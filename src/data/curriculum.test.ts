import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACADEMIC_STAGES,
  ACADEMIC_GRADES,
  AUTHOR_CREDIT,
  COPYRIGHT_TEXT,
  getGradesByStage,
  getSubjectsForGrade,
  buildSubjectBankKey,
  parseSubjectBankKey
} from './curriculum';

test('curriculum defines all 12 grades from 1st elementary to 3rd secondary across 3 stages and updated supervisor credit', () => {
  assert.equal(ACADEMIC_STAGES.length, 3);
  assert.equal(ACADEMIC_GRADES.length, 12);
  assert.equal(getGradesByStage('elementary').length, 6);
  assert.equal(getGradesByStage('middle').length, 3);
  assert.equal(getGradesByStage('high').length, 3);
  assert.equal(ACADEMIC_GRADES[0].shortTitle, 'أول ابتدائي');
  assert.equal(ACADEMIC_GRADES[11].shortTitle, 'ثالث ثانوي');
  assert.equal(AUTHOR_CREDIT, 'إعداد المشرفة الأكاديمية أ/ صافيناز عبدالعزيز');
  assert.ok(COPYRIGHT_TEXT.includes('إعداد المشرفة الأكاديمية أ/ صافيناز عبدالعزيز'));
});

test('elementary and middle grades expose Science, Math, Arabic, and English', () => {
  for (const gradeId of ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9']) {
    const subjects = getSubjectsForGrade(gradeId).map((s) => s.title);
    assert.deepEqual(subjects, ['العلوم', 'الرياضيات', 'اللغة العربية', 'اللغة الإنجليزية']);
  }
});

test('high school grades (1st to 3rd secondary) expose Math, Arabic, English, Chemistry, Physics, Biology', () => {
  for (const gradeId of ['g10', 'g11', 'g12']) {
    const subjects = getSubjectsForGrade(gradeId).map((s) => s.title);
    assert.deepEqual(subjects, [
      'الرياضيات',
      'اللغة العربية',
      'اللغة الإنجليزية',
      'الكيمياء',
      'الفيزياء',
      'الأحياء'
    ]);
  }
});

test('buildSubjectBankKey and parseSubjectBankKey round-trip valid grade-subject pairs and reject invalid ones', () => {
  const key = buildSubjectBankKey('g10', 'chemistry');
  assert.equal(key, 'g10_chemistry');
  const parsed = parseSubjectBankKey(key);
  assert.ok(parsed);
  assert.equal(parsed.grade.title, 'الصف الأول الثانوي');
  assert.equal(parsed.subject.title, 'الكيمياء');

  // Chemistry is not in 1st elementary
  assert.equal(parseSubjectBankKey('g1_chemistry'), null);
});
