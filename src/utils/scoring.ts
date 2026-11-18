import { Question } from '../types/quiz';

export interface ScoreSummary {
  score: number;
  total: number;
  percentage: number;
  isPassed: boolean;
  rating: {
    label: string;
    color: string;
    bg: string;
  };
}

export function calculateScore(
  questions: Question[],
  answers: Record<string, number>,
  passThreshold = 60
): ScoreSummary {
  const total = questions.length;
  if (total === 0) {
    return {
      score: 0,
      total: 0,
      percentage: 0,
      isPassed: false,
      rating: { label: 'لا توجد أسئلة', color: 'text-slate-600', bg: 'bg-slate-100' }
    };
  }

  let correctCount = 0;
  for (const q of questions) {
    if (answers[q.id] !== undefined && answers[q.id] === q.correctIndex) {
      correctCount += 1;
    }
  }

  const percentage = Math.round((correctCount / total) * 100);
  const isPassed = percentage >= passThreshold;

  let rating = { label: 'يحتاج إلى تحسين', color: 'text-rose-600', bg: 'bg-rose-50' };
  if (percentage >= 90) {
    rating = { label: 'ممتاز مرتفع', color: 'text-emerald-700', bg: 'bg-emerald-50' };
  } else if (percentage >= 80) {
    rating = { label: 'جيد جداً', color: 'text-teal-700', bg: 'bg-teal-50' };
  } else if (percentage >= 70) {
    rating = { label: 'جيد', color: 'text-blue-700', bg: 'bg-blue-50' };
  } else if (percentage >= 60) {
    rating = { label: 'مقبول', color: 'text-amber-700', bg: 'bg-amber-50' };
  }

  return {
    score: correctCount,
    total,
    percentage,
    isPassed,
    rating
  };
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const paddedMins = mins.toString().padStart(2, '0');
  const paddedSecs = secs.toString().padStart(2, '0');
  return `${paddedMins}:${paddedSecs}`;
}

export const ARABIC_LETTERS = ['أ', 'ب', 'ج', 'د'];
