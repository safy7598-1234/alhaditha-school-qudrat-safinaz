import { StudentQuestionItem, PlatformFeedbackItem } from '../types/quiz';

export interface QuestionViewerContext {
  isAdmin: boolean;
  studentName?: string;
  ownedQuestionIds?: string[];
}

/**
 * Filter questions so that:
 * - Admin/supervisor can see ALL questions.
 * - Non-admin students can ONLY see their own questions (either matching their owned IDs or student name).
 */
export function filterQuestionsForViewer(
  questions: StudentQuestionItem[],
  viewer: QuestionViewerContext
): StudentQuestionItem[] {
  if (viewer.isAdmin) {
    return questions;
  }

  const ownedSet = new Set(
    (viewer.ownedQuestionIds || []).map((id) => String(id).trim()).filter(Boolean)
  );
  const normalizedName = (viewer.studentName || '').trim().toLowerCase();

  return questions.filter((q) => {
    if (ownedSet.has(q.id)) {
      return true;
    }
    if (normalizedName && q.studentName && q.studentName.trim().toLowerCase() === normalizedName) {
      return true;
    }
    return false;
  });
}

/**
 * Checks whether the viewer can delete a given question:
 * - Admin can delete any question.
 * - The author of the question can delete their own question.
 */
export function canUserDeleteQuestion(
  question: StudentQuestionItem,
  viewer: QuestionViewerContext
): boolean {
  if (viewer.isAdmin) return true;
  const ownedSet = new Set(
    (viewer.ownedQuestionIds || []).map((id) => String(id).trim()).filter(Boolean)
  );
  if (ownedSet.has(question.id)) return true;
  const normalizedName = (viewer.studentName || '').trim().toLowerCase();
  if (normalizedName && question.studentName && question.studentName.trim().toLowerCase() === normalizedName) {
    return true;
  }
  return false;
}

/**
 * Checks whether the viewer can delete a feedback item:
 * - Admin can delete any feedback.
 */
export function canUserDeleteFeedback(
  _feedback: PlatformFeedbackItem,
  viewer: QuestionViewerContext
): boolean {
  return viewer.isAdmin;
}

/**
 * Calculates the average rating formatted to 1 decimal place.
 */
export function calculateAverageRating(feedbacks: PlatformFeedbackItem[]): string {
  if (!feedbacks || feedbacks.length === 0) return '5.0';
  const sum = feedbacks.reduce((acc, f) => acc + (typeof f.rating === 'number' ? f.rating : 5), 0);
  return (sum / feedbacks.length).toFixed(1);
}
