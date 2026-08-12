/**
 * Google Drive Centralized Storage Service (Single Source of Truth)
 * ===================================================================
 * يوفر طبقة تخزين مركزية تعتمد كلياً على Google Drive كمصدر الحقيقة الوحيد والأساسي.
 * يحل مشكلة الـ Ephemeral Storage والـ Serverless Architecture على Vercel و Render.
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { User, Customer, Activity, AppTask, AppNotification } from '../types.js';

export interface LocalDB {
  sheetConfig: {
    sheetUrl: string;
    sheetId: string;
    autoSync: boolean;
  };
  users: User[];
  customers: Customer[];
  activities: Activity[];
  tasks?: AppTask[];
  notifications?: AppNotification[];
  archivedRecords?: Customer[];
  backupConfig?: any;
  backupAuditLogs?: any[];
}

// Configuration
const DRIVE_FOLDER_NAME = 'CRM_SYSTEM_DATA';
const DB_FILENAME = 'db.json';
const USERS_FILENAME = 'users.json';
const CLIENTS_FILENAME = 'clients.json';
const CALLS_FILENAME = 'calls.json';
const ACTIVITIES_FILENAME = 'activities.json';
const TASKS_FILENAME = 'tasks.json';
const SETTINGS_FILENAME = 'settings.json';

// Internal State
let driveClient: ReturnType<typeof google.drive> | null = null;
let driveFolderId: string | null = null;
let isDriveInitialized = false;
let driveInitError: string | null = null;

const fileIdCache: Record<string, string> = {};

/**
 * Initialize Google Drive Client using Environment Variables or Service Account
 */
export async function initGoogleDriveStorage(): Promise<boolean> {
  try {
    let credentials: any = null;

    // Priority 1: Environment variable GOOGLE_SERVICE_ACCOUNT_JSON (Production / Vercel)
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      try {
        let rawEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON.trim();
        if ((rawEnv.startsWith("'") && rawEnv.endsWith("'")) || (rawEnv.startsWith('"') && rawEnv.endsWith('"'))) {
          rawEnv = rawEnv.slice(1, -1);
        }
        credentials = JSON.parse(rawEnv);
        console.log('✅ GoogleDriveStorage: Loaded credentials from GOOGLE_SERVICE_ACCOUNT_JSON env var.');
      } catch (e1) {
        try {
          const sanitized = process.env.GOOGLE_SERVICE_ACCOUNT_JSON.replace(/[\r\n]+/g, '\\n');
          credentials = JSON.parse(sanitized);
          console.log('✅ GoogleDriveStorage: Loaded credentials using sanitized newline fallback.');
        } catch (e2) {
          console.error('❌ GoogleDriveStorage: Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON env var:', (e2 as any)?.message);
        }
      }
    }

    // Priority 2: Local service-account.json file
    if (!credentials) {
      const localKeyPath = path.join(process.cwd(), 'service-account.json');
      if (fs.existsSync(localKeyPath)) {
        try {
          const raw = fs.readFileSync(localKeyPath, 'utf-8');
          credentials = JSON.parse(raw);
          console.log('✅ GoogleDriveStorage: Loaded credentials from service-account.json file.');
        } catch (e) {
          console.error('❌ GoogleDriveStorage: Error reading service-account.json:', e);
        }
      }
    }

    if (!credentials) {
      driveInitError = 'لم يتم العثور على بيانات Service Account. يرجى تعيين GOOGLE_SERVICE_ACCOUNT_JSON على Vercel أو وضع service-account.json في مجلد المشروع.';
      console.warn('⚠️ GoogleDriveStorage: ' + driveInitError);
      return false;
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    driveClient = google.drive({ version: 'v3', auth });

    // Verify connectivity
    await driveClient.files.list({ pageSize: 1, fields: 'files(id)' });

    // Ensure folder exists
    driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || null;
    if (!driveFolderId) {
      driveFolderId = await ensureDriveFolder();
    }

    isDriveInitialized = true;
    driveInitError = null;
    console.log(`✅ GoogleDriveStorage Initialized! Main Folder: "${DRIVE_FOLDER_NAME}" (ID: ${driveFolderId})`);

    // Perform initial data migration if Drive is empty but local legacy data exists
    await checkAndMigrateInitialData();

    return true;
  } catch (err: any) {
    driveInitError = err.message || String(err);
    isDriveInitialized = false;
    console.error('❌ GoogleDriveStorage initialization failed:', driveInitError);
    return false;
  }
}

export function getDriveStorageStatus(): { initialized: boolean; folderId: string | null; error: string | null } {
  return {
    initialized: isDriveInitialized,
    folderId: driveFolderId,
    error: driveInitError
  };
}

/**
 * Ensure CRM_SYSTEM_DATA folder exists in Google Drive
 */
async function ensureDriveFolder(): Promise<string> {
  if (!driveClient) throw new Error('Drive client not initialized');

  const searchRes = await driveClient.files.list({
    q: `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (searchRes.data.files && searchRes.data.files.length > 0) {
    const folderId = searchRes.data.files[0].id!;
    return folderId;
  }

  const createRes = await driveClient.files.create({
    requestBody: {
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });

  return createRes.data.id!;
}

/**
 * Helper to find file ID by name inside CRM_SYSTEM_DATA folder
 */
async function findFileId(filename: string): Promise<string | null> {
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
    console.error(`❌ GoogleDriveStorage: Error finding file "${filename}":`, err);
  }
  return null;
}

/**
 * Generic Read File from Drive with Automatic Retry & Backoff
 */
export async function readFileFromDrive(filename: string, retries = 3): Promise<string | null> {
  if (!isDriveInitialized || !driveClient) return null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const fileId = await findFileId(filename);
      if (!fileId) return null;

      const res = await driveClient.files.get(
        { fileId, alt: 'media' },
        { responseType: 'text' }
      );

      const content = res.data as string;
      return content;
    } catch (err: any) {
      console.error(`❌ GoogleDriveStorage: Read error "${filename}" (Attempt ${attempt}/${retries}):`, err.message);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, attempt * 1000));
      }
    }
  }
  return null;
}

/**
 * Generic Write File to Drive with Automatic Retry & Backoff
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
          media: { mimeType: 'application/json', body: mediaBody },
        });
      } else {
        const createRes = await driveClient.files.create({
          requestBody: { name: filename, parents: [driveFolderId] },
          media: { mimeType: 'application/json', body: mediaBody },
          fields: 'id',
        });
        if (createRes.data.id) fileIdCache[filename] = createRes.data.id;
      }
      return true;
    } catch (err: any) {
      console.error(`❌ GoogleDriveStorage: Write error "${filename}" (Attempt ${attempt}/${retries}):`, err.message);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, attempt * 1000));
      }
    }
  }
  return false;
}

// ===================== HIGH LEVEL DOMAIN STORAGE FUNCTIONS =====================

/**
 * Read full database snapshot from Google Drive
 */
export async function getFullDatabase(): Promise<LocalDB | null> {
  const content = await readFileFromDrive(DB_FILENAME);
  if (!content) return null;
  try {
    return JSON.parse(content) as LocalDB;
  } catch (e) {
    console.error('❌ GoogleDriveStorage: Failed to parse db.json from Drive');
    return null;
  }
}

/**
 * Save full database snapshot to Google Drive
 */
export async function saveFullDatabase(db: LocalDB): Promise<boolean> {
  const content = JSON.stringify(db, null, 2);
  const success = await writeFileToDrive(DB_FILENAME, content);
  if (success) {
    // Also save modular users.json and clients.json for clean organization
    if (db.users) writeFileToDrive(USERS_FILENAME, JSON.stringify(db.users, null, 2)).catch(() => {});
    if (db.customers) writeFileToDrive(CLIENTS_FILENAME, JSON.stringify(db.customers, null, 2)).catch(() => {});
    if (db.activities) writeFileToDrive(ACTIVITIES_FILENAME, JSON.stringify(db.activities, null, 2)).catch(() => {});
    if (db.tasks) writeFileToDrive(TASKS_FILENAME, JSON.stringify(db.tasks, null, 2)).catch(() => {});
    if (db.sheetConfig) writeFileToDrive(SETTINGS_FILENAME, JSON.stringify(db.sheetConfig, null, 2)).catch(() => {});
  }
  return success;
}

export async function getUsers(): Promise<User[]> {
  const content = await readFileFromDrive(USERS_FILENAME);
  if (content) {
    try {
      return JSON.parse(content);
    } catch (e) {}
  }
  const db = await getFullDatabase();
  return db?.users || [];
}

export async function saveUsers(users: User[]): Promise<boolean> {
  const content = JSON.stringify(users, null, 2);
  const okUsers = await writeFileToDrive(USERS_FILENAME, content);
  // Keep db.json in sync
  const db = await getFullDatabase();
  if (db) {
    db.users = users;
    await saveFullDatabase(db);
  }
  return okUsers;
}

export async function getClients(): Promise<Customer[]> {
  const content = await readFileFromDrive(CLIENTS_FILENAME);
  if (content) {
    try {
      return JSON.parse(content);
    } catch (e) {}
  }
  const db = await getFullDatabase();
  return db?.customers || [];
}

export async function saveClients(clients: Customer[]): Promise<boolean> {
  const content = JSON.stringify(clients, null, 2);
  const okClients = await writeFileToDrive(CLIENTS_FILENAME, content);
  const db = await getFullDatabase();
  if (db) {
    db.customers = clients;
    await saveFullDatabase(db);
  }
  return okClients;
}

export async function getActivities(): Promise<Activity[]> {
  const content = await readFileFromDrive(ACTIVITIES_FILENAME);
  if (content) {
    try {
      return JSON.parse(content);
    } catch (e) {}
  }
  const db = await getFullDatabase();
  return db?.activities || [];
}

export async function saveActivities(activities: Activity[]): Promise<boolean> {
  const content = JSON.stringify(activities, null, 2);
  const okAct = await writeFileToDrive(ACTIVITIES_FILENAME, content);
  const db = await getFullDatabase();
  if (db) {
    db.activities = activities;
    await saveFullDatabase(db);
  }
  return okAct;
}

export async function getTasks(): Promise<AppTask[]> {
  const content = await readFileFromDrive(TASKS_FILENAME);
  if (content) {
    try {
      return JSON.parse(content);
    } catch (e) {}
  }
  const db = await getFullDatabase();
  return db?.tasks || [];
}

export async function saveTasks(tasks: AppTask[]): Promise<boolean> {
  const content = JSON.stringify(tasks, null, 2);
  const okTask = await writeFileToDrive(TASKS_FILENAME, content);
  const db = await getFullDatabase();
  if (db) {
    db.tasks = tasks;
    await saveFullDatabase(db);
  }
  return okTask;
}

export async function getSettings(): Promise<any> {
  const content = await readFileFromDrive(SETTINGS_FILENAME);
  if (content) {
    try {
      return JSON.parse(content);
    } catch (e) {}
  }
  const db = await getFullDatabase();
  return db?.sheetConfig || {};
}

export async function saveSettings(settings: any): Promise<boolean> {
  const content = JSON.stringify(settings, null, 2);
  const okSet = await writeFileToDrive(SETTINGS_FILENAME, content);
  const db = await getFullDatabase();
  if (db) {
    db.sheetConfig = settings;
    await saveFullDatabase(db);
  }
  return okSet;
}

/**
 * Migration check: If Google Drive is empty, migrate existing local data/db.json & data/users.json to Drive.
 */
async function checkAndMigrateInitialData(): Promise<void> {
  try {
    const existingDbInDrive = await getFullDatabase();
    if (existingDbInDrive && (existingDbInDrive.customers?.length > 0 || existingDbInDrive.users?.length > 0)) {
      console.log(`📦 GoogleDriveStorage: Existing data found in Drive (${existingDbInDrive.customers?.length || 0} customers, ${existingDbInDrive.users?.length || 0} users). Migration skipped.`);
      return;
    }

    // Check local fallback files
    const dataDir = path.join(process.cwd(), 'data');
    const localDbPath = path.join(dataDir, 'db.json');
    const localUsersPath = path.join(dataDir, 'users.json');

    let localDb: LocalDB | null = null;
    let localUsers: User[] = [];

    if (fs.existsSync(localDbPath)) {
      try {
        localDb = JSON.parse(fs.readFileSync(localDbPath, 'utf-8'));
      } catch (e) {}
    }
    if (fs.existsSync(localUsersPath)) {
      try {
        localUsers = JSON.parse(fs.readFileSync(localUsersPath, 'utf-8'));
      } catch (e) {}
    }

    if (localDb || localUsers.length > 0) {
      console.log('🚀 GoogleDriveStorage: Migrating local data to Google Drive for the first time...');
      const mergedUsersMap = new Map<string, User>();
      (localDb?.users || []).forEach(u => mergedUsersMap.set(u.email.toLowerCase(), u));
      localUsers.forEach(u => mergedUsersMap.set(u.email.toLowerCase(), u));

      const mergedDb: LocalDB = {
        sheetConfig: localDb?.sheetConfig || { sheetUrl: '', sheetId: '', autoSync: false },
        users: Array.from(mergedUsersMap.values()),
        customers: localDb?.customers || [],
        activities: localDb?.activities || [],
        tasks: localDb?.tasks || [],
        notifications: localDb?.notifications || [],
        archivedRecords: localDb?.archivedRecords || [],
        backupConfig: localDb?.backupConfig || {},
        backupAuditLogs: localDb?.backupAuditLogs || []
      };

      const migrated = await saveFullDatabase(mergedDb);
      if (migrated) {
        console.log(`✅ GoogleDriveStorage: Initial Migration Successful! (${mergedDb.customers.length} customers, ${mergedDb.users.length} users saved to Drive).`);
      }
    }
  } catch (err) {
    console.error('⚠️ GoogleDriveStorage: Error during initial data migration:', err);
  }
}
