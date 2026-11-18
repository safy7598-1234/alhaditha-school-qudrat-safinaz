import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  RotateCcw,
  Home,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  BookOpen,
  Moon,
  Sun,
  ShieldCheck
} from 'lucide-react';
import { Question, StudentResult } from '../types/quiz';
import { AUTHOR_CREDIT, PLATFORM_FULL_NAME } from '../data/curriculum';
import { ARABIC_LETTERS, calculateScore, formatTime } from '../utils/scoring';
import { ExamTheme, getExamThemeToggleLabel } from '../utils/theme';
import { SchoolLogo } from './SchoolLogo';

interface ResultViewProps {
  result: StudentResult;
  questions: Question[];
  theme: ExamTheme;
  onToggleTheme: () => void;
  onRetake: () => void;
  onGoHome: () => void;
  onGoToLeaderboard: () => void;
  isAdmin?: boolean;
}

export const ResultView: React.FC<ResultViewProps> = ({
  result,
  questions,
  theme,
  onToggleTheme,
  onRetake,
  onGoHome,
  onGoToLeaderboard,
  isAdmin = false
}) => {
  const [filter, setFilter] = useState<'all' | 'wrong' | 'correct'>('all');
  const isDark = theme === 'dark';
  const themeLabels = getExamThemeToggleLabel(theme);

  const scoreSummary = calculateScore(questions, result.answers);

  useEffect(() => {
    if (scoreSummary.percentage >= 70) {
      try {
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {
        console.warn('Confetti effect skipped:', e);
      }
    }
  }, [scoreSummary.percentage]);

  const filteredQuestions = questions.filter((q) => {
    const studentChoice = result.answers[q.id];
    const isCorrect = studentChoice !== undefined && studentChoice === q.correctIndex;
    if (filter === 'wrong') return !isCorrect;
    if (filter === 'correct') return isCorrect;
    return true;
  });

  const correctAnswersCount = scoreSummary.score;
  const wrongAnswersCount = scoreSummary.total - correctAnswersCount;

  const examContextLabel =
    result.track === 'nafis'
      ? `اختبار نافس الوطني · ${result.gradeTitle || ''} ${
          result.subjectTitle ? `(${result.subjectTitle})` : ''
        }`
      : result.gradeTitle && result.subjectTitle
      ? `${result.gradeTitle} · مادة ${result.subjectTitle}`
      : result.sectionTitle || 'الاختبار المحوسب';

  return (
    <div className="bg-[#f3f7f4] text-slate-800 transition-colors duration-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Top Result Card */}
        <div className="bg-white rounded-3xl border border-emerald-900/10 p-6 sm:p-10 text-center mb-10 relative overflow-hidden shadow-[0_4px_25px_rgba(6,78,59,0.08)]">
          <div className="flex justify-center mb-4">
            <SchoolLogo size="md" className="ring-2 ring-amber-400 shadow-md" />
          </div>

          <div className="text-xs font-bold text-emerald-800 mb-2 tracking-wide">
            {PLATFORM_FULL_NAME} · {AUTHOR_CREDIT}
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-[#064e3b] mb-1">
            نتيجة الطالبة: <span className="text-amber-500">{result.studentName}</span>
          </h1>
          <p className="text-xs sm:text-sm font-bold text-slate-500 mb-6">
            {examContextLabel}
          </p>

          {/* Score Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto mb-8 tabular-nums">
            <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 relative overflow-hidden">
              <div className="text-3xl sm:text-4xl font-black text-[#064e3b] font-mono">
                {scoreSummary.score}{' '}
                <span className="text-slate-400 text-xl font-normal">
                  / {scoreSummary.total}
                </span>
              </div>
              <div className="text-xs font-bold text-slate-600 mt-1">
                الدرجة المستحقة
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 relative overflow-hidden">
              <div className="text-3xl sm:text-4xl font-black text-amber-500 font-mono">
                {scoreSummary.percentage}٪
              </div>
              <div className="text-xs font-bold text-slate-600 mt-1">
                النسبة المئوية
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 relative overflow-hidden">
              <div
                className={`text-xl sm:text-2xl font-black mt-1 ${
                  scoreSummary.percentage >= 80
                    ? 'text-emerald-700'
                    : scoreSummary.percentage >= 60
                    ? 'text-amber-600'
                    : 'text-rose-600'
                }`}
              >
                {scoreSummary.rating.label}
              </div>
              <div className="text-xs font-bold text-slate-600 mt-2">
                التقدير العام
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 relative overflow-hidden">
              <div className="text-3xl sm:text-4xl font-black text-slate-800 font-mono flex items-center justify-center gap-1">
                <Clock className="w-5 h-5 text-emerald-600" />
                <span dir="ltr">{formatTime(result.timeSeconds)}</span>
              </div>
              <div className="text-xs font-bold text-slate-600 mt-1">
                الزمن المستغرق
              </div>
            </div>
          </div>

          {/* Student Privacy Assurance Banner */}
          <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-full mb-6 shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>درجتكِ وإجاباتكِ خاصة بكِ ومحمية بالكامل، ولا تظهر في أي لوحة عامة للآخرين</span>
          </div>

          {/* Navigation Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {isAdmin && (
              <button
                type="button"
                onClick={onGoToLeaderboard}
                className="px-6 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black font-black text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shadow-md active:scale-95"
              >
                <Trophy className="w-4 h-4 fill-black stroke-black" />
                <span>لوحة الصدارة (عرض المشرفة فقط)</span>
              </button>
            )}

            <button
              type="button"
              onClick={onRetake}
              className="px-6 py-3 bg-[#064e3b] hover:bg-[#043d2e] text-white font-black text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shadow-md active:scale-95"
            >
              <RotateCcw className="w-4 h-4 text-white" />
              <span>إعادة الاختبار</span>
            </button>

            <button
              type="button"
              onClick={onGoHome}
              className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap active:scale-95 shadow-xs"
            >
              <Home className="w-4 h-4" />
              <span>العودة للرئيسية</span>
            </button>
          </div>
        </div>

        {/* Answer Review Section */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-[#064e3b] flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-emerald-600" />
                <span>المراجعة التفصيلية للإجابات</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                راجعي إجاباتك وتعرفي على الحلول الصحيحة مع التفسير العلمي
              </p>
            </div>

            <div className="flex items-center gap-1.5 p-1.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold tabular-nums shadow-xs">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  filter === 'all'
                    ? 'bg-[#f59e0b] text-black font-black shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكل ({questions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('wrong')}
                className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  filter === 'wrong'
                    ? 'bg-rose-100 text-rose-800 font-black border border-rose-300 shadow-xs'
                    : 'text-slate-600 hover:text-rose-700'
                }`}
              >
                الخاطئة ({wrongAnswersCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('correct')}
                className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  filter === 'correct'
                    ? 'bg-emerald-100 text-emerald-800 font-black border border-emerald-300 shadow-xs'
                    : 'text-slate-600 hover:text-emerald-700'
                }`}
              >
                الصحيحة ({correctAnswersCount})
              </button>
            </div>
          </div>

          {filteredQuestions.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-sm shadow-xs">
              لا توجد أسئلة تطابق هذا الفلتر.
            </div>
          ) : (
            <div className="space-y-5">
              {filteredQuestions.map((q) => {
                const studentChoice = result.answers[q.id];
                const isCorrect = studentChoice !== undefined && studentChoice === q.correctIndex;
                const isUnanswered = studentChoice === undefined;

                return (
                  <div
                    key={q.id}
                    className={`bg-white rounded-3xl p-6 sm:p-7 border relative overflow-hidden transition-all shadow-sm ${
                      isCorrect
                        ? 'border-emerald-300 ring-1 ring-emerald-400/20'
                        : isUnanswered
                        ? 'border-amber-300 ring-1 ring-amber-400/20'
                        : 'border-rose-300 ring-1 ring-rose-400/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600 tabular-nums">
                        <span className="font-black text-emerald-900 bg-emerald-100/80 border border-emerald-300 px-2.5 py-1 rounded-lg">
                          السؤال {questions.findIndex((orig) => orig.id === q.id) + 1}
                        </span>
                        {q.category && (
                          <>
                            <span aria-hidden="true" className="text-emerald-400">·</span>
                            <span className="text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded-md">{q.category}</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs font-extrabold">
                        {isCorrect ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>إجابة صحيحة</span>
                          </span>
                        ) : isUnanswered ? (
                          <span className="inline-flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                            <AlertCircle className="w-4 h-4 text-amber-600" />
                            <span>لم تتم الإجابة</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
                            <XCircle className="w-4 h-4 text-rose-600" />
                            <span>إجابة غير صحيحة</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {q.passage && (
                      <div className="mb-4 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-slate-800 text-xs sm:text-sm leading-relaxed">
                        <div className="font-black text-[#064e3b] mb-1.5 flex items-center gap-1.5">
                          <BookOpen className="w-4 h-4 text-emerald-700" />
                          <span>نص القطعة:</span>
                        </div>
                        <p className="whitespace-pre-line text-slate-700 font-medium">
                          {q.passage}
                        </p>
                      </div>
                    )}

                    <h3
                      dir="auto"
                      className="text-base sm:text-lg font-black text-slate-900 mb-5 leading-relaxed"
                    >
                      {q.text}
                    </h3>

                    <div className="grid sm:grid-cols-2 gap-3 mb-4">
                      {q.options.map((opt, optIdx) => {
                        const letter = ARABIC_LETTERS[optIdx] || String.fromCharCode(65 + optIdx);
                        const isCorrectChoice = optIdx === q.correctIndex;
                        const isStudentSelected = studentChoice === optIdx;

                        let style =
                          'bg-slate-50 hover:bg-slate-100/80 border-slate-200 text-slate-800';
                        if (isCorrectChoice) {
                          style =
                            'bg-emerald-50 border-2 border-emerald-500 text-emerald-950 font-bold ring-2 ring-emerald-300/40 shadow-xs';
                        } else if (isStudentSelected && !isCorrectChoice) {
                          style =
                            'bg-rose-50 border-2 border-rose-400 text-rose-950 font-bold ring-2 ring-rose-200 shadow-xs';
                        }

                        return (
                          <div
                            key={optIdx}
                            className={`p-3.5 rounded-xl border flex items-center justify-between text-sm transition-colors ${style}`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                                  isCorrectChoice
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : isStudentSelected
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {letter}
                              </span>
                              <span dir="auto" className="font-semibold">{opt}</span>
                            </div>

                            {isCorrectChoice && (
                              <span className="text-[11px] font-black text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-md whitespace-nowrap">
                                الإجابة الصحيحة ✓
                              </span>
                            )}

                            {isStudentSelected && !isCorrectChoice && (
                              <span className="text-[11px] font-black text-rose-800 bg-rose-100/90 border border-rose-300 px-2 py-0.5 rounded-md whitespace-nowrap">
                                اختيارك ✗
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {q.explanation && (
                      <div className="mt-4 p-4 rounded-2xl bg-amber-50/90 border border-amber-300 text-slate-800 text-xs sm:text-sm leading-relaxed flex items-start gap-2.5 shadow-2xs">
                        <div className="font-black text-amber-900 shrink-0 mt-0.5">
                          الشرح والتفسير:
                        </div>
                        <div className="text-slate-800 font-medium">{q.explanation}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
