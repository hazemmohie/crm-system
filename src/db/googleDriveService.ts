/**
 * Google Drive Persistent Storage Service
 * =========================================
 * يستخدم Google Drive API لتخزين بيانات النظام (db.json و users.json) بشكل دائم.
 * يحل مشكلة فقدان البيانات عند إعادة تشغيل السيرفر (ephemeral filesystem).
 *
 * طريقة المصادقة: Service Account JSON
 * ملف البيانات المُستهدَف في Drive: CRM_Data/db.json و CRM_Data/users.json
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

// ===================== CONFIGURATION =====================
const DRIVE_FOLDER_NAME = 'CRM_Production_Data';
const DB_FILENAME = 'db.json';
const USERS_FILENAME = 'users.json';

// ===================== STATE =====================
let driveClient: ReturnType<typeof google.drive> | null = null;
let driveFolderId: string | null = null;
let isDriveInitialized = false;
let driveInitError: string | null = null;

// Cache للـ file IDs لتجنب البحث المتكرر
const fileIdCache: Record<string, string> = {};

// ===================== INITIALIZATION =====================

/**
 * تهيئة عميل Google Drive من متغيرات البيئة أو ملف Service Account
 */
export async function initGoogleDrive(): Promise<boolean> {
  try {
    let credentials: any = null;

    // الأولوية 1: متغير البيئة GOOGLE_SERVICE_ACCOUNT_JSON
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      try {
        credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        console.log('✅ Google Drive: Loaded credentials from GOOGLE_SERVICE_ACCOUNT_JSON env var.');
      } catch (e) {
        console.error('❌ Google Drive: Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON env var.');
      }
    }

    // الأولوية 2: ملف service-account.json في مجلد المشروع
    if (!credentials) {
      const localKeyPath = path.join(process.cwd(), 'service-account.json');
      if (fs.existsSync(localKeyPath)) {
        const raw = fs.readFileSync(localKeyPath, 'utf-8');
        credentials = JSON.parse(raw);
        console.log('✅ Google Drive: Loaded credentials from service-account.json file.');
      }
    }

    if (!credentials) {
      driveInitError = 'لم يتم العثور على بيانات Service Account. يرجى تعيين GOOGLE_SERVICE_ACCOUNT_JSON أو وضع service-account.json في مجلد المشروع.';
      console.warn('⚠️ Google Drive: ' + driveInitError);
      return false;
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    driveClient = google.drive({ version: 'v3', auth });

    // تأكيد الاتصال عبر قائمة الملفات
    await driveClient.files.list({ pageSize: 1, fields: 'files(id)' });

    // إيجاد أو إنشاء الفولدر المخصص
    driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || null;
    if (!driveFolderId) {
      driveFolderId = await ensureDriveFolder();
    }

    isDriveInitialized = true;
    driveInitError = null;
    console.log(`✅ Google Drive Storage initialized! Folder: "${DRIVE_FOLDER_NAME}" (ID: ${driveFolderId})`);
    return true;
  } catch (err: any) {
    driveInitError = err.message || String(err);
    isDriveInitialized = false;
    console.error('❌ Google Drive initialization failed:', driveInitError);
    return false;
  }
}

export function getDriveStatus(): { initialized: boolean; folderId: string | null; error: string | null } {
  return {
    initialized: isDriveInitialized,
    folderId: driveFolderId,
    error: driveInitError
  };
}

// ===================== FOLDER MANAGEMENT =====================

/**
 * إيجاد الفولدر CRM_Production_Data في Drive أو إنشاؤه تلقائياً
 */
async function ensureDriveFolder(): Promise<string> {
  if (!driveClient) throw new Error('Drive client not initialized');

  // البحث عن الفولدر أولاً
  const searchRes = await driveClient.files.list({
    q: `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (searchRes.data.files && searchRes.data.files.length > 0) {
    const folderId = searchRes.data.files[0].id!;
    console.log(`📂 Google Drive: Found existing folder "${DRIVE_FOLDER_NAME}" (ID: ${folderId})`);
    return folderId;
  }

  // إنشاء الفولدر إذا لم يوجد
  const createRes = await driveClient.files.create({
    requestBody: {
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });

  const newFolderId = createRes.data.id!;
  console.log(`📂 Google Drive: Created new folder "${DRIVE_FOLDER_NAME}" (ID: ${newFolderId})`);
  return newFolderId;
}

// ===================== FILE OPERATIONS =====================

/**
 * البحث عن ملف بالاسم في الفولدر المحدد
 */
async function findFileId(filename: string): Promise<string | null> {
  // استخدام الـ cache أولاً
  if (fileIdCache[filename]) return fileIdCache[filename];
  if (!driveClient || !driveFolderId) return null;

  try {
    const res = await driveClient.files.list({
      q: `name='${filename}' and '${driveFolderId}' in parents and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (res.data.files && res.data.files.length > 0) {
      const fileId = res.data.files[0].id!;
      fileIdCache[filename] = fileId;
      return fileId;
    }
  } catch (err) {
    console.error(`❌ Google Drive: Error searching for file "${filename}":`, err);
  }
  return null;
}

/**
 * قراءة محتوى ملف من Google Drive مع المحاولة التلقائية (Retry with backoff)
 */
export async function readFileFromDrive(filename: string, retries = 3): Promise<string | null> {
  if (!isDriveInitialized || !driveClient) return null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const fileId = await findFileId(filename);
      if (!fileId) {
        console.log(`ℹ️ Google Drive: File "${filename}" not found in Drive (first run?)`);
        return null;
      }

      const res = await driveClient.files.get(
        { fileId, alt: 'media' },
        { responseType: 'text' }
      );

      const content = res.data as string;
      console.log(`☁️ Google Drive: Successfully read "${filename}" (${content.length} bytes)`);
      return content;
    } catch (err: any) {
      console.error(`❌ Google Drive: Error reading file "${filename}" (Attempt ${attempt}/${retries}):`, err.message);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, attempt * 1000));
      }
    }
  }
  return null;
}

/**
 * كتابة/تحديث ملف على Google Drive (Create أو Update) مع المحاولة التلقائية (Retry with backoff)
 */
export async function writeFileToDrive(filename: string, content: string, retries = 3): Promise<boolean> {
  if (!isDriveInitialized || !driveClient || !driveFolderId) return false;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const fileId = await findFileId(filename);
      const mediaBody = new Readable();
      mediaBody.push(content, 'utf-8');
      mediaBody.push(null);

      if (fileId) {
        await driveClient.files.update({
          fileId,
          media: {
            mimeType: 'application/json',
            body: mediaBody,
          },
        });
      } else {
        const createRes = await driveClient.files.create({
          requestBody: {
            name: filename,
            parents: [driveFolderId],
          },
          media: {
            mimeType: 'application/json',
            body: mediaBody,
          },
          fields: 'id',
        });

        if (createRes.data.id) {
          fileIdCache[filename] = createRes.data.id;
        }
      }

      console.log(`☁️ Google Drive: Successfully saved "${filename}" (${content.length} bytes)`);
      return true;
    } catch (err: any) {
      console.error(`❌ Google Drive: Error writing file "${filename}" (Attempt ${attempt}/${retries}):`, err.message);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, attempt * 1000));
      }
    }
  }
  return false;
}

/**
 * قراءة db.json من Google Drive
 */
export async function readDbFromDrive(): Promise<any | null> {
  const content = await readFileFromDrive(DB_FILENAME);
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch (e) {
    console.error('❌ Google Drive: Failed to parse db.json from Drive');
    return null;
  }
}

/**
 * كتابة db.json على Google Drive
 */
export async function writeDbToDrive(data: any): Promise<boolean> {
  const content = JSON.stringify(data, null, 2);
  return writeFileToDrive(DB_FILENAME, content);
}

/**
 * قراءة users.json من Google Drive
 */
export async function readUsersFromDrive(): Promise<any[] | null> {
  const content = await readFileFromDrive(USERS_FILENAME);
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    console.error('❌ Google Drive: Failed to parse users.json from Drive');
    return null;
  }
}

/**
 * كتابة users.json على Google Drive
 */
export async function writeUsersToDrive(users: any[]): Promise<boolean> {
  const content = JSON.stringify(users, null, 2);
  return writeFileToDrive(USERS_FILENAME, content);
}

/**
 * إنشاء نسخة احتياطية في Google Drive بتاريخ محدد
 */
export async function createDriveBackup(data: any, label: string = 'auto'): Promise<boolean> {
  if (!isDriveInitialized || !driveClient || !driveFolderId) return false;

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `backup_crm_${label}_${timestamp}.json`;
    const content = JSON.stringify({
      backupAt: new Date().toISOString(),
      label,
      data
    }, null, 2);

    const mediaBody = new Readable();
    mediaBody.push(content, 'utf-8');
    mediaBody.push(null);

    await driveClient.files.create({
      requestBody: {
        name: backupFilename,
        parents: [driveFolderId],
      },
      media: {
        mimeType: 'application/json',
        body: mediaBody,
      },
    });

    console.log(`📦 Google Drive: Backup created: "${backupFilename}"`);
    return true;
  } catch (err: any) {
    console.error('❌ Google Drive: Failed to create backup:', err.message);
    return false;
  }
}
