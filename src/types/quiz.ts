export type VerbalCategory =
  | 'تناظر لفظي'
  | 'إكمال الجمل'
  | 'الخطأ السياقي'
  | 'استيعاب المقروء'
  | 'المفردة الشاذة'
  | 'لفظي';

export type QuestionCategory =
  | VerbalCategory
  | string;

export type ExamTrack = 'choice' | 'academic' | 'nafis' | 'qudurat';

export type StageId = 'elementary' | 'middle' | 'high';

export interface Question {
  id: string;
  text: string;
  passage?: string;
  options: [string, string, string, string] | string[];
  correctIndex: number;
  explanation?: string;
  category?: QuestionCategory | string;
}

export interface QuizConfig {
  title: string;
  description: string;
  durationMinutes: number;
  shuffleQuestions: boolean;
  allowReview: boolean;
  passPercentage: number;
  adminPin: string;
  activeSectionId?: string;
  customPublicUrl?: string;
}

export interface QuizData {
  title: string;
  sourceFilename?: string;
  createdAt: string;
  updatedAt: string;
  questions: Question[];
}

export interface QuizSection {
  id: string;
  sectionNumber: number;
  title: string;
  sourceFilename: string;
  questions: Question[];
}

export interface SubjectBankEntry {
  bankKey: string;
  gradeId: string;
  subjectId: string;
  title: string;
  sourceFilename?: string;
  durationMinutes: number;
  questions: Question[];
  updatedAt: string;
}

export type SubjectBanksMap = Record<string, SubjectBankEntry>;

export interface StudentResult {
  id: string;
  studentName: string;
  track?: 'academic' | 'nafis' | 'qudurat';
  gradeTitle?: string;
  subjectTitle?: string;
  sectionTitle?: string;
  score: number;
  total: number;
  percentage: number;
  timeSeconds: number;
  submittedAt: string;
  answers: Record<string, number>; // questionId -> selectedOptionIndex
}

export type ViewMode =
  | 'home'
  | 'quiz'
  | 'result'
  | 'leaderboard'
  | 'questions-feedback'
  | 'admin';

export interface QuestionReply {
  id: string;
  authorName: string;
  isSupervisor?: boolean;
  text: string;
  createdAt: string;
}

export interface StudentQuestionItem {
  id: string;
  studentName: string;
  category: VerbalCategory | string;
  text: string;
  imageUrl?: string;
  createdAt: string;
  replies?: QuestionReply[];
}

export interface PlatformFeedbackItem {
  id: string;
  studentName: string;
  rating: number; // 1 to 5
  comment: string;
  createdAt: string;
}
