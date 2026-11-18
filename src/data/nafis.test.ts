import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NAFIS_DURATION_MINUTES,
  NAFIS_GRADES,
  buildNafisBankKey,
  parseNafisBankKey,
  getDefaultNafisQuestions,
  resolveEffectiveNafisBank,
  prepareNafisExamQuestions
} from './nafis';
import { SubjectBanksMap } from '../types/quiz';

test('NAFIS defines exact 3 target grades (3rd Elementary, 6th Elementary, 3rd Middle) with 135 minutes duration', () => {
  assert.equal(NAFIS_DURATION_MINUTES, 135);
  assert.equal(NAFIS_GRADES.length, 3);

  const [g3, g6, g9] = NAFIS_GRADES;
  assert.equal(g3.shortTitle, 'ثالث ابتدائي');
  assert.equal(g3.targetQuestionCount, 40);
  assert.equal(g3.defaultDurationMinutes, 135);

  assert.equal(g6.shortTitle, 'سادس ابتدائي');
  assert.equal(g6.targetQuestionCount, 70);
  assert.equal(g6.defaultDurationMinutes, 135);

  assert.equal(g9.shortTitle, 'ثالث متوسط');
  assert.equal(g9.targetQuestionCount, 70);
  assert.equal(g9.defaultDurationMinutes, 135);
});

test('built-in NAFIS comprehensive models contain exact 40 questions for 3rd Elem and 70 questions for 6th Elem & 3rd Middle', () => {
  const qG3 = getDefaultNafisQuestions('nafis_g3');
  const qG6 = getDefaultNafisQuestions('nafis_g6');
  const qG9 = getDefaultNafisQuestions('nafis_g9');

  assert.equal(qG3.length, 40);
  assert.equal(qG6.length, 70);
  assert.equal(qG9.length, 70);

  for (const bank of [qG3, qG6, qG9]) {
    const ids = new Set(bank.map((q) => q.id));
    assert.equal(ids.size, bank.length, 'Every question ID in a NAFIS bank must be unique');
    for (const q of bank) {
      assert.equal(q.options.length, 4);
      assert.ok(q.correctIndex >= 0 && q.correctIndex <= 3);
      assert.ok(q.text.length > 5);
    }
  }
});

test('buildNafisBankKey, parseNafisBankKey, resolveEffectiveNafisBank, and prepareNafisExamQuestions respect supervisor overrides', () => {
  const key = buildNafisBankKey('nafis_g6', 'math');
  assert.equal(key, 'nafis_g6_math');

  const parsed = parseNafisBankKey(key);
  assert.ok(parsed);
  assert.equal(parsed.grade.title, 'الصف السادس الابتدائي');
  assert.equal(parsed.subject.title, 'الرياضيات');

  const emptyMap: SubjectBanksMap = {};
  const defaultComp = resolveEffectiveNafisBank('nafis_g3', 'comprehensive', emptyMap);
  assert.ok(defaultComp.bank);
  assert.equal(defaultComp.bank.questions.length, 40);
  assert.equal(defaultComp.bank.durationMinutes, 135);
  assert.equal(defaultComp.isCustomSupervisorBank, false);

  // Subject bank starts empty until supervisor uploads
  const emptyMath = resolveEffectiveNafisBank('nafis_g3', 'math', emptyMap);
  assert.equal(emptyMath.bank, null);

  // Explicit clear by supervisor overrides built-in comprehensive model
  const clearedMap: SubjectBanksMap = {
    nafis_g3_comprehensive: {
      bankKey: 'nafis_g3_comprehensive',
      gradeId: 'nafis_g3',
      subjectId: 'comprehensive',
      title: 'ممسوح مؤقتاً',
      durationMinutes: 135,
      questions: [],
      updatedAt: '2026-10-27T00:00:00.000Z'
    }
  };
  const clearedComp = resolveEffectiveNafisBank('nafis_g3', 'comprehensive', clearedMap);
  assert.equal(clearedComp.bank, null);
  assert.equal(clearedComp.isCustomSupervisorBank, true);

  // prepareNafisExamQuestions caps >40 questions on 3rd Elementary to 40
  const extraQuestions = [...getDefaultNafisQuestions('nafis_g6')]; // 70 questions
  assert.equal(prepareNafisExamQuestions(extraQuestions, 'nafis_g3').length, 40);
  assert.equal(prepareNafisExamQuestions(extraQuestions, 'nafis_g6').length, 70);
});
