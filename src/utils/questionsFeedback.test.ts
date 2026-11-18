import test from 'node:test';
import assert from 'node:assert/strict';
import { StudentQuestionItem, PlatformFeedbackItem } from '../types/quiz';
import {
  filterQuestionsForViewer,
  canUserDeleteQuestion,
  canUserDeleteFeedback,
  calculateAverageRating
} from './questionsFeedback';

test('StudentQuestionItem validates structure for image or text questions', () => {
  const textQuestion: StudentQuestionItem = {
    id: 'sq_1',
    studentName: 'ريما',
    category: 'لفظي',
    text: 'ما الفرق بين التناظر والتضاد في السؤال رقم ٤؟',
    createdAt: new Date().toISOString()
  };

  assert.equal(textQuestion.studentName, 'ريما');
  assert.equal(textQuestion.category, 'لفظي');
  assert.ok(textQuestion.text.length > 0);
  assert.equal(textQuestion.imageUrl, undefined);

  const imageQuestion: StudentQuestionItem = {
    id: 'sq_2',
    studentName: 'منى',
    category: 'كمي',
    text: '',
    imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    createdAt: new Date().toISOString()
  };

  assert.equal(imageQuestion.category, 'كمي');
  assert.ok(imageQuestion.imageUrl?.startsWith('data:image/'));
});

test('PlatformFeedbackItem validates rating bounds and comment text', () => {
  const feedback: PlatformFeedbackItem = {
    id: 'fb_1',
    studentName: 'هند',
    rating: 5,
    comment: 'منصة ممتازة جداً وساعدتني في التدريب على إدارة الوقت المحوسب!',
    createdAt: new Date().toISOString()
  };

  assert.equal(feedback.studentName, 'هند');
  assert.ok(feedback.rating >= 1 && feedback.rating <= 5);
  assert.ok(feedback.comment.length > 5);
});

test('filterQuestionsForViewer shows all questions for admin', () => {
  const list: StudentQuestionItem[] = [
    { id: 'q1', studentName: 'سارة', category: 'لفظي', text: 'سؤال سارة', createdAt: '' },
    { id: 'q2', studentName: 'نورة', category: 'كمي', text: 'سؤال نورة', createdAt: '' }
  ];

  const adminResult = filterQuestionsForViewer(list, { isAdmin: true });
  assert.equal(adminResult.length, 2);
});

test('filterQuestionsForViewer shows only authored questions for non-admin student', () => {
  const list: StudentQuestionItem[] = [
    { id: 'q1', studentName: 'سارة أحمد', category: 'لفظي', text: 'سؤال سارة', createdAt: '' },
    { id: 'q2', studentName: 'نورة فهد', category: 'كمي', text: 'سؤال نورة', createdAt: '' },
    { id: 'q3', studentName: 'ريما خالد', category: 'عام', text: 'سؤال ريما', createdAt: '' }
  ];

  // Viewer 1: Sarah viewing by studentName
  const sarahResult = filterQuestionsForViewer(list, {
    isAdmin: false,
    studentName: 'سارة أحمد'
  });
  assert.equal(sarahResult.length, 1);
  assert.equal(sarahResult[0].id, 'q1');

  // Viewer 2: Noura viewing by owned IDs
  const nouraResult = filterQuestionsForViewer(list, {
    isAdmin: false,
    ownedQuestionIds: ['q2']
  });
  assert.equal(nouraResult.length, 1);
  assert.equal(nouraResult[0].id, 'q2');

  // Viewer 3: A new student with no questions
  const newStudentResult = filterQuestionsForViewer(list, {
    isAdmin: false,
    studentName: 'هيفاء',
    ownedQuestionIds: []
  });
  assert.equal(newStudentResult.length, 0);
});

test('canUserDeleteQuestion allows admin and author only', () => {
  const q: StudentQuestionItem = {
    id: 'q1',
    studentName: 'سارة أحمد',
    category: 'لفظي',
    text: 'سؤال سارة',
    createdAt: ''
  };

  assert.equal(canUserDeleteQuestion(q, { isAdmin: true }), true);
  assert.equal(canUserDeleteQuestion(q, { isAdmin: false, ownedQuestionIds: ['q1'] }), true);
  assert.equal(canUserDeleteQuestion(q, { isAdmin: false, studentName: 'سارة أحمد' }), true);
  assert.equal(canUserDeleteQuestion(q, { isAdmin: false, studentName: 'طالبة أخرى' }), false);
});

test('canUserDeleteFeedback allows admin only', () => {
  const fb: PlatformFeedbackItem = {
    id: 'fb1',
    studentName: 'سارة',
    rating: 5,
    comment: 'ممتاز',
    createdAt: ''
  };

  assert.equal(canUserDeleteFeedback(fb, { isAdmin: true }), true);
  assert.equal(canUserDeleteFeedback(fb, { isAdmin: false }), false);
});

test('calculateAverageRating handles empty and filled arrays correctly', () => {
  assert.equal(calculateAverageRating([]), '5.0');
  const items: PlatformFeedbackItem[] = [
    { id: '1', studentName: 'أ', rating: 5, comment: '', createdAt: '' },
    { id: '2', studentName: 'ب', rating: 4, comment: '', createdAt: '' }
  ];
  assert.equal(calculateAverageRating(items), '4.5');
});
