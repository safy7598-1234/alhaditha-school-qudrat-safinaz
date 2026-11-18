export const MAX_ADMIN_LOGIN_ATTEMPTS = 4;
export const ADMIN_LOCKOUT_DURATION_MS = 60 * 60 * 1000; // 1 hour (3,600,000 ms)

export interface LockoutRecord {
  failedAttempts: number;
  lockedUntil: number | null;
}

export interface LockoutEvaluation {
  isLocked: boolean;
  failedAttempts: number;
  attemptsLeft: number;
  lockedUntil: number | null;
  remainingSeconds: number;
}

export function evaluateLockoutState(
  record: LockoutRecord | null | undefined,
  nowMs: number = Date.now()
): LockoutEvaluation {
  if (!record) {
    return {
      isLocked: false,
      failedAttempts: 0,
      attemptsLeft: MAX_ADMIN_LOGIN_ATTEMPTS,
      lockedUntil: null,
      remainingSeconds: 0
    };
  }

  if (typeof record.lockedUntil === 'number' && record.lockedUntil > nowMs) {
    const remainingSeconds = Math.max(1, Math.ceil((record.lockedUntil - nowMs) / 1000));
    return {
      isLocked: true,
      failedAttempts: MAX_ADMIN_LOGIN_ATTEMPTS,
      attemptsLeft: 0,
      lockedUntil: record.lockedUntil,
      remainingSeconds
    };
  }

  // If a previous lockout timestamp existed and has now expired, reset cleanly
  if (typeof record.lockedUntil === 'number' && record.lockedUntil <= nowMs) {
    return {
      isLocked: false,
      failedAttempts: 0,
      attemptsLeft: MAX_ADMIN_LOGIN_ATTEMPTS,
      lockedUntil: null,
      remainingSeconds: 0
    };
  }

  const failedAttempts = Math.min(
    Math.max(0, Math.floor(record.failedAttempts || 0)),
    MAX_ADMIN_LOGIN_ATTEMPTS
  );
  const attemptsLeft = Math.max(0, MAX_ADMIN_LOGIN_ATTEMPTS - failedAttempts);

  return {
    isLocked: false,
    failedAttempts,
    attemptsLeft,
    lockedUntil: null,
    remainingSeconds: 0
  };
}

export function recordFailedLoginAttempt(
  record: LockoutRecord | null | undefined,
  nowMs: number = Date.now()
): { nextRecord: LockoutRecord; status: LockoutEvaluation } {
  const current = evaluateLockoutState(record, nowMs);

  if (current.isLocked && current.lockedUntil) {
    const nextRecord: LockoutRecord = {
      failedAttempts: MAX_ADMIN_LOGIN_ATTEMPTS,
      lockedUntil: current.lockedUntil
    };
    return { nextRecord, status: current };
  }

  const nextFailed = current.failedAttempts + 1;

  if (nextFailed >= MAX_ADMIN_LOGIN_ATTEMPTS) {
    const lockedUntil = nowMs + ADMIN_LOCKOUT_DURATION_MS;
    const nextRecord: LockoutRecord = {
      failedAttempts: MAX_ADMIN_LOGIN_ATTEMPTS,
      lockedUntil
    };
    return {
      nextRecord,
      status: evaluateLockoutState(nextRecord, nowMs)
    };
  }

  const nextRecord: LockoutRecord = {
    failedAttempts: nextFailed,
    lockedUntil: null
  };

  return {
    nextRecord,
    status: evaluateLockoutState(nextRecord, nowMs)
  };
}

export function resetLockoutRecord(): LockoutRecord {
  return {
    failedAttempts: 0,
    lockedUntil: null
  };
}

export function formatLockoutCountdown(remainingSeconds: number): string {
  const clamped = Math.max(0, Math.floor(remainingSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatArabicRemainingAttempts(attemptsLeft: number): string {
  if (attemptsLeft >= 3) {
    return 'متبقي ٣ محاولات قبل قفل تسجيل الدخول لمدة ساعة';
  }
  if (attemptsLeft === 2) {
    return 'متبقي محاولتان قبل قفل تسجيل الدخول لمدة ساعة';
  }
  if (attemptsLeft === 1) {
    return 'تنبيه أخير: متبقية محاولة واحدة فقط قبل قفل الدخول لمدة ساعة';
  }
  return 'تم قفل محاولات الدخول لمدة ساعة كاملة';
}
