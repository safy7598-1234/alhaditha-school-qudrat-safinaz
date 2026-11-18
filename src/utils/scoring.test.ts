import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateScore, formatTime } from './scoring';
import { Question } from '../types/quiz';

const sampleQuestions: Question[] = [
  {
    id: 'q1',
    text: 'ما ناتج 1 + 1؟',
    options: ['2', '3', '4', '5'],
    correctIndex: 0
  },
  {
    id: 'q2',
    text: 'ما ناتج 2 + 2؟',
    options: ['3', '4', '5', '6'],
    correctIndex: 1
  },
  {
    id: 'q3',
    text: 'ما عاصمة السعودية؟',
    options: ['جدة', 'الرياض', 'الدمام', 'مكة'],
    correctIndex: 1
  }
];

test('calculateScore handles empty answers correctly', () => {
  const result = calculateScore(sampleQuestions, {});
  assert.equal(result.score, 0);
  assert.equal(result.total, 3);
  assert.equal(result.percentage, 0);
  assert.equal(result.isPassed, false);
});

test('calculateScore evaluates all correct answers', () => {
  const answers = { q1: 0, q2: 1, q3: 1 };
  const result = calculateScore(sampleQuestions, answers);
  assert.equal(result.score, 3);
  assert.equal(result.total, 3);
  assert.equal(result.percentage, 100);
  assert.equal(result.isPassed, true);
  assert.equal(result.rating.label, 'ممتاز مرتفع');
});

test('calculateScore calculates partial score accurately', () => {
  const answers = { q1: 0, q2: 0, q3: 1 }; // q1 correct (0), q2 wrong (0 != 1), q3 correct (1)
  const result = calculateScore(sampleQuestions, answers);
  assert.equal(result.score, 2);
  assert.equal(result.total, 3);
  assert.equal(result.percentage, 67);
  assert.equal(result.isPassed, true);
});

test('formatTime produces correct mm:ss strings', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(59), '00:59');
  assert.equal(formatTime(65), '01:05');
  assert.equal(formatTime(3600), '60:00');
});
