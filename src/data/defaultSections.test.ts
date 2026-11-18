import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DEFAULT_QUDURAT_SECTIONS } from './defaultSections';

describe('Default Sections 1 to 20 Verification', () => {
  it('contains at least 20 sections', () => {
    assert.ok(DEFAULT_QUDURAT_SECTIONS.length >= 20, `Expected at least 20 sections, got ${DEFAULT_QUDURAT_SECTIONS.length}`);
  });

  it('verifies sections 11 to 20 have proper IDs, numbers, titles, and 13 questions each', () => {
    for (let secNum = 11; secNum <= 20; secNum++) {
      const sec = DEFAULT_QUDURAT_SECTIONS.find((s) => s.sectionNumber === secNum);
      assert.ok(sec, `Section ${secNum} must exist`);
      assert.strictEqual(sec.id, `sec_${secNum}`);
      assert.strictEqual(sec.questions.length, 13, `Section ${secNum} should have 13 questions`);

      for (let qIdx = 0; qIdx < sec.questions.length; qIdx++) {
        const q = sec.questions[qIdx];
        assert.ok(q.id, `Question at index ${qIdx} in sec_${secNum} must have an ID`);
        assert.ok(q.text && q.text.trim().length > 0, `Question text must not be empty`);
        assert.ok(Array.isArray(q.options) && q.options.length >= 4, `Question must have at least 4 options`);
        assert.ok(q.correctIndex >= 0 && q.correctIndex < q.options.length, `correctIndex must be valid`);
        assert.ok(q.explanation && q.explanation.trim().length > 0, `Explanation must not be empty`);
      }
    }
  });

  it('guarantees zero occurrences of "سطور" or "sotoor" in any section metadata or questions', () => {
    for (const sec of DEFAULT_QUDURAT_SECTIONS) {
      assert.ok(!sec.title.includes('سطور'), `Section ${sec.sectionNumber} title should not mention سطور`);
      assert.ok(!sec.sourceFilename?.includes('سطور'), `Section ${sec.sectionNumber} sourceFilename should not mention سطور`);

      for (const q of sec.questions) {
        assert.ok(!q.text.includes('سطور'), `Question ${q.id} text should not mention سطور`);
        if (q.passage) {
          assert.ok(!q.passage.includes('سطور'), `Question ${q.id} passage should not mention سطور`);
        }
        if (q.explanation) {
          assert.ok(!q.explanation.includes('سطور'), `Question ${q.id} explanation should not mention سطور`);
        }
        for (const opt of q.options) {
          assert.ok(!opt.includes('سطور'), `Question ${q.id} option should not mention سطور`);
        }
      }
    }
  });
});
