import { StageId } from '../types/quiz';

export const PLATFORM_FULL_NAME = 'منصة مدارس الحديثة الأهلية للتفوق في القدرات';
export const PLATFORM_SHORT_NAME = 'مدارس الحديثة الأهلية للتفوق في القدرات';
export const PLATFORM_SUBTITLE = 'منصة محاكاة وتدريب اختبار القدرات العامة المحوسب (لفظي وكمي)';
export const SCHOOL_LOGO_URL = '/assets/aistudio/IMG_20261027_184906_067_d4744c34.jpg';
export const AUTHOR_CREDIT = 'إعداد المشرفة الأكاديمية أ/ صافيناز عبدالعزيز';
export const COPYRIGHT_TEXT = 'إعداد المشرفة الأكاديمية أ/ صافيناز عبدالعزيز — جميع الحقوق محفوظة © 2026';

export interface StageDefinition {
  id: StageId;
  title: string;
  shortTitle: string;
  gradesRangeLabel: string;
}

export interface GradeDefinition {
  id: string;
  order: number;
  stageId: StageId;
  title: string;
  shortTitle: string;
}

export interface SubjectDefinition {
  id: string;
  title: string;
  categoryLabel: string;
  defaultDurationMinutes: number;
}

export const ACADEMIC_STAGES: StageDefinition[] = [
  {
    id: 'elementary',
    title: 'المرحلة الابتدائية',
    shortTitle: 'الابتدائية',
    gradesRangeLabel: 'من الصف الأول حتى السادس الابتدائي'
  },
  {
    id: 'middle',
    title: 'المرحلة المتوسطة',
    shortTitle: 'المتوسطة',
    gradesRangeLabel: 'من الصف الأول حتى الثالث المتوسط'
  },
  {
    id: 'high',
    title: 'المرحلة الثانوية',
    shortTitle: 'الثانوية',
    gradesRangeLabel: 'من الصف الأول حتى الثالث الثانوي'
  }
];

export const ACADEMIC_GRADES: GradeDefinition[] = [
  // Elementary (1 - 6)
  { id: 'g1', order: 1, stageId: 'elementary', title: 'الصف الأول الابتدائي', shortTitle: 'أول ابتدائي' },
  { id: 'g2', order: 2, stageId: 'elementary', title: 'الصف الثاني الابتدائي', shortTitle: 'ثاني ابتدائي' },
  { id: 'g3', order: 3, stageId: 'elementary', title: 'الصف الثالث الابتدائي', shortTitle: 'ثالث ابتدائي' },
  { id: 'g4', order: 4, stageId: 'elementary', title: 'الصف الرابع الابتدائي', shortTitle: 'رابع ابتدائي' },
  { id: 'g5', order: 5, stageId: 'elementary', title: 'الصف الخامس الابتدائي', shortTitle: 'خامس ابتدائي' },
  { id: 'g6', order: 6, stageId: 'elementary', title: 'الصف السادس الابتدائي', shortTitle: 'سادس ابتدائي' },
  // Middle (7 - 9)
  { id: 'g7', order: 7, stageId: 'middle', title: 'الصف الأول المتوسط', shortTitle: 'أول متوسط' },
  { id: 'g8', order: 8, stageId: 'middle', title: 'الصف الثاني المتوسط', shortTitle: 'ثاني متوسط' },
  { id: 'g9', order: 9, stageId: 'middle', title: 'الصف الثالث المتوسط', shortTitle: 'ثالث متوسط' },
  // High School (10 - 12)
  { id: 'g10', order: 10, stageId: 'high', title: 'الصف الأول الثانوي', shortTitle: 'أول ثانوي' },
  { id: 'g11', order: 11, stageId: 'high', title: 'الصف الثاني الثانوي', shortTitle: 'ثاني ثانوي' },
  { id: 'g12', order: 12, stageId: 'high', title: 'الصف الثالث الثانوي', shortTitle: 'ثالث ثانوي' }
];

// Subjects for Elementary & Middle grades (1st Elementary -> 3rd Middle)
export const GENERAL_GRADE_SUBJECTS: SubjectDefinition[] = [
  { id: 'science', title: 'العلوم', categoryLabel: 'علوم', defaultDurationMinutes: 20 },
  { id: 'math', title: 'الرياضيات', categoryLabel: 'رياضيات', defaultDurationMinutes: 25 },
  { id: 'arabic', title: 'اللغة العربية', categoryLabel: 'لغة عربية', defaultDurationMinutes: 20 },
  { id: 'english', title: 'اللغة الإنجليزية', categoryLabel: 'لغة إنجليزية', defaultDurationMinutes: 20 }
];

// Subjects for Upper High School grades (1st Secondary -> 3rd Secondary)
export const HIGH_SCHOOL_SUBJECTS: SubjectDefinition[] = [
  { id: 'math', title: 'الرياضيات', categoryLabel: 'رياضيات', defaultDurationMinutes: 25 },
  { id: 'arabic', title: 'اللغة العربية', categoryLabel: 'لغة عربية', defaultDurationMinutes: 20 },
  { id: 'english', title: 'اللغة الإنجليزية', categoryLabel: 'لغة إنجليزية', defaultDurationMinutes: 20 },
  { id: 'chemistry', title: 'الكيمياء', categoryLabel: 'كيمياء', defaultDurationMinutes: 25 },
  { id: 'physics', title: 'الفيزياء', categoryLabel: 'فيزياء', defaultDurationMinutes: 25 },
  { id: 'biology', title: 'الأحياء', categoryLabel: 'أحياء', defaultDurationMinutes: 20 }
];

export function getGradeById(gradeId: string): GradeDefinition | undefined {
  return ACADEMIC_GRADES.find((g) => g.id === gradeId);
}

export function getGradesByStage(stageId: StageId): GradeDefinition[] {
  return ACADEMIC_GRADES.filter((g) => g.stageId === stageId);
}

export function getSubjectsForGrade(gradeId: string): SubjectDefinition[] {
  const grade = getGradeById(gradeId);
  if (!grade) return GENERAL_GRADE_SUBJECTS;
  return grade.stageId === 'high' ? HIGH_SCHOOL_SUBJECTS : GENERAL_GRADE_SUBJECTS;
}

export function getSubjectForGrade(gradeId: string, subjectId: string): SubjectDefinition | undefined {
  return getSubjectsForGrade(gradeId).find((s) => s.id === subjectId);
}

export function buildSubjectBankKey(gradeId: string, subjectId: string): string {
  return `${gradeId}_${subjectId}`;
}

export function parseSubjectBankKey(
  bankKey: string
): { grade: GradeDefinition; subject: SubjectDefinition } | null {
  const idx = bankKey.indexOf('_');
  if (idx <= 0) return null;
  const gradeId = bankKey.slice(0, idx);
  const subjectId = bankKey.slice(idx + 1);
  const grade = getGradeById(gradeId);
  if (!grade) return null;
  const subject = getSubjectForGrade(gradeId, subjectId);
  if (!subject) return null;
  return { grade, subject };
}
