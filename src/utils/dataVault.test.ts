import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeStudentResults,
  mergeFeedbackItems,
  mergeStudentQuestions,
  mergeSections,
  buildBackupPayload,
  safeJsonParse
} from './dataVault';
import { StudentResult, PlatformFeedbackItem, StudentQuestionItem, QuizSection } from '../types/quiz';

describe('Data Vault & Preservation Logic', () => {
  it('mergeStudentResults merges results non-destructively without losing existing scores', () => {
    const existing: StudentResult[] = [
      {
        id: 'res_1',
        studentName: 'سارة خالد',
        score: 12,
        total: 13,
        percentage: 92,
        timeSeconds: 320,
        submittedAt: '2026-10-30T10:00:00Z',
        answers: { 0: 3 }
      }
    ];

    const incoming: StudentResult[] = [
      {
        id: 'res_2',
        studentName: 'نورة فهد',
        score: 13,
        total: 13,
        percentage: 100,
        timeSeconds: 280,
        submittedAt: '2026-10-30T11:00:00Z',
        answers: { 0: 3, 1: 0 }
      }
    ];

    const merged = mergeStudentResults(existing, incoming);
    assert.equal(merged.length, 2);
    assert.equal(merged[0].id, 'res_2'); // Newer timestamp comes first
    assert.equal(merged[1].id, 'res_1');
  });

  it('mergeStudentResults deduplicates by id and preserves the most complete answers and best score', () => {
    const existing: StudentResult[] = [
      {
        id: 'res_dup',
        studentName: 'ريم علي',
        score: 10,
        total: 13,
        percentage: 76,
        timeSeconds: 400,
        submittedAt: '2026-10-29T10:00:00Z',
        answers: { 0: 1 }
      }
    ];

    const incoming: StudentResult[] = [
      {
        id: 'res_dup',
        studentName: 'ريم علي',
        score: 11,
        total: 13,
        percentage: 84,
        timeSeconds: 390,
        submittedAt: '2026-10-29T10:05:00Z',
        answers: { 1: 2 }
      }
    ];

    const merged = mergeStudentResults(existing, incoming);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].score, 11);
    assert.equal(merged[0].percentage, 84);
    assert.deepEqual(merged[0].answers, { 0: 1, 1: 2 });
  });

  it('mergeFeedbackItems merges feedback items non-destructively', () => {
    const existing: PlatformFeedbackItem[] = [
      {
        id: 'fb_1',
        studentName: 'منى أحمد',
        rating: 5,
        comment: 'منصة رائعة وشرح وافٍ',
        createdAt: '2026-10-28T09:00:00Z'
      }
    ];

    const incoming: PlatformFeedbackItem[] = [
      {
        id: 'fb_2',
        studentName: 'هند خالد',
        rating: 5,
        comment: 'شكراً أستاذة صافيناز',
        createdAt: '2026-10-29T09:00:00Z'
      }
    ];

    const merged = mergeFeedbackItems(existing, incoming);
    assert.equal(merged.length, 2);
    assert.equal(merged[0].id, 'fb_2'); // Newer first
    assert.equal(merged[1].id, 'fb_1');
  });

  it('mergeStudentQuestions merges questions and retains replies from both sides', () => {
    const existing: StudentQuestionItem[] = [
      {
        id: 'sq_1',
        studentName: 'أمل سعيد',
        category: 'لفظي',
        text: 'كيف أفرق بين التناظر وعلاقة الإحاطة؟',
        createdAt: '2026-10-28T12:00:00Z',
        replies: [
          {
            id: 'rep_1',
            authorName: 'المشرفة الأكاديمية',
            isSupervisor: true,
            text: 'انظري دائماً للكل والجزء والوظيفة يا أمل.',
            createdAt: '2026-10-28T12:30:00Z'
          }
        ]
      }
    ];

    const incoming: StudentQuestionItem[] = [
      {
        id: 'sq_1',
        studentName: 'أمل سعيد',
        category: 'لفظي',
        text: 'كيف أفرق بين التناظر وعلاقة الإحاطة؟',
        createdAt: '2026-10-28T12:00:00Z',
        replies: [
          {
            id: 'rep_2',
            authorName: 'طالبة',
            isSupervisor: false,
            text: 'مثل الثوب والجسم والقبعة والرأس',
            createdAt: '2026-10-28T12:45:00Z'
          }
        ]
      }
    ];

    const merged = mergeStudentQuestions(existing, incoming);
    assert.equal(merged.length, 1);
    const replies = merged[0]?.replies || [];
    assert.equal(replies.length, 2);
    assert.equal(replies[0]?.id, 'rep_1');
    assert.equal(replies[1]?.id, 'rep_2');
  });

  it('mergeSections preserves custom supervisor-uploaded questions in existing sections', () => {
    const defaults: QuizSection[] = [
      {
        id: 'sec_1',
        sectionNumber: 1,
        title: 'القسم الأول (1)',
        sourceFilename: 'sample.pdf',
        questions: [{ id: 'q_default', text: 'سؤال افتراضي', options: ['1', '2', '3', '4'], correctIndex: 0, category: 'لفظي' }]
      }
    ];

    const supervisorUploaded: QuizSection[] = [
      {
        id: 'sec_1',
        sectionNumber: 1,
        title: 'القسم الأول معدل',
        sourceFilename: 'custom.pdf',
        questions: [{ id: 'q_custom', text: 'سؤال المشرفة صافيناز', options: ['أ', 'ب', 'ج', 'د'], correctIndex: 1, category: 'لفظي' }]
      },
      {
        id: 'sec_11',
        sectionNumber: 11,
        title: 'القسم الحادي عشر',
        sourceFilename: 'sec11.pdf',
        questions: [{ id: 'q_11_1', text: 'سؤال قسم 11', options: ['أ', 'ب', 'ج', 'د'], correctIndex: 0, category: 'لفظي' }]
      }
    ];

    const merged = mergeSections(defaults, supervisorUploaded);
    assert.equal(merged.length, 2);
    assert.equal(merged[0].id, 'sec_1');
    assert.equal(merged[0].questions[0].id, 'q_custom'); // Kept supervisor custom question
    assert.equal(merged[1].id, 'sec_11');
  });

  it('buildBackupPayload creates a structured full backup object with metadata', () => {
    const backup = buildBackupPayload({
      results: [],
      feedback: [],
      studentQuestions: [],
      sections: [],
      quiz: null
    });
    assert.equal(backup.version, 1);
    assert.equal(backup.supervisor, 'أ/ صافيناز عبدالعزيز');
    assert(backup.exportedAt);
    assert.deepEqual(backup.data.results, []);
  });

  it('safeJsonParse falls back gracefully on corrupt or null JSON', () => {
    assert.deepEqual(safeJsonParse('{invalid}', [1, 2]), [1, 2]);
    assert.deepEqual(safeJsonParse(null, { ok: true }), { ok: true });
    assert.deepEqual(safeJsonParse('{"ok":true}', { ok: false }), { ok: true });
  });

  it('mergeStudentQuestions permanently excludes deleted question IDs via deletedIds tombstone', () => {
    const existing: StudentQuestionItem[] = [
      {
        id: 'sq_keep',
        studentName: 'سارة',
        category: 'لفظي',
        text: 'سؤال سيبقى',
        createdAt: '2026-10-28T12:00:00Z',
        replies: []
      },
      {
        id: 'sq_deleted',
        studentName: 'طالبة تم حذف سؤالها',
        category: 'لفظي',
        text: 'سؤال محذوف من قبل المشرفة',
        createdAt: '2026-10-28T12:00:00Z',
        replies: []
      }
    ];

    const incoming: StudentQuestionItem[] = [
      {
        id: 'sq_deleted',
        studentName: 'طالبة تم حذف سؤالها',
        category: 'لفظي',
        text: 'سؤال محذوف من قبل المشرفة قادم من كاش قديم',
        createdAt: '2026-10-28T12:00:00Z',
        replies: []
      },
      {
        id: 'sq_new',
        studentName: 'نورة',
        category: 'كمي',
        text: 'سؤال جديد',
        createdAt: '2026-10-28T13:00:00Z',
        replies: []
      }
    ];

    const tombstones = new Set(['sq_deleted']);
    const merged = mergeStudentQuestions(existing, incoming, tombstones);
    assert.equal(merged.length, 2);
    assert.equal(merged.some((q) => q.id === 'sq_deleted'), false);
    assert.equal(merged.some((q) => q.id === 'sq_keep'), true);
    assert.equal(merged.some((q) => q.id === 'sq_new'), true);
  });

  it('mergeFeedbackItems permanently excludes deleted feedback IDs via deletedIds tombstone', () => {
    const existing: PlatformFeedbackItem[] = [
      {
        id: 'fb_1',
        studentName: 'منى',
        rating: 5,
        comment: 'تقييم سيبقى',
        createdAt: '2026-10-28T09:00:00Z'
      },
      {
        id: 'fb_del',
        studentName: 'طالبة تم حذف تقييمها',
        rating: 1,
        comment: 'تقييم محذوف',
        createdAt: '2026-10-28T09:05:00Z'
      }
    ];

    const incoming: PlatformFeedbackItem[] = [
      {
        id: 'fb_del',
        studentName: 'طالبة تم حذف تقييمها',
        rating: 1,
        comment: 'تقييم محذوف قادم من ذاكرة المتصفح',
        createdAt: '2026-10-28T09:05:00Z'
      }
    ];

    const merged = mergeFeedbackItems(existing, incoming, ['fb_del']);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].id, 'fb_1');
  });

  it('mergeStudentResults permanently excludes deleted result IDs via deletedIds tombstone', () => {
    const existing: StudentResult[] = [
      {
        id: 'res_keep',
        studentName: 'هند',
        score: 13,
        total: 13,
        percentage: 100,
        timeSeconds: 300,
        submittedAt: '2026-10-30T10:00:00Z',
        answers: {}
      },
      {
        id: 'res_deleted',
        studentName: 'اسم محذوف',
        score: 5,
        total: 13,
        percentage: 38,
        timeSeconds: 600,
        submittedAt: '2026-10-30T10:05:00Z',
        answers: {}
      }
    ];

    const incoming: StudentResult[] = [
      {
        id: 'res_deleted',
        studentName: 'اسم محذوف من كاش قديم',
        score: 5,
        total: 13,
        percentage: 38,
        timeSeconds: 600,
        submittedAt: '2026-10-30T10:05:00Z',
        answers: {}
      }
    ];

    const merged = mergeStudentResults(existing, incoming, ['res_deleted']);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].id, 'res_keep');
  });
});
