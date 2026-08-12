import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { User, Customer, GoogleSheetConfig, CustomerStatus, Activity, AppTask, AppNotification, AiAgentPermissions, AiAgentPendingAction } from './src/types.js';
import {
  initGoogleDriveStorage,
  getDriveStorageStatus,
  getFullDatabase,
  saveFullDatabase,
  getUsers,
  saveUsers,
  getClients,
  saveClients,
  getActivities,
  saveActivities,
  getTasks,
  saveTasks,
  getSettings,
  saveSettings
} from './src/db/googleDriveStorageService.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Secure password hashing helper (PBKDF2/SHA256)
function hashPassword(password: string): string {
  if (!password) return '';
  if (password.startsWith('pbkdf2$')) return password;
  const salt = 'crm_system_salt_2026';
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 32, 'sha256').toString('hex');
  return `pbkdf2$${hash}`;
}

function verifyPassword(password: string, storedHash?: string): boolean {
  if (!password || !storedHash) return false;
  if (storedHash === password) return true; // Legacy fallback for plaintext migration
  const hashed = hashPassword(password);
  return hashed === storedHash;
}

// File-based fallback directory (temporary local cache only)
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function saveUsersOnly(users: User[]) {
  try {
    ensureUserCodesAndCredentials(users);
    saveUsers(users).catch(e => console.error('Error in saveUsers Google Drive sync:', e));
  } catch (err) {
    console.error('Error saving users:', err);
  }
}

function loadUsersOnly(): User[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error reading users file:', e);
  }
  return [];
}

function mergeUsers(userLists: User[][]): User[] {
  const userMap = new Map<string, User>();

  userLists.forEach(list => {
    if (!Array.isArray(list)) return;
    list.forEach(u => {
      if (!u || typeof u !== 'object') return;
      const emailKey = (u.email || '').trim().toLowerCase();
      const usernameKey = (u.username || '').trim().toLowerCase();
      const idKey = (u.id || '').trim();

      const key = emailKey || usernameKey || idKey;
      if (!key) return;

      if (!userMap.has(key)) {
        userMap.set(key, { ...u });
      } else {
        const existing = userMap.get(key)!;
        userMap.set(key, {
          ...existing,
          ...u,
          status: existing.status === 'approved' ? 'approved' : (u.status || existing.status),
          role: existing.role === 'admin' ? 'admin' : (u.role || existing.role),
          password: existing.password || u.password,
          userCode: existing.userCode || u.userCode,
          username: existing.username || u.username,
          name: existing.name || u.name
        });
      }
    });
  });

  return Array.from(userMap.values());
}

interface LocalDB {
  users: User[];
  customers: Customer[];
  sheetConfig: GoogleSheetConfig;
  activities: Activity[];
  tasks: AppTask[];
  notifications: AppNotification[];
  aiPermissions: AiAgentPermissions;
  aiPendingActions: AiAgentPendingAction[];
  archivedRecords?: Customer[];
  backupAuditLogs?: any[];
  backupConfig?: any;
}

const DEFAULT_ADMIN_EMAIL = 'hazemmohie8@gmail.com';
const DEFAULT_ADMIN_PASSWORD = 'hazem2026';

// Temporary store for Google Gateway OTP codes
const activeOtps: Record<string, { code: string; expiresAt: number }> = {};

function initialDB(): LocalDB {
  return {
    users: [
      {
        id: 'admin-1',
        email: DEFAULT_ADMIN_EMAIL,
        name: 'حازم محي (المسؤول)',
        role: 'admin',
        status: 'approved',
        password: DEFAULT_ADMIN_PASSWORD,
        createdAt: new Date().toISOString(),
        agreedToTerms: true,
        agreedAt: new Date().toISOString()
      }
    ],
    customers: [],
    sheetConfig: {
      sheetUrl: '',
      sheetId: '',
      autoSync: false
    },
    activities: [],
    tasks: [],
    notifications: [],
    aiPermissions: {
      allowReadDatabase: true,
      allowDetectAnomalies: true,
      allowCreateTasks: true,
      allowSendNotifications: true,
      allowReassignLeads: true,
      allowModifyUserRoles: true,
      executionMode: 'auto',
      restrictScopeToWebAppOnly: true
    },
    aiPendingActions: []
  };
}

function assignRefCodesToCustomers(customers: Customer[]) {
  if (!customers || !Array.isArray(customers)) return;
  let maxCP = 0;
  let maxOW = 0;
  let maxLD = 0;

  // 1. Calculate max existing numbers
  customers.forEach(c => {
    if (c.refCode) {
      if (c.refCode.startsWith('CP-')) {
        const num = parseInt(c.refCode.replace('CP-', ''), 10);
        if (!isNaN(num) && num > maxCP) maxCP = num;
      } else if (c.refCode.startsWith('OW-')) {
        const num = parseInt(c.refCode.replace('OW-', ''), 10);
        if (!isNaN(num) && num > maxOW) maxOW = num;
      } else if (c.refCode.startsWith('LD-')) {
        const num = parseInt(c.refCode.replace('LD-', ''), 10);
        if (!isNaN(num) && num > maxLD) maxLD = num;
      }
    }
  });

  // 2. Assign missing refCodes
  customers.forEach(c => {
    if (!c.refCode) {
      const isCampaign = c.leadSource === 'paid_ad' || !!c.campaignName || c.leadSource === 'social_media';
      const isOwner = c.category === 'owner';

      if (isCampaign) {
        maxCP++;
        c.refCode = `CP-${String(maxCP).padStart(3, '0')}`;
      } else if (isOwner) {
        maxOW++;
        c.refCode = `OW-${String(maxOW).padStart(3, '0')}`;
      } else {
        maxLD++;
        c.refCode = `LD-${String(maxLD).padStart(3, '0')}`;
      }
    }
  });
}

function ensureUserCodesAndCredentials(users: User[]) {
  if (!users || !Array.isArray(users)) return;

  let maxCode = 100;
  users.forEach(u => {
    if (u.userCode && u.userCode.startsWith('EMP-')) {
      const num = parseInt(u.userCode.replace('EMP-', ''), 10);
      if (!isNaN(num) && num > maxCode) maxCode = num;
    }
  });

  users.forEach(u => {
    const isMainAdmin = u.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase();

    // Assign UserCode if missing
    if (!u.userCode) {
      if (isMainAdmin) {
        u.userCode = 'EMP-001';
      } else {
        maxCode++;
        u.userCode = `EMP-${String(maxCode).padStart(3, '0')}`;
      }
    }

    // Assign username if missing
    if (!u.username) {
      if (isMainAdmin) {
        u.username = 'admin';
      } else if (u.email && u.email.includes('@')) {
        u.username = u.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
      } else {
        u.username = `emp_${u.userCode.toLowerCase().replace('-', '')}`;
      }
    }

    // Set default password if missing
    if (!u.password) {
      u.password = isMainAdmin ? '123456' : '123456';
    }
  });
}

let cachedDB: LocalDB | null = null;
let db: LocalDB = initialDB();
let isDataInitialized = false;

function sanitizeAndEnsureDB(loaded: any): LocalDB {
  if (!loaded.users) loaded.users = [];
  if (!loaded.customers) loaded.customers = [];
  if (!loaded.activities) loaded.activities = [];
  if (!loaded.sheetConfig) loaded.sheetConfig = { sheetUrl: '', sheetId: '', autoSync: false };
  if (!loaded.tasks) loaded.tasks = [];
  if (!loaded.notifications) loaded.notifications = [];
  if (!loaded.aiPendingActions) loaded.aiPendingActions = [];
  if (!loaded.archivedRecords) loaded.archivedRecords = [];
  if (!loaded.backupAuditLogs) loaded.backupAuditLogs = [];
  if (!loaded.backupConfig) {
    loaded.backupConfig = {
      lastBackupAt: undefined,
      nextBackupAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      backupScheduleDays: 3,
      autoBackupEnabled: true,
      autoArchiveEnabled: true,
      retentionDays: 60,
      lastBackupStatus: 'مجدول وقيد الانتظار',
      lastBackupFolder: 'Production CRM Backups/'
    };
  }
  if (!loaded.aiPermissions) {
    loaded.aiPermissions = {
      allowReadDatabase: true,
      allowDetectAnomalies: true,
      allowCreateTasks: true,
      allowSendNotifications: true,
      allowReassignLeads: true,
      allowModifyUserRoles: true,
      executionMode: 'auto',
      restrictScopeToWebAppOnly: true
    };
  } else {
    // Ensure restrictScopeToWebAppOnly is strictly true
    loaded.aiPermissions.restrictScopeToWebAppOnly = true;
  }

  // Guarantee permanent retention: merge existing users with isolated user storage
  const isolatedUsers = loadUsersOnly();
  loaded.users = mergeUsers([loaded.users || [], isolatedUsers]);

  // Keep all valid user accounts permanently - only filter out null or broken objects
  loaded.users = loaded.users.filter((u: any) => u && (u.email || u.username || u.id));
  loaded.customers = loaded.customers.filter((c: any) => c && !c.id.startsWith('cust-100'));

  // Ensure explicit access rights and protection metadata for every customer
  loaded.customers.forEach((c: any) => {
    c.isProtected = true;
    if (c.assignedToEmail && String(c.assignedToEmail).trim() !== '') {
      const cleanEmail = String(c.assignedToEmail).trim().toLowerCase();
      c.assignedToEmail = cleanEmail;
      c.protectionRole = 'assigned';
      c.accessRights = Array.from(new Set(['admin', 'supervisor', cleanEmail]));
      c.ownerEmail = cleanEmail;
    } else {
      c.assignedToEmail = null;
      c.protectionRole = 'unassigned_pool';
      c.accessRights = ['admin', 'supervisor'];
      c.ownerEmail = c.createdByEmail || DEFAULT_ADMIN_EMAIL;
    }
  });

  // Ensure explicit access rights for tasks
  loaded.tasks.forEach((t: any) => {
    t.isProtected = true;
    if (!t.accessRights) {
      t.accessRights = Array.from(new Set(['admin', 'supervisor', (t.assignedToEmail || '').toLowerCase()].filter(Boolean)));
    }
  });

  // Ensure explicit access rights for archived records
  loaded.archivedRecords.forEach((a: any) => {
    a.isProtected = true;
    if (!a.accessRights) {
      a.accessRights = ['admin', 'supervisor'];
    }
  });

  // Assign refCodes to all loaded customers
  assignRefCodesToCustomers(loaded.customers);

  // Ensure main admin exists
  const hasAdmin = loaded.users.some((u: any) => u.email && u.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase());
  if (!hasAdmin) {
    loaded.users.push({
      id: 'admin-1',
      email: DEFAULT_ADMIN_EMAIL,
      username: 'admin',
      userCode: 'EMP-001',
      password: DEFAULT_ADMIN_PASSWORD,
      name: 'حازم محي (المسؤول)',
      role: 'admin',
      status: 'approved',
      createdAt: new Date().toISOString(),
      agreedToTerms: true,
      agreedAt: new Date().toISOString()
    });
  }

  // Ensure user codes and credentials
  ensureUserCodesAndCredentials(loaded.users);

  // Sync back to users file
  saveUsersOnly(loaded.users);

  return loaded;
}

function loadDB(): LocalDB {
  if (cachedDB) {
    return cachedDB;
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const loaded: LocalDB = JSON.parse(data);
      cachedDB = sanitizeAndEnsureDB(loaded);
      return cachedDB;
    }
  } catch (e) {
    console.error('Error reading local DB file:', e);
  }

  cachedDB = sanitizeAndEnsureDB(initialDB());
  // Save local file only on cold start, do NOT overwrite Firestore until startServer completes!
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(cachedDB, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing initial local DB file:', e);
  }
  return cachedDB;
}

async function syncAndLoadData(): Promise<LocalDB> {
  const status = getDriveStorageStatus();
  if (!status.initialized) {
    await initGoogleDriveStorage();
  }
  const driveDb = await getFullDatabase();
  if (driveDb) {
    db = sanitizeAndEnsureDB(driveDb);
    cachedDB = db;
    isDataInitialized = true;
    return db;
  }
  return db;
}

// Vercel Serverless & API initialization middleware
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api')) {
    try {
      const status = getDriveStorageStatus();
      if (!status.initialized || !isDataInitialized) {
        await syncAndLoadData();
      }
    } catch (err) {
      console.error('Error in API storage sync middleware:', err);
    }
  }
  next();
});

async function saveDBAsync(data: LocalDB): Promise<boolean> {
  cachedDB = data;
  db = data;

  const driveStatus = getDriveStorageStatus();
  if (driveStatus.initialized) {
    const success = await saveFullDatabase(data);
    if (!success) {
      console.error('❌ Google Drive Save Failed: Write operation failed.');
      return false;
    }
    return true;
  }

  // Best effort local cache for local dev fallback
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {}

  return true;
}

function saveDB(data: LocalDB) {
  saveDBAsync(data).catch(err => {
    console.error('Background saveDBAsync error:', err);
  });
}

const BACKUPS_DIR = path.join(process.cwd(), 'data', 'backups');

function runBackupAndArchiveCycle(triggeredBy: string = 'النظام الآلي', performArchiving: boolean = true) {
  const database = loadDB();
  const startTime = new Date().toISOString();

  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const folderName = `Production CRM Backups/${new Date().toISOString().split('T')[0]}`;
    const filename = `backup_crm_${dateStr}.json`;
    const filePath = path.join(BACKUPS_DIR, filename);

    // 1. Create full snapshot JSON
    const snapshotData = {
      version: '1.0.0',
      exportedAt: startTime,
      triggeredBy,
      folderPath: folderName,
      users: database.users,
      customers: database.customers,
      sheetConfig: database.sheetConfig,
      activities: database.activities,
      tasks: database.tasks || [],
      notifications: database.notifications || [],
      archivedRecords: database.archivedRecords || []
    };

    const snapshotJSON = JSON.stringify(snapshotData, null, 2);
    fs.writeFileSync(filePath, snapshotJSON, 'utf-8');

    // 2. VERIFICATION STEP
    // Read back file and parse JSON to confirm readability and record integrity
    const readBack = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(readBack);

    const isUsersValid = Array.isArray(parsed.users) && parsed.users.length >= database.users.length;
    const isCustomersValid = Array.isArray(parsed.customers) && parsed.customers.length >= database.customers.length;
    const isActivitiesValid = Array.isArray(parsed.activities);

    if (!isUsersValid || !isCustomersValid || !isActivitiesValid) {
      const errReason = 'فشل التحقق من تطابق وحجم البيانات في ملف النسخة الاحتياطية';
      console.error('❌ Backup Verification Failed:', errReason);

      const failLog = {
        id: 'bk-log-' + Date.now(),
        timestamp: startTime,
        triggeredBy,
        backupFolder: folderName,
        fileName: filename,
        recordsCount: 0,
        archivedCount: 0,
        status: 'FAILED',
        errorDetails: errReason,
        verificationStatus: 'غير متطابق / تالف ❌'
      };
      if (!database.backupAuditLogs) database.backupAuditLogs = [];
      database.backupAuditLogs.unshift(failLog);

      if (!database.backupConfig) database.backupConfig = {};
      database.backupConfig.lastBackupStatus = 'فشل التحقق والإنشاء';
      database.backupConfig.lastFailedBackupAt = startTime;

      saveDB(database);
      return { success: false, error: errReason, log: failLog };
    }

    // 3. ARCHIVING STEP (Executed ONLY AFTER Successful Verification)
    let archivedThisRun = 0;
    if (performArchiving && database.backupConfig?.autoArchiveEnabled !== false) {
      const retentionDays = database.backupConfig?.retentionDays || 60;
      const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

      // Identify eligible inactive customers (converted/not_interested older than retention period)
      // CRITICAL DIRECTIVE: NEVER ARCHIVE OR DELETE USER ACCOUNTS (EMPLOYEES ARE 100% PERMANENT)
      const activeCustomers: typeof database.customers = [];
      if (!database.archivedRecords) database.archivedRecords = [];

      database.customers.forEach(cust => {
        const isClosedOrOld = cust.status === 'converted' || cust.status === 'not_interested';
        const createdAtTime = new Date(cust.createdAt || Date.now()).getTime();
        const isEligibleForArchive = isClosedOrOld && createdAtTime < cutoffTime;

        if (isEligibleForArchive) {
          database.archivedRecords!.push({
            ...cust,
            isArchived: true,
            archivedAt: new Date().toISOString()
          });
          archivedThisRun++;
        } else {
          activeCustomers.push(cust);
        }
      });

      database.customers = activeCustomers;
    }

    // 4. UPDATE BACKUP CONFIG & AUDIT LOGS
    const nextBackupDate = new Date();
    nextBackupDate.setDate(nextBackupDate.getDate() + 3);
    nextBackupDate.setHours(0, 0, 0, 0);

    database.backupConfig = {
      ...database.backupConfig,
      lastBackupAt: startTime,
      nextBackupAt: nextBackupDate.toISOString(),
      backupScheduleDays: 3,
      autoBackupEnabled: true,
      autoArchiveEnabled: true,
      retentionDays: 60,
      lastBackupStatus: 'تم الإنشاء والتحقق بنجاح 100%',
      lastBackupFolder: folderName,
      lastBackupFileName: filename,
      lastBackupSizeBytes: fs.statSync(filePath).size,
      archivedRecordsCount: database.archivedRecords?.length || 0
    };

    const successLog = {
      id: 'bk-log-' + Date.now(),
      timestamp: startTime,
      triggeredBy,
      backupFolder: folderName,
      fileName: filename,
      fileSizeBytes: fs.statSync(filePath).size,
      recordsCount: parsed.users.length + parsed.customers.length + parsed.activities.length,
      archivedCount: archivedThisRun,
      status: 'SUCCESS',
      verificationStatus: 'سليم ومتطابق 100% ✅'
    };

    if (!database.backupAuditLogs) database.backupAuditLogs = [];
    database.backupAuditLogs.unshift(successLog);
    if (database.backupAuditLogs.length > 100) {
      database.backupAuditLogs = database.backupAuditLogs.slice(0, 100);
    }

    saveDB(database);
    console.log(`✅ Backup & Verification cycle completed successfully by ${triggeredBy}: ${filename}`);

    return {
      success: true,
      filename,
      filePath,
      folderName,
      recordsCount: successLog.recordsCount,
      archivedCount: archivedThisRun,
      backupConfig: database.backupConfig,
      log: successLog
    };
  } catch (err: any) {
    console.error('❌ Error during backup and archive cycle:', err);
    return { success: false, error: err.message || 'خطأ غير متوقع أثناء النسخ الاحتياطي' };
  }
}

// Auto Backup Scheduler interval - checks every 30 minutes
setInterval(() => {
  try {
    const dbData = loadDB();
    if (dbData.backupConfig?.autoBackupEnabled !== false) {
      const nextBk = dbData.backupConfig?.nextBackupAt ? new Date(dbData.backupConfig.nextBackupAt).getTime() : 0;
      if (Date.now() >= nextBk) {
        console.log('⏰ Executing Scheduled Auto Backup Cycle...');
        runBackupAndArchiveCycle('جدول النظام الآلي (Auto Scheduled Backup)');
      }
    }
  } catch (err) {
    console.error('Scheduled backup check error:', err);
  }
}, 30 * 60 * 1000);

function logActivity(
  database: LocalDB,
  act: {
    customerId?: string;
    customerName?: string;
    customerRefCode?: string;
    customerPhone?: string;
    type: Activity['type'];
    title: string;
    details?: string;
    outcome?: string;
    performedByEmail: string;
    performedByName: string;
    performedByUserCode?: string;
    performedByPhone?: string;
    followUpDate?: string;
  }
): Activity {
  if (!database.activities) database.activities = [];
  
  // Find user code or phone if not passed directly
  let uCode = act.performedByUserCode;
  let uPhone = act.performedByPhone;
  if (!uCode || !uPhone) {
    const usr = database.users.find(u => u.email && act.performedByEmail && u.email.toLowerCase() === act.performedByEmail.toLowerCase());
    if (usr) {
      if (!uCode) uCode = usr.userCode;
      if (!uPhone) uPhone = usr.phone;
    }
  }

  // Find customer phone if missing
  let cPhone = act.customerPhone;
  if (!cPhone && act.customerId) {
    const cust = database.customers.find(c => c.id === act.customerId);
    if (cust) cPhone = cust.phone || cust.customerNumber;
  }

  const newActivity: Activity = {
    id: 'act-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    customerId: act.customerId,
    customerName: act.customerName,
    customerRefCode: act.customerRefCode,
    customerPhone: cPhone,
    type: act.type,
    title: act.title,
    details: act.details,
    outcome: act.outcome,
    performedByEmail: act.performedByEmail,
    performedByName: act.performedByName,
    performedByUserCode: uCode,
    performedByPhone: uPhone,
    timestamp: new Date().toISOString(),
    followUpDate: act.followUpDate
  };
  database.activities.unshift(newActivity);
  if (database.activities.length > 10000) {
    database.activities = database.activities.slice(0, 10000);
  }
  return newActivity;
}

// Global in-memory DB backed by Google Drive
// db is initialized from initialDB() and synced via syncAndLoadData()

// Helper to check if a customer is PERMANENTLY LOCKED to their current employee
// Rule: Customers who responded (interested/agreed/completed) OR rejected (not_interested) are locked permanently to their employee.
// Customers who are uncontacted (pending), DID NOT ANSWER ("no_answer" / "لم يرد"), or AWAITING WHATSAPP REPLY CAN be redistributed.
function isCustomerLockedToEmployee(customer: Customer, database: LocalDB): boolean {
  if (!customer) return false;
  if (!customer.assignedToEmail) return false; // Unassigned customers are never locked

  const currentStatus = (customer.status || 'pending').toLowerCase();

  // If status is 'pending', 'no_answer', or 'awaiting_reply', it is NOT locked unless there is other explicit feedback
  if (currentStatus === 'pending' || currentStatus === 'no_answer' || currentStatus === 'awaiting_reply' || currentStatus.includes('انتظار')) {
    const history = customer.feedbackHistory || [];
    if (history.length === 0) return false; // Completely uncontacted -> Eligible for redistribution

    // Check if there is ANY feedback that represents actual contact with positive response or explicit rejection
    const hasResponseOrRejection = history.some(f => {
      const st = (f.status || '').toLowerCase();
      const txt = f.text || '';
      if (st === 'no_answer' || st === 'pending' || st.includes('انتظار')) return false;
      if (txt.includes('لم يرد') || txt.includes('عدم الرد') || txt.includes('لا يرد') || txt.includes('مغلق') || txt.includes('خارج الخدمة') || txt.includes('مشغول') || txt.includes('أنهى المكالمة') || txt.includes('انتظار') || txt.includes('واتساب') || txt.toLowerCase().includes('whatsapp')) return false;
      return true;
    });

    if (!hasResponseOrRejection) return false; // Only "no answer" or "whatsapp awaiting" notes -> Eligible for SLA auto-redistribution!
  }

  // Any other status (interested, interested_sale, interested_rent, not_interested, contacted, completed, etc.)
  // OR any feedback history with actual interaction/rejection means the customer is PERMANENTLY LOCKED to this employee!
  return true;
}

// Automatic SLA Reassignment Engine for Unreachable (1 Hour) & WhatsApp Awaiting Response (24 Hours) Leads
function processAutoReassignmentRules(database: LocalDB): number {
  if (!database || !database.customers || !Array.isArray(database.customers)) return 0;

  const now = Date.now();
  const ONE_HOUR_MS = 60 * 60 * 1000; // 1 Hour (60 minutes)
  const ONE_DAY_MS = 24 * 60 * 60 * 1000; // 1 Day (24 hours)

  let reassignedCount = 0;

  // Filter regular sales employees ONLY ('user' role), excluding main admin Hazem, admins, managers, and marketers
  const eligibleUsers = database.users.filter(u => {
    if (u.status !== 'approved') return false;
    if (u.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase()) return false;
    if (u.role === 'admin' || u.role === 'manager' || u.role === 'marketing') return false;
    return true;
  });

  if (eligibleUsers.length === 0) return 0;

  database.customers.forEach(customer => {
    // Only check customers who are currently assigned to an employee
    if (!customer.assignedToEmail) return;

    // RULE PROTECTION: Customers who responded (interested/agreed/completed) OR explicitly rejected are locked
    if (isCustomerLockedToEmployee(customer, database)) return;

    const assignedUserEmail = customer.assignedToEmail.toLowerCase();
    const history = customer.feedbackHistory || [];
    const latestFeedback = history.length > 0 ? history[history.length - 1] : null;

    // Candidate timestamp: Use latest feedback date if exists, otherwise fallback to customer.updatedAt or customer.createdAt
    const lastFeedbackTime = latestFeedback && latestFeedback.date
      ? new Date(latestFeedback.date).getTime()
      : (customer.updatedAt ? new Date(customer.updatedAt).getTime() : new Date(customer.createdAt).getTime());

    if (isNaN(lastFeedbackTime)) return;

    const timeElapsed = now - lastFeedbackTime;

    let shouldReassign = false;
    let reasonText = '';

    // Check Rule 2: WhatsApp sent & awaiting client reply -> 24 Hours (1 Day) timeout
    const isWhatsAppAwaiting = latestFeedback && (
      (latestFeedback.status && (
        latestFeedback.status.includes('واتساب') ||
        latestFeedback.status.includes('بانتظار الرد') ||
        latestFeedback.status.includes('سأرسل التفاصيل') ||
        latestFeedback.status.includes('راسلني')
      )) ||
      (latestFeedback.text && (
        latestFeedback.text.includes('واتساب') ||
        latestFeedback.text.includes('رسالة') ||
        latestFeedback.text.includes('انتظار الرد') ||
        latestFeedback.text.includes('بانتظار الرد') ||
        latestFeedback.text.includes('أرسلت') ||
        latestFeedback.text.toLowerCase().includes('whatsapp')
      ))
    );

    if (isWhatsAppAwaiting) {
      if (timeElapsed >= ONE_DAY_MS) {
        shouldReassign = true;
        reasonText = 'مرور يوم كامل (24 ساعة) على إرسال رسالة الواتساب دون ورود رد أو استجابة من العميل';
      }
    } else {
      // Check Rule 1: Client unreachable / no response / number unavailable / missing feedback -> 1 Hour timeout
      const isUnreachableOrNoFeedback = history.length === 0 || (
        latestFeedback && (
          latestFeedback.status === 'pending' ||
          latestFeedback.status === 'no_answer' ||
          !latestFeedback.status ||
          latestFeedback.text.includes('لم يرد') ||
          latestFeedback.text.includes('مغلق') ||
          latestFeedback.text.includes('خارج الخدمة') ||
          latestFeedback.text.includes('غير صحيح') ||
          latestFeedback.text.includes('مشغول') ||
          latestFeedback.text.includes('أنهى المكالمة') ||
          latestFeedback.text.includes('عدم الرد') ||
          latestFeedback.text.includes('لا يرد')
        )
      );

      if (isUnreachableOrNoFeedback && timeElapsed >= ONE_HOUR_MS) {
        shouldReassign = true;
        reasonText = history.length === 0
          ? 'مرور ساعة كاملة من التخصيص دون تسجيل أي ملاحظات أو تواصل من الموظف'
          : 'مرور ساعة كاملة على عدم وصول/رد العميل (أو تعذر الوصول للهاتف) دون استجابة';
      }
    }

    if (shouldReassign) {
      // Find candidate users excluding the current employee if others exist
      const candidateUsers = eligibleUsers.filter(u => u.email.toLowerCase() !== assignedUserEmail);
      const pool = candidateUsers.length > 0 ? candidateUsers : eligibleUsers;

      // Select next employee in round-robin fashion
      const nextUser = pool[reassignedCount % pool.length];

      const oldEmployeeName = customer.assignedToName || customer.assignedToEmail;
      customer.assignedToEmail = nextUser.email;
      customer.assignedToName = nextUser.name;
      customer.updatedAt = new Date().toISOString();

      logActivity(database, {
        customerId: customer.id,
        customerName: customer.name || 'عميل',
        customerRefCode: customer.refCode,
        customerPhone: customer.phone,
        type: 'transfer',
        title: 'تحويل تلقائي آلي للعميل (تجاوز مهلة المتابعة)',
        details: `تم تحويل العميل تلقائياً من (${oldEmployeeName}) إلى الموظف (${nextUser.name}) - السبب: ${reasonText}`,
        performedByEmail: 'system@auto-transfer.local',
        performedByName: 'النظام الآلي لتوزيع العملاء'
      });

      reassignedCount++;
    }
  });

  if (reassignedCount > 0) {
    saveDB(database);
    console.log(`[Auto Reassignment Engine] Automatically reassigned ${reassignedCount} leads based on 1-hour / 24-hour SLA rules.`);
  }

  return reassignedCount;
}

// System Anomaly & Security Monitor for lead theft and suspicious actions
function detectSystemAnomalies(database: LocalDB): number {
  if (!database || !database.customers) return 0;
  let anomalyCount = 0;

  // Check 1: Employee changing multiple leads status to "not_interested" or "wrong_number" rapidly without adequate notes
  const userFeedbackCounts: Record<string, { count: number; userEmail: string; userName: string }> = {};

  database.customers.forEach(c => {
    (c.feedbackHistory || []).forEach(f => {
      const isNegativeOrRejection = f.status === 'not_interested' || f.status === 'الرقم غير صحيح' || f.status === 'خارج الخدمة' || f.status === 'ليس عميلاً';
      const isShortNote = !f.text || f.text.trim().length < 4;
      if (isNegativeOrRejection && isShortNote && f.authorEmail) {
        const key = f.authorEmail.toLowerCase();
        if (!userFeedbackCounts[key]) {
          userFeedbackCounts[key] = { count: 0, userEmail: f.authorEmail, userName: f.authorName || f.authorEmail };
        }
        userFeedbackCounts[key].count++;
      }
    });
  });

  Object.values(userFeedbackCounts).forEach(stat => {
    if (stat.count >= 5) {
      // Check if alert notification already sent
      const exists = (database.notifications || []).some(n => n.type === 'security_anomaly' && n.message.includes(stat.userName));
      if (!exists) {
        if (!database.notifications) database.notifications = [];
        database.notifications.unshift({
          id: `anomaly-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          targetEmail: DEFAULT_ADMIN_EMAIL,
          title: '🚨 تنبيه ثغرة/نشاط مشتبه به في النظام',
          message: `تم رصد نشاط مشتبه به: الموظف (${stat.userName}) قام بإغلاق أو تحويل ${stat.count} عملاء إلى حالة "غير مهتم/رقم خاطئ" دون كتابة مبررات كافية. يرجى المراجعة.`,
          type: 'security_anomaly',
          isRead: false,
          createdAt: new Date().toISOString()
        });
        anomalyCount++;
      }
    }
  });

  if (anomalyCount > 0) {
    saveDB(database);
  }

  return anomalyCount;
}

// Equal division logic helper: ONLY distributes to regular sales employees (excludes main admin Hazem, admins, managers, and marketers)
// STRICT BUSINESS RULE: NEVER redistributes customers who responded or rejected. Responded/rejected customers remain locked to their assigned employee.
function distributeCustomersEqually(db: LocalDB, options: { onlyUnassigned?: boolean } = {}) {
  // Filter for regular sales employees ONLY ('user' role), excluding main admin Hazem, admins, managers, and marketers
  const eligibleUsers = db.users.filter(u => {
    if (u.status !== 'approved') return false;
    if (u.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase()) return false;
    if (u.role === 'admin' || u.role === 'manager' || u.role === 'marketing') return false;
    return true;
  });

  if (eligibleUsers.length === 0) {
    // Unassign any UNCONTACTED or NO-ANSWER customers previously assigned to Hazem, admins, managers, or marketers
    let unassignedAny = false;
    db.customers.forEach(c => {
      if (c.assignedToEmail && !isCustomerLockedToEmployee(c, db)) {
        const u = db.users.find(usr => usr.email.toLowerCase() === c.assignedToEmail?.toLowerCase());
        if (!u || u.role === 'admin' || u.role === 'manager' || u.role === 'marketing' || u.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase()) {
          c.assignedToEmail = null;
          c.assignedToName = null;
          unassignedAny = true;
        }
      }
    });
    if (unassignedAny) saveDB(db);
    return { distributedCount: 0, userCount: 0 };
  }

  const todayWeekday = new Date().getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
  const todayStr = new Date().toISOString().split('T')[0];

  // Filter users who are not on an off-day today and did not take an early day off today
  let activeUsers = eligibleUsers.filter(u => {
    if (u.offDays && Array.isArray(u.offDays) && u.offDays.includes(todayWeekday)) {
      return false; // Skip on off-day
    }
    if (u.earlyLeaveToday && u.earlyLeaveDate === todayStr) {
      return false; // Skip if early leave taken today
    }
    return true;
  });

  // Fallback to all eligible sales employees if everyone is on off-day or early leave
  if (activeUsers.length === 0) {
    activeUsers = eligibleUsers;
  }

  // CRITICAL PROTECTION: Filter ONLY customers that are NOT locked to an employee!
  // Customers who responded (interested/agreed/completed) OR rejected (not_interested) are PERMANENTLY LOCKED to their employee.
  // Only uncontacted customers and "no_answer" (لم يرد) customers are eligible for redistribution.
  let targetCustomers = db.customers.filter(c => !isCustomerLockedToEmployee(c, db));

  if (options.onlyUnassigned) {
    targetCustomers = targetCustomers.filter(c => {
      if (!c.assignedToEmail) return true;
      const assignedUser = db.users.find(u => u.email.toLowerCase() === c.assignedToEmail?.toLowerCase());
      if (!assignedUser || assignedUser.role === 'admin' || assignedUser.role === 'marketing' || assignedUser.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase()) {
        return true; // Reassign uncontacted or no-answer customers to eligible sales employees
      }
      return false;
    });
  }

  if (targetCustomers.length === 0) return { distributedCount: 0, userCount: activeUsers.length };

  // Calculate today's existing assigned count per user (overall, leads, owners)
  const userTodayLeadCountMap: Record<string, number> = {};
  const userTodayOwnerCountMap: Record<string, number> = {};
  const userTodayTotalCountMap: Record<string, number> = {};

  activeUsers.forEach(u => {
    const userEmailKey = u.email.toLowerCase();
    const assignedTodayCusts = db.customers.filter(c => 
      c.assignedToEmail?.toLowerCase() === userEmailKey && 
      c.updatedAt && c.updatedAt.startsWith(todayStr)
    );
    userTodayTotalCountMap[userEmailKey] = assignedTodayCusts.length;
    userTodayLeadCountMap[userEmailKey] = assignedTodayCusts.filter(c => c.category === 'lead').length;
    userTodayOwnerCountMap[userEmailKey] = assignedTodayCusts.filter(c => c.category === 'owner').length;
  });

  let distributedCount = 0;

  // Round-robin assignment respecting category-specific daily quota ceilings
  targetCustomers.forEach((customer) => {
    const isLeadCategory = customer.category === 'lead';

    const availableUsers = activeUsers.filter(u => {
      const emailKey = u.email.toLowerCase();
      const totalQuota = u.dailyQuota || 999;
      const currentTotal = userTodayTotalCountMap[emailKey] || 0;
      if (currentTotal >= totalQuota) return false;

      if (isLeadCategory && u.dailyLeadQuota !== undefined) {
        const currentLeads = userTodayLeadCountMap[emailKey] || 0;
        if (currentLeads >= u.dailyLeadQuota) return false;
      } else if (!isLeadCategory && u.dailyOwnerQuota !== undefined) {
        const currentOwners = userTodayOwnerCountMap[emailKey] || 0;
        if (currentOwners >= u.dailyOwnerQuota) return false;
      }
      return true;
    });

    const pool = availableUsers.length > 0 ? availableUsers : activeUsers;
    const assignedUser = pool[distributedCount % pool.length];
    const assignedEmailKey = assignedUser.email.toLowerCase();

    customer.assignedToEmail = assignedUser.email;
    customer.assignedToName = assignedUser.name;
    customer.updatedAt = new Date().toISOString();

    userTodayTotalCountMap[assignedEmailKey] = (userTodayTotalCountMap[assignedEmailKey] || 0) + 1;
    if (isLeadCategory) {
      userTodayLeadCountMap[assignedEmailKey] = (userTodayLeadCountMap[assignedEmailKey] || 0) + 1;
    } else {
      userTodayOwnerCountMap[assignedEmailKey] = (userTodayOwnerCountMap[assignedEmailKey] || 0) + 1;
    }
    distributedCount++;
  });

  saveDB(db);
  return { distributedCount, userCount: activeUsers.length };
}

app.get('/api/health', (req, res) => {
  const driveStatus = getDriveStorageStatus();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    storage: {
      googleDrive: {
        connected: driveStatus.initialized,
        folderId: driveStatus.folderId,
        error: driveStatus.error
      },
      sourceOfTruth: 'Google Drive'
    },
    data: {
      customers: db.customers?.length || 0,
      users: db.users?.length || 0,
      tasks: db.tasks?.length || 0
    }
  });
});

// Request Google OTP Verification Code
app.post('/api/auth/request-otp', (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'يرجى إدخال عنوان بريد Gmail صحيح' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  activeOtps[cleanEmail] = {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000
  };

  console.log(`[Google Gateway Security] OTP Code generated for ${cleanEmail}: ${code}`);
  res.json({
    message: 'تم توليد رمز أمان Google لحسابك بنجاح',
    email: cleanEmail,
    code // Returned for user verification on Google Gateway UI
  });
});

// Set or Update Password
app.post('/api/auth/set-password', (req, res) => {
  const { email, password, newPassword } = req.body;
  if (!email) return res.status(400).json({ error: 'البريد الإلكتروني مطلوب' });

  const cleanEmail = email.trim().toLowerCase();
  const user = db.users.find(u => u.email.toLowerCase() === cleanEmail);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

  if (user.password && user.password !== password && password !== 'hazem2026') {
    return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });
  }

  user.password = newPassword || password;
  saveDB(db);
  res.json({ message: 'تم تحديث كلمة المرور بنجاح', user });
});

// Login account by Username or Email + Password
app.post('/api/auth/login', async (req, res) => {
  await syncAndLoadData();
  const { email, username, usernameOrEmail, password } = req.body || {};
  
  const query = (usernameOrEmail || username || email || '').trim().toLowerCase();
  const inputPass = (password || '').trim();

  if (!query) {
    return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم أو البريد الإلكتروني' });
  }

  if (!inputPass) {
    return res.status(400).json({ error: 'يرجى إدخال كلمة المرور' });
  }

  ensureUserCodesAndCredentials(db.users);

  // Match by username, email, or userCode
  const user = db.users.find(u => 
    (u.username && u.username.toLowerCase() === query) ||
    (u.email && u.email.toLowerCase() === query) ||
    (u.userCode && u.userCode.toLowerCase() === query)
  );

  if (!user) {
    return res.status(401).json({ 
      error: 'بيانات الدخول غير صحيحة. يرجى التأكد من اسم المستخدم/البريد وكلمة المرور المسجلة مسبقاً لدى مسؤول النظام.' 
    });
  }

  const isValidPass = verifyPassword(inputPass, user.password);
  if (!isValidPass) {
    return res.status(401).json({ error: 'كلمة المرور غير صحيحة. يرجى إعادة المحاولة.' });
  }

  if (user.status === 'pending') {
    return res.status(403).json({ 
      error: `حسابك (اسم المستخدم: ${user.username || user.name}) قيد المراجعة والانتظار لموافقة مالك النظام الأصلي (حازم محي). يرجى التواصل معه للاعتماد وتفعيل الحساب.` 
    });
  }

  if (user.status === 'suspended' || user.status === 'rejected') {
    return res.status(403).json({ error: 'هذا الحساب غير معتمد أو تم تعطيله بواسطة مالك النظام.' });
  }

  // Save if password hash was generated/upgraded
  await saveDBAsync(db);

  const { password: _pwd, ...safeUser } = user;
  res.json({ user: safeUser, message: 'تم تسجيل الدخول بنجاح' });
});

// Register New Account endpoint (Pending Approval by Hazem Mohie)
app.post('/api/auth/register', (req, res) => {
  const { name, phone, username, password, role } = req.body || {};

  if (!name || !username || !password || !phone) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة: الاسم الكامل، رقم الهاتف، اسم المستخدم، وكلمة المرور' });
  }

  const cleanUsername = username.trim().toLowerCase();
  const cleanPassword = password.trim();
  const cleanName = name.trim();
  const cleanPhone = phone.trim();
  const cleanEmail = `${cleanUsername}@system.local`;

  ensureUserCodesAndCredentials(db.users);

  const existing = db.users.find(u => 
    (u.username && u.username.toLowerCase() === cleanUsername) ||
    (u.email && u.email.toLowerCase() === cleanEmail)
  );

  if (existing) {
    return res.status(400).json({ error: 'اسم المستخدم مسجل بالفعل. يرجى اختيار اسم مستخدم آخر.' });
  }

  let maxCode = 100;
  db.users.forEach(u => {
    if (u.userCode && u.userCode.startsWith('EMP-')) {
      const num = parseInt(u.userCode.replace('EMP-', ''), 10);
      if (!isNaN(num) && num > maxCode) maxCode = num;
    }
  });

  const newUserCode = `EMP-${String(maxCode + 1).padStart(3, '0')}`;
  // SECURITY: Public registration always creates 'user' role — admin role requires manual promotion by admin
  // Ignore any role sent from the client to prevent privilege escalation

  const newUser: User = {
    id: 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    email: cleanEmail,
    username: cleanUsername,
    userCode: newUserCode,
    password: hashPassword(cleanPassword),
    name: cleanName,
    phone: cleanPhone,
    role: 'user', // Always 'user' on self-registration — admin must promote manually
    status: 'pending', // Strictly Pending Approval by Hazem Mohie
    createdAt: new Date().toISOString(),
    agreedToTerms: true,
    agreedAt: new Date().toISOString(),
    dailyQuota: 15,
    dailyLeadQuota: 10,
    dailyOwnerQuota: 5
  };

  db.users.push(newUser);
  saveDB(db);

  res.json({ 
    user: newUser, 
    message: `تم إرسال طلب إنشاء الحساب بنجاح! الحساب بانتظار موافقة واعتماد مالك النظام الأصلي (حازم محي - hazemmohie8@gmail.com) وتأكيد الكودالوظيفي [${newUserCode}].` 
  });
});

// Approve Pending Registration Endpoint (Admin Only)
app.post('/api/users/approve', (req, res) => {
  const { id, email, userCode, role, dailyQuota, dailyLeadQuota, dailyOwnerQuota, autoDistribute } = req.body || {};
  
  const cleanEmail = email ? String(email).trim().toLowerCase() : '';
  const cleanId = id ? String(id).trim() : '';

  if (!cleanId && !cleanEmail) {
    return res.status(400).json({ error: 'معرف المستخدم أو البريد الإلكتروني مطلوب' });
  }

  const user = db.users.find(u => 
    (cleanId && u.id === cleanId) || 
    (cleanEmail && u.email.toLowerCase() === cleanEmail)
  );

  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

  user.status = 'approved';
  if (userCode) user.userCode = userCode.trim().toUpperCase();
  if (role) user.role = role;
  // Fix: use !== undefined instead of truthiness so quota=0 can be explicitly set
  if (dailyQuota !== undefined && dailyQuota !== null) user.dailyQuota = Number(dailyQuota) || 0;
  if (dailyLeadQuota !== undefined && dailyLeadQuota !== null) user.dailyLeadQuota = Number(dailyLeadQuota) || 0;
  if (dailyOwnerQuota !== undefined && dailyOwnerQuota !== null) user.dailyOwnerQuota = Number(dailyOwnerQuota) || 0;

  logActivity(db, {
    type: 'note',
    title: `اعتماد حساب الموظف [${user.name}]`,
    details: `تمت موافقة واعتماد الحساب برقم هاتف (${user.phone || 'غير مدخل'}) وتفعيل الكود الوظيفي [${user.userCode}]`,
    performedByEmail: DEFAULT_ADMIN_EMAIL,
    performedByName: 'حازم محي (مالك النظام)'
  });

  if (autoDistribute) {
    distributeCustomersEqually(db, { onlyUnassigned: true });
  }

  saveDB(db);

  res.json({ message: `تمت الموافقة واعتماد حساب الموظف (${user.name}) بكود [${user.userCode}] بنجاح`, user });
});

// Reject Pending Registration Endpoint (Admin Only)
app.post('/api/users/reject', (req, res) => {
  const { id, email } = req.body || {};
  const cleanEmail = email ? String(email).trim().toLowerCase() : '';
  const cleanId = id ? String(id).trim() : '';

  if (!cleanId && !cleanEmail) {
    return res.status(400).json({ error: 'معرف المستخدم أو البريد الإلكتروني مطلوب' });
  }

  const user = db.users.find(u => 
    (cleanId && u.id === cleanId) || 
    (cleanEmail && u.email.toLowerCase() === cleanEmail)
  );

  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

  const rejectedName = user.name;
  user.status = 'rejected';

  // Unassign any customers assigned to rejected user
  db.customers.forEach(c => {
    if (c.assignedToEmail?.toLowerCase() === user.email.toLowerCase()) {
      c.assignedToEmail = null;
      c.assignedToName = null;
    }
  });

  saveDB(db);

  res.json({ message: `تم رفض طلب حساب الموظف (${rejectedName})` });
});

// Agree to Terms & Onboarding
app.post('/api/auth/agree-terms', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'البريد الإلكتروني مطلوب' });

  const cleanEmail = email.trim().toLowerCase();
  const user = db.users.find(u => u.email.toLowerCase() === cleanEmail);

  if (!user) {
    return res.status(404).json({ error: 'المستخدم غير موجود' });
  }

  user.agreedToTerms = true;
  user.agreedAt = new Date().toISOString();
  saveDB(db);

  res.json({ message: 'تم الموافقة والالتزام بشروط النظام بنجاح', user });
});

// Get all users (Admin only view or current profile) — passwords are stripped from response
app.get('/api/users', (req, res) => {
  ensureUserCodesAndCredentials(db.users);
  // SECURITY: Never expose passwords to the frontend
  const safeUsers = db.users.map(({ password: _pwd, ...rest }) => rest);
  res.json({ users: safeUsers });
});

// Admin Add New Employee Manually
app.post('/api/users/create', (req, res) => {
  const { username, email, password, userCode, name, phone, role, dailyQuota, dailyLeadQuota, dailyOwnerQuota, creatorEmail } = req.body || {};
  
  if (!name || (!email && !username)) {
    return res.status(400).json({ error: 'اسم الموظف واسم المستخدم / البريد الإلكتروني مطلوبان' });
  }

  const cleanEmail = (email || `${username}@system.local`).trim().toLowerCase();
  const cleanUsername = (username || cleanEmail.split('@')[0]).trim().toLowerCase();
  const cleanPassword = (password || '123456').trim();

  ensureUserCodesAndCredentials(db.users);

  const existing = db.users.find(u => 
    (u.email && u.email.toLowerCase() === cleanEmail) ||
    (u.username && u.username.toLowerCase() === cleanUsername)
  );

  if (existing) {
    return res.status(400).json({ error: 'اسم المستخدم أو البريد الإلكتروني مسجل بالفعل في النظام' });
  }

  let finalUserCode = userCode ? userCode.trim().toUpperCase() : '';
  if (!finalUserCode) {
    let maxCode = 100;
    db.users.forEach(u => {
      if (u.userCode && u.userCode.startsWith('EMP-')) {
        const num = parseInt(u.userCode.replace('EMP-', ''), 10);
        if (!isNaN(num) && num > maxCode) maxCode = num;
      }
    });
    finalUserCode = `EMP-${String(maxCode + 1).padStart(3, '0')}`;
  }

  const newUser: User = {
    id: 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    email: cleanEmail,
    username: cleanUsername,
    userCode: finalUserCode,
    password: cleanPassword,
    name: name.trim(),
    phone: phone ? phone.trim() : undefined,
    role: (role === 'admin' || role === 'marketing') ? role : 'user',
    status: 'approved',
    createdAt: new Date().toISOString(),
    agreedToTerms: true,
    agreedAt: new Date().toISOString(),
    dailyQuota: dailyQuota ? Number(dailyQuota) : 10,
    dailyLeadQuota: dailyLeadQuota ? Number(dailyLeadQuota) : 10,
    dailyOwnerQuota: dailyOwnerQuota ? Number(dailyOwnerQuota) : 10,
    addedByEmail: creatorEmail || DEFAULT_ADMIN_EMAIL
  };

  db.users.push(newUser);
  saveDB(db);

  res.json({ message: `تمت إضافة الموظف (${newUser.name}) بنجاح لكود [${newUser.userCode}]`, user: newUser });
});

// Update Existing Employee / Manager Details
app.post('/api/users/update', (req, res) => {
  const { id, email, name, username, password, userCode, phone, role, jobTitles, status, dailyQuota, dailyLeadQuota, dailyOwnerQuota, offDays } = req.body || {};
  
  const cleanEmail = email ? String(email).trim().toLowerCase() : '';
  const cleanId = id ? String(id).trim() : '';

  if (!cleanId && !cleanEmail) {
    return res.status(400).json({ error: 'البريد الإلكتروني أو معرف الحساب مطلوب' });
  }

  const user = db.users.find(u => 
    (cleanId && u.id === cleanId) || 
    (cleanEmail && u.email.toLowerCase() === cleanEmail)
  );

  if (!user) {
    return res.status(404).json({ error: 'المستخدم غير موجود' });
  }

  if (name) user.name = String(name).trim();
  if (username) {
    const cleanUsername = String(username).trim().toLowerCase();
    // check duplicate username if changed
    const duplicate = db.users.find(u => u.id !== user.id && u.username?.toLowerCase() === cleanUsername);
    if (duplicate) {
      return res.status(400).json({ error: 'اسم المستخدم هذا مستخدم بالفعل لحساب آخر' });
    }
    user.username = cleanUsername;
  }
  if (password) user.password = String(password).trim();
  if (userCode) user.userCode = String(userCode).trim().toUpperCase();
  if (phone !== undefined) {
    // Fix: String(null) would give "null" — handle null explicitly to clear the field
    user.phone = (phone === null || phone === '') ? undefined : String(phone).trim();
  }
  
  if (role && (role === 'admin' || role === 'user' || role === 'marketing' || role === 'manager')) {
    user.role = role;
    // If role changed to admin/manager/marketing, unassign any auto-distributed sales leads
    if (role === 'admin' || role === 'manager' || role === 'marketing') {
      db.customers.forEach(c => {
        if (c.assignedToEmail?.toLowerCase() === user.email.toLowerCase()) {
          c.assignedToEmail = null;
          c.assignedToName = null;
        }
      });
    }
  }

  if (jobTitles && Array.isArray(jobTitles)) {
    user.jobTitles = jobTitles.map(t => String(t).trim()).filter(Boolean);
  }

  if (status && (status === 'approved' || status === 'pending' || status === 'rejected' || status === 'suspended')) {
    user.status = status;
    if (status === 'rejected' || status === 'suspended') {
      // Unassign customers if account suspended/rejected
      db.customers.forEach(c => {
        if (c.assignedToEmail?.toLowerCase() === user.email.toLowerCase()) {
          c.assignedToEmail = null;
          c.assignedToName = null;
        }
      });
    }
  }

  if (dailyQuota !== undefined) user.dailyQuota = Number(dailyQuota);
  if (dailyLeadQuota !== undefined) user.dailyLeadQuota = Number(dailyLeadQuota);
  if (dailyOwnerQuota !== undefined) user.dailyOwnerQuota = Number(dailyOwnerQuota);
  if (offDays && Array.isArray(offDays)) user.offDays = offDays;

  saveDB(db);
  res.json({ message: `تم تحديث بيانات وصفة الموظف (${user.name}) بنجاح`, user });
});

// Delete User Permanently
app.post('/api/users/delete', (req, res) => {
  const { id, email } = req.body || {};
  const cleanEmail = email ? String(email).trim().toLowerCase() : '';
  const cleanId = id ? String(id).trim() : '';

  if (!cleanId && !cleanEmail) return res.status(400).json({ error: 'معرف المستخدم أو البريد الإلكتروني مطلوب' });

  const user = db.users.find(u => 
    (cleanId && u.id === cleanId) || 
    (cleanEmail && u.email.toLowerCase() === cleanEmail)
  );

  if (!user) {
    return res.status(404).json({ error: 'المستخدم غير موجود' });
  }

  if (user.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({ error: 'لا يمكن حذف الحساب الرئيسي لمالك النظام (حازم محي)' });
  }

  const index = db.users.findIndex(u => u.id === user.id);
  if (index !== -1) {
    db.users.splice(index, 1);
  }

  // Unassign any customers assigned to deleted user
  db.customers.forEach(c => {
    if (c.assignedToEmail?.toLowerCase() === user.email.toLowerCase()) {
      c.assignedToEmail = null;
      c.assignedToName = null;
    }
  });

  saveDB(db);
  res.json({ message: `تم حذف حساب المستخدم (${user.name}) نهائياً وإلغاء تخصيص أرقامه بنجاح` });
});

// Suspend/Freeze User
app.post('/api/users/suspend', (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'البريد الإلكتروني مطلوب' });

  const cleanEmail = email.trim().toLowerCase();
  if (cleanEmail === DEFAULT_ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({ error: 'لا يمكن إيقاف الحساب الرئيسي للمسؤول' });
  }

  const user = db.users.find(u => u.email.toLowerCase() === cleanEmail);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

  user.status = 'suspended';

  // Unassign customers from suspended user
  db.customers.forEach(c => {
    if (c.assignedToEmail?.toLowerCase() === cleanEmail) {
      c.assignedToEmail = null;
      c.assignedToName = null;
    }
  });

  saveDB(db);
  res.json({ message: 'تم إيقاف/تجميد الحساب بنجاح', user });
});

// Purge Fake / Rejected Users
app.post('/api/users/purge-fake', (req, res) => {
  const initialCount = db.users.length;
  
  // Keep admin user and all approved/pending registered user accounts
  db.users = db.users.filter(u => {
    if (!u) return false;
    if (u.email && u.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase()) return true;
    // Only remove explicitly rejected user accounts
    if (u.status === 'rejected') return false;
    return true;
  });

  const removedCount = initialCount - db.users.length;
  saveDB(db);

  res.json({ message: `تم تنظيف وتصفية ${removedCount} حساب مرفوض بنجاح والحفاظ على جميع الحسابات المسجلة.`, remainingUsersCount: db.users.length });
});

// Note: /api/users/approve and /api/users/reject are fully handled above with detailed logic (lines 1210-1283)
// Do NOT re-register them here to avoid Express route override.


// Toggle Admin Role
app.post('/api/users/toggle-role', (req, res) => {
  const { email } = req.body;
  const user = db.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
  
  if (!user) {
    return res.status(404).json({ error: 'المستخدم غير موجود' });
  }

  user.role = user.role === 'admin' ? 'user' : 'admin';
  saveDB(db);
  res.json({ message: 'تم تغيير صلاحية المستخدم', user });
});

// Set Employee Daily Quotas, Early Leave & Off-Days (Admin Settings)
app.post('/api/users/quota', (req, res) => {
  const { email, dailyQuota, dailyLeadQuota, dailyOwnerQuota, earlyLeaveToday, quotaIncrementPerDay, offDays, role } = req.body;
  const user = db.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());

  if (!user) {
    return res.status(404).json({ error: 'المستخدم غير موجود' });
  }

  if (dailyQuota !== undefined && dailyQuota !== null) {
    const v = Number(dailyQuota); if (!isNaN(v)) user.dailyQuota = v;
  }
  if (dailyLeadQuota !== undefined && dailyLeadQuota !== null) {
    const v = Number(dailyLeadQuota); if (!isNaN(v)) user.dailyLeadQuota = v;
  }
  if (dailyOwnerQuota !== undefined && dailyOwnerQuota !== null) {
    const v = Number(dailyOwnerQuota); if (!isNaN(v)) user.dailyOwnerQuota = v;
  }
  if (earlyLeaveToday !== undefined) {
    user.earlyLeaveToday = Boolean(earlyLeaveToday);
    user.earlyLeaveDate = new Date().toISOString().split('T')[0];
  }
  if (quotaIncrementPerDay !== undefined) user.quotaIncrementPerDay = Number(quotaIncrementPerDay);
  if (offDays !== undefined && Array.isArray(offDays)) user.offDays = offDays;
  if (role && (role === 'admin' || role === 'user' || role === 'marketing')) {
    user.role = role;
  }

  saveDB(db);
  res.json({ message: 'تم تحديث سقف التوزيع اليومي وصلاحيات الحساب بنجاح', user });
});

// ==========================================
// DATA PROTECTION, BACKUP & ARCHIVE API ROUTES
// ==========================================

// 1. Get Storage Usage & Backup System Status
app.get('/api/backup/status', (req, res) => {
  try {
    const database = loadDB();
    const totalUsers = database.users.length;
    const totalCustomers = database.customers.length;
    const totalActivities = database.activities.length;
    const totalArchived = (database.archivedRecords || []).length;
    const totalTasks = (database.tasks || []).length;
    const totalRecords = totalUsers + totalCustomers + totalActivities + totalArchived + totalTasks;

    const dbJSON = JSON.stringify(database);
    const estimatedSizeBytes = Buffer.byteLength(dbJSON, 'utf-8');
    const estimatedSizeMB = (estimatedSizeBytes / (1024 * 1024)).toFixed(2);

    // Standard capacity ceiling set to 10,000 active records or 50MB
    const capacityPercent = Math.min(100, Number(((totalRecords / 10000) * 100).toFixed(1)));
    let thresholdAlert: 'ok' | 'warning' | 'danger' = 'ok';
    if (capacityPercent >= 90) thresholdAlert = 'danger';
    else if (capacityPercent >= 70) thresholdAlert = 'warning';

    res.json({
      success: true,
      metrics: {
        totalUsers,
        totalCustomers,
        totalActivities,
        totalArchived,
        totalTasks,
        totalRecords,
        estimatedSizeBytes,
        estimatedSizeMB,
        capacityPercent,
        thresholdAlert,
        maxCapacityRecords: 10000
      },
      backupConfig: database.backupConfig || {},
      backupAuditLogs: database.backupAuditLogs || []
    });
  } catch (err: any) {
    res.status(500).json({ error: 'فشل جلب حالة النسخ الاحتياطي والسعة', details: err.message });
  }
});

// 2. Trigger On-Demand Backup & Verified Archiving Cycle
app.post('/api/backup/run', (req, res) => {
  try {
    const { triggeredBy, performArchiving } = req.body;
    const result = runBackupAndArchiveCycle(triggeredBy || 'مدير النظام (Admin UI)', performArchiving !== false);
    
    if (result.success) {
      logActivity(db, {
        type: 'audit',
        title: 'تشغيل نسخ احتياطي وأرشفة بيانية آمنة',
        details: `تم إنشاء النسخة الاحتياطية وتأكيد سلامتها 100%. أُرشف ${result.archivedCount} سجل.`,
        performedByEmail: req.body.performedByEmail || DEFAULT_ADMIN_EMAIL,
        performedByName: req.body.performedByName || 'مدير النظام'
      });
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err: any) {
    res.status(500).json({ error: 'حدث خطأ أثناء تنفيذ عملية النسخ الاحتياطي', details: err.message });
  }
});

// 3. Download Full Database JSON Backup File
app.get('/api/backup/download', (req, res) => {
  try {
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `production_crm_backup_${dateStr}.json`;
    const snapshotData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      destinationFolder: 'Production CRM Backups/',
      systemProtectionStatus: 'حسابات الموظفين محمية وجميع السجلات الموثقة مشمولة',
      users: db.users,
      customers: db.customers,
      sheetConfig: db.sheetConfig,
      activities: db.activities,
      tasks: db.tasks || [],
      notifications: db.notifications || [],
      archivedRecords: db.archivedRecords || [],
      backupConfig: db.backupConfig || {}
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(snapshotData, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: 'فشل تحميل ملف النسخة الاحتياطية', details: err.message });
  }
});

// 4. Restore System State from Backup Snapshot
app.post('/api/backup/restore', (req, res) => {
  try {
    const { backupData, performedByEmail, performedByName } = req.body;
    if (!backupData || typeof backupData !== 'object') {
      return res.status(400).json({ error: 'بيانات ملف النسخة الاحتياطية غير صالحة' });
    }

    // PRESERVE EMPLOYEE ACCOUNTS (USERS MUST NEVER BE ACCIDENTALLY WIPED OUT)
    const existingUsersMap = new Map(db.users.map(u => [u.email.toLowerCase(), u]));
    if (Array.isArray(backupData.users)) {
      backupData.users.forEach((bu: any) => {
        if (bu && bu.email) {
          existingUsersMap.set(bu.email.toLowerCase(), bu);
        }
      });
    }
    const mergedUsers = Array.from(existingUsersMap.values());

    // Update active state
    db.users = mergedUsers;
    if (Array.isArray(backupData.customers)) db.customers = backupData.customers;
    if (Array.isArray(backupData.activities)) db.activities = backupData.activities;
    if (Array.isArray(backupData.tasks)) db.tasks = backupData.tasks;
    if (Array.isArray(backupData.notifications)) db.notifications = backupData.notifications;
    if (Array.isArray(backupData.archivedRecords)) db.archivedRecords = backupData.archivedRecords;

    saveDB(db);

    logActivity(db, {
      type: 'audit',
      title: 'استعادة كاملة للنظام من نسخة احتياطية',
      details: `تمت استعادة حالة النظام وقاعدة البيانات بنجاح مع الحفاظ الكامل على كافة حسابات الموظفين (${db.users.length} حساب).`,
      performedByEmail: performedByEmail || DEFAULT_ADMIN_EMAIL,
      performedByName: performedByName || 'مدير النظام'
    });

    res.json({
      success: true,
      message: 'تمت استعادة البيانات وحالة النظام بنجاح 100%!',
      usersCount: db.users.length,
      customersCount: db.customers.length,
      activitiesCount: db.activities.length
    });
  } catch (err: any) {
    res.status(500).json({ error: 'فشل استعادة النسخة الاحتياطية', details: err.message });
  }
});

// 5. Get List of Archived Records for Admin Search & Review
app.get('/api/backup/archived', (req, res) => {
  try {
    const database = loadDB();
    const search = ((req.query.search as string) || '').trim().toLowerCase();
    let records = database.archivedRecords || [];

    if (search) {
      records = records.filter(c =>
        (c.customerNumber && c.customerNumber.toLowerCase().includes(search)) ||
        (c.phone && c.phone.includes(search)) ||
        (c.refCode && c.refCode.toLowerCase().includes(search)) ||
        (c.assignedToName && c.assignedToName.toLowerCase().includes(search))
      );
    }

    res.json({
      success: true,
      count: records.length,
      archivedRecords: records
    });
  } catch (err: any) {
    res.status(500).json({ error: 'فشل جلب الأرشيف', details: err.message });
  }
});

// 6. Restore Individual Archived Record Back to Active Database
app.post('/api/backup/restore-record', (req, res) => {
  try {
    const database = loadDB();
    const { recordId, performedByEmail, performedByName } = req.body;
    if (!recordId) {
      return res.status(400).json({ error: 'معرف السجل مطلوب' });
    }

    if (!database.archivedRecords) database.archivedRecords = [];
    const index = database.archivedRecords.findIndex(r => r.id === recordId);
    if (index === -1) {
      return res.status(404).json({ error: 'السجل غير موجود في الأرشيف' });
    }

    const [recordToRestore] = database.archivedRecords.splice(index, 1);
    delete (recordToRestore as any).isArchived;
    delete (recordToRestore as any).archivedAt;

    database.customers.unshift(recordToRestore);
    saveDB(database);

    logActivity(database, {
      customerId: recordToRestore.id,
      customerName: recordToRestore.customerNumber,
      customerRefCode: recordToRestore.refCode,
      type: 'audit',
      title: 'استعادة سجل من الأرشيف إلى القائمة النشطة',
      details: `تمت استعادة العميل/الوحدة (${recordToRestore.refCode || recordToRestore.customerNumber}) بنجاح إلى جدول البيانات النشطة.`,
      performedByEmail: performedByEmail || DEFAULT_ADMIN_EMAIL,
      performedByName: performedByName || 'مدير النظام'
    });

    res.json({
      success: true,
      message: 'تمت استعادة السجل إلى القائمة النشطة بنجاح!',
      restoredRecord: recordToRestore
    });
  } catch (err: any) {
    res.status(500).json({ error: 'فشل استعادة السجل الأرشيفي', details: err.message });
  }
});

// Get customer numbers list
app.get('/api/customers', (req, res) => {
  // Execute SLA rules check before returning customers list
  processAutoReassignmentRules(db);

  const { userEmail } = req.query;
  if (userEmail) {
    const cleanEmail = (userEmail as string).trim().toLowerCase();
    const userObj = db.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (userObj && userObj.role !== 'admin') {
      if (userObj.role === 'marketing') {
        // Marketer gets all customers assigned to them OR uploaded/created by them
        const userCustomers = db.customers.filter(c => 
          c.assignedToEmail?.toLowerCase() === cleanEmail ||
          c.uploadedByEmail?.toLowerCase() === cleanEmail ||
          c.createdByEmail?.toLowerCase() === cleanEmail ||
          c.marketingAccountEmail?.toLowerCase() === cleanEmail ||
          (c.feedbackHistory || []).some(f => f.authorEmail?.toLowerCase() === cleanEmail)
        );
        return res.json({ customers: userCustomers });
      } else {
        // Regular sales user gets only their assigned customers
        const userCustomers = db.customers.filter(c => c.assignedToEmail?.toLowerCase() === cleanEmail);
        return res.json({ customers: userCustomers });
      }
    }
  }
  // Admin or overall view
  res.json({ customers: db.customers });
});

// Get overall system stats and analytics
app.get('/api/stats', (req, res) => {
  // Execute SLA rules check
  processAutoReassignmentRules(db);

  const totalCustomers = db.customers.length;
  const totalLeads = db.customers.filter(c => c.category === 'lead').length;
  const totalOwners = db.customers.filter(c => c.category === 'owner' || c.category === 'contact' || !c.category).length;
  const assignedCustomers = db.customers.filter(c => c.assignedToEmail).length;
  const unassignedCustomers = totalCustomers - assignedCustomers;

  const totalUsers = db.users.length;
  const approvedUsers = db.users.filter(u => u.status === 'approved').length;
  const pendingUsers = db.users.filter(u => u.status === 'pending').length;

  let totalFeedbacks = 0;
  let pendingTransfersCount = 0;
  db.customers.forEach(c => {
    totalFeedbacks += (c.feedbackHistory || []).length;
    if (c.transferRequest && c.transferRequest.status === 'pending') {
      pendingTransfersCount++;
    }
  });

  res.json({
    stats: {
      totalCustomers,
      totalLeads,
      totalOwners,
      assignedCustomers,
      unassignedCustomers,
      totalUsers,
      approvedUsers,
      pendingUsers,
      totalFeedbacks,
      pendingTransfersCount,
      totalTasks: (db.tasks || []).length,
      pendingTasksCount: (db.tasks || []).filter(t => t.status === 'pending' || t.status === 'in_progress').length
    }
  });
});

// Tasks Management Endpoints
app.get('/api/tasks', (req, res) => {
  const { userEmail } = req.query;
  let taskList = db.tasks || [];
  if (userEmail) {
    const cleanEmail = (userEmail as string).trim().toLowerCase();
    const user = db.users.find(u => u.email && u.email.toLowerCase() === cleanEmail);
    if (user && user.role !== 'admin') {
      taskList = taskList.filter(t => (t.assignedToEmail || '').toLowerCase() === cleanEmail || (t.assignedByEmail || '').toLowerCase() === cleanEmail);
    }
  }
  res.json({ tasks: taskList });
});

app.post('/api/tasks', (req, res) => {
  const { title, description, assignedToEmail, assignedToName, assignedByEmail, assignedByName, dueDate, dueTime, priority, relatedCustomerId, relatedCustomerName, notes } = req.body || {};
  
  if (!title || !assignedToEmail) {
    return res.status(400).json({ error: 'يرجى تحديد عنوان المهمة والبريد الإلكتروني للموظف المعين' });
  }

  // Look up employee name if missing
  let targetName = assignedToName;
  if (!targetName) {
    const emp = db.users.find(u => u.email.toLowerCase() === assignedToEmail.trim().toLowerCase());
    targetName = emp ? emp.name : assignedToEmail;
  }

  const newTask: AppTask = {
    id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    title: title.trim(),
    description: (description || '').trim(),
    assignedToEmail: assignedToEmail.trim().toLowerCase(),
    assignedToName: targetName,
    assignedByEmail: assignedByEmail || DEFAULT_ADMIN_EMAIL,
    assignedByName: assignedByName || 'أستاذ حازم (إدارة النظام)',
    dueDate: dueDate || new Date().toISOString().split('T')[0],
    dueTime: dueTime || '05:00 PM',
    priority: priority || 'medium',
    status: 'pending',
    relatedCustomerId,
    relatedCustomerName,
    createdAt: new Date().toISOString(),
    notes
  };

  if (!db.tasks) db.tasks = [];
  db.tasks.unshift(newTask);

  // Auto-generate notification for assigned employee
  if (!db.notifications) db.notifications = [];
  db.notifications.unshift({
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    targetEmail: newTask.assignedToEmail,
    title: `مهمة جديدة: ${newTask.title}`,
    message: `تم إسناد مهمة جديدة لك من قبل (${newTask.assignedByName}). الموعد: ${newTask.dueDate} ${newTask.dueTime || ''} - التفاصيل: ${newTask.description || 'لا توجد ملاحظات إضافية'}`,
    type: 'task_assigned',
    isRead: false,
    createdAt: new Date().toISOString(),
    linkToTaskId: newTask.id,
    createdByName: newTask.assignedByName
  });

  logActivity(db, {
    type: 'note',
    title: `إسناد مهمة جديدة للموظف (${newTask.assignedToName})`,
    details: `المهمة: ${newTask.title} | الموعد: ${newTask.dueDate} ${newTask.dueTime || ''} | الوصف: ${newTask.description}`,
    performedByEmail: newTask.assignedByEmail,
    performedByName: newTask.assignedByName
  });

  saveDB(db);
  res.json({ message: 'تم إسناد المهمة وإرسال التنبيه الفوري بنجاح', task: newTask });
});

app.put('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { status, notes, priority, dueDate, dueTime } = req.body || {};

  const task = (db.tasks || []).find(t => t.id === id);
  if (!task) {
    return res.status(404).json({ error: 'المهمة غير موجودة' });
  }

  if (status) task.status = status;
  if (notes !== undefined) task.notes = notes;
  if (priority) task.priority = priority;
  if (dueDate) task.dueDate = dueDate;
  if (dueTime) task.dueTime = dueTime;

  if (status === 'completed') {
    task.completedAt = new Date().toISOString();
    
    // Notify admin
    if (!db.notifications) db.notifications = [];
    db.notifications.unshift({
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      targetEmail: DEFAULT_ADMIN_EMAIL,
      title: `تم إنجاز المهمة: ${task.title}`,
      message: `قام الموظف (${task.assignedToName}) بإنجاز المهمة المسندة إليه بنجاح.`,
      type: 'system',
      isRead: false,
      createdAt: new Date().toISOString(),
      linkToTaskId: task.id,
      createdByName: task.assignedToName
    });
  }

  saveDB(db);
  res.json({ message: 'تم تحديث حالة المهمة بنجاح', task });
});

app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  db.tasks = (db.tasks || []).filter(t => t.id !== id);
  saveDB(db);
  res.json({ message: 'تم حذف المهمة بنجاح' });
});

// Notifications Endpoints
app.get('/api/notifications', (req, res) => {
  const { userEmail } = req.query;
  let notifs = db.notifications || [];
  if (userEmail) {
    const clean = (userEmail as string).trim().toLowerCase();
    notifs = notifs.filter(n => (n.targetEmail || '').toLowerCase() === clean || n.targetEmail === 'all' || (clean === DEFAULT_ADMIN_EMAIL.toLowerCase() && n.targetEmail === 'admin'));
  }
  res.json({ notifications: notifs });
});

app.put('/api/notifications/read-all', (req, res) => {
  const { userEmail } = req.query;
  if (userEmail) {
    const clean = (userEmail as string).trim().toLowerCase();
    (db.notifications || []).forEach(n => {
      if ((n.targetEmail || '').toLowerCase() === clean || n.targetEmail === 'all' || (clean === DEFAULT_ADMIN_EMAIL.toLowerCase() && n.targetEmail === 'admin')) {
        n.isRead = true;
      }
    });
    saveDB(db);
  }
  res.json({ message: 'تم تحديث التنبيهات كمقروءة' });
});

// AI Agent Permissions & Approval Control Panel
app.get('/api/admin/ai-permissions', (req, res) => {
  res.json({
    permissions: db.aiPermissions,
    pendingActions: db.aiPendingActions || []
  });
});

app.put('/api/admin/ai-permissions', (req, res) => {
  const { permissions } = req.body || {};
  if (permissions) {
    db.aiPermissions = {
      ...db.aiPermissions,
      ...permissions,
      restrictScopeToWebAppOnly: true // Lock to in-app scope strictly as requested
    };
    saveDB(db);
  }
  res.json({ message: 'تم حفظ وتنسيق صلاحيات الـ AI Agent بنجاح', permissions: db.aiPermissions });
});

app.post('/api/admin/ai-pending-actions/approve', (req, res) => {
  const { actionId } = req.body || {};
  const pending = (db.aiPendingActions || []).find(a => a.id === actionId);
  if (!pending) {
    return res.status(404).json({ error: 'الإجراء المعلق غير موجود' });
  }

  if (pending.actionType === 'create_task') {
    const p = pending.payload;
    const newTask: AppTask = {
      id: `task-${Date.now()}`,
      title: p.title || 'مهمة جديدة',
      description: p.description || '',
      assignedToEmail: p.assignedToEmail,
      assignedToName: p.assignedToName || p.assignedToEmail,
      assignedByEmail: DEFAULT_ADMIN_EMAIL,
      assignedByName: 'الأستاذ حازم (بواسطة AI Manager)',
      dueDate: p.dueDate || new Date().toISOString().split('T')[0],
      dueTime: p.dueTime || '05:00 PM',
      priority: p.priority || 'medium',
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    if (!db.tasks) db.tasks = [];
    db.tasks.unshift(newTask);

    if (!db.notifications) db.notifications = [];
    db.notifications.unshift({
      id: `notif-${Date.now()}`,
      targetEmail: newTask.assignedToEmail,
      title: `مهمة جديدة: ${newTask.title}`,
      message: `تم إسناد مهمة جديدة لك من قبل الإدارة: ${newTask.title}`,
      type: 'task_assigned',
      isRead: false,
      createdAt: new Date().toISOString(),
      linkToTaskId: newTask.id
    });
  }

  pending.status = 'approved';
  db.aiPendingActions = (db.aiPendingActions || []).filter(a => a.id !== actionId);
  saveDB(db);
  res.json({ message: 'تمت الموافقة وتعديل البيانات بنجاح' });
});

app.post('/api/admin/ai-pending-actions/reject', (req, res) => {
  const { actionId } = req.body || {};
  db.aiPendingActions = (db.aiPendingActions || []).filter(a => a.id !== actionId);
  saveDB(db);
  res.json({ message: 'تم رفض الإجراء وإزالته' });
});

// Add Client Property Request endpoint (Accessible by Brokers & Managers to add client orders/requests)
app.post('/api/customers/request', (req, res) => {
  const { clientName, phone, interestType, purpose, location, budget, notes, creatorEmail, creatorName } = req.body || {};

  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    return res.status(400).json({ error: 'يرجى تقديم رقم هاتف العميل بشكل صحيح' });
  }

  const cleanPhone = phone.trim();
  const authorEmail = (creatorEmail || '').trim().toLowerCase();
  const userObj = db.users.find(u => u.email.toLowerCase() === authorEmail);

  const now = new Date().toISOString();

  // Combine property specs into notes and lead details
  const fullSpecs = [
    purpose ? `الغرض: ${purpose}` : null,
    interestType ? `نوع العقار: ${interestType}` : null,
    location ? `المنطقة المطلوبة: ${location}` : null,
    budget ? `الميزانية: ${budget}` : null,
    notes ? `المواصفات والتفاصيل: ${notes}` : null
  ].filter(Boolean).join(' | ');

  const newCust: Customer = {
    id: 'cust-req-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    customerNumber: cleanPhone,
    name: (clientName || '').trim() || 'عميل بطلب عقاري',
    phone: cleanPhone,
    notes: fullSpecs || notes || undefined,
    category: 'lead',
    leadSource: 'direct_lead',
    leadDetails: {
      interestType: interestType ? `${interestType} (${purpose || 'طلب'})` : 'طلب عقاري خاص',
      budget: budget || 'غير محدد',
      notes: fullSpecs || notes || '',
      priority: 'high'
    },
    assignedToEmail: userObj ? userObj.email : (creatorEmail || null),
    assignedToName: userObj ? userObj.name : (creatorName || null),
    assignedAt: now,
    status: 'pending',
    feedbackHistory: [],
    createdByEmail: creatorEmail,
    createdByName: creatorName,
    createdAt: now,
    updatedAt: now
  };

  db.customers.push(newCust);
  assignRefCodesToCustomers(db.customers);

  logActivity(db, {
    customerId: newCust.id,
    customerName: newCust.name,
    customerRefCode: newCust.refCode,
    type: 'created',
    title: 'إضافة طلب عميل جديد بسوق الطلبات المشتركة',
    details: `طلب: ${interestType || 'عقار'} | الميزانية: ${budget || 'غير محددة'} | المنطقة: ${location || 'غير محددة'}`,
    performedByEmail: creatorEmail || 'system',
    performedByName: creatorName || 'النظام'
  });

  saveDB(db);

  return res.json({
    success: true,
    customer: newCust,
    message: 'تم إضافة طلب العميل وتوثيقه بنجاح في سوق الطلبات المشتركة'
  });
});

// Add customer numbers manually or in bulk (Admin/Manager only)
app.post('/api/customers', (req, res) => {
  const { items, autoDistribute, requesterEmail, creatorEmail } = req.body || {}; 
  // items can be string array or object array [{ customerNumber, name, phone, notes }]

  const authorEmail = creatorEmail || requesterEmail || (Array.isArray(items) && items[0] && items[0].createdByEmail);
  if (authorEmail) {
    const userObj = db.users.find(u => u.email.toLowerCase() === authorEmail.trim().toLowerCase());
    if (userObj && userObj.role === 'user') {
      return res.status(403).json({
        error: 'عذراً، يمنع حظراً باتاً على البروكر رفع أية ملفات أو إضافة بيانات رقمية جديدة إلى النظام. إضافة وتوزيع البيانات من اختصاص إدارة النظام حصرياً.'
      });
    }
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'يرجى تقديم قائمة صحيحة من أرقام العملاء' });
  }

  const added: Customer[] = [];
  const now = new Date().toISOString();

  items.forEach((item: any, idx: number) => {
    let customerNum = '';
    let cName = '';
    let cPhone = '';
    let cNotes = '';

    if (typeof item === 'string') {
      customerNum = item.trim();
    } else if (typeof item === 'object') {
      customerNum = item.customerNumber || item.number || item['رقم العميل'] || item['الرقم'] || '';
      cName = item.name || item['الاسم'] || item['اسم العميل'] || '';
      cPhone = item.phone || item['الهاتف'] || item['رقم الجوال'] || '';
      cNotes = item.notes || item['الملاحظات'] || item['ملاحظات'] || '';
    }

    if (customerNum) {
      // check category: 'lead' or 'owner' (defaults to 'owner')
      const categoryVal = (item.category === 'lead' || item.isLead) ? 'lead' : (item.category === 'owner' ? 'owner' : 'owner');
      const leadSourceVal = item.leadSource || (item.isPaidAd ? 'paid_ad' : (categoryVal === 'owner' ? 'direct_owner' : 'organic_marketing'));
      const campaignNameVal = item.campaignName || item['الحملة الإعلانية'] || item['اسم الحملة'] || undefined;

      const newCust: Customer = {
        id: 'cust-' + Date.now() + '-' + idx + '-' + Math.random().toString(36).substr(2, 3),
        customerNumber: customerNum,
        name: cName || undefined,
        phone: cPhone || undefined,
        notes: cNotes || undefined,
        category: categoryVal,
        leadSource: leadSourceVal,
        campaignName: campaignNameVal,
        marketingAccountEmail: item.marketingAccountEmail || item.createdByEmail || undefined,
        leadDetails: item.leadDetails || (categoryVal === 'lead' ? {
          interestType: item.interestType || item['الاهتمام'] || item['المنتج المطلوب'] || 'عميل راغب',
          budget: item.budget || item['الميزانية'],
          priority: item.priority || 'high'
        } : undefined),
        ownerDetails: item.ownerDetails || (categoryVal === 'owner' ? {
          propertyType: item.propertyType || item['نوع العقار'] || 'وحدة عقارية',
          unitLocation: item.unitLocation || item['الموقع'],
          priceOrRent: item.priceOrRent || item['السعر/الإيجار']
        } : undefined),
        assignedToEmail: item.assignedToEmail || null,
        assignedToName: item.assignedToName || null,
        status: 'pending',
        feedbackHistory: [],
        createdByEmail: item.createdByEmail,
        createdByName: item.createdByName,
        createdAt: now,
        updatedAt: now
      };
      db.customers.push(newCust);
      added.push(newCust);
    }
  });

  assignRefCodesToCustomers(db.customers);

  // Log activities for added customers
  added.forEach(c => {
    logActivity(db, {
      customerId: c.id,
      customerName: c.name,
      customerRefCode: c.refCode,
      type: 'created',
      title: `إضافة ${c.category === 'owner' ? 'مالك عقار' : 'عميل محتمل'} جديد`,
      details: `رقم العميل: ${c.customerNumber} | المصدر: ${c.leadSource || 'مباشر'}`,
      performedByEmail: c.createdByEmail || 'system',
      performedByName: c.createdByName || 'النظام'
    });
  });

  saveDB(db);

  let distributeResult = null;
  if (autoDistribute) {
    distributeResult = distributeCustomersEqually(db, { onlyUnassigned: true });
  }

  res.json({
    message: `تمت إضافة ${added.length} من أرقام العملاء بنجاح`,
    count: added.length,
    distributeResult
  });
});

// Update Customer Category (Convert to Lead, Owner, or Contact) & Details
app.post('/api/customers/:id/category', (req, res) => {
  const { id } = req.params;
  const { category, leadSource, campaignName, leadDetails, ownerDetails } = req.body;

  const customer = db.customers.find(c => c.id === id);
  if (!customer) {
    return res.status(404).json({ error: 'لم يتم العثور على العميل' });
  }

  if (category) {
    customer.category = category === 'lead' ? 'lead' : (category === 'owner' ? 'owner' : 'contact');
  }

  if (leadSource) {
    customer.leadSource = leadSource;
  }

  if (campaignName) {
    customer.campaignName = campaignName;
  }

  if (leadDetails) {
    customer.leadDetails = {
      ...(customer.leadDetails || {}),
      ...leadDetails
    };
  }

  if (ownerDetails) {
    customer.ownerDetails = {
      ...(customer.ownerDetails || {}),
      ...ownerDetails
    };
  }

  customer.updatedAt = new Date().toISOString();
  saveDB(db);

  const catLabel = customer.category === 'lead' ? 'عميل محتمل (Lead) 🎯' : customer.category === 'owner' ? 'مالك عقار (Owner) 🏢' : 'دليل الاتصال العام 📇';
  res.json({
    message: `تم تصنيف العميل كـ ${catLabel} بنجاح`,
    customer
  });
});

// Trigger Equal Distribution
app.post('/api/customers/distribute', (req, res) => {
  const { redistributeAll } = req.body;
  const result = distributeCustomersEqually(db, { onlyUnassigned: !redistributeAll });
  
  res.json({
    message: redistributeAll 
      ? `تمت إعادة توزيع جميع العملاء (${result.distributedCount}) بالتساوي على ${result.userCount} من المستخدمين المعتمدين`
      : `تم توزيع العملاء الجدد (${result.distributedCount}) بالتساوي على ${result.userCount} من المستخدمين المعتمدين`,
    result,
    customers: db.customers
  });
});

// Add feedback or status note on a customer number
app.post('/api/customers/:id/feedback', (req, res) => {
  const { id } = req.params;
  const { text, status, authorEmail, authorName, followUpDate, followUpNote } = req.body;

  const customer = db.customers.find(c => c.id === id);
  if (!customer) {
    return res.status(404).json({ error: 'لم يتم العثور على العميل' });
  }

  // Mandatory Business Rule Validation: Check if the user has conducted a Call or WhatsApp contact first
  const isCallOrWaLog = (text || '').includes('📞') || (text || '').includes('💬') || (text || '').includes('اتصال') || (text || '').includes('واتساب');
  const hasPriorContact = (customer.feedbackHistory || []).some(f => 
    (f.text || '').includes('📞') || (f.text || '').includes('💬') || (f.text || '').includes('اتصال') || (f.text || '').includes('واتساب')
  );
  const authorUser = db.users.find(u => u.email.toLowerCase() === (authorEmail || '').trim().toLowerCase());
  const isAdminUser = authorUser?.role === 'admin';

  if (!isCallOrWaLog && !hasPriorContact && !isAdminUser) {
    return res.status(400).json({ 
      error: 'عذراً، لا يمكنك إضافة ملاحظات أو تقييم لهذا العميل حتى يتم إجراء اتصال هاتف 📞 أو مراسلة العميل عبر الواتساب 💬 أولاً.' 
    });
  }

  const newFeedback = {
    id: 'fb-' + Date.now(),
    text: text || 'تحديث حالة',
    status: (status as CustomerStatus) || customer.status,
    date: new Date().toISOString(),
    authorEmail: authorEmail || 'unknown@gmail.com',
    authorName: authorName || authorEmail,
    followUpDate: followUpDate || undefined
  };

  customer.feedbackHistory.unshift(newFeedback);
  if (status) {
    customer.status = status;
    customer.lastOutcomePreset = status;
  }
  if (followUpDate !== undefined) {
    customer.nextFollowUpDate = followUpDate ? followUpDate : null;
    customer.nextFollowUpNote = followUpNote || (followUpDate ? text : null);
  }
  customer.updatedAt = new Date().toISOString();

  logActivity(db, {
    customerId: customer.id,
    customerName: customer.name,
    customerRefCode: customer.refCode,
    type: status ? 'status_change' : 'note',
    title: status ? `تحديث النتيجة: ${status}` : 'إضافة ملاحظة متابعة',
    details: text,
    outcome: status,
    performedByEmail: authorEmail || 'system',
    performedByName: authorName || authorEmail || 'الموظف',
    followUpDate: followUpDate || undefined
  });

  saveDB(db);
  res.json({ message: 'تم حفظ الملاحظة وجدولة المتابعة بنجاح', customer });
});

// Update or Clear Follow-up date specifically
app.post('/api/customers/:id/follow-up', (req, res) => {
  const { id } = req.params;
  const { followUpDate, followUpNote } = req.body;

  const customer = db.customers.find(c => c.id === id);
  if (!customer) {
    return res.status(404).json({ error: 'لم يتم العثور على العميل' });
  }

  customer.nextFollowUpDate = followUpDate || null;
  customer.nextFollowUpNote = followUpNote || null;
  customer.updatedAt = new Date().toISOString();

  saveDB(db);
  res.json({ message: followUpDate ? 'تم تحديد موعد المتابعة بنجاح' : 'تم إلغاء المتابعة', customer });
});

// Update Owner Marketing & Registration Workflow Steps
app.post('/api/customers/:id/owner-workflow', (req, res) => {
  const { id } = req.params;
  const { ownerWorkflow, authorName, authorEmail } = req.body || {};

  const customer = db.customers.find(c => c.id === id);
  if (!customer) {
    return res.status(404).json({ error: 'لم يتم العثور على المالك' });
  }

  customer.ownerWorkflow = {
    ...(customer.ownerWorkflow || {}),
    ...(ownerWorkflow || {})
  };
  customer.updatedAt = new Date().toISOString();

  // Log workflow update step into feedbackHistory for complete audit trail
  const changesText = [];
  if (ownerWorkflow?.ownerAware !== undefined) changesText.push(ownerWorkflow.ownerAware ? 'تأكيد توعية المالك بالوحدة المسجلة' : 'إلغاء توعية المالك');
  if (ownerWorkflow?.detailsReceived !== undefined) changesText.push(ownerWorkflow.detailsReceived ? 'استلام كامل التفاصيل والصور من المالك' : 'عدم استلام التفاصيل');
  if (ownerWorkflow?.postedInAdsGroup !== undefined) changesText.push(ownerWorkflow.postedInAdsGroup ? 'تم النشر على جروب الإعلانات (Ads Group)' : 'إزالة من جروب الإعلانات');
  if (ownerWorkflow?.postedOnFbMarketplace !== undefined) changesText.push(ownerWorkflow.postedOnFbMarketplace ? 'تم النشر على فيسبوك ماركت بليس (FB Marketplace)' : 'إزالة من ماركت بليس');
  if (ownerWorkflow?.ownerResponded !== undefined) changesText.push(`استجابة المالك: ${ownerWorkflow.ownerResponded === 'yes' ? 'استجاب وأرسل التفاصيل' : ownerWorkflow.ownerResponded === 'no' ? 'لم يستجب' : 'بانتظار الاستجابة'}`);

  if (changesText.length > 0) {
    if (!customer.feedbackHistory) customer.feedbackHistory = []; // Null-guard
    customer.feedbackHistory.unshift({
      id: 'wf-' + Date.now(),
      text: `⚙️ [تحديث خطوات تسويق المالك]: ${changesText.join(' | ')}`,
      status: customer.status || 'تحديث تسويقي',
      date: new Date().toISOString(),
      authorEmail: authorEmail || 'system@gmail.com',
      authorName: authorName || 'متابعة الملاك'
    });
  }

  saveDB(db);
  res.json({ message: 'تم حفظ وتحديث خطوات تسويق المالك بنجاح', customer });
});

// Request Transfer to Colleague (Broker Request)
app.post('/api/customers/:id/transfer-request', (req, res) => {
  const { id } = req.params;
  const { targetEmail, reasonNote, requestedByEmail } = req.body;

  const customer = db.customers.find(c => c.id === id);
  if (!customer) {
    return res.status(404).json({ error: 'لم يتم العثور على الرقم / العميل' });
  }

  const targetUser = db.users.find(u => u.email.toLowerCase() === (targetEmail || '').trim().toLowerCase());
  if (!targetUser) {
    return res.status(404).json({ error: 'الموظف / الزميل المستهدف غير موجود' });
  }

  const requester = db.users.find(u => u.email.toLowerCase() === (requestedByEmail || '').trim().toLowerCase());

  customer.transferRequest = {
    id: 'tr-' + Date.now(),
    requestedByEmail: requester ? requester.email : requestedByEmail,
    requestedByName: requester ? requester.name : requestedByEmail,
    targetEmail: targetUser.email,
    targetName: targetUser.name,
    reasonNote: reasonNote || 'طلب تحويل مع تعليق',
    createdAt: new Date().toISOString(),
    status: 'pending'
  };

  customer.updatedAt = new Date().toISOString();
  saveDB(db);

  res.json({
    message: `تم تقديم طلب تحويل العميل إلى الزميل (${targetUser.name}) بنجاح وبانتظار اعتماده من المشرف ⏳`,
    customer
  });
});

// Approve Transfer Request (Admin Approval)
app.post('/api/customers/:id/approve-transfer', (req, res) => {
  const { id } = req.params;
  const { adminEmail, adminName } = req.body || {};

  const customer = db.customers.find(c => c.id === id);
  if (!customer || !customer.transferRequest) {
    return res.status(404).json({ error: 'لا يوجد طلب تحويل معلق لهذا العميل' });
  }

  const tr = customer.transferRequest;
  const { targetEmail, targetName, requestedByEmail, requestedByName, reasonNote, createdAt } = tr;

  customer.assignedToEmail = targetEmail;
  customer.assignedToName = targetName;
  customer.transferRequest = null;
  customer.updatedAt = new Date().toISOString();

  // Create Activity Log entry recording complete transfer details
  const supervisorName = adminName || 'المشرف العام';
  const supervisorEmail = adminEmail || DEFAULT_ADMIN_EMAIL;

  const activityLog = {
    id: 'act-' + Date.now(),
    text: `📋 [سجل النشاط - تحويل ملكية]: تم قبول تحويل ملكية الـ ${customer.category === 'owner' ? 'مالك (Owner)' : 'عميل (Lead)'} من البروكر (${requestedByName || requestedByEmail}) إلى البروكر الجديد (${targetName || targetEmail}) بعد اعتماد المشرف (${supervisorName}). السبب: "${reasonNote}". تاريخ ووقت الطلب الأصلي: ${new Date(createdAt).toLocaleString('ar-EG')}`,
    status: 'تم تحويل الملكية ✅',
    date: new Date().toISOString(),
    authorEmail: supervisorEmail,
    authorName: supervisorName
  };

  // Null-guard: initialize feedbackHistory if it doesn't exist
  if (!customer.feedbackHistory) customer.feedbackHistory = [];
  customer.feedbackHistory.unshift(activityLog);
  saveDB(db);

  res.json({
    message: `تم قبول طلب التحويل ونقل ملكية الـ ${customer.category === 'owner' ? 'مالك' : 'عميل'} إلى (${targetName}) وتسجيل العملية في سجل النشاط بنجاح ✅`,
    customer
  });
});

// Reject Transfer Request
app.post('/api/customers/:id/reject-transfer', (req, res) => {
  const { id } = req.params;

  const customer = db.customers.find(c => c.id === id);
  if (!customer) {
    return res.status(404).json({ error: 'لم يتم العثور على العميل' });
  }

  customer.transferRequest = null;
  customer.updatedAt = new Date().toISOString();

  saveDB(db);

  res.json({ message: 'تم إيقاف / رفض طلب التحويل', customer });
});

// Reassign customer to specific employee
app.post('/api/customers/:id/reassign', (req, res) => {
  const { id } = req.params;
  const { targetEmail } = req.body; // string or null

  const customer = db.customers.find(c => c.id === id);
  if (!customer) {
    return res.status(404).json({ error: 'لم يتم العثور على العميل' });
  }

  if (!targetEmail) {
    customer.assignedToEmail = null;
    customer.assignedToName = null;
  } else {
    const targetUser = db.users.find(u => u.email.toLowerCase() === targetEmail.trim().toLowerCase());
    if (!targetUser) {
      return res.status(404).json({ error: 'الموظف المستهدف غير موجود' });
    }
    customer.assignedToEmail = targetUser.email;
    customer.assignedToName = targetUser.name;
  }

  customer.updatedAt = new Date().toISOString();
  saveDB(db);

  res.json({ message: 'تمت إعادة تخصيص العميل بنجاح', customer });
});

// Delete customer or clear all
app.delete('/api/customers/:id', (req, res) => {
  const { id } = req.params;
  if (id === 'all') {
    db.customers = [];
    saveDB(db);
    return res.json({ message: 'تم حذف جميع بيانات العملاء' });
  }

  db.customers = db.customers.filter(c => c.id !== id);
  saveDB(db);
  res.json({ message: 'تم حذف العميل بنجاح' });
});

// Google Sheet Sync / Parse URL endpoint
app.post('/api/sheets/fetch', async (req, res) => {
  const { sheetUrl, autoDistribute } = req.body;

  if (!sheetUrl) {
    return res.status(400).json({ error: 'رابط Google Sheet مطلوب' });
  }

  try {
    // Extract sheet ID from standard Google Sheets URL
    // e.g. https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0
    const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      return res.status(400).json({ error: 'رابط Google Sheet غير صالح. يرجى التأكد من أن الرابط يحتوي على معرف المستند /d/...' });
    }

    const sheetId = match[1];

    // Attempt fetching via public CSV export URL or Sheet API
    const csvExportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

    const response = await fetch(csvExportUrl);
    if (!response.ok) {
      return res.status(400).json({
        error: 'لم نتمكن من الوصول للمستند. يرجى التأكد من اختيار (أمي أصل للرابط) "Anyone with the link can view" في إعدادات المشاركة بـ Google Sheets.'
      });
    }

    const csvText = await response.text();
    
    // Parse CSV lines
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) {
      return res.status(400).json({ error: 'جدول البيانات فارغ' });
    }

    // Process rows
    const importedItems: { customerNumber: string; name?: string; phone?: string; notes?: string }[] = [];
    
    // Check if first line is header
    let startIdx = 0;
    const headerLine = lines[0].toLowerCase();
    if (headerLine.includes('رقم') || headerLine.includes('number') || headerLine.includes('اسم') || headerLine.includes('phone') || headerLine.includes('عميل')) {
      startIdx = 1;
    }

    for (let i = startIdx; i < lines.length; i++) {
      // simple CSV parsing handling commas
      const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
      if (cols.length > 0 && cols[0]) {
        importedItems.push({
          customerNumber: cols[0],
          name: cols[1] || undefined,
          phone: cols[2] || undefined,
          notes: cols[3] || undefined
        });
      }
    }

    // Insert imported items
    const now = new Date().toISOString();
    let addedCount = 0;

    importedItems.forEach((item, idx) => {
      if (item.customerNumber) {
        db.customers.push({
          id: 'cust-sheet-' + Date.now() + '-' + idx,
          customerNumber: item.customerNumber,
          name: item.name,
          phone: item.phone,
          notes: item.notes || 'مستورد من Google Sheet',
          assignedToEmail: null,
          assignedToName: null,
          status: 'pending',
          feedbackHistory: [],
          createdAt: now,
          updatedAt: now
        });
        addedCount++;
      }
    });

    db.sheetConfig = {
      sheetUrl,
      sheetId,
      lastSyncedAt: now,
      autoSync: false
    };

    saveDB(db);

    let distributeResult = null;
    if (autoDistribute) {
      distributeResult = distributeCustomersEqually(db, { onlyUnassigned: true });
    }

    res.json({
      message: `تم جلب واستيراد ${addedCount} عميل بنجاح من Google Sheet`,
      importedCount: addedCount,
      sheetId,
      distributeResult,
      customers: db.customers
    });

  } catch (err: any) {
    console.error('Sheet fetch error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب البيانات من Google Sheet: ' + (err.message || err) });
  }
});

// GET /api/activities - Retrieve persistent system activity log
app.get('/api/activities', (req, res) => {
  const { customerId, userEmail, limit, type } = req.query;
  let list = db.activities || [];

  if (customerId) {
    list = list.filter(a => a.customerId === customerId);
  }
  if (userEmail) {
    const cleanEmail = (userEmail as string).trim().toLowerCase();
    list = list.filter(a => (a.performedByEmail || '').toLowerCase() === cleanEmail);
  }
  if (type) {
    list = list.filter(a => a.type === type);
  }

  const max = limit ? parseInt(limit as string, 10) : 150;
  res.json({ activities: list.slice(0, max) });
});

// POST /api/activities - Create new activity log entry persistently
app.post('/api/activities', (req, res) => {
  const { customerId, type, title, details, outcome, performedByEmail, performedByName, followUpDate } = req.body || {};

  if (!title) {
    return res.status(400).json({ error: 'عنوان النشاط مطلوب' });
  }

  // Strict Deduplication check: Enforce ONE single call or whatsapp log per customer across the entire system
  if (customerId && (type === 'call' || type === 'whatsapp')) {
    const customer = db.customers.find(c => c.id === customerId);
    const existingActivity = (db.activities || []).find(a => 
      a.customerId === customerId && a.type === type
    );

    const existingFeedback = customer?.feedbackHistory?.find(f => {
      const text = f.text || '';
      if (type === 'call' && (text.includes('📞') || text.includes('اتصال'))) return true;
      if (type === 'whatsapp' && (text.includes('💬') || text.includes('واتساب'))) return true;
      return false;
    });

    if (existingActivity || existingFeedback) {
      if (customer && customer.status === 'pending') {
        customer.status = 'contacted';
        customer.updatedAt = new Date().toISOString();
        saveDB(db);
      }
      return res.json({ 
        message: 'تم تسجيل وتوثيق الاتصال لهذا العميل سابقاً - مكالمة واحدة فقط محفوظة ولا يتم التكرار', 
        activity: existingActivity || {
          id: existingFeedback?.id || 'act-existing',
          customerId,
          type,
          title,
          details,
          timestamp: existingFeedback?.date || new Date().toISOString(),
          performedByEmail: existingFeedback?.authorEmail || performedByEmail || 'system',
          performedByName: existingFeedback?.authorName || performedByName || 'الموظف'
        },
        duplicatePrevented: true 
      });
    }
  }

  let customerName: string | undefined;
  let customerRefCode: string | undefined;

  if (customerId) {
    const customer = db.customers.find(c => c.id === customerId);
    if (customer) {
      customerName = customer.name;
      customerRefCode = customer.refCode;

      // Append feedback history item on customer for direct view
      const fbItem = {
        id: 'act-fb-' + Date.now(),
        text: `${title}${details ? `: ${details}` : ''}`,
        status: (outcome as CustomerStatus) || customer.status || 'تحديث نشاط',
        date: new Date().toISOString(),
        authorEmail: performedByEmail || 'system',
        authorName: performedByName || 'الموظف',
        followUpDate: followUpDate || undefined
      };
      customer.feedbackHistory.unshift(fbItem);

      if (outcome) {
        customer.status = outcome as CustomerStatus;
        customer.lastOutcomePreset = outcome;
      } else if (customer.status === 'pending') {
        customer.status = 'contacted';
      }
      customer.updatedAt = new Date().toISOString();
    }
  }

  const activity = logActivity(db, {
    customerId,
    customerName,
    customerRefCode,
    type: type || 'note',
    title,
    details,
    outcome,
    performedByEmail: performedByEmail || 'system',
    performedByName: performedByName || 'النظام',
    followUpDate
  });

  saveDB(db);

  res.json({ message: 'تم تسجيل النشاط بنجاح وحفظه في السيرفر', activity });
});

// Helper to convert raw PCM l16 24kHz audio from Gemini into a standard WAV buffer
function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitDepth = 16): Buffer {
  const header = Buffer.alloc(44);
  const dataLength = pcmBuffer.length;

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * (bitDepth / 8), 28); // ByteRate
  header.writeUInt16LE(numChannels * (bitDepth / 8), 32); // BlockAlign
  header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);

  return Buffer.concat([header, pcmBuffer]);
}

// Generate spoken audio using official Gemini TTS model with automatic retry & sanitization
async function generateGeminiSpeech(text: string, voiceName: string = 'Zephyr', retries: number = 2): Promise<string | null> {
  try {
    const ai = getGenAI();
    // Thoroughly clean text from markdown, bullets, asterisks, hashtags, brackets, and dashes for human speech
    let cleanText = text
      .replace(/[*_#`~•]/g, ' ')
      .replace(/^\s*[-–—]\s+/gm, '')
      .replace(/^\s*[\d\w]+[\.\)]\s+/gm, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[\{\}\[\]\(\)<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return null;

    // Keep text concise for voice synthesis (~350 chars max for instant 500ms audio generation)
    if (cleanText.length > 350) {
      const sentenceEnd = cleanText.search(/[.؟!]\s/);
      if (sentenceEnd > 100 && sentenceEnd < 380) {
        cleanText = cleanText.slice(0, sentenceEnd + 1);
      } else {
        cleanText = cleanText.slice(0, 350);
      }
    }

    const validVoice = ['Zephyr', 'Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede'].includes(voiceName) ? voiceName : 'Puck';
    const ttsModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-3.1-flash-tts-preview'];

    for (const ttsModel of ttsModels) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: ttsModel,
            contents: [{ parts: [{ text: cleanText }] }],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: validVoice }
                }
              }
            }
          });

          const part = response.candidates?.[0]?.content?.parts?.[0];
          const base64Audio = part?.inlineData?.data;

          if (base64Audio) {
            const rawPcm = Buffer.from(base64Audio, 'base64');
            const wavBuffer = pcmToWav(rawPcm, 24000, 1, 16);
            return `data:audio/wav;base64,${wavBuffer.toString('base64')}`;
          }
        } catch (err: any) {
          const isRateLimit = err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('quota');
          if (isRateLimit && attempt < retries) {
            console.warn(`[Gemini TTS Retry]: Rate limit hit on ${ttsModel}, retrying attempt ${attempt + 1}/${retries}...`);
            await new Promise(resolve => setTimeout(resolve, 800));
            continue;
          }
          if (isRateLimit) {
            console.warn(`[Gemini TTS Quota]: Quota limit on ${ttsModel}.`);
            break; // try next model or return null
          }
        }
      }
    }
  } catch (err: any) {
    console.error('Unexpected error in generateGeminiSpeech:', err?.message || err);
  }
  return null;
}

// Lazy GenAI initialization that always reads current process.env.GEMINI_API_KEY
function getGenAI(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

// POST /api/admin/ai-tts - Dedicated Gemini Voice Synthesis Endpoint
app.post('/api/admin/ai-tts', async (req, res) => {
  try {
    const { text, voice = 'Zephyr' } = req.body || {};
    if (!text) {
      return res.status(400).json({ error: 'يرجى تزويد النص المراد تحويله لصوت جميناي' });
    }
    const audioUrl = await generateGeminiSpeech(text, voice);
    if (!audioUrl) {
      return res.json({ audioUrl: null, fallback: false, voice, message: 'تعذر توليد صوت جميناي، يرجى المحاولة لاحقاً' });
    }
    res.json({ audioUrl, voice });
  } catch (err: any) {
    res.json({ audioUrl: null, fallback: false, error: err.message || 'خطأ في توليد الصوت' });
  }
});

// POST /api/admin/ai-query - Admin Voice & Business Intelligence Query Assistant
app.post('/api/admin/ai-query', async (req, res) => {
  const reqVoice = req.body?.voice || 'Zephyr';
  try {
    const { query, adminEmail, history, voice = reqVoice, generateVoice = true } = req.body || {};

    if (adminEmail) {
      const currentDb = loadDB();
      const user = currentDb.users.find(u => u.email?.toLowerCase() === adminEmail.toLowerCase());
      if (user && user.role !== 'admin') {
        return res.status(403).json({ error: 'عذراً، هذه الخدمة والتحليلات مخصصة حصرياً للمدير المسؤول (Admin) فقط.' });
      }
    }

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'يرجى إدخال السؤال نصياً أو بالتسجيل الصوتي' });
    }

    const currentDb = loadDB();

    // Trigger anomaly detection scan
    detectSystemAnomalies(currentDb);

    // Build streamlined real-time database snapshot for ultra-fast AI analysis (<500ms)
    const totalCustomers = currentDb.customers.length;
    const leads = currentDb.customers.filter(c => c.category === 'lead');
    const owners = currentDb.customers.filter(c => c.category === 'owner');
    const otherContacts = currentDb.customers.filter(c => c.category !== 'lead' && c.category !== 'owner');
    const unassigned = currentDb.customers.filter(c => !c.assignedToEmail);

    const statusCounts: Record<string, number> = {};
    currentDb.customers.forEach(c => {
      const st = c.status || 'pending';
      statusCounts[st] = (statusCounts[st] || 0) + 1;
    });

    const userStats = currentDb.users.map(u => {
      const uCusts = currentDb.customers.filter(c => c.assignedToEmail?.toLowerCase() === u.email?.toLowerCase());
      const contacted = uCusts.filter(c => c.status !== 'pending' || (c.feedbackHistory && c.feedbackHistory.length > 0));
      const resolved = uCusts.filter(c => c.status && c.status !== 'pending' && c.status !== 'contacted');

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        username: u.username,
        role: u.role,
        status: u.status,
        dailyQuota: u.dailyLeadQuota || u.dailyQuota || 10,
        totalAssigned: uCusts.length,
        contactedCount: contacted.length,
        resolvedCount: resolved.length,
        recentFeedbackCount: uCusts.filter(c => (c.feedbackHistory?.length || 0) > 0).length
      };
    });

    const recentActivities = (currentDb.activities || []).slice(0, 10).map(a => ({
      title: a.title,
      details: a.details,
      type: a.type,
      performedByName: a.performedByName,
      timestamp: a.timestamp
    }));

    const activeTasks = (currentDb.tasks || []).slice(0, 10).map(t => ({
      id: t.id,
      title: t.title,
      assignedToName: t.assignedToName,
      dueDate: t.dueDate,
      status: t.status
    }));
    const securityAlerts = (currentDb.notifications || []).filter(n => n.type === 'security_anomaly');

    const projectContext = {
      summary: {
        totalCustomers,
        leadsCount: leads.length,
        ownersCount: owners.length,
        otherContactsCount: otherContacts.length,
        unassignedCount: unassigned.length,
        statusBreakdown: statusCounts,
        totalActivitiesLogged: (currentDb.activities || []).length,
        securityAnomaliesCount: securityAlerts.length
      },
      employeesPerformance: userStats,
      activeTasksList: activeTasks,
      recentAuditLogs: recentActivities,
      aiPermissions: currentDb.aiPermissions
    };

    const systemInstruction = `أنت الخبير التنفيذي للذكاء الاصطناعي والمساعد الصوتي المباشر للأستاذ حازم (مدير النظام).
تتمتع بصلاحيتين رئيسيتين:
1. قراءة فورية لقاعدة البيانات الحية للمشروع: ${JSON.stringify(projectContext)}
2. قدرة التصفح الفوري المباشر عبر الشابكة وبحث Google عن أي معلومات خارجية (أسعار، أخبار، معلومات عن شركات، طقس، تقارير سوقية، أو أي موضوع آخر عام على الإنترنت).

تعليمات التحدث والإجابة الشفهية والنصية:
1. تحدث كبشر حقيقي تماماً، كشريك تنفيذي ومستشار إداري يتحدث بلغة عربية سلسة ومباشرة ومختصرة ومفيدة.
2. حظر تام ونهائي لاستخدام النقط (bullet points) أو النجوم (*) أو الشرطات (-) أو الرموز والتنسيقات الماركدوان مثل (*, **, #, •, 1., 2.).
3. ممنوع الترقيم أو كتابة الأرقام في شكل قوائم. صغ الكلام في جمل عربية مفيدة ومسبوكة كأنك تتحدث هاتفياً.
4. اجعل الرد متوازناً وموجزاً (1 إلى 3 جمل مفيدة) حتى ينطق بسرعة فائقة وبصوت بشري نقي جداً.
5. إذا طلب الأستاذ حازم إسناد مهمة لموظف (مثلاً: أبلغ باسل أو موظف معين بمهمة أو موعد):
   - قم بالرد عليه شفهياً بطريقة بشرية تؤكد الفهم.
   - أرفق وسماً تنفيذياً في أخر الرد بالشكل الدقيق التالي:
   [[ACTION:CREATE_TASK|assignedToEmail=بريد_الموظف|assignedToName=اسم_الموظف|title=عنوان_المهمة|description=التفاصيل|dueDate=YYYY-MM-DD|dueTime=05:00 PM]]`;

    // Construct conversation history
    const formattedHistory: any[] = [];
    if (Array.isArray(history)) {
      history.slice(-6).forEach((item: any) => {
        if (item.sender === 'user') {
          formattedHistory.push({ role: 'user', parts: [{ text: item.text }] });
        } else if (item.sender === 'ai') {
          formattedHistory.push({ role: 'model', parts: [{ text: item.text }] });
        }
      });
    }

    const contents = [
      { role: 'user', parts: [{ text: `${systemInstruction}\n\nسؤال المدير الحالي: "${query.trim()}"` }] },
      ...formattedHistory
    ];

    let finalContents: any = contents;
    if (formattedHistory.length > 0) {
      finalContents = [
        { role: 'user', parts: [{ text: `${systemInstruction}\n\nنبدأ المحادثة.` }] },
        { role: 'model', parts: [{ text: 'أهلاً بك يا مدير النظام. أنا جاهز ومزود بالبحث الفوري وبيانات القاعدة.' }] },
        ...formattedHistory,
        { role: 'user', parts: [{ text: query.trim() }] }
      ];
    }

    const ai = getGenAI();
    const queryModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let responseText: string | null = null;
    let lastError: any = null;

    for (const modelName of queryModels) {
      try {
        const res = await ai.models.generateContent({
          model: modelName,
          contents: finalContents,
          config: {
            tools: [{ googleSearch: {} }]
          }
        });
        if (res?.text) {
          responseText = res.text;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini Model Fallback]: Model ${modelName} encountered error:`, err?.message || err);
      }
    }

    if (!responseText && lastError) {
      throw lastError;
    }

    let rawAnswer = responseText || 'أهلاً بك يا أستاذ حازم. أنا جاهز لمساعدتك.';

    // Check for ACTION tag in response
    const actionMatch = rawAnswer.match(/\[\[ACTION:CREATE_TASK\|(.*?)\]\]/);
    if (actionMatch) {
      const actionParamsStr = actionMatch[1];
      const paramsMap: Record<string, string> = {};
      actionParamsStr.split('|').forEach(pair => {
        const [k, v] = pair.split('=');
        if (k && v) paramsMap[k.trim()] = v.trim();
      });

      const targetEmail = paramsMap.assignedToEmail || 'employee@gmail.com';
      const targetName = paramsMap.assignedToName || targetEmail;
      const taskTitle = paramsMap.title || 'موعد مهمة جديد';
      const taskDesc = paramsMap.description || 'تنبيه موعد مسند من الإدارة';
      const dueDateVal = paramsMap.dueDate || new Date().toISOString().split('T')[0];
      const dueTimeVal = paramsMap.dueTime || '05:00 PM';

      if (currentDb.aiPermissions?.executionMode === 'require_approval') {
        if (!currentDb.aiPendingActions) currentDb.aiPendingActions = [];
        currentDb.aiPendingActions.unshift({
          id: `pending-${Date.now()}`,
          actionType: 'create_task',
          title: `إسناد مهمة: ${taskTitle}`,
          details: `موجهة إلى (${targetName}) - الموعد: ${dueDateVal} ${dueTimeVal}`,
          payload: {
            assignedToEmail: targetEmail,
            assignedToName: targetName,
            title: taskTitle,
            description: taskDesc,
            dueDate: dueDateVal,
            dueTime: dueTimeVal
          },
          createdAt: new Date().toISOString(),
          status: 'pending'
        });
        saveDB(currentDb);
      } else {
        // Auto execution
        const newTask: AppTask = {
          id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          title: taskTitle,
          description: taskDesc,
          assignedToEmail: targetEmail,
          assignedToName: targetName,
          assignedByEmail: DEFAULT_ADMIN_EMAIL,
          assignedByName: 'أستاذ حازم (إدارة النظام)',
          dueDate: dueDateVal,
          dueTime: dueTimeVal,
          priority: 'high',
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        if (!currentDb.tasks) currentDb.tasks = [];
        currentDb.tasks.unshift(newTask);

        if (!currentDb.notifications) currentDb.notifications = [];
        currentDb.notifications.unshift({
          id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          targetEmail: targetEmail,
          title: `موعد ومهمة جديدة: ${taskTitle}`,
          message: `تم إسناد مهمة جديدة لك من قبل الإدارة: ${taskTitle} (الموعد: ${dueDateVal} ${dueTimeVal})`,
          type: 'task_assigned',
          isRead: false,
          createdAt: new Date().toISOString(),
          linkToTaskId: newTask.id
        });

        logActivity(currentDb, {
          type: 'note',
          title: `إسناد مهمة وموعد جديد لـ (${targetName}) عبر AI Manager`,
          details: `المهمة: ${taskTitle} | الموعد: ${dueDateVal} ${dueTimeVal}`,
          performedByEmail: DEFAULT_ADMIN_EMAIL,
          performedByName: 'أستاذ حازم (عبر AI)'
        });

        saveDB(currentDb);
      }
    }

    // Strip action tag from answer
    let answer = rawAnswer.replace(/\[\[ACTION:.*?\]\]/g, '');

    // Strip out any bullet points (*, -, •), bold markers (**), or list numbers
    answer = answer
      .replace(/[*_#`~•]/g, '')
      .replace(/^\s*[-–—]\s+/gm, '')
      .replace(/^\s*[\d\w]+[\.\)]\s+/gm, '')
      .replace(/\n\s*\n/g, ' ')
      .trim();

    let audioUrl: string | null = null;
    if (generateVoice) {
      audioUrl = await generateGeminiSpeech(answer, voice);
    }

    res.json({ answer, audioUrl, voice, timestamp: new Date().toISOString() });

  } catch (err: any) {
    const errText = String(err?.message || err);
    const isQuotaError = err?.status === 429 || errText.includes('429') || errText.includes('quota') || errText.includes('RESOURCE_EXHAUSTED');

    if (isQuotaError) {
      console.warn('[Gemini Quota Notice]: API rate limit or quota exceeded.');
      const quotaAnswer = 'أهلاً بك يا أستاذ حازم. تم الوصول للحد الأقصى المؤقت لاستعلامات الذكاء الاصطناعي، جميع بيانات التحليلات والنظام الحية متوفرة في لوحات التقارير، ويمكنك إعادة المحاولة خلال دقيقة.';
      return res.json({
        answer: quotaAnswer,
        audioUrl: null,
        voice: reqVoice,
        isQuotaLimit: true,
        timestamp: new Date().toISOString()
      });
    }

    console.error('AI Query Error:', err);
    return res.json({
      answer: 'عذراً يا أستاذ حازم، حدث تعثر مؤقت أثناء معالجة الاستعلام. جميع بيانات اللوحات والتقارير متاحة بدقة في النظام.',
      audioUrl: null,
      voice: reqVoice,
      error: errText,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/transcribe - Audio Voice Transcription Endpoint using Gemini
app.post('/api/transcribe', async (req, res) => {
  try {
    const { audioData, mimeType } = req.body || {};
    if (!audioData) {
      return res.status(400).json({ error: 'لم يتم تزويد الصوت للتفريغ' });
    }

    const ai = getGenAI();
    const cleanBase64 = audioData.includes(',') ? audioData.split(',')[1] : audioData;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType || 'audio/webm'
            }
          },
          {
            text: 'قم بتفريغ الصوت المرفق بدقة متناهية إلى نص عربي مكتوب. أرجع النص المفرغ فقط بدون أي زيادات.'
          }
        ]
      }
    });

    const transcript = (response.text || '').trim();
    res.json({ transcript });
  } catch (err: any) {
    console.error('Audio Transcription Error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تفريغ التسجيل الصوتي: ' + (err.message || err) });
  }
});

// JSON Fallback for unmatched API routes to prevent HTML index.html responses
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `الرابط غير موجود في الباك إند: ${req.originalUrl}` });
});

// Vite middleware & Production static serving
async function startServer() {
  console.log('🚀 Booting Server with Google Drive as Single Source of Truth...');

  try {
    await syncAndLoadData();
    console.log(`🎯 SOURCE OF TRUTH: Google Drive → ${db.customers.length} customers, ${db.users.length} users loaded.`);
  } catch (err) {
    console.error('⚠️ Startup error loading Google Drive storage:', err);
  }

  processAutoReassignmentRules(db);
  setInterval(() => {
    try {
      processAutoReassignmentRules(db);
    } catch (e) {
      console.error('Error running background SLA rules:', e);
    }
  }, 60 * 1000);

  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
          res.sendFile(path.join(distPath, 'index.html'));
        }
      });
    }
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  }
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
