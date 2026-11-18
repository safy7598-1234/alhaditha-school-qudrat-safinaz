import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Flag,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Moon,
  Sun
} from 'lucide-react';
import { Question, QuizConfig, QuizData } from '../types/quiz';
import { AUTHOR_CREDIT, PLATFORM_SHORT_NAME } from '../data/curriculum';
import { ARABIC_LETTERS, formatTime } from '../utils/scoring';
import { ExamTheme, getExamThemeToggleLabel } from '../utils/theme';
import { SchoolLogo } from './SchoolLogo';

interface QuizViewProps {
  studentName: string;
  quizData: QuizData;
  config: QuizConfig;
  durationMinutesOverride?: number;
  theme: ExamTheme;
  onToggleTheme: () => void;
  onSubmit: (answers: Record<string, number>, timeSpentSeconds: number) => void;
  onExit: () => void;
}

export const QuizView: React.FC<QuizViewProps> = ({
  studentName,
  quizData,
  config,
  durationMinutesOverride,
  theme,
  onToggleTheme,
  onSubmit,
  onExit
}) => {
  const effectiveDuration = durationMinutesOverride || config.durationMinutes || 15;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [secondsRemaining, setSecondsRemaining] = useState(effectiveDuration * 60);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);

  const isDark = theme === 'dark';
  const themeLabels = getExamThemeToggleLabel(theme);

  const answersRef = useRef(answers);
  answersRef.current = answers;
  const timeSpentRef = useRef(timeSpent);
  timeSpentRef.current = timeSpent;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  const questions = quizData.questions;
  const currentQuestion: Question | undefined = questions[currentIndex];
  const totalQuestions = questions.length;

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSpent((prev) => prev + 1);
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onSubmitRef.current(answersRef.current, timeSpentRef.current + 1);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSubmitModalOpen) return;

      if (e.key === 'ArrowLeft') {
        if (currentIndex < totalQuestions - 1) {
          setCurrentIndex((prev) => prev + 1);
        }
      } else if (e.key === 'ArrowRight') {
        if (currentIndex > 0) {
          setCurrentIndex((prev) => prev - 1);
        }
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        const optionIndex = parseInt(e.key, 10) - 1;
        if (currentQuestion && optionIndex < currentQuestion.options.length) {
          selectAnswer(currentQuestion.id, optionIndex);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, currentQuestion, isSubmitModalOpen, totalQuestions]);

  const selectAnswer = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex
    }));
  };

  const toggleFlag = (questionId: string) => {
    setFlagged((prev) => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
  };

  const handleSubmitExam = () => {
    onSubmit(answers, timeSpent);
  };

  const answeredCount = Object.keys(answers).length;
  const unansweredCount = totalQuestions - answeredCount;
  const flaggedCount = Object.values(flagged).filter(Boolean).length;
  const isLowTime = secondsRemaining < 120;

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#f3f7f4]">
        <div className="max-w-xl w-full p-8 bg-white rounded-3xl text-center border border-emerald-900/10 shadow-lg">
          <p className="text-slate-700 font-bold">لا توجد أسئلة متاحة في هذا الاختبار.</p>
          <button
            type="button"
            onClick={onExit}
            className="mt-4 px-6 py-2.5 bg-[#064e3b] hover:bg-[#043d2e] text-white rounded-xl text-sm font-bold cursor-pointer"
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col font-sans select-none transition-colors duration-200 bg-[#f3f7f4] text-slate-900"
    >
      {/* Top Examination Bar (Saudi Emerald Theme from Video) */}
      <div className="bg-[#064e3b] text-white px-3 sm:px-6 py-3 border-b-2 border-[#f59e0b] shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* Student & School Info */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <SchoolLogo size="xs" className="ring-1 ring-amber-400 shadow-sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-white truncate">
                <span className="font-black text-amber-300">{studentName}</span>
                <span className="hidden md:inline text-emerald-400">·</span>
                <span className="hidden md:inline text-xs text-white font-bold">
                  {PLATFORM_SHORT_NAME}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-emerald-100 truncate max-w-[130px] sm:max-w-xs font-medium">
                {quizData.title}
              </p>
            </div>
          </div>

          {/* Center: Countdown Timer with Gold Accent */}
          <div
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 rounded-xl text-xs sm:text-base font-extrabold border tabular-nums shrink-0 shadow-inner ${
              isLowTime
                ? 'bg-rose-900/80 text-rose-200 border-rose-400 animate-pulse'
                : 'bg-[#032e22] text-[#fbbf24] border-amber-400/50'
            }`}
          >
            <Clock className={`w-4 h-4 shrink-0 ${isLowTime ? 'text-rose-400' : 'text-amber-400'}`} />
            <span className="hidden sm:inline font-sans text-xs sm:text-sm font-bold text-emerald-100">
              الوقت المتبقي:
            </span>
            <span className="font-mono tracking-wider font-black text-amber-300" dir="ltr">
              {formatTime(secondsRemaining)}
            </span>
          </div>

          {/* Left: End Exam Button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsSubmitModalOpen(true)}
              className="px-3.5 sm:px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-black rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 shadow-sm active:scale-95"
            >
              إنهاء الاختبار
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Main Question Panel */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white rounded-3xl border border-emerald-900/10 p-6 sm:p-8 shadow-[0_4px_25px_rgba(6,78,59,0.06)] relative overflow-hidden transition-colors">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 tabular-nums">
                  <span className="font-black text-[#064e3b] text-sm">
                    السؤال {currentIndex + 1} من {totalQuestions}
                  </span>
                  {currentQuestion.category && (
                    <>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">{currentQuestion.category}</span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => toggleFlag(currentQuestion.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    flagged[currentQuestion.id]
                      ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-xs'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <Flag
                    className={`w-3.5 h-3.5 ${
                      flagged[currentQuestion.id]
                        ? 'fill-amber-500 text-amber-500'
                        : 'text-slate-400'
                    }`}
                  />
                  <span>{flagged[currentQuestion.id] ? 'مميز للمراجعة' : 'تمييز للمراجعة'}</span>
                </button>
              </div>

              {currentQuestion.passage && (
                <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-emerald-50/70 border-r-4 border-r-[#064e3b] border border-emerald-200 text-slate-800">
                  <div className="flex items-center gap-2 text-xs font-black text-[#064e3b] mb-2">
                    <BookOpen className="w-4 h-4 text-emerald-700" />
                    <span>نص القطعة للمطالعة واستيعاب المقروء:</span>
                  </div>
                  <p className="text-sm sm:text-base leading-relaxed text-slate-800 font-medium whitespace-pre-line">
                    {currentQuestion.passage}
                  </p>
                </div>
              )}

              <div className="mb-8">
                <h2
                  dir="auto"
                  className="text-xl sm:text-2xl font-black text-slate-900 leading-relaxed"
                >
                  {currentQuestion.text}
                </h2>
              </div>

              <div className="space-y-3.5">
                {currentQuestion.options.map((option, optIdx) => {
                  const isSelected = answers[currentQuestion.id] === optIdx;
                  const letter = ARABIC_LETTERS[optIdx] || String.fromCharCode(65 + optIdx);

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => selectAnswer(currentQuestion.id, optIdx)}
                      className={`w-full p-4 sm:p-5 rounded-2xl border-2 text-right transition-all flex items-center justify-between gap-4 cursor-pointer group shadow-xs ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/90 text-emerald-950 shadow-sm ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/20 text-slate-800'
                      }`}
                    >
                      <span
                        dir="auto"
                        className={`text-base font-bold leading-relaxed ${
                          isSelected
                            ? 'text-emerald-950 font-black'
                            : 'text-slate-800 group-hover:text-emerald-900 transition-colors'
                        }`}
                      >
                        {option}
                      </span>

                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm transition-colors shrink-0 ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 border border-slate-200 group-hover:bg-emerald-100 group-hover:text-emerald-800'
                        }`}
                      >
                        {letter}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Bottom Nav Controls */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-6 mt-8">
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                    currentIndex === 0
                      ? 'text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed'
                      : 'text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 hover:border-emerald-500 cursor-pointer shadow-xs'
                  }`}
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>السؤال السابق</span>
                </button>

                <div className="text-xs font-bold text-slate-500 hidden sm:block">
                  يمكنك استخدام الأرقام ١، ٢، ٣، ٤ للاختيار السريع
                </div>

                {currentIndex < totalQuestions - 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))
                    }
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black bg-[#f59e0b] hover:bg-[#d97706] text-black transition-all cursor-pointer whitespace-nowrap shadow-md active:scale-95"
                  >
                    <span>السؤال التالي</span>
                    <ChevronLeft className="w-4 h-4 text-black stroke-[2.5]" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsSubmitModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black bg-[#f59e0b] hover:bg-[#d97706] text-black transition-all cursor-pointer whitespace-nowrap shadow-md active:scale-95"
                  >
                    <span>مراجعة وإنهاء</span>
                    <CheckCircle2 className="w-4 h-4 text-black stroke-[2.5]" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar: Question Matrix */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-3xl border border-emerald-900/10 p-5 shadow-[0_4px_25px_rgba(6,78,59,0.06)] relative overflow-hidden">
              <h3 className="font-extrabold text-sm text-[#064e3b] mb-3 flex items-center justify-between tabular-nums">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  لوحة الأسئلة
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {answeredCount} من {totalQuestions} مجاب
                </span>
              </h3>

              <div className="grid grid-cols-3 gap-2 mb-4 p-2 bg-emerald-50/80 rounded-2xl border border-emerald-200 text-center tabular-nums">
                <div className="p-2">
                  <div className="text-lg font-black text-emerald-800 font-mono">
                    {answeredCount}
                  </div>
                  <div className="text-[11px] font-bold text-slate-600">
                    تم الحل
                  </div>
                </div>
                <div className="p-2 border-x border-emerald-200">
                  <div className="text-lg font-black text-slate-800 font-mono">
                    {unansweredCount}
                  </div>
                  <div className="text-[11px] font-bold text-slate-600">
                    متبقي
                  </div>
                </div>
                <div className="p-2">
                  <div className="text-lg font-black text-[#d97706] font-mono">
                    {flaggedCount}
                  </div>
                  <div className="text-[11px] font-bold text-slate-600">
                    مراجعة
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2 max-h-[360px] overflow-y-auto p-1 tabular-nums custom-scrollbar">
                {questions.map((q, idx) => {
                  const isAnswered = answers[q.id] !== undefined;
                  const isCurrent = currentIndex === idx;
                  const isFlagged = Boolean(flagged[q.id]);

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className={`relative h-11 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer font-mono ${
                        isCurrent
                          ? 'border-2 border-emerald-600 bg-emerald-100 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-500/20 scale-102 z-10'
                          : isAnswered
                          ? 'bg-emerald-600 text-white font-black shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      <span>{idx + 1}</span>
                      {isFlagged && (
                        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#f59e0b] text-black flex items-center justify-center border-2 border-white shadow-xs">
                          <Flag className="w-2.5 h-2.5 fill-black" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600">
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded-sm bg-emerald-600"></div>
                  <span>مجاب</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded-sm bg-slate-100 border border-slate-300"></div>
                  <span>غير مجاب</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded-sm bg-[#f59e0b]"></div>
                  <span>مميز</span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-emerald-900/10 text-center space-y-2.5 shadow-md relative overflow-hidden">
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(true)}
                className="w-full py-3.5 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-xl text-sm font-black transition-all cursor-pointer shadow-md active:scale-95"
              >
                تسليم الإجابات وإنهاء الاختبار
              </button>
              <p className="text-[11px] font-semibold text-slate-500">
                {AUTHOR_CREDIT} — جميع الحقوق محفوظة
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {isSubmitModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-emerald-950/40 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border-2 border-emerald-600 relative overflow-hidden text-slate-800">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 border border-amber-300 flex items-center justify-center mb-4 shadow-sm">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-black text-slate-900 mb-2">
              هل أنتِ متأكدة من إنهاء الاختبار؟
            </h3>

            {unansweredCount > 0 ? (
              <p className="text-sm text-slate-700 mb-4 leading-relaxed font-medium">
                لديكِ{' '}
                <span className="font-extrabold text-amber-600 font-mono tabular-nums">
                  {unansweredCount}
                </span>{' '}
                سؤالاً لم تقومي بالإجابة عليها بعد. هل ترغبين في التسليم الآن أم العودة للمراجعة؟
              </p>
            ) : (
              <p className="text-sm text-slate-700 mb-4 leading-relaxed font-medium">
                لقد أجبتِ على جميع الأسئلة ({totalQuestions} سؤالاً). بالضغط على تأكيد الإنهاء، سيتم تصحيح الإجابات وإعلان النتيجة فوراً.
              </p>
            )}

            <div className="bg-emerald-50/80 rounded-2xl p-4 mb-6 text-xs font-semibold text-slate-700 space-y-2.5 border border-emerald-200 tabular-nums">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">اسم الطالبة:</span>
                <span className="font-black text-[#064e3b]">{studentName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">الأسئلة المحلولة:</span>
                <span className="font-black text-emerald-800">
                  {answeredCount} من {totalQuestions}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">الأسئلة المميزة للمراجعة:</span>
                <span className="font-black text-amber-700">{flaggedCount}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSubmitExam}
                className="flex-1 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-xl text-sm font-black transition-all cursor-pointer shadow-md active:scale-95"
              >
                تأكيد الإنهاء والتسليم
              </button>
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-sm font-bold border border-slate-300 transition-colors cursor-pointer"
              >
                العودة للاختبار
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
