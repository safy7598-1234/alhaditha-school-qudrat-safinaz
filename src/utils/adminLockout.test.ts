import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_LOCKOUT_DURATION_MS,
  MAX_ADMIN_LOGIN_ATTEMPTS,
  evaluateLockoutState,
  formatLockoutCountdown,
  recordFailedLoginAttempt,
  resetLockoutRecord
} from './adminLockout';

test('allows 3 wrong attempts with decreasing attemptsLeft and locks for 1 hour on the 4th wrong attempt', () => {
  const startMs = 1_700_000_000_000;
  assert.equal(MAX_ADMIN_LOGIN_ATTEMPTS, 4);
  assert.equal(ADMIN_LOCKOUT_DURATION_MS, 3_600_000);

  // Attempt 1 (wrong)
  const r1 = recordFailedLoginAttempt(null, startMs);
  assert.equal(r1.status.isLocked, false);
  assert.equal(r1.status.failedAttempts, 1);
  assert.equal(r1.status.attemptsLeft, 3);

  // Attempt 2 (wrong)
  const r2 = recordFailedLoginAttempt(r1.nextRecord, startMs + 1000);
  assert.equal(r2.status.isLocked, false);
  assert.equal(r2.status.failedAttempts, 2);
  assert.equal(r2.status.attemptsLeft, 2);

  // Attempt 3 (wrong)
  const r3 = recordFailedLoginAttempt(r2.nextRecord, startMs + 2000);
  assert.equal(r3.status.isLocked, false);
  assert.equal(r3.status.failedAttempts, 3);
  assert.equal(r3.status.attemptsLeft, 1);

  // Attempt 4 (wrong) -> Locks for 1 full hour (3600s)
  const fourthMs = startMs + 3000;
  const r4 = recordFailedLoginAttempt(r3.nextRecord, fourthMs);
  assert.equal(r4.status.isLocked, true);
  assert.equal(r4.status.failedAttempts, 4);
  assert.equal(r4.status.attemptsLeft, 0);
  assert.equal(r4.status.remainingSeconds, 3600);
  assert.equal(r4.status.lockedUntil, fourthMs + 3_600_000);
});

test('keeps login locked during the 1-hour window and automatically unlocks once 60 minutes pass', () => {
  const lockStart = 1_700_000_000_000;
  const lockedRecord = {
    failedAttempts: 4,
    lockedUntil: lockStart + 3_600_000
  };

  // 30 minutes later: still locked with 1800 seconds remaining
  const halfHourStatus = evaluateLockoutState(lockedRecord, lockStart + 1_800_000);
  assert.equal(halfHourStatus.isLocked, true);
  assert.equal(halfHourStatus.remainingSeconds, 1800);

  // Additional attempt during lock does not extend or bypass the existing lock
  const duringLock = recordFailedLoginAttempt(lockedRecord, lockStart + 1_800_000);
  assert.equal(duringLock.status.isLocked, true);
  assert.equal(duringLock.nextRecord.lockedUntil, lockStart + 3_600_000);

  // Exactly 1 hour later: lock expires and resets to 4 fresh attempts
  const unlockedStatus = evaluateLockoutState(lockedRecord, lockStart + 3_600_000);
  assert.equal(unlockedStatus.isLocked, false);
  assert.equal(unlockedStatus.failedAttempts, 0);
  assert.equal(unlockedStatus.attemptsLeft, 4);
  assert.equal(unlockedStatus.remainingSeconds, 0);
});

test('resetLockoutRecord clears failed attempts and formatLockoutCountdown formats MM:SS accurately', () => {
  const cleared = resetLockoutRecord();
  assert.deepEqual(cleared, { failedAttempts: 0, lockedUntil: null });
  assert.equal(formatLockoutCountdown(3600), '60:00');
  assert.equal(formatLockoutCountdown(3599), '59:59');
  assert.equal(formatLockoutCountdown(65), '01:05');
  assert.equal(formatLockoutCountdown(0), '00:00');
});
