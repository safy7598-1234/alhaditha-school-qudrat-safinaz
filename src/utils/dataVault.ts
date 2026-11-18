/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  StudentResult,
  PlatformFeedbackItem,
  StudentQuestionItem,
  QuizSection,
  QuizConfig,
  QuizData,
  SubjectBanksMap
} from '../types/quiz';

export interface FullPlatformBackup {
  version: number;
  exportedAt: string;
  source: string;
  supervisor: string;
  data: {
    results: StudentResult[];
    feedback: PlatformFeedbackItem[];
    studentQuestions: StudentQuestionItem[];
    sections: QuizSection[];
    quiz: QuizData | null;
    subjectBanks: SubjectBanksMap;
    config: Partial<QuizConfig>;
  };
}

/**
 * Merge two lists of student results by unique ID and submission timestamp.
 * Strictly non-destructive for active items, but permanently honors supervisor deletions via deletedIds.
 */
export function mergeStudentResults(
  existing: StudentResult[],
  incoming: StudentResult[],
  deletedIds?: Set<string> | string[]
): StudentResult[] {
  const deletedSet = new Set(
    deletedIds ? (Array.isArray(deletedIds) ? deletedIds : Array.from(deletedIds)) : []
  );
  const map = new Map<string, StudentResult>();

  // Process existing first
  for (const item of existing) {
    if (item && item.id && item.studentName && !deletedSet.has(item.id)) {
      map.set(item.id, item);
    }
  }

  // Merge incoming
  for (const item of incoming) {
    if (!item || !item.id || !item.studentName || deletedSet.has(item.id)) continue;
    const prev = map.get(item.id);
    if (!prev) {
      map.set(item.id, item);
    } else {
      map.set(item.id, {
        ...prev,
        ...item,
        answers: { ...(prev.answers || {}), ...(item.answers || {}) },
        score: Math.max(prev.score ?? 0, item.score ?? 0),
        percentage: Math.max(prev.percentage ?? 0, item.percentage ?? 0),
        submittedAt: item.submittedAt || prev.submittedAt
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return timeB - timeA;
  });
}

/**
 * Merge feedback items non-destructively by ID, permanently filtering deleted items.
 */
export function mergeFeedbackItems(
  existing: PlatformFeedbackItem[],
  incoming: PlatformFeedbackItem[],
  deletedIds?: Set<string> | string[]
): PlatformFeedbackItem[] {
  const deletedSet = new Set(
    deletedIds ? (Array.isArray(deletedIds) ? deletedIds : Array.from(deletedIds)) : []
  );
  const map = new Map<string, PlatformFeedbackItem>();

  for (const item of existing) {
    if (item && item.id && !deletedSet.has(item.id)) {
      map.set(item.id, item);
    }
  }

  for (const item of incoming) {
    if (!item || !item.id || deletedSet.has(item.id)) continue;
    if (!map.has(item.id)) {
      map.set(item.id, item);
    } else {
      const prev = map.get(item.id)!;
      map.set(item.id, { ...prev, ...item });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
}

/**
 * Merge student questions non-destructively by ID, combining replies, permanently filtering deleted items.
 */
export function mergeStudentQuestions(
  existing: StudentQuestionItem[],
  incoming: StudentQuestionItem[],
  deletedIds?: Set<string> | string[]
): StudentQuestionItem[] {
  const deletedSet = new Set(
    deletedIds ? (Array.isArray(deletedIds) ? deletedIds : Array.from(deletedIds)) : []
  );
  const map = new Map<string, StudentQuestionItem>();

  for (const item of existing) {
    if (item && item.id && !deletedSet.has(item.id)) {
      map.set(item.id, item);
    }
  }

  for (const item of incoming) {
    if (!item || !item.id || deletedSet.has(item.id)) continue;
    const prev = map.get(item.id);
    if (!prev) {
      map.set(item.id, item);
    } else {
      const replyMap = new Map<string, any>();
      for (const rep of prev.replies || []) {
        if (rep && rep.id) replyMap.set(rep.id, rep);
      }
      for (const rep of item.replies || []) {
        if (rep && rep.id) replyMap.set(rep.id, rep);
      }
      map.set(item.id, {
        ...prev,
        ...item,
        replies: Array.from(replyMap.values())
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
}

/**
 * Merge sections non-destructively by ID.
 * Preserves custom uploaded sections and merges questions.
 */
export function mergeSections(
  defaultSections: QuizSection[],
  incomingSections: QuizSection[]
): QuizSection[] {
  const map = new Map<string, QuizSection>();

  for (const sec of defaultSections) {
    if (sec && sec.id) map.set(sec.id, sec);
  }

  for (const sec of incomingSections) {
    if (!sec || !sec.id) continue;
    const prev = map.get(sec.id);
    if (!prev) {
      map.set(sec.id, sec);
    } else {
      // If incoming has questions, keep them (supervisor upload or custom questions)
      map.set(sec.id, {
        ...prev,
        ...sec,
        questions: Array.isArray(sec.questions) && sec.questions.length > 0 ? sec.questions : prev.questions
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.sectionNumber - b.sectionNumber);
}

/**
 * Safely parse JSON with fallback.
 */
export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed !== null && parsed !== undefined ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Build a downloadable JSON blob for the full platform backup.
 */
export function buildBackupPayload(payload: {
  results: StudentResult[];
  feedback: PlatformFeedbackItem[];
  studentQuestions: StudentQuestionItem[];
  sections: QuizSection[];
  quiz: QuizData | null;
  subjectBanks?: SubjectBanksMap;
  config?: Partial<QuizConfig>;
}): FullPlatformBackup {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    source: 'Madaris Al-Haditha Girls CBT Platform',
    supervisor: 'أ/ صافيناز عبدالعزيز',
    data: {
      results: payload.results || [],
      feedback: payload.feedback || [],
      studentQuestions: payload.studentQuestions || [],
      sections: payload.sections || [],
      quiz: payload.quiz,
      subjectBanks: payload.subjectBanks || {},
      config: payload.config || {}
    }
  };
}
