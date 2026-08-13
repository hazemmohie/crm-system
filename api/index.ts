/**
 * Vercel Serverless Entry Point
 * ─────────────────────────────
 * مصدر البيانات الوحيد: db من server.ts
 * لا يوجد memDB منفصل، لا hashPassword مكررة، لا routes مكررة.
 *
 * كل routes الـ /api/* تُعالَج بواسطة express app من server.ts.
 * هذا الملف يُضيف فقط:
 *   - CORS headers
 *   - تهيئة التخزين قبل أول طلب (warm start)
 */

import app, { db, syncAndLoadData } from '../server.js';
import type { Request, Response, NextFunction } from 'express';

// ── CORS (Vercel لا يضيفه تلقائياً لـ serverless functions) ───────
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

export default app;
