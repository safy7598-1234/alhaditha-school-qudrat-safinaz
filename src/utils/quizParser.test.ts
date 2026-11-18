import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuestionsFromText } from './quizParser';

test('parseQuestionsFromText parses Arabic standard numbered exam text', () => {
  const sample = `
1. كم ناتج جمع 15 + 25؟
أ) 30
ب) 40
ج) 50
د) 60
الإجابة: ب

2. ما مرادف كلمة "حاذق"؟
أ) بطيء
ب) ماهر وذكي
ج) غاضب
د) متردد
الجواب: ب
الشرح: الحاذق في المعاجم هو الماهر البارع.
`;

  const questions = parseQuestionsFromText(sample);
  assert.equal(questions.length, 2);
  assert.equal(questions[0].options.length, 4);
  assert.equal(questions[0].correctIndex, 1);
  assert.equal(questions[0].options[1], '40');

  assert.equal(questions[1].options.length, 4);
  assert.equal(questions[1].correctIndex, 1);
  assert.equal(questions[1].options[1], 'ماهر وذكي');
  assert.equal(questions[1].explanation, 'الحاذق في المعاجم هو الماهر البارع.');
});

test('parseQuestionsFromText parses English format', () => {
  const text = `
1. What is 2 + 2?
A) 3
B) 4
C) 5
D) 6
Answer: B
`;
  const questions = parseQuestionsFromText(text);
  assert.equal(questions.length, 1);
  assert.equal(questions[0].correctIndex, 1);
  assert.equal(questions[0].options[1], '4');
});
