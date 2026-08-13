/**
 * Vercel Serverless API Handler
 * ===============================
 * هذا الملف هو نقطة الدخول الوحيدة لجميع طلبات /api/* على Vercel.
 * مصمم ليعمل بدون Google Drive و بدون filesystem و بدون أي إعداد خارجي.
 * يدعم Login / Register / Health بشكل كامل ومستقل.
 */

import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import {
  initGoogleDriveStorage,
  getDriveStorageStatus,
  getFullDatabase,
  saveFullDatabase,
} from '../src/db/googleDriveStorageService.js';

const app = express();
app.use(express.json({ limit: '10mb' }));

// ── CORS ──────────────────────────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Password helpers ───────────────────────────────────────────────
const SALT = 'crm_system_salt_2026';

function hashPassword(pw: string): string {
  if (!pw) return '';
  if (pw.startsWith('pbkdf2$')) return pw;
  const h = crypto.pbkdf2Sync(pw, SALT, 1000, 32, 'sha256').toString('hex');
  return `pbkdf2$${h}`;
}

function verifyPassword(pw: string, stored?: string): boolean {
  if (!pw || !stored) return false;
  if (stored === pw) return true; // plaintext legacy fallback
  return hashPassword(pw) === stored;
}

// ── In-memory DB (warm cache per serverless instance) ─────────────
const DEFAULT_ADMIN = {
  id: 'admin-1',
  email: 'hazemmohie8@gmail.com',
  username: 'admin',
  userCode: 'EMP-001',
  password: 'hazem2026',
  name: 'حازم محي (المسؤول)',
  role: 'admin',
  status: 'approved',
  createdAt: '2026-08-11T02:56:51.864Z',
  agreedToTerms: true,
  agreedAt: '2026-08-11T02:56:51.865Z',
};

let memDB: any = null;
let dbInitialized = false;

async function getDB(): Promise<any> {
  if (memDB && dbInitialized) return memDB;

  // Try Google Drive first
  try {
    const status = getDriveStorageStatus();
    if (!status.initialized) await initGoogleDriveStorage();
    const driveDB = await getFullDatabase();
    if (driveDB && driveDB.users && driveDB.users.length > 0) {
      memDB = driveDB;
      dbInitialized = true;
      return memDB;
    }
  } catch (e) {
    console.warn('[DB] Google Drive unavailable, using memory fallback:', (e as any)?.message);
  }

  // Fallback: boot with built-in admin
  memDB = {
    users: [DEFAULT_ADMIN],
    customers: [],
    activities: [],
    tasks: [],
    notifications: [],
    archivedRecords: [],
    sheetConfig: { sheetUrl: '', sheetId: '', autoSync: false },
    backupConfig: {},
    backupAuditLogs: [],
  };
  dbInitialized = true;
  return memDB;
}

async function persistDB(): Promise<void> {
  if (!memDB) return;
  try {
    const status = getDriveStorageStatus();
    if (status.initialized) {
      await saveFullDatabase(memDB);
    }
  } catch (e) {
    console.warn('[DB] Persist to Google Drive failed:', (e as any)?.message);
  }
}

// ── GET /api/health ────────────────────────────────────────────────
app.get('/api/health', async (_req: Request, res: Response) => {
  const status = getDriveStorageStatus();
  const db = await getDB();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    storage: {
      googleDrive: {
        connected: status.initialized,
        folderId: status.folderId ?? null,
      },
      mode: status.initialized ? 'google_drive' : 'memory_fallback',
    },
    data: {
      users: db.users?.length ?? 0,
      customers: db.customers?.length ?? 0,
    },
  });
});

// ── POST /api/auth/login ───────────────────────────────────────────
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { usernameOrEmail, username, email, password } = req.body ?? {};
    const query = (usernameOrEmail || username || email || '').trim().toLowerCase();
    const inputPass = (password || '').trim();

    if (!query) return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم أو البريد الإلكتروني' });
    if (!inputPass) return res.status(400).json({ error: 'يرجى إدخال كلمة المرور' });

    const db = await getDB();
    const user = (db.users as any[]).find((u: any) =>
      (u.username && u.username.toLowerCase() === query) ||
      (u.email && u.email.toLowerCase() === query) ||
      (u.userCode && u.userCode.toLowerCase() === query)
    );

    if (!user) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة. يرجى التأكد من اسم المستخدم وكلمة المرور.' });
    }

    if (!verifyPassword(inputPass, user.password)) {
      return res.status(401).json({ error: 'كلمة المرور غير صحيحة.' });
    }

    if (user.status === 'pending') {
      return res.status(403).json({ error: `حسابك (${user.username || user.name}) قيد المراجعة. يرجى انتظار موافقة مالك النظام حازم محي.` });
    }
    if (user.status === 'suspended' || user.status === 'rejected') {
      return res.status(403).json({ error: 'هذا الحساب معطّل أو مرفوض.' });
    }

    // Hash plaintext passwords on first login
    if (user.password && !user.password.startsWith('pbkdf2$')) {
      user.password = hashPassword(user.password);
      persistDB();
    }

    const { password: _pw, ...safeUser } = user;
    return res.json({ user: safeUser, message: 'تم تسجيل الدخول بنجاح' });
  } catch (err: any) {
    console.error('[LOGIN ERROR]', err?.message);
    return res.status(500).json({ error: 'حدث خطأ داخلي عند تسجيل الدخول. يرجى المحاولة مرة أخرى.' });
  }
});

// ── POST /api/auth/register ────────────────────────────────────────
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { name, phone, username, password } = req.body ?? {};
    if (!name || !phone || !username || !password) {
      return res.status(400).json({ error: 'جميع الحقول مطلوبة: الاسم، رقم الهاتف، اسم المستخدم، وكلمة المرور.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const db = await getDB();

    const exists = (db.users as any[]).find((u: any) =>
      (u.username && u.username.toLowerCase() === cleanUsername) ||
      (u.email && u.email.toLowerCase() === `${cleanUsername}@system.local`)
    );
    if (exists) {
      return res.status(400).json({ error: 'اسم المستخدم مسجل بالفعل. يرجى اختيار اسم مستخدم آخر.' });
    }

    let maxCode = 100;
    (db.users as any[]).forEach((u: any) => {
      if (u.userCode?.startsWith('EMP-')) {
        const n = parseInt(u.userCode.replace('EMP-', ''), 10);
        if (!isNaN(n) && n > maxCode) maxCode = n;
      }
    });
    const newUserCode = `EMP-${String(maxCode + 1).padStart(3, '0')}`;

    const newUser: any = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      email: `${cleanUsername}@system.local`,
      username: cleanUsername,
      userCode: newUserCode,
      password: hashPassword(password.trim()),
      name: name.trim(),
      phone: phone.trim(),
      role: 'user',
      status: 'pending',
      createdAt: new Date().toISOString(),
      agreedToTerms: true,
      agreedAt: new Date().toISOString(),
      dailyQuota: 15,
      dailyLeadQuota: 10,
      dailyOwnerQuota: 5,
    };

    db.users.push(newUser);
    persistDB(); // non-blocking background save

    const { password: _pw, ...safeUser } = newUser;
    return res.json({
      user: safeUser,
      message: `تم إرسال طلب إنشاء الحساب بنجاح! الحساب بانتظار موافقة مالك النظام حازم محي [${newUserCode}].`,
    });
  } catch (err: any) {
    console.error('[REGISTER ERROR]', err?.message);
    return res.status(500).json({ error: 'حدث خطأ داخلي عند إنشاء الحساب. يرجى المحاولة مرة أخرى.' });
  }
});

// ── 404 fallback for unmatched API routes ────────────────────────
app.use('*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'الرابط غير موجود في API.' });
});

export default app;
