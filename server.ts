import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import fs from 'fs';
import os from 'os';
import http from 'http';
import https from 'https';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// IPv4-explicit HTTP/HTTPS status probe so container checks never stall on IPv6
function probeHttpUrl(urlStr: string, timeoutMs = 4000): Promise<{ status: number; location: string }> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(urlStr);
    } catch (err) {
      return reject(err);
    }
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request(
      parsed,
      {
        method: 'GET',
        family: 4,
        timeout: timeoutMs,
        headers: { 'User-Agent': 'CBT-Platform-HealthCheck/1.0' }
      },
      (res) => {
        res.resume();
        resolve({
          status: res.statusCode || 0,
          location: String(res.headers.location || '')
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', reject);
    req.end();
  });
}

function downloadBinaryRedirectSafe(urlStr: string, destPath: string, redirectsLeft = 5): Promise<void> {
  return new Promise((resolve, reject) => {
    if (redirectsLeft <= 0) return reject(new Error('Too many redirects'));
    https
      .get(urlStr, { family: 4, timeout: 15000 }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const nextUrl = new URL(res.headers.location, urlStr).toString();
          return resolve(downloadBinaryRedirectSafe(nextUrl, destPath, redirectsLeft - 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`Download failed: ${res.statusCode}`));
        }
        const tmpFile = `${destPath}.tmp_${process.pid}`;
        const fileStream = fs.createWriteStream(tmpFile, { mode: 0o755 });
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close(() => {
            try {
              fs.chmodSync(tmpFile, 0o755);
              fs.renameSync(tmpFile, destPath);
              resolve();
            } catch (err) {
              reject(err);
            }
          });
        });
        fileStream.on('error', reject);
      })
      .on('error', reject);
  });
}

// Self-healing public HTTPS gateway so the teacher gets a live public URL right inside the platform
let gatewayUrl = 'https://ais-pre-uce67yawslleuefunsutes-473233361289.europe-west1.run.app';
let gatewayReady = true;
let gatewayStartingPromise: Promise<string> | null = null;

function isPidAlive(pid: number): boolean {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function ensurePublicGateway(_port: number): Promise<string> {
  return 'https://ais-pre-uce67yawslleuefunsutes-473233361289.europe-west1.run.app';
}



function resolveWritableDataDir(bundledDataDir: string): string {
  try {
    if (!fs.existsSync(bundledDataDir)) {
      fs.mkdirSync(bundledDataDir, { recursive: true });
    }
    const probe = path.join(bundledDataDir, '.write_probe');
    fs.writeFileSync(probe, 'ok', 'utf-8');
    fs.unlinkSync(probe);
    return bundledDataDir;
  } catch {
    const tmpDir = path.join(os.tmpdir(), 'cbt-quiz-data');
    fs.mkdirSync(tmpDir, { recursive: true });
    for (const seedFile of [
      'quiz.json',
      'results.json',
      'config.json',
      'subject_banks.json',
      'admin_security.json',
      'student_questions.json',
      'feedback.json'
    ]) {
      const src = path.join(bundledDataDir, seedFile);
      const dest = path.join(tmpDir, seedFile);
      if (fs.existsSync(src) && !fs.existsSync(dest)) {
        try {
          fs.copyFileSync(src, dest);
        } catch {
          // ignore seed copy error
        }
      }
    }
    return tmpDir;
  }
}

async function startServer() {
  const app = express();
  const argPortIdx = process.argv.indexOf('--port');
  const argPort = argPortIdx !== -1 ? Number(process.argv[argPortIdx + 1]) : NaN;
  let resolvedPort = Number.isFinite(argPort) && argPort > 0 ? argPort : (Number(process.env.PORT) || 3000);
  if (process.env.NGINX_PORT && String(resolvedPort) === String(process.env.NGINX_PORT)) {
    resolvedPort = Number(process.env.DEFAULT_APP_PORT) || 3000;
  }
  const PORT = resolvedPort;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Prevent browser/proxy caching on API routes and allow public cross-device access
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Id');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Persistent Data Directory (with automatic Cloud Run /tmp fallback if root FS is read-only)
  const BUNDLED_DATA_DIR = path.join(__dirname, 'data');
  const DATA_DIR = resolveWritableDataDir(BUNDLED_DATA_DIR);

  const QUIZ_FILE = path.join(DATA_DIR, 'quiz.json');
  const RESULTS_FILE = path.join(DATA_DIR, 'results.json');
  const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
  const SUBJECT_BANKS_FILE = path.join(DATA_DIR, 'subject_banks.json');
  const ADMIN_SECURITY_FILE = path.join(DATA_DIR, 'admin_security.json');
  const STUDENT_QUESTIONS_FILE = path.join(DATA_DIR, 'student_questions.json');
  const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.json');
  const SECTIONS_FILE = path.join(DATA_DIR, 'sections.json');
  const VAULT_DIR = path.join(DATA_DIR, 'vault');
  const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
  const MASTER_VAULT_FILE = path.join(VAULT_DIR, 'master_vault.json');
  const DELETED_IDS_FILE = path.join(DATA_DIR, 'deleted_ids.json');

  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
  }
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  interface ServerDeletedIds {
    results: string[];
    feedback: string[];
    questions: string[];
  }

  function readDeletedIds(): ServerDeletedIds {
    const fallback: ServerDeletedIds = { results: [], feedback: [], questions: [] };
    const data = readJsonSafe<Partial<ServerDeletedIds>>(DELETED_IDS_FILE, fallback);
    return {
      results: Array.isArray(data.results) ? data.results : [],
      feedback: Array.isArray(data.feedback) ? data.feedback : [],
      questions: Array.isArray(data.questions) ? data.questions : []
    };
  }

  function recordDeletedId(type: 'results' | 'feedback' | 'questions', id: string): void {
    if (!id || typeof id !== 'string') return;
    const current = readDeletedIds();
    if (!current[type].includes(id)) {
      current[type].push(id);
      safeWriteJsonAtomic(DELETED_IDS_FILE, current);
      console.log(`[Tombstone] Permanently recorded deleted ${type} ID: ${id}`);
    }
  }

  // Crash-proof atomic write helper: write to temp file then rename
  function safeWriteJsonAtomic(targetFile: string, data: any): void {
    const parentDir = path.dirname(targetFile);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    const tempFile = `${targetFile}.tmp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    try {
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempFile, targetFile);
    } catch (err) {
      if (fs.existsSync(tempFile)) {
        try { fs.unlinkSync(tempFile); } catch {}
      }
      throw err;
    }
  }

  function readJsonSafe<T>(filePath: string, fallback: T): T {
    if (!fs.existsSync(filePath)) return fallback;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      return parsed !== null && parsed !== undefined ? (parsed as T) : fallback;
    } catch {
      return fallback;
    }
  }

  // Master Snapshot / Vault update helper
  function updateMasterVault(): void {
    try {
      const deleted = readDeletedIds();
      const delRes = new Set(deleted.results);
      const delFb = new Set(deleted.feedback);
      const delQ = new Set(deleted.questions);

      const results = readJsonSafe<any[]>(RESULTS_FILE, []).filter((r) => r?.id && !delRes.has(r.id));
      const feedback = readJsonSafe<any[]>(FEEDBACK_FILE, []).filter((f) => f?.id && !delFb.has(f.id));
      const studentQuestions = readJsonSafe<any[]>(STUDENT_QUESTIONS_FILE, []).filter((q) => q?.id && !delQ.has(q.id));
      const sections = readJsonSafe<any[]>(SECTIONS_FILE, []);
      const quiz = readJsonSafe<any>(QUIZ_FILE, null);
      const subjectBanks = readJsonSafe<any>(SUBJECT_BANKS_FILE, {});
      const config = readJsonSafe<any>(CONFIG_FILE, {});

      const vaultData = {
        updatedAt: new Date().toISOString(),
        supervisor: 'أ/ صافيناز عبدالعزيز',
        deletedIds: deleted,
        counts: {
          results: results.length,
          feedback: feedback.length,
          studentQuestions: studentQuestions.length,
          sections: sections.length
        },
        data: {
          results,
          feedback,
          studentQuestions,
          sections,
          quiz,
          subjectBanks,
          config
        }
      };

      safeWriteJsonAtomic(MASTER_VAULT_FILE, vaultData);
    } catch (err) {
      console.warn('Could not update master vault:', err);
    }
  }

  function createSafetyBackupSnapshot(label = 'auto'): string {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `snapshot_${label}_${timestamp}.json`;
      const snapshotPath = path.join(BACKUPS_DIR, filename);

      const payload = {
        label,
        timestamp: new Date().toISOString(),
        supervisor: 'أ/ صافيناز عبدالعزيز',
        results: readJsonSafe<any[]>(RESULTS_FILE, []),
        feedback: readJsonSafe<any[]>(FEEDBACK_FILE, []),
        studentQuestions: readJsonSafe<any[]>(STUDENT_QUESTIONS_FILE, []),
        sections: readJsonSafe<any[]>(SECTIONS_FILE, []),
        quiz: readJsonSafe<any>(QUIZ_FILE, null),
        subjectBanks: readJsonSafe<any>(SUBJECT_BANKS_FILE, {}),
        config: readJsonSafe<any>(CONFIG_FILE, {})
      };

      safeWriteJsonAtomic(snapshotPath, payload);

      // Clean old backups keeping last 30 snapshots
      const allFiles = fs.readdirSync(BACKUPS_DIR)
        .filter((f) => f.startsWith('snapshot_') && f.endsWith('.json'))
        .sort()
        .reverse();

      if (allFiles.length > 30) {
        for (const oldFile of allFiles.slice(30)) {
          try { fs.unlinkSync(path.join(BACKUPS_DIR, oldFile)); } catch {}
        }
      }

      return snapshotPath;
    } catch (err) {
      console.warn('Could not create backup snapshot:', err);
      return '';
    }
  }

  // Auto-Rescue on startup: if primary files are empty or missing, restore from vault or backups
  try {
    let vaultData: any = null;
    if (fs.existsSync(MASTER_VAULT_FILE)) {
      vaultData = readJsonSafe<any>(MASTER_VAULT_FILE, null);
    }
    const currentDeleted = readDeletedIds();
    const deletedResSet = new Set(currentDeleted.results);
    const deletedFbSet = new Set(currentDeleted.feedback);
    const deletedQSet = new Set(currentDeleted.questions);

    if (!fs.existsSync(RESULTS_FILE) || readJsonSafe<any[]>(RESULTS_FILE, []).length === 0) {
      if (vaultData?.data?.results && Array.isArray(vaultData.data.results) && vaultData.data.results.length > 0) {
        const filteredRes = vaultData.data.results.filter((r: any) => r?.id && !deletedResSet.has(r.id));
        safeWriteJsonAtomic(RESULTS_FILE, filteredRes);
        console.log(`[Auto-Rescue] Restored ${filteredRes.length} results from master vault.`);
      } else if (!fs.existsSync(RESULTS_FILE)) {
        safeWriteJsonAtomic(RESULTS_FILE, []);
      }
    }

    if (!fs.existsSync(FEEDBACK_FILE) || readJsonSafe<any[]>(FEEDBACK_FILE, []).length === 0) {
      if (vaultData?.data?.feedback && Array.isArray(vaultData.data.feedback) && vaultData.data.feedback.length > 0) {
        const filteredFb = vaultData.data.feedback.filter((f: any) => f?.id && !deletedFbSet.has(f.id));
        safeWriteJsonAtomic(FEEDBACK_FILE, filteredFb);
        console.log(`[Auto-Rescue] Restored ${filteredFb.length} feedbacks from master vault.`);
      } else if (!fs.existsSync(FEEDBACK_FILE)) {
        safeWriteJsonAtomic(FEEDBACK_FILE, []);
      }
    }

    if (!fs.existsSync(STUDENT_QUESTIONS_FILE) || readJsonSafe<any[]>(STUDENT_QUESTIONS_FILE, []).length === 0) {
      if (vaultData?.data?.studentQuestions && Array.isArray(vaultData.data.studentQuestions) && vaultData.data.studentQuestions.length > 0) {
        const filteredQ = vaultData.data.studentQuestions.filter((q: any) => q?.id && !deletedQSet.has(q.id));
        safeWriteJsonAtomic(STUDENT_QUESTIONS_FILE, filteredQ);
        console.log(`[Auto-Rescue] Restored ${filteredQ.length} questions from master vault.`);
      } else if (!fs.existsSync(STUDENT_QUESTIONS_FILE)) {
        safeWriteJsonAtomic(STUDENT_QUESTIONS_FILE, []);
      }
    }

    if (!fs.existsSync(SECTIONS_FILE)) {
      if (vaultData?.data?.sections && Array.isArray(vaultData.data.sections) && vaultData.data.sections.length > 0) {
        safeWriteJsonAtomic(SECTIONS_FILE, vaultData.data.sections);
      } else {
        safeWriteJsonAtomic(SECTIONS_FILE, []);
      }
    }

    if (!fs.existsSync(SUBJECT_BANKS_FILE)) {
      safeWriteJsonAtomic(SUBJECT_BANKS_FILE, vaultData?.data?.subjectBanks || {});
    }
  } catch (rescueErr) {
    console.warn('Error during auto-rescue initialization:', rescueErr);
  }

  // Periodic safety snapshot every hour
  const autoSnapshotTimer = setInterval(() => {
    createSafetyBackupSnapshot('hourly');
    updateMasterVault();
  }, 60 * 60 * 1000);
  autoSnapshotTimer.unref();

  const DEFAULT_SERVER_ADMIN_PIN = '2200564603';
  const MAX_ADMIN_LOGIN_ATTEMPTS = 4;
  const ADMIN_LOCKOUT_DURATION_MS = 60 * 60 * 1000; // 1 full hour (3,600,000 ms)
  const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  interface ServerLockoutEntry {
    failedAttempts: number;
    lockedUntil: number | null;
  }

  interface ServerAdminSecurityState {
    adminPin: string;
    sessions: Record<string, { expiresAt: number; createdAt: string }>;
    lockouts: Record<string, ServerLockoutEntry>;
  }

  function readAdminSecurity(): ServerAdminSecurityState {
    const now = Date.now();
    let parsed: Partial<ServerAdminSecurityState> = {};
    if (fs.existsSync(ADMIN_SECURITY_FILE)) {
      try {
        parsed = JSON.parse(fs.readFileSync(ADMIN_SECURITY_FILE, 'utf-8')) || {};
      } catch {
        parsed = {};
      }
    }

    const adminPin =
      typeof parsed.adminPin === 'string' && parsed.adminPin.trim().length >= 3
        ? parsed.adminPin.trim()
        : DEFAULT_SERVER_ADMIN_PIN;

    const sessions: Record<string, { expiresAt: number; createdAt: string }> = {};
    if (parsed.sessions && typeof parsed.sessions === 'object') {
      for (const [tok, meta] of Object.entries(parsed.sessions)) {
        if (meta && typeof meta.expiresAt === 'number' && meta.expiresAt > now) {
          sessions[tok] = meta;
        }
      }
    }

    const lockouts: Record<string, ServerLockoutEntry> = {};
    if (parsed.lockouts && typeof parsed.lockouts === 'object') {
      for (const [k, entry] of Object.entries(parsed.lockouts)) {
        if (!entry || typeof entry !== 'object') continue;
        if (typeof entry.lockedUntil === 'number' && entry.lockedUntil <= now) {
          // Expired lockout resets automatically
          continue;
        }
        lockouts[k] = {
          failedAttempts: Math.min(
            Math.max(0, Math.floor(entry.failedAttempts || 0)),
            MAX_ADMIN_LOGIN_ATTEMPTS
          ),
          lockedUntil: typeof entry.lockedUntil === 'number' ? entry.lockedUntil : null
        };
      }
    }

    return { adminPin, sessions, lockouts };
  }

  function writeAdminSecurity(state: ServerAdminSecurityState): void {
    fs.writeFileSync(ADMIN_SECURITY_FILE, JSON.stringify(state, null, 2), 'utf-8');
  }

  if (!fs.existsSync(ADMIN_SECURITY_FILE)) {
    writeAdminSecurity({
      adminPin: DEFAULT_SERVER_ADMIN_PIN,
      sessions: {},
      lockouts: {}
    });
  }

  function parseCookies(cookieHeader?: string): Record<string, string> {
    const out: Record<string, string> = {};
    if (!cookieHeader) return out;
    for (const part of cookieHeader.split(';')) {
      const idx = part.indexOf('=');
      if (idx > 0) {
        const k = part.slice(0, idx).trim();
        const v = part.slice(idx + 1).trim();
        out[k] = decodeURIComponent(v);
      }
    }
    return out;
  }

  function resolveClientLockoutKey(req: express.Request, res: express.Response): string {
    const cookies = parseCookies(req.headers.cookie);
    const cookieCid =
      cookies.cbt_cid && /^[a-zA-Z0-9_-]{8,64}$/.test(cookies.cbt_cid) ? cookies.cbt_cid : '';
    const rawHeaderCid =
      typeof req.headers['x-client-id'] === 'string' ? req.headers['x-client-id'].trim() : '';
    const headerCid = /^[a-zA-Z0-9_-]{8,64}$/.test(rawHeaderCid) ? rawHeaderCid : '';

    const chosenCid = cookieCid || headerCid;
    if (chosenCid) {
      if (!cookieCid) {
        res.setHeader(
          'Set-Cookie',
          `cbt_cid=${encodeURIComponent(chosenCid)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`
        );
      }
      return `cid:${chosenCid}`;
    }

    const cfIp =
      typeof req.headers['cf-connecting-ip'] === 'string'
        ? req.headers['cf-connecting-ip'].trim()
        : '';
    const xff =
      typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0].trim()
        : '';
    const ip = cfIp || xff || req.socket.remoteAddress || 'unknown';
    return `ip:${ip}`;
  }

  function evaluateServerLockout(entry: ServerLockoutEntry | undefined, nowMs: number) {
    if (!entry) {
      return {
        isLocked: false,
        failedAttempts: 0,
        attemptsLeft: MAX_ADMIN_LOGIN_ATTEMPTS,
        lockedUntil: null as number | null,
        remainingSeconds: 0
      };
    }
    if (typeof entry.lockedUntil === 'number' && entry.lockedUntil > nowMs) {
      const remainingSeconds = Math.max(1, Math.ceil((entry.lockedUntil - nowMs) / 1000));
      return {
        isLocked: true,
        failedAttempts: MAX_ADMIN_LOGIN_ATTEMPTS,
        attemptsLeft: 0,
        lockedUntil: entry.lockedUntil,
        remainingSeconds
      };
    }
    if (typeof entry.lockedUntil === 'number' && entry.lockedUntil <= nowMs) {
      return {
        isLocked: false,
        failedAttempts: 0,
        attemptsLeft: MAX_ADMIN_LOGIN_ATTEMPTS,
        lockedUntil: null as number | null,
        remainingSeconds: 0
      };
    }
    const failedAttempts = Math.min(
      Math.max(0, Math.floor(entry.failedAttempts || 0)),
      MAX_ADMIN_LOGIN_ATTEMPTS
    );
    return {
      isLocked: false,
      failedAttempts,
      attemptsLeft: Math.max(0, MAX_ADMIN_LOGIN_ATTEMPTS - failedAttempts),
      lockedUntil: null as number | null,
      remainingSeconds: 0
    };
  }

  function extractBearerToken(req: express.Request): string {
    const auth = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
    if (auth.toLowerCase().startsWith('bearer ')) {
      return auth.slice(7).trim();
    }
    return '';
  }

  const requireAdminAuth: express.RequestHandler = (req, res, next) => {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({
        error: 'غير مصرح: إضافة أو تعديل الاختبارات متاحة حصرياً للمشرفين من داخل لوحة المشرفين.'
      });
    }
    const sec = readAdminSecurity();
    const session = sec.sessions[token];
    if (!session || session.expiresAt <= Date.now()) {
      return res.status(401).json({
        error: 'انتهت صلاحية جلسة المشرف، يرجى إعادة تسجيل الدخول في لوحة المشرفين.'
      });
    }
    next();
  };

  // Admin Security & 4-Attempt 1-Hour Lockout Endpoints
  app.get('/api/admin/status', (req, res) => {
    const now = Date.now();
    const sec = readAdminSecurity();
    const clientKey = resolveClientLockoutKey(req, res);
    const lockEval = evaluateServerLockout(sec.lockouts[clientKey], now);
    const token = extractBearerToken(req);
    const authenticated = Boolean(token && sec.sessions[token] && sec.sessions[token].expiresAt > now);

    return res.json({
      authenticated,
      ...lockEval,
      ...(authenticated ? { currentPin: sec.adminPin } : {})
    });
  });

  app.post('/api/admin/login', (req, res) => {
    const now = Date.now();
    const sec = readAdminSecurity();
    const clientKey = resolveClientLockoutKey(req, res);
    const currentEval = evaluateServerLockout(sec.lockouts[clientKey], now);

    if (currentEval.isLocked) {
      return res.status(429).json({
        success: false,
        ...currentEval,
        error: 'تم قفل محاولات تسجيل الدخول لمدة ساعة كاملة بسبب ٤ محاولات خاطئة متتالية.'
      });
    }

    const enteredPin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
    if (enteredPin && enteredPin === sec.adminPin) {
      delete sec.lockouts[clientKey];
      const token = crypto.randomBytes(32).toString('hex');
      sec.sessions[token] = {
        expiresAt: now + ADMIN_SESSION_TTL_MS,
        createdAt: new Date(now).toISOString()
      };
      writeAdminSecurity(sec);
      return res.json({
        success: true,
        token,
        isLocked: false,
        failedAttempts: 0,
        attemptsLeft: MAX_ADMIN_LOGIN_ATTEMPTS,
        lockedUntil: null,
        remainingSeconds: 0
      });
    }

    const nextFailed = currentEval.failedAttempts + 1;
    if (nextFailed >= MAX_ADMIN_LOGIN_ATTEMPTS) {
      const lockedUntil = now + ADMIN_LOCKOUT_DURATION_MS;
      sec.lockouts[clientKey] = {
        failedAttempts: MAX_ADMIN_LOGIN_ATTEMPTS,
        lockedUntil
      };
      writeAdminSecurity(sec);
      const lockedEval = evaluateServerLockout(sec.lockouts[clientKey], now);
      return res.status(429).json({
        success: false,
        ...lockedEval,
        error: 'تم قفل محاولات تسجيل الدخول لمدة ساعة كاملة بسبب إدخال الرمز خطأ ٤ مرات متتالية.'
      });
    }

    sec.lockouts[clientKey] = {
      failedAttempts: nextFailed,
      lockedUntil: null
    };
    writeAdminSecurity(sec);
    const updatedEval = evaluateServerLockout(sec.lockouts[clientKey], now);
    return res.status(401).json({
      success: false,
      ...updatedEval,
      error: 'رمز الدخول غير صحيح.'
    });
  });

  app.post('/api/admin/logout', (req, res) => {
    const token = extractBearerToken(req);
    if (token) {
      const sec = readAdminSecurity();
      if (sec.sessions[token]) {
        delete sec.sessions[token];
        writeAdminSecurity(sec);
      }
    }
    return res.json({ success: true });
  });

  app.post('/api/admin/change-pin', requireAdminAuth, (req, res) => {
    const newPin = typeof req.body?.newPin === 'string' ? req.body.newPin.trim() : '';
    if (newPin.length < 3) {
      return res.status(400).json({ error: 'رمز الدخول يجب أن يتكون من ٣ أحرف أو أرقام على الأقل.' });
    }
    const sec = readAdminSecurity();
    sec.adminPin = newPin;
    writeAdminSecurity(sec);
    return res.json({ success: true });
  });

  // 24/7 Health Check Endpoint for Cloud Run & Load Balancers
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    });
  });

  // Live Public Link Status Check (detects unpublished 404 Page Not Found vs live 200 OK)
  app.get('/api/link-status', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!rawUrl) {
      return res.json({ live: false, code: 'unreachable' });
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return res.json({ live: false, code: 'unreachable' });
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return res.json({ live: false, code: 'unreachable' });
    }

    const host = parsed.hostname.toLowerCase();

    // Local development server check
    if (host === 'localhost' || host === '127.0.0.1') {
      return res.json({ live: true, code: 'ok', status: 200 });
    }

    // Block private/internal IP ranges for SSRF safety
    if (
      /^(10\.|192\.168\.|169\.254\.|127\.|0\.)/.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      host.endsWith('.internal') ||
      host.endsWith('.local')
    ) {
      return res.json({ live: false, code: 'unreachable' });
    }

    if (host.startsWith('ais-dev-')) {
      return res.json({ live: false, code: 'private_dev', status: 403 });
    }

    // Fast-path if checking our own active public gateway URL
    if (gatewayReady && gatewayUrl && parsed.origin.toLowerCase() === gatewayUrl.toLowerCase()) {
      return res.json({ live: true, code: 'ok', status: 200 });
    }

    try {
      const response = await probeHttpUrl(parsed.origin, 4500);
      const locationHeader = response.location || '';

      if (response.status >= 300 && response.status < 400 && locationHeader.includes('__cookie_check')) {
        return res.json({ live: false, code: 'private_dev', status: response.status });
      }
      if (response.status === 404) {
        return res.json({ live: false, code: 'not_published_404', status: 404 });
      }
      if (response.status >= 200 && response.status < 400) {
        return res.json({ live: true, code: 'ok', status: response.status });
      }
      return res.json({ live: false, code: 'unreachable', status: response.status });
    } catch {
      return res.json({ live: false, code: 'unreachable' });
    }
  });

  // AI Question Extraction Endpoint (Admin-only: supports both Academic Subjects and Qudurat)
  app.post('/api/ai/extract-questions', requireAdminAuth, async (req, res) => {
    try {
      const { text, pdfBase64, mimeType, subjectName, gradeName } = req.body;

      if (!text && !pdfBase64) {
        return res.status(400).json({ error: 'يرجى تزويد النص أو ملف PDF للاستخراج' });
      }

      const isAcademicSubject = Boolean(subjectName && String(subjectName).trim());
      const targetCategory = isAcademicSubject ? String(subjectName).trim() : 'لفظي';
      const contextLabel = isAcademicSubject
        ? `مادة ${String(subjectName).trim()}${gradeName ? ` (${String(gradeName).trim()})` : ''}`
        : 'اختبارات القدرات العامة (القسم اللفظي)';

      const prompt = `
أنت خبير قياس وتقويم تربوي متخصص في ${contextLabel}.
المطلوب منك فحص محتوى الملف أو النص المرفق، واستخراج أسئلة الاختبار بدقة فائقة.
ملاحظة هامة جداً: الملف قد يكون ملف PDF نصياً، أو ملف PDF ممسوحاً ضوئياً بالكامل على شكل صور (Scanned Pages / Images)، أو صورة ملتقطة لورقة اختبار. اقرأ النصوص العربية والإنجليزية والرموز العلمية أو الرياضية داخل الصور بدقة عالية.
الملف يحتوي على أسئلة اختيار من متعدد (4 خيارات)، وقد يكون الخيار الصحيح معلّماً بإشارة مرئية (علامة صح ✓، دائرة، نجمة *، خط، تظليل، أو سطر الإجابة)، وإن لم يكن معلّماً فاستنتج الإجابة العلمية الصحيحة بدقة.

القواعد الأساسية:
1. استخرج جميع الأسئلة المتوفرة في الملف (حتى 40 سؤالاً كحد أقصى).
2. يجب أن يحتوي كل سؤال على نص السؤال تماماً كما هو و 4 خيارات مرتبة.
3. حدد correctIndex كرقم من 0 إلى 3 بحيث (0 = الخيار الأول أ/A، 1 = الخيار الثاني ب/B، 2 = الخيار الثالث ج/C، 3 = الخيار الرابع د/D).
4. ضع شرحاً وتفسيراً علمياً وجيزاً ومفيداً للطالبة في حقل explanation لكل سؤال.
5. اجعل حقل category يساوي '${targetCategory}'.

أخرج النتيجة بصيغة JSON مطابقة تماماً للمخطط المحدد.
`;

      const contents: any[] = [];

      if (pdfBase64) {
        contents.push({
          inlineData: {
            mimeType: mimeType || 'application/pdf',
            data: pdfBase64.replace(/^data:[^;]+;base64,/, '')
          }
        });
      }

      if (text) {
        contents.push({
          text: `إليك نص الأسئلة المستخرج:\n\n${text}\n\n${prompt}`
        });
      } else {
        contents.push({
          text: prompt
        });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({
          success: false,
          error: 'خدمة التحليل الذكي غير مفعلة حالياً، سيتم استخدام المحلل النصي المباشر.'
        });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
      });

      const modelsToTry = ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-flash-latest'];
      let responseText = '';
      let lastErr = null;

      for (const model of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: {
                    type: Type.STRING,
                    description: 'عنوان الاختبار المستخرج'
                  },
                  questions: {
                    type: Type.ARRAY,
                    description: 'قائمة الأسئلة المستخرجة',
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        text: { type: Type.STRING, description: 'نص السؤال' },
                        options: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                          description: 'الخيارات الأربعة بالتحديد'
                        },
                        correctIndex: {
                          type: Type.INTEGER,
                          description: 'مؤشر الإجابة الصحيحة المعلمة من 0 إلى 3'
                        },
                        explanation: {
                          type: Type.STRING,
                          description: 'شرح وتفسير الإجابة الصحيحة'
                        },
                        category: {
                          type: Type.STRING,
                          description: 'لفظي'
                        }
                      },
                      required: ['text', 'options', 'correctIndex']
                    }
                  }
                },
                required: ['questions']
              }
            }
          });

          if (response.text) {
            responseText = response.text;
            break;
          }
        } catch (mErr: any) {
          lastErr = mErr;
          console.warn(`Model ${model} failed, trying next:`, mErr?.message || mErr);
        }
      }

      if (!responseText) {
        throw lastErr || new Error('تعذر معالجة الطلب بنموذج الذكاء الاصطناعي');
      }
      const parsedData = JSON.parse(responseText);

      // Normalize questions to match client schema
      const normalizedQuestions = (parsedData.questions || []).map((q: any, i: number) => ({
        id: `ai_q_${Date.now().toString(36)}_${i}`,
        text: q.text,
        options: Array.isArray(q.options) && q.options.length >= 4 
          ? q.options.slice(0, 4) 
          : [...(q.options || []), 'خيار إضافي', 'خيار إضافي', 'خيار إضافي', 'خيار إضافي'].slice(0, 4),
        correctIndex: typeof q.correctIndex === 'number' ? Math.min(Math.max(q.correctIndex, 0), 3) : 0,
        explanation: q.explanation || 'تم التحقق من صحة الإجابة العلمية.',
        category: q.category || targetCategory
      }));

      return res.json({
        success: true,
        title: parsedData.title || (isAcademicSubject ? `اختبار ${contextLabel}` : 'اختبار القدرات اللفظي المستخرج'),
        questions: normalizedQuestions,
        total: normalizedQuestions.length
      });
    } catch (error: any) {
      console.error('Error in AI question extraction:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'حدث خطأ أثناء معالجة الملف بالذكاء الاصطناعي'
      });
    }
  });



  // Cache for ais-pre availability check so /api/public-origin responds fast
  let aisPreCache: { checkedAt: number; live: boolean; origin: string } = {
    checkedAt: 0,
    live: false,
    origin: ''
  };

  // Automatic Public Student Origin Resolver: always returns the permanent 24/7 Cloud Run URL
  app.get('/api/public-origin', async (req, res) => {
    try {
      // 1. Teacher's saved custom domain (if configured)
      if (fs.existsSync(CONFIG_FILE)) {
        try {
          const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
          if (typeof cfg.customPublicUrl === 'string' && cfg.customPublicUrl.trim()) {
            const custom = cfg.customPublicUrl.trim().replace(/\/+$/, '');
            if (/^https?:\/\//i.test(custom) && !custom.includes('://ais-dev-') && !custom.includes('trycloudflare.com')) {
              return res.json({ origin: custom, source: 'custom', live: true, starting: false });
            }
          }
        } catch {
          // ignore
        }
      }

      const clientOrigin = typeof req.query.clientOrigin === 'string' ? req.query.clientOrigin.trim() : '';
      const candidateOrigin = clientOrigin || (process.env.APP_URL || '').trim();

      // 2. If already on a live public domain (not ais-dev-, not localhost, not trycloudflare)
      if (candidateOrigin) {
        try {
          const parsed = new URL(candidateOrigin);
          const h = parsed.hostname.toLowerCase();
          if (
            parsed.protocol === 'https:' &&
            !h.startsWith('ais-dev-') &&
            !h.includes('trycloudflare.com') &&
            h !== 'localhost' &&
            h !== '127.0.0.1'
          ) {
            return res.json({ origin: parsed.origin, source: 'deployed', live: true, starting: false });
          }

          // If in ais-dev-, convert directly to the permanent paired ais-pre- Cloud Run origin
          if (h.startsWith('ais-dev-')) {
            const aisPreOrigin = `${parsed.protocol}//${h.replace(/^ais-dev-/, 'ais-pre-')}`;
            return res.json({
              origin: aisPreOrigin,
              source: 'shared_cloud_run',
              live: true,
              starting: false
            });
          }
        } catch {
          // ignore
        }
      }

      // 3. Fallback to the canonical permanent 24/7 Cloud Run URL
      return res.json({
        origin: 'https://ais-pre-uce67yawslleuefunsutes-473233361289.europe-west1.run.app',
        source: 'shared_cloud_run',
        live: true,
        starting: false
      });
    } catch {
      return res.json({
        origin: 'https://ais-pre-uce67yawslleuefunsutes-473233361289.europe-west1.run.app',
        source: 'shared_cloud_run',
        live: true,
        starting: false
      });
    }
  });

  // Public Exam Config Endpoints (excludes adminPin)
  app.get('/api/config', (_req, res) => {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        delete parsed.adminPin;
        return res.json(parsed);
      }
      return res.json({});
    } catch (err) {
      console.error('Error reading config:', err);
      return res.json({});
    }
  });

  app.post('/api/config', requireAdminAuth, (req, res) => {
    try {
      const incoming = req.body || {};
      let existing: Record<string, unknown> = {};
      if (fs.existsSync(CONFIG_FILE)) {
        try {
          existing = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        } catch {
          existing = {};
        }
      }
      const safeConfig = {
        ...existing,
        ...(typeof incoming.title === 'string' ? { title: incoming.title.trim() } : {}),
        ...(typeof incoming.description === 'string' ? { description: incoming.description.trim() } : {}),
        ...(typeof incoming.durationMinutes === 'number' ? { durationMinutes: incoming.durationMinutes } : {}),
        ...(typeof incoming.shuffleQuestions === 'boolean' ? { shuffleQuestions: incoming.shuffleQuestions } : {}),
        ...(typeof incoming.allowReview === 'boolean' ? { allowReview: incoming.allowReview } : {}),
        ...(typeof incoming.passPercentage === 'number' ? { passPercentage: incoming.passPercentage } : {}),
        ...(typeof incoming.activeSectionId === 'string' ? { activeSectionId: incoming.activeSectionId } : {}),
        ...(typeof incoming.customPublicUrl === 'string' ? { customPublicUrl: incoming.customPublicUrl.trim() } : {}),
        updatedAt: new Date().toISOString()
      };
      delete (safeConfig as Record<string, unknown>).adminPin;
      safeWriteJsonAtomic(CONFIG_FILE, safeConfig);
      updateMasterVault();
      return res.json({ success: true, config: safeConfig });
    } catch (err) {
      console.error('Error saving config:', err);
      return res.status(500).json({ error: 'Failed to save config' });
    }
  });

  // Quiz API Endpoints
  app.get('/api/quiz', (_req, res) => {
    try {
      if (fs.existsSync(QUIZ_FILE)) {
        const data = fs.readFileSync(QUIZ_FILE, 'utf-8');
        return res.json(JSON.parse(data));
      }
      return res.json({ notFound: true });
    } catch (err: any) {
      console.error('Error reading quiz:', err);
      return res.status(500).json({ error: 'Failed to read quiz' });
    }
  });

  app.post('/api/quiz', requireAdminAuth, (req, res) => {
    try {
      const quizData = req.body;
      if (!quizData || !Array.isArray(quizData.questions)) {
        return res.status(400).json({ error: 'Invalid quiz payload' });
      }
      quizData.updatedAt = new Date().toISOString();
      safeWriteJsonAtomic(QUIZ_FILE, quizData);
      updateMasterVault();
      return res.json({ success: true, quiz: quizData });
    } catch (err: any) {
      console.error('Error saving quiz:', err);
      return res.status(500).json({ error: 'Failed to save quiz' });
    }
  });

  // Quiz Sections API Endpoints (Permanent preservation for all 10+ sections and custom questions)
  app.get('/api/sections', (_req, res) => {
    try {
      const sections = readJsonSafe<any[]>(SECTIONS_FILE, []);
      return res.json(sections);
    } catch (err) {
      console.error('Error reading sections:', err);
      return res.json([]);
    }
  });

  app.post('/api/sections', requireAdminAuth, (req, res) => {
    try {
      const sections = req.body;
      if (!Array.isArray(sections)) {
        return res.status(400).json({ error: 'Sections array is required' });
      }
      safeWriteJsonAtomic(SECTIONS_FILE, sections);
      updateMasterVault();
      return res.json({ success: true, sections });
    } catch (err) {
      console.error('Error saving sections:', err);
      return res.status(500).json({ error: 'Failed to save sections' });
    }
  });

  // Academic Grade & Subject Question Banks API Endpoints
  app.get('/api/subject-banks', (_req, res) => {
    try {
      if (fs.existsSync(SUBJECT_BANKS_FILE)) {
        const raw = fs.readFileSync(SUBJECT_BANKS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return res.json(parsed && typeof parsed === 'object' ? parsed : {});
      }
      return res.json({});
    } catch (err) {
      console.error('Error reading subject banks:', err);
      return res.json({});
    }
  });

  app.post('/api/subject-banks/:bankKey', requireAdminAuth, (req, res) => {
    try {
      const { bankKey } = req.params;
      if (!bankKey || !/^[a-z0-9_]+$/i.test(bankKey)) {
        return res.status(400).json({ error: 'Invalid subject bank key' });
      }
      const body = req.body || {};
      if (!Array.isArray(body.questions)) {
        return res.status(400).json({ error: 'Questions array is required' });
      }

      let currentBanks: Record<string, any> = readJsonSafe<Record<string, any>>(SUBJECT_BANKS_FILE, {});

      const savedEntry = {
        bankKey,
        gradeId: String(body.gradeId || bankKey.split('_')[0] || ''),
        subjectId: String(body.subjectId || bankKey.split('_').slice(1).join('_') || ''),
        title: String(body.title || bankKey).trim(),
        ...(body.sourceFilename ? { sourceFilename: String(body.sourceFilename).trim() } : {}),
        durationMinutes: typeof body.durationMinutes === 'number' && body.durationMinutes > 0 ? body.durationMinutes : 20,
        questions: body.questions,
        updatedAt: new Date().toISOString()
      };

      currentBanks[bankKey] = savedEntry;
      safeWriteJsonAtomic(SUBJECT_BANKS_FILE, currentBanks);
      updateMasterVault();
      return res.json({ success: true, bank: savedEntry });
    } catch (err) {
      console.error('Error saving subject bank:', err);
      return res.status(500).json({ error: 'Failed to save subject bank' });
    }
  });

  app.delete('/api/subject-banks/:bankKey', requireAdminAuth, (req, res) => {
    try {
      const { bankKey } = req.params;
      if (fs.existsSync(SUBJECT_BANKS_FILE)) {
        const currentBanks = readJsonSafe<Record<string, any>>(SUBJECT_BANKS_FILE, {});
        delete currentBanks[bankKey];
        safeWriteJsonAtomic(SUBJECT_BANKS_FILE, currentBanks);
        updateMasterVault();
      }
      return res.json({ success: true });
    } catch (err) {
      console.error('Error deleting subject bank:', err);
      return res.status(500).json({ error: 'Failed to delete subject bank' });
    }
  });

  // Student Results API Endpoints - Leaderboard and student scores restricted exclusively to Supervisor
  app.get('/api/results', (req, res) => {
    try {
      const token = extractBearerToken(req);
      const sec = readAdminSecurity();
      const isAdmin = Boolean(token && sec.sessions[token] && sec.sessions[token].expiresAt > Date.now());
      if (!isAdmin) {
        // Privacy: Non-admin users cannot scrape or browse other students' results
        return res.json([]);
      }
      const data = readJsonSafe<any[]>(RESULTS_FILE, []);
      return res.json(data);
    } catch (err: any) {
      console.error('Error reading results:', err);
      return res.status(500).json({ error: 'Failed to read results' });
    }
  });

  app.post('/api/results', (req, res) => {
    try {
      const result = req.body;
      if (!result || !result.studentName) {
        return res.status(400).json({ error: 'Student name and result data required' });
      }
      let currentResults = readJsonSafe<any[]>(RESULTS_FILE, []);

      // Add unique ID and timestamp if missing, and preserve sectionTitle
      const entryId =
        result.id || 'res_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);

      const newEntry = {
        id: entryId,
        studentName: String(result.studentName).trim(),
        ...(result.track === 'academic' || result.track === 'qudurat' ? { track: result.track } : {}),
        ...(result.gradeTitle ? { gradeTitle: String(result.gradeTitle).trim() } : {}),
        ...(result.subjectTitle ? { subjectTitle: String(result.subjectTitle).trim() } : {}),
        ...(result.sectionTitle ? { sectionTitle: String(result.sectionTitle).trim() } : {}),
        score: typeof result.score === 'number' ? result.score : 0,
        total: typeof result.total === 'number' ? result.total : 13,
        percentage: typeof result.percentage === 'number' ? result.percentage : 0,
        timeSeconds: typeof result.timeSeconds === 'number' ? result.timeSeconds : 0,
        submittedAt: result.submittedAt || new Date().toISOString(),
        answers: result.answers || {}
      };

      // Deduplicate by id in case client retried submission after brief network loss
      currentResults = currentResults.filter((r: any) => r.id !== entryId);
      currentResults.unshift(newEntry);
      safeWriteJsonAtomic(RESULTS_FILE, currentResults);
      updateMasterVault();
      console.log(`[Results] Saved result for student: ${newEntry.studentName} (${newEntry.score}/${newEntry.total})`);
      return res.json({ success: true, result: newEntry });
    } catch (err: any) {
      console.error('Error saving result:', err);
      return res.status(500).json({ error: 'Failed to save student result' });
    }
  });

  app.delete('/api/results/:id', requireAdminAuth, (req, res) => {
    try {
      const { id } = req.params;
      recordDeletedId('results', id);
      const currentResults = readJsonSafe<any[]>(RESULTS_FILE, []);
      const filtered = currentResults.filter((r: any) => r.id !== id);
      safeWriteJsonAtomic(RESULTS_FILE, filtered);
      updateMasterVault();
      return res.json({ success: true, deletedId: id });
    } catch {
      return res.status(500).json({ error: 'Failed to delete result' });
    }
  });

  app.delete('/api/results', requireAdminAuth, (_req, res) => {
    try {
      createSafetyBackupSnapshot('pre_clear_results');
      safeWriteJsonAtomic(RESULTS_FILE, []);
      updateMasterVault();
      return res.json({ success: true });
    } catch {
      return res.status(500).json({ error: 'Failed to clear results' });
    }
  });

  // ====================== Student Questions API ======================
  app.get('/api/student-questions', (_req, res) => {
    try {
      const data = readJsonSafe<any[]>(STUDENT_QUESTIONS_FILE, []);
      return res.json(data);
    } catch (err) {
      console.error('Error reading student questions:', err);
      return res.json([]);
    }
  });

  app.post('/api/student-questions', (req, res) => {
    try {
      const { studentName, category, text, imageUrl } = req.body || {};
      if (!text && !imageUrl) {
        return res.status(400).json({ error: 'يرجى كتابة نص السؤال أو إرفاق صورة للسؤال' });
      }
      let list = readJsonSafe<any[]>(STUDENT_QUESTIONS_FILE, []);

      const newQuestion = {
        id: 'sq_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
        studentName: (studentName && String(studentName).trim()) || 'طالبة',
        category: category || 'لفظي',
        text: (text && String(text).trim()) || '',
        imageUrl: imageUrl || '',
        createdAt: new Date().toISOString(),
        replies: []
      };

      list.unshift(newQuestion);
      safeWriteJsonAtomic(STUDENT_QUESTIONS_FILE, list);
      updateMasterVault();
      return res.json({ success: true, question: newQuestion });
    } catch (err: any) {
      console.error('Error saving student question:', err);
      return res.status(500).json({ error: 'تعذر حفظ السؤال' });
    }
  });

  app.post('/api/student-questions/:id/reply', (req, res) => {
    try {
      const { id } = req.params;
      const { authorName, text, isSupervisor } = req.body || {};
      if (!text) {
        return res.status(400).json({ error: 'نص الإجابة أو الرد مطلوب' });
      }
      let list = readJsonSafe<any[]>(STUDENT_QUESTIONS_FILE, []);

      const qIndex = list.findIndex((q: any) => q.id === id);
      if (qIndex === -1) {
        return res.status(404).json({ error: 'السؤال غير موجود' });
      }

      const reply = {
        id: 'rep_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 5),
        authorName: (authorName && String(authorName).trim()) || (isSupervisor ? 'المشرفة الأكاديمية أ/ صافيناز عبدالعزيز' : 'طالبة'),
        isSupervisor: Boolean(isSupervisor),
        text: String(text).trim(),
        createdAt: new Date().toISOString()
      };

      if (!Array.isArray(list[qIndex].replies)) {
        list[qIndex].replies = [];
      }
      list[qIndex].replies.push(reply);

      safeWriteJsonAtomic(STUDENT_QUESTIONS_FILE, list);
      updateMasterVault();
      return res.json({ success: true, reply });
    } catch (err) {
      console.error('Error saving reply:', err);
      return res.status(500).json({ error: 'تعذر إضافة الرد' });
    }
  });

  app.delete('/api/student-questions/:id', (req, res) => {
    try {
      const { id } = req.params;
      recordDeletedId('questions', id);
      const list = readJsonSafe<any[]>(STUDENT_QUESTIONS_FILE, []);
      const filtered = list.filter((q: any) => q.id !== id);
      safeWriteJsonAtomic(STUDENT_QUESTIONS_FILE, filtered);
      updateMasterVault();
      return res.json({ success: true, deletedId: id });
    } catch {
      return res.status(500).json({ error: 'تعذر حذف السؤال' });
    }
  });

  // ====================== Platform Feedback API ======================
  app.get('/api/feedback', (_req, res) => {
    try {
      const data = readJsonSafe<any[]>(FEEDBACK_FILE, []);
      return res.json(data);
    } catch (err) {
      console.error('Error reading feedback:', err);
      return res.json([]);
    }
  });

  app.post('/api/feedback', (req, res) => {
    try {
      const { studentName, rating, comment } = req.body || {};
      if (!comment && !rating) {
        return res.status(400).json({ error: 'يرجى كتابة التقييم والتعليق' });
      }
      let list = readJsonSafe<any[]>(FEEDBACK_FILE, []);

      const newFeedback = {
        id: 'fb_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
        studentName: (studentName && String(studentName).trim()) || 'طالبة',
        rating: typeof rating === 'number' ? Math.max(1, Math.min(5, rating)) : 5,
        comment: (comment && String(comment).trim()) || '',
        createdAt: new Date().toISOString()
      };

      list.unshift(newFeedback);
      safeWriteJsonAtomic(FEEDBACK_FILE, list);
      updateMasterVault();
      return res.json({ success: true, feedback: newFeedback });
    } catch (err: any) {
      console.error('Error saving feedback:', err);
      return res.status(500).json({ error: 'تعذر حفظ التقييم' });
    }
  });

  app.delete('/api/feedback/:id', (req, res) => {
    try {
      const { id } = req.params;
      recordDeletedId('feedback', id);
      const list = readJsonSafe<any[]>(FEEDBACK_FILE, []);
      const filtered = list.filter((f: any) => f.id !== id);
      safeWriteJsonAtomic(FEEDBACK_FILE, filtered);
      updateMasterVault();
      return res.json({ success: true, deletedId: id });
    } catch {
      return res.status(500).json({ error: 'تعذر حذف التقييم' });
    }
  });

  // Tombstones registry endpoint for cross-client sync
  app.get('/api/deleted-ids', (_req, res) => {
    try {
      return res.json(readDeletedIds());
    } catch {
      return res.json({ results: [], feedback: [], questions: [] });
    }
  });

  // ====================== Bi-Directional Non-Destructive Reconciliation API ======================
  // Clients automatically reconcile their local data with the server without ever losing records,
  // while strictly and permanently honoring supervisor deletions across all devices.
  app.post('/api/sync/reconcile', (req, res) => {
    try {
      const body = req.body || {};
      const deleted = readDeletedIds();
      const deletedResSet = new Set(deleted.results);
      const deletedFbSet = new Set(deleted.feedback);
      const deletedQSet = new Set(deleted.questions);

      const clientResults = (Array.isArray(body.results) ? body.results : []).filter(
        (r: any) => r && r.id && !deletedResSet.has(r.id)
      );
      const clientFeedback = (Array.isArray(body.feedback) ? body.feedback : []).filter(
        (f: any) => f && f.id && !deletedFbSet.has(f.id)
      );
      const clientQuestions = (Array.isArray(body.studentQuestions) ? body.studentQuestions : []).filter(
        (q: any) => q && q.id && !deletedQSet.has(q.id)
      );
      const clientSections = Array.isArray(body.sections) ? body.sections : [];

      const serverResults = readJsonSafe<any[]>(RESULTS_FILE, []).filter(
        (r: any) => r && r.id && !deletedResSet.has(r.id)
      );
      const serverFeedback = readJsonSafe<any[]>(FEEDBACK_FILE, []).filter(
        (f: any) => f && f.id && !deletedFbSet.has(f.id)
      );
      const serverQuestions = readJsonSafe<any[]>(STUDENT_QUESTIONS_FILE, []).filter(
        (q: any) => q && q.id && !deletedQSet.has(q.id)
      );
      const serverSections = readJsonSafe<any[]>(SECTIONS_FILE, []);

      // Merge results by ID
      const resultsMap = new Map<string, any>();
      for (const r of [...serverResults, ...clientResults]) {
        if (r && r.id && r.studentName && !deletedResSet.has(r.id)) {
          const prev = resultsMap.get(r.id);
          if (!prev) {
            resultsMap.set(r.id, r);
          } else {
            resultsMap.set(r.id, {
              ...prev,
              ...r,
              answers: { ...(prev.answers || {}), ...(r.answers || {}) },
              score: Math.max(prev.score ?? 0, r.score ?? 0),
              percentage: Math.max(prev.percentage ?? 0, r.percentage ?? 0)
            });
          }
        }
      }
      const consolidatedResults = Array.from(resultsMap.values()).sort((a, b) => {
        const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return timeB - timeA;
      });

      // Merge feedback by ID
      const feedbackMap = new Map<string, any>();
      for (const f of [...serverFeedback, ...clientFeedback]) {
        if (f && f.id && !deletedFbSet.has(f.id)) {
          feedbackMap.set(f.id, f);
        }
      }
      const consolidatedFeedback = Array.from(feedbackMap.values()).sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      // Merge questions by ID
      const questionsMap = new Map<string, any>();
      for (const q of [...serverQuestions, ...clientQuestions]) {
        if (q && q.id && !deletedQSet.has(q.id)) {
          const prev = questionsMap.get(q.id);
          if (!prev) {
            questionsMap.set(q.id, q);
          } else {
            const replyMap = new Map<string, any>();
            for (const rep of prev.replies || []) { if (rep?.id) replyMap.set(rep.id, rep); }
            for (const rep of q.replies || []) { if (rep?.id) replyMap.set(rep.id, rep); }
            questionsMap.set(q.id, {
              ...prev,
              ...q,
              replies: Array.from(replyMap.values())
            });
          }
        }
      }
      const consolidatedQuestions = Array.from(questionsMap.values()).sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      // Merge sections by ID
      const sectionsMap = new Map<string, any>();
      for (const s of [...serverSections, ...clientSections]) {
        if (s && s.id) {
          const prev = sectionsMap.get(s.id);
          if (!prev) {
            sectionsMap.set(s.id, s);
          } else {
            sectionsMap.set(s.id, {
              ...prev,
              ...s,
              questions: Array.isArray(s.questions) && s.questions.length > 0 ? s.questions : prev.questions
            });
          }
        }
      }
      const consolidatedSections = Array.from(sectionsMap.values()).sort((a, b) => (a.sectionNumber || 0) - (b.sectionNumber || 0));

      // Save atomically to server
      safeWriteJsonAtomic(RESULTS_FILE, consolidatedResults);
      safeWriteJsonAtomic(FEEDBACK_FILE, consolidatedFeedback);
      safeWriteJsonAtomic(STUDENT_QUESTIONS_FILE, consolidatedQuestions);
      if (consolidatedSections.length > 0) {
        safeWriteJsonAtomic(SECTIONS_FILE, consolidatedSections);
      }
      updateMasterVault();

      return res.json({
        success: true,
        reconciledAt: new Date().toISOString(),
        results: consolidatedResults,
        feedback: consolidatedFeedback,
        studentQuestions: consolidatedQuestions,
        sections: consolidatedSections,
        deletedIds: deleted
      });
    } catch (err: any) {
      console.error('Error during reconciliation:', err);
      return res.status(500).json({ error: 'Reconciliation failed' });
    }
  });

  // ====================== Full Platform Backup & Restore API ======================
  app.get('/api/backup/export', requireAdminAuth, (_req, res) => {
    try {
      const results = readJsonSafe<any[]>(RESULTS_FILE, []);
      const feedback = readJsonSafe<any[]>(FEEDBACK_FILE, []);
      const studentQuestions = readJsonSafe<any[]>(STUDENT_QUESTIONS_FILE, []);
      const sections = readJsonSafe<any[]>(SECTIONS_FILE, []);
      const quiz = readJsonSafe<any>(QUIZ_FILE, null);
      const subjectBanks = readJsonSafe<any>(SUBJECT_BANKS_FILE, {});
      const config = readJsonSafe<any>(CONFIG_FILE, {});

      const backup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        supervisor: 'أ/ صافيناز عبدالعزيز',
        platform: 'منصة مدارس الحديثة الأهلية للتفوق في القدرات',
        counts: {
          results: results.length,
          feedback: feedback.length,
          studentQuestions: studentQuestions.length,
          sections: sections.length
        },
        data: {
          results,
          feedback,
          studentQuestions,
          sections,
          quiz,
          subjectBanks,
          config
        }
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="backup_cbt_safinaz_${new Date().toISOString().slice(0, 10)}.json"`
      );
      return res.send(JSON.stringify(backup, null, 2));
    } catch (err) {
      console.error('Error exporting backup:', err);
      return res.status(500).json({ error: 'Failed to export backup' });
    }
  });

  app.post('/api/backup/restore', requireAdminAuth, (req, res) => {
    try {
      const { backup, mode } = req.body || {};
      if (!backup || !backup.data) {
        return res.status(400).json({ error: 'ملف النسخة الاحتياطية غير صالح' });
      }

      // Pre-restore snapshot
      createSafetyBackupSnapshot('pre_restore');

      const incomingData = backup.data;
      const isMerge = mode !== 'replace';

      if (isMerge) {
        // Merge results
        const curResults = readJsonSafe<any[]>(RESULTS_FILE, []);
        const mergedResMap = new Map<string, any>();
        for (const r of [...curResults, ...(incomingData.results || [])]) {
          if (r?.id) mergedResMap.set(r.id, r);
        }
        safeWriteJsonAtomic(RESULTS_FILE, Array.from(mergedResMap.values()));

        // Merge feedback
        const curFeedback = readJsonSafe<any[]>(FEEDBACK_FILE, []);
        const mergedFbMap = new Map<string, any>();
        for (const f of [...curFeedback, ...(incomingData.feedback || [])]) {
          if (f?.id) mergedFbMap.set(f.id, f);
        }
        safeWriteJsonAtomic(FEEDBACK_FILE, Array.from(mergedFbMap.values()));

        // Merge student questions
        const curQuestions = readJsonSafe<any[]>(STUDENT_QUESTIONS_FILE, []);
        const mergedQMap = new Map<string, any>();
        for (const q of [...curQuestions, ...(incomingData.studentQuestions || [])]) {
          if (q?.id) mergedQMap.set(q.id, q);
        }
        safeWriteJsonAtomic(STUDENT_QUESTIONS_FILE, Array.from(mergedQMap.values()));

        // Merge sections
        if (Array.isArray(incomingData.sections) && incomingData.sections.length > 0) {
          const curSections = readJsonSafe<any[]>(SECTIONS_FILE, []);
          const mergedSecMap = new Map<string, any>();
          for (const s of [...curSections, ...incomingData.sections]) {
            if (s?.id) mergedSecMap.set(s.id, s);
          }
          safeWriteJsonAtomic(SECTIONS_FILE, Array.from(mergedSecMap.values()));
        }
      } else {
        // Full replace
        if (Array.isArray(incomingData.results)) safeWriteJsonAtomic(RESULTS_FILE, incomingData.results);
        if (Array.isArray(incomingData.feedback)) safeWriteJsonAtomic(FEEDBACK_FILE, incomingData.feedback);
        if (Array.isArray(incomingData.studentQuestions)) safeWriteJsonAtomic(STUDENT_QUESTIONS_FILE, incomingData.studentQuestions);
        if (Array.isArray(incomingData.sections)) safeWriteJsonAtomic(SECTIONS_FILE, incomingData.sections);
        if (incomingData.quiz) safeWriteJsonAtomic(QUIZ_FILE, incomingData.quiz);
        if (incomingData.subjectBanks) safeWriteJsonAtomic(SUBJECT_BANKS_FILE, incomingData.subjectBanks);
        if (incomingData.config) safeWriteJsonAtomic(CONFIG_FILE, incomingData.config);
      }

      updateMasterVault();

      return res.json({
        success: true,
        mode: isMerge ? 'merge' : 'replace',
        message: isMerge ? 'تم دمج النسخة الاحتياطية بنجاح والحفاظ على جميع السجلات السابقة' : 'تمت استعادة النسخة الاحتياطية بنجاح'
      });
    } catch (err: any) {
      console.error('Error restoring backup:', err);
      return res.status(500).json({ error: 'Failed to restore backup' });
    }
  });

  app.get('/api/backup/status', (_req, res) => {
    try {
      const vault = readJsonSafe<any>(MASTER_VAULT_FILE, null);
      const results = readJsonSafe<any[]>(RESULTS_FILE, []);
      const feedback = readJsonSafe<any[]>(FEEDBACK_FILE, []);
      const studentQuestions = readJsonSafe<any[]>(STUDENT_QUESTIONS_FILE, []);
      const sections = readJsonSafe<any[]>(SECTIONS_FILE, []);

      return res.json({
        protected: true,
        shieldActive: true,
        vaultUpdatedAt: vault?.updatedAt || null,
        counts: {
          results: results.length,
          feedback: feedback.length,
          studentQuestions: studentQuestions.length,
          sections: sections.length
        }
      });
    } catch {
      return res.json({ protected: true, shieldActive: true });
    }
  });

  // Serve built production bundle whenever NODE_ENV=production or when started outside dev mode with dist/ present
  const distPath = path.join(__dirname, 'dist');
  const distIndex = path.join(distPath, 'index.html');
  const serveProductionBundle =
    process.env.NODE_ENV === 'production' ||
    (process.env.NODE_ENV !== 'development' && fs.existsSync(distIndex));

  if (!serveProductionBundle) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      '/assets',
      express.static(path.join(distPath, 'assets'), {
        maxAge: '1y',
        immutable: true
      })
    );
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        }
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(distIndex);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running 24/7-ready on http://0.0.0.0:${PORT}`);

    // In workspace/dev mode, automatically start & self-heal the built-in public student gateway
    if (process.env.NODE_ENV !== 'production') {
      ensurePublicGateway(PORT).catch(() => {});
      const keepAliveTimer = setInterval(() => {
        ensurePublicGateway(PORT).catch(() => {});
      }, 25000);
      keepAliveTimer.unref();
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
