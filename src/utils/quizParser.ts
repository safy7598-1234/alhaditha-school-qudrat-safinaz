import { Question } from '../types/quiz';

/**
 * Parses raw text extracted from PDF, Word, or pasted input into structured Question objects.
 */
export function parseQuestionsFromText(rawText: string): Question[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const questions: Question[] = [];
  let currentText = '';
  let currentOptions: string[] = [];
  let currentCorrectIndex = 0;
  let currentExplanation = '';

  const questionStartRegex = /^(?:(?:س(?:ؤال)?\s*[\d٠-٩]+)|(?:Q(?:uestion)?\s*\d+)|(?:[\d٠-٩]+))[\.\-\)\:\/]\s*(.+)$/i;
  const optionRegex = /^(?:[\(\[]?([أابجدABCDabcd1-4])[\)\]\.\-\:\/]?)\s+(.+)$/;
  const answerKeyRegex = /(?:الإجابة|الجواب|الحل|الصحيحة?|Answer|Correct|Ans)[\s\:\-]+([أابجدABCDabcd1-4])/i;

  const letterToIndex = (char: string): number => {
    const c = char.trim().toLowerCase();
    if (c === 'أ' || c === 'ا' || c === 'a' || c === '1') return 0;
    if (c === 'ب' || c === 'b' || c === '2') return 1;
    if (c === 'ج' || c === 'c' || c === '3') return 2;
    if (c === 'د' || c === 'd' || c === '4') return 3;
    return 0;
  };

  const flushQuestion = () => {
    if (currentText && currentOptions.length >= 2) {
      while (currentOptions.length < 4) {
        currentOptions.push(`خيار ${currentOptions.length + 1}`);
      }
      const finalOptions = currentOptions.slice(0, 4) as [string, string, string, string];

      questions.push({
        id: 'q_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36),
        text: currentText,
        options: finalOptions,
        correctIndex: Math.min(Math.max(currentCorrectIndex, 0), finalOptions.length - 1),
        explanation: currentExplanation || undefined,
        category: currentText.includes('+') || currentText.includes('×') || currentText.includes('%') || /\d/.test(currentText) ? 'كمي' : 'لفظي'
      });
    }

    currentText = '';
    currentOptions = [];
    currentCorrectIndex = 0;
    currentExplanation = '';
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Answer key line
    const ansMatch = line.match(answerKeyRegex);
    if (ansMatch) {
      currentCorrectIndex = letterToIndex(ansMatch[1]);
      const explanationPart = line.split(ansMatch[0])[1]?.replace(/^[\s\-–—:]+/, '');
      if (explanationPart) {
        currentExplanation = explanationPart.trim();
      }
      continue;
    }

    // 2. Explanation line
    if (line.startsWith('التفسير:') || line.startsWith('الشرح:') || line.startsWith('Explanation:')) {
      currentExplanation = line.replace(/^(?:التفسير|الشرح|Explanation):\s*/i, '').trim();
      continue;
    }

    // 3. Question Start (MUST check before options to avoid "1.", "2." being parsed as options)
    const qMatch = line.match(questionStartRegex);
    if (qMatch) {
      if (currentText && currentOptions.length >= 2) {
        flushQuestion();
      }
      currentText = qMatch[1].trim();
      continue;
    }

    // 4. Option line (e.g., أ) 40 or [A] 20 or A. 15)
    const optMatch = line.match(optionRegex);
    if (optMatch && currentText) {
      let optText = optMatch[2].trim();
      if (optText.endsWith('*') || optText.endsWith('✓') || optText.endsWith('✔')) {
        optText = optText.replace(/[\*✓✔]+$/, '').trim();
        currentCorrectIndex = currentOptions.length;
      }
      currentOptions.push(optText);
      continue;
    }

    // 5. Initial question line without numbering
    if (!currentText) {
      currentText = line;
      continue;
    }

    // 6. Multi-line question prompt
    if (currentText && currentOptions.length === 0) {
      currentText += ' ' + line;
      continue;
    }

    // 7. If we already collected options and encounter non-option text
    if (currentOptions.length >= 2) {
      flushQuestion();
      currentText = line;
    }
  }

  flushQuestion();

  return questions;
}
