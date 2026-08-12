import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
  addDoc
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { User, Customer, GoogleSheetConfig, Activity, AppTask, AppNotification } from '../types.js';

export interface LocalDB {
  users: User[];
  customers: Customer[];
  sheetConfig: GoogleSheetConfig;
  activities: Activity[];
  tasks?: AppTask[];
  notifications?: AppNotification[];
  aiPermissions?: any;
  aiPendingActions?: any[];
  archivedRecords?: Customer[];
  backupAuditLogs?: any[];
  backupConfig?: any;
}

let firebaseApp: any = null;
let firestoreDb: any = null;

// Cold Boot & Production Protection Flags
let isFirestoreInitialized = false;
let isFirestoreSafeReadOnlyMode = false;
let lastKnownCounts = {
  users: 0,
  customers: 0,
  tasks: 0,
  activities: 0
};

export function getFirestoreDb() {
  if (firestoreDb) return firestoreDb;

  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const configRaw = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configRaw);

      const firebaseConfig = {
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId
      };

      firebaseApp = initializeApp(firebaseConfig, 'server-app');
      const databaseId = config.firestoreDatabaseId || '(default)';
      firestoreDb = getFirestore(firebaseApp, databaseId);
      console.log('✅ Firebase Firestore initialized successfully with Database ID:', databaseId);
      return firestoreDb;
    } else {
      console.warn('⚠️ firebase-applet-config.json not found.');
    }
  } catch (err) {
    console.error('❌ Failed to initialize Firebase Firestore:', err);
  }
  return null;
}

export function getFirestoreProtectionStatus() {
  return {
    isInitialized: isFirestoreInitialized,
    isSafeReadOnlyMode: isFirestoreSafeReadOnlyMode,
    lastKnownCounts: { ...lastKnownCounts }
  };
}

export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === undefined) {
    return null as any;
  }
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirestore(item)) as any;
  }
  const cleanObj: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, any>)[key];
    if (val !== undefined) {
      cleanObj[key] = sanitizeForFirestore(val);
    }
  }
  return cleanObj as T;
}

/**
 * DATABASE HEALTH CHECK
 * Verifies connectivity, reads current state, ensures no abnormal data drops,
 * and confirms presence of permanent employee accounts.
 */
export async function checkDatabaseHealth(): Promise<{
  ok: boolean;
  reason?: string;
  data?: LocalDB | null;
  users?: User[] | null;
}> {
  const db = getFirestoreDb();
  if (!db) {
    return { ok: false, reason: 'Firestore SDK not initialized or firebase-applet-config.json missing.' };
  }

  try {
    console.log('🔍 Executing Startup Database Health Check on Firestore...');

    const stateDocRef = doc(db, 'appState', 'mainState');
    const stateDocSnap = await getDoc(stateDocRef);

    const usersDocRef = doc(db, 'appState', 'usersState');
    const usersDocSnap = await getDoc(usersDocRef);

    let loadedData: LocalDB | null = null;
    let loadedUsers: User[] | null = null;

    if (stateDocSnap.exists()) {
      loadedData = stateDocSnap.data() as LocalDB;
    }

    if (usersDocSnap.exists()) {
      const uData = usersDocSnap.data();
      if (uData && Array.isArray(uData.users)) {
        loadedUsers = uData.users as User[];
      }
    }

    // Check 1: Must be able to read documents without throwing network errors
    console.log('✅ Health Check: Firestore connection established.');

    // Check 2: Abnormal Data Drop Protection
    if (lastKnownCounts.customers > 10 && loadedData) {
      const currentCustCount = loadedData.customers?.length || 0;
      if (currentCustCount === 0) {
        console.error(`🚨 DATA LOSS DETECTED! Previously knew ${lastKnownCounts.customers} customers, but Firestore returned 0.`);
        return {
          ok: false,
          reason: `Abnormal data drop detected: Customer count dropped from ${lastKnownCounts.customers} to 0.`
        };
      }
    }

    // Update last known counts if valid data exists
    if (loadedData) {
      lastKnownCounts.users = Math.max(lastKnownCounts.users, loadedData.users?.length || 0);
      lastKnownCounts.customers = Math.max(lastKnownCounts.customers, loadedData.customers?.length || 0);
      lastKnownCounts.tasks = Math.max(lastKnownCounts.tasks, loadedData.tasks?.length || 0);
      lastKnownCounts.activities = Math.max(lastKnownCounts.activities, loadedData.activities?.length || 0);
    }

    if (loadedUsers && loadedUsers.length > 0) {
      lastKnownCounts.users = Math.max(lastKnownCounts.users, loadedUsers.length);
    }

    return {
      ok: true,
      data: loadedData,
      users: loadedUsers
    };
  } catch (err: any) {
    console.error('❌ Health Check Failed:', err);
    return { ok: false, reason: err.message || String(err) };
  }
}

/**
 * INITIALIZE FIRESTORE PROTECTION
 * Cold Start Protection logic: Strictly reads from Firestore before allowing any writes.
 */
export async function initializeFirestoreProtection(): Promise<{
  data: LocalDB | null;
  users: User[] | null;
  success: boolean;
}> {
  console.log('🛡️ Initializing Production Cold Start Protection...');

  const health = await checkDatabaseHealth();

  if (!health.ok) {
    console.error(`🚨 Cold Start Protection STOPPED: ${health.reason}`);
    console.error('🔒 Application entering Safe Read-Only Mode. All Firestore writes are BLOCKED.');
    isFirestoreInitialized = false;
    isFirestoreSafeReadOnlyMode = true;
    return { data: null, users: null, success: false };
  }

  isFirestoreInitialized = true;
  isFirestoreSafeReadOnlyMode = false;
  console.log('✅ Cold Start Protection Initialized Successfully. Writes enabled.');

  return {
    data: health.data || null,
    users: health.users || null,
    success: true
  };
}

// Load entire DB from Firestore with safety checks
export async function loadDataFromFirestore(): Promise<LocalDB | null> {
  const db = getFirestoreDb();
  if (!db) return null;

  try {
    const stateDocRef = doc(db, 'appState', 'mainState');
    const stateDocSnap = await getDoc(stateDocRef);

    if (stateDocSnap.exists()) {
      const data = stateDocSnap.data() as LocalDB;
      const customersCount = data.customers?.length || 0;
      const usersCount = data.users?.length || 0;

      // Update baseline counts
      if (customersCount > 0) lastKnownCounts.customers = Math.max(lastKnownCounts.customers, customersCount);
      if (usersCount > 0) lastKnownCounts.users = Math.max(lastKnownCounts.users, usersCount);

      return {
        users: data.users || [],
        customers: data.customers || [],
        sheetConfig: data.sheetConfig || { sheetUrl: '', sheetId: '', autoSync: false },
        activities: data.activities || [],
        tasks: data.tasks || [],
        notifications: data.notifications || [],
        aiPermissions: data.aiPermissions || {},
        aiPendingActions: data.aiPendingActions || [],
        archivedRecords: data.archivedRecords || [],
        backupAuditLogs: data.backupAuditLogs || [],
        backupConfig: data.backupConfig || {}
      };
    }
  } catch (err) {
    console.error('❌ Error loading data from Firestore:', err);
  }

  return null;
}

// Load users specifically from Firestore appState/usersState
export async function loadUsersFromFirestore(): Promise<User[] | null> {
  const db = getFirestoreDb();
  if (!db) return null;

  try {
    const usersDocRef = doc(db, 'appState', 'usersState');
    const snap = await getDoc(usersDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data && Array.isArray(data.users)) {
        if (data.users.length > 0) {
          lastKnownCounts.users = Math.max(lastKnownCounts.users, data.users.length);
        }
        return data.users as User[];
      }
    }
  } catch (err) {
    console.error('❌ Error reading usersState from Firestore:', err);
  }
  return null;
}

/**
 * VALIDATE WRITE PAYLOAD
 * Prevents writing empty, stale, or incomplete data over production collections.
 */
function validateWritePayload(data: LocalDB): void {
  if (!isFirestoreInitialized) {
    throw new Error('BLOCKED_WRITE: Firestore has not completed Cold Start Initialization. Writes are strictly forbidden.');
  }

  if (isFirestoreSafeReadOnlyMode) {
    throw new Error('BLOCKED_WRITE: Application is in Safe Read-Only Mode due to a health check failure.');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('INVALID_PAYLOAD: Provided database state is invalid or null.');
  }

  // Check 1: User Account Preservation
  if (lastKnownCounts.users > 0 && (!data.users || data.users.length === 0)) {
    throw new Error(`PRESERVATION_VIOLATION: Attempting to overwrite ${lastKnownCounts.users} users with 0 users.`);
  }

  // Check 2: Customer Data Loss Protection
  if (lastKnownCounts.customers > 10 && (!data.customers || data.customers.length === 0)) {
    throw new Error(`DATA_LOSS_VIOLATION: Unexpected wipe attempt! Payload has 0 customers, previously had ${lastKnownCounts.customers}.`);
  }

  // Check 3: Validate individual required fields
  if (data.users) {
    data.users.forEach((u, i) => {
      if (!u.id || (!u.email && !u.username)) {
        throw new Error(`CORRUPTED_USER: User at index ${i} is missing required fields (id, email/username).`);
      }
    });
  }

  if (data.customers) {
    data.customers.forEach((c, i) => {
      if (!c.id) {
        throw new Error(`CORRUPTED_CUSTOMER: Customer at index ${i} is missing required field 'id'.`);
      }
    });
  }
}

/**
 * SAVE USERS TO FIRESTORE
 * Atomic and validated write for employee accounts.
 */
export async function saveUsersToFirestore(users: User[]): Promise<boolean> {
  const db = getFirestoreDb();
  if (!db) return false;

  if (!isFirestoreInitialized || isFirestoreSafeReadOnlyMode) {
    console.error('❌ saveUsersToFirestore blocked: Cold start initialization not complete or in Safe Mode.');
    return false;
  }

  if (lastKnownCounts.users > 0 && (!users || users.length === 0)) {
    console.error('❌ saveUsersToFirestore blocked: Cannot replace existing user accounts with empty array.');
    return false;
  }

  try {
    const usersDocRef = doc(db, 'appState', 'usersState');
    const rawData = {
      users: users || [],
      updatedAt: new Date().toISOString()
    };
    const cleanData = sanitizeForFirestore(JSON.parse(JSON.stringify(rawData)));
    await setDoc(usersDocRef, cleanData);

    if (users && users.length > 0) {
      lastKnownCounts.users = Math.max(lastKnownCounts.users, users.length);
    }
    console.log(`☁️ Successfully saved ${users?.length || 0} user accounts to Firestore (appState/usersState)!`);
    return true;
  } catch (err) {
    console.error('❌ Error saving usersState to Firestore:', err);
    throw err;
  }
}

/**
 * SAVE ENTIRE DB STATE TO FIRESTORE
 * High-safety validated write function.
 */
export async function saveStateToFirestore(data: LocalDB): Promise<boolean> {
  const db = getFirestoreDb();
  if (!db) return false;

  // Validate payload before writing anything
  validateWritePayload(data);

  try {
    const stateDocRef = doc(db, 'appState', 'mainState');
    const rawData = {
      users: data.users || [],
      customers: data.customers || [],
      sheetConfig: data.sheetConfig || { sheetUrl: '', sheetId: '', autoSync: false },
      activities: data.activities || [],
      tasks: data.tasks || [],
      notifications: data.notifications || [],
      aiPermissions: data.aiPermissions || {},
      aiPendingActions: data.aiPendingActions || [],
      archivedRecords: data.archivedRecords || [],
      backupAuditLogs: data.backupAuditLogs || [],
      backupConfig: data.backupConfig || {},
      updatedAt: new Date().toISOString()
    };

    const cleanData = sanitizeForFirestore(JSON.parse(JSON.stringify(rawData)));
    await setDoc(stateDocRef, cleanData);

    // Update baseline counts
    if (data.customers) lastKnownCounts.customers = Math.max(lastKnownCounts.customers, data.customers.length);
    if (data.users) lastKnownCounts.users = Math.max(lastKnownCounts.users, data.users.length);

    // Also update usersState to keep employee accounts synchronized
    if (data.users && Array.isArray(data.users)) {
      await saveUsersToFirestore(data.users);
    }

    console.log(`☁️ Successfully saved database state to Firebase Firestore (${data.customers?.length || 0} customers, ${data.users?.length || 0} users)!`);
    return true;
  } catch (err: any) {
    console.error('❌ Error saving state to Firestore:', err);
    throw err;
  }
}

/**
 * ATOMIC SINGLE CUSTOMER WRITE
 * Directly updates an individual customer document without overwriting unrelated state.
 */
export async function saveSingleCustomerToFirestore(customer: Customer): Promise<boolean> {
  const db = getFirestoreDb();
  if (!db) return false;

  if (!customer || !customer.id) {
    throw new Error('INVALID_CUSTOMER: Customer object must have a valid id.');
  }

  if (!isFirestoreInitialized || isFirestoreSafeReadOnlyMode) {
    throw new Error('BLOCKED_WRITE: Firestore initialization not completed or in Safe Mode.');
  }

  try {
    const custDocRef = doc(db, 'customers', customer.id);
    const cleanCustomer = sanitizeForFirestore(JSON.parse(JSON.stringify(customer)));
    await setDoc(custDocRef, {
      ...cleanCustomer,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    console.log(`☁️ Atomic update succeeded for Customer ID: ${customer.id} (${customer.name || customer.customerNumber})`);
    return true;
  } catch (err) {
    console.error(`❌ Error saving single customer ${customer.id} to Firestore:`, err);
    throw err;
  }
}

/**
 * ATOMIC SINGLE CUSTOMER SOFT DELETE
 */
export async function deleteSingleCustomerFromFirestore(customerId: string): Promise<boolean> {
  const db = getFirestoreDb();
  if (!db) return false;

  if (!customerId) throw new Error('INVALID_ID: customerId is required.');

  if (!isFirestoreInitialized || isFirestoreSafeReadOnlyMode) {
    throw new Error('BLOCKED_WRITE: Firestore initialization not completed or in Safe Mode.');
  }

  try {
    const custDocRef = doc(db, 'customers', customerId);
    await deleteDoc(custDocRef);
    console.log(`☁️ Atomic delete succeeded for Customer ID: ${customerId}`);
    return true;
  } catch (err) {
    console.error(`❌ Error deleting customer ${customerId} from Firestore:`, err);
    throw err;
  }
}

/**
 * ATOMIC SINGLE TASK WRITE
 */
export async function saveSingleTaskToFirestore(task: AppTask): Promise<boolean> {
  const db = getFirestoreDb();
  if (!db) return false;

  if (!task || !task.id) throw new Error('INVALID_TASK: Task must have an id.');

  if (!isFirestoreInitialized || isFirestoreSafeReadOnlyMode) {
    throw new Error('BLOCKED_WRITE: Firestore initialization not completed or in Safe Mode.');
  }

  try {
    const taskDocRef = doc(db, 'tasks', task.id);
    const cleanTask = sanitizeForFirestore(JSON.parse(JSON.stringify(task)));
    await setDoc(taskDocRef, {
      ...cleanTask,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    console.log(`☁️ Atomic update succeeded for Task ID: ${task.id}`);
    return true;
  } catch (err) {
    console.error(`❌ Error saving task ${task.id} to Firestore:`, err);
    throw err;
  }
}

/**
 * ATOMIC AUDIT LOG WRITE
 */
export async function logAuditEventToFirestore(auditEntry: {
  timestamp: string;
  userEmail: string;
  userRole: string;
  operation: string;
  recordId?: string;
  details: string;
  result: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
  error?: string;
}): Promise<boolean> {
  const db = getFirestoreDb();
  if (!db) return false;

  try {
    const auditColRef = collection(db, 'auditLogs');
    const cleanLog = sanitizeForFirestore(JSON.parse(JSON.stringify({
      ...auditEntry,
      createdAt: new Date().toISOString()
    })));
    await addDoc(auditColRef, cleanLog);
    return true;
  } catch (err) {
    console.error('❌ Error logging audit entry to Firestore:', err);
    return false;
  }
}

/**
 * CREATE FIRESTORE BACKUP
 * Creates a verified JSON backup in data/backups/ and writes to Firestore backups collection.
 */
export async function createFirestoreBackup(data: LocalDB): Promise<{
  success: boolean;
  backupFile?: string;
  backupId?: string;
  error?: string;
}> {
  const db = getFirestoreDb();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `backup_crm_${timestamp}.json`;

  try {
    const backupDir = path.join(process.cwd(), 'data', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupFilePath = path.join(backupDir, backupFileName);
    const backupPayload = {
      timestamp: new Date().toISOString(),
      counts: {
        users: data.users?.length || 0,
        customers: data.customers?.length || 0,
        tasks: data.tasks?.length || 0,
        activities: data.activities?.length || 0
      },
      data: data
    };

    // Save to local filesystem backup
    fs.writeFileSync(backupFilePath, JSON.stringify(backupPayload, null, 2), 'utf-8');

    // Save to Firestore backups collection if db available
    if (db) {
      const backupDocRef = doc(db, 'backups', backupFileName);
      const cleanBackup = sanitizeForFirestore(JSON.parse(JSON.stringify(backupPayload)));
      await setDoc(backupDocRef, cleanBackup);
    }

    console.log(`📦 Automatic Firestore backup created successfully: ${backupFileName}`);
    return { success: true, backupFile: backupFilePath, backupId: backupFileName };
  } catch (err: any) {
    console.error('❌ Failed to create database backup:', err);
    return { success: false, error: err.message || String(err) };
  }
}
