import React, { useState } from 'react';
import {
  Play,
  Clock,
  ListChecks,
  Award,
  CheckCircle2,
  Share2,
  BookOpen,
  Sparkles,
  Layers,
  ChevronLeft
} from 'lucide-react';
import {
  QuizConfig,
  QuizData,
  QuizSection
} from '../types/quiz';
import {
  AUTHOR_CREDIT,
  COPYRIGHT_TEXT,
  PLATFORM_FULL_NAME
} from '../data/curriculum';
import { ExamTheme } from '../utils/theme';
import { SchoolLogo } from './SchoolLogo';

interface HomeViewProps {
  examTheme: ExamTheme;
  onToggleExamTheme: () => void;
  quizData: QuizData;
  config: QuizConfig;
  sections?: QuizSection[];
  activeSectionId?: string;
  onSelectSection?: (sectionId: string) => void;
  onStartExam: (studentName: string) => void;
  onOpenShare?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  quizData,
  config,
  sections = [],
  activeSectionId = 'sec_1',
  onSelectSection,
  onStartExam,
  onOpenShare
}) => {
  const [studentName, setStudentName] = useState('');
  const [error, setError] = useState('');

  const currentSection =
    sections.find((s) => s.id === activeSectionId) ||
    sections[0] || {
      id: 'sec_1',
      sectionNumber: 1,
      title: 'القسم الأول (1)',
      questions: quizData.questions
    };

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = studentName.trim();
    if (!trimmed) {
      setError('يرجى كتابة اسم الطالبة الثلاثي للمتابعة');
      return;
    }
    if (trimmed.length < 3) {
      setError('يرجى كتابة اسم ثلاثي واضح (٣ أحرف على الأقل)');
      return;
    }
    setError('');
    onStartExam(trimmed);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* 1. Official Welcome & Overview Card (Matches Video Aesthetic) */}
      <section className="bg-white rounded-3xl border border-emerald-900/10 p-6 sm:p-8 shadow-[0_4px_20px_rgba(6,78,59,0.06)] relative overflow-hidden">
        <div className="flex flex-col-reverse lg:flex-row items-center justify-between gap-6 sm:gap-8">
          {/* Quick CTA Actions */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 shrink-0">
            {onOpenShare && (
              <button
                type="button"
                onClick={onOpenShare}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] text-black text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap shadow-md active:scale-95"
              >
                <Share2 className="w-4 h-4 text-black stroke-[2.5] shrink-0" />
                <span>مشاركة الرابط</span>
              </button>
            )}

            <a
              href="#start-section"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#064e3b] hover:bg-[#043d2e] text-white text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap shadow-md active:scale-95"
            >
              <Play className="w-4 h-4 fill-white shrink-0" />
              <span>بدء الاختبار فوراً</span>
            </a>
          </div>

          {/* Right Brand & Supervisor Details */}
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-right">
            <SchoolLogo size="lg" className="shrink-0 ring-4 ring-emerald-50 shadow-md" />
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs font-bold">
                <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full shadow-xs">
                  {AUTHOR_CREDIT}
                </span>
                <span aria-hidden="true" className="text-emerald-400">·</span>
                <span className="text-emerald-800 font-semibold flex items-center gap-1.5 bg-emerald-100/70 px-3 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                  منصة التدريب المحوسب 24/7
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#064e3b] leading-tight">
                {PLATFORM_FULL_NAME}
              </h1>

              <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-2xl leading-relaxed">
                منظومة المحاكاة والتدريب الشامل لاختبار القدرات العامة المحوسب (القسم اللفظي والكمي) بمختلف النماذج والأقسام، مع نظام توقيت محوسب دقيق وتصحيح فوري وشرح تفصيلي للحلول.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Interactive Sections Selector (10 Interactive Sections) */}
      <section className="bg-white rounded-3xl border border-emerald-900/10 shadow-[0_4px_25px_rgba(6,78,59,0.06)] overflow-hidden">
        {/* Deep Emerald Header Band (Exact from Video Style) */}
        <div className="bg-[#064e3b] text-white p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-right">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300 mb-1">
              <Layers className="w-4 h-4 text-amber-300" />
              <span>أقسام ونماذج اختبار القدرات المحوسب</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums font-semibold text-emerald-100">متاح {sections.length} أقسام تفاعلية</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              اختاري القسم أو النموذج للبدء في الاختبار
            </h2>
          </div>
          <div className="text-xs font-bold bg-[#032e22] text-amber-300 px-3.5 py-1.5 rounded-xl border border-emerald-700/50 shadow-xs">
            القسم المحدد حالياً: {currentSection.title} ({currentSection.questions.length} سؤالاً)
          </div>
        </div>

        {/* 10 Sections Grid */}
        <div className="p-6 sm:p-7 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5 bg-slate-50/50">
          {sections.map((sec) => {
            const isSelected = activeSectionId === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => onSelectSection && onSelectSection(sec.id)}
                className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between cursor-pointer group ${
                  isSelected
                    ? 'border-2 border-emerald-600 bg-emerald-50/80 shadow-[0_4px_15px_rgba(5,150,105,0.2)] ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/30 text-slate-700 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                        isSelected
                          ? 'bg-[#f59e0b] text-black shadow-xs'
                          : 'text-slate-600 bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {isSelected ? 'مختار' : 'اختيار'}
                    </span>
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center font-mono tabular-nums ${
                        isSelected
                          ? 'bg-[#064e3b] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 border border-slate-200 group-hover:bg-emerald-100 group-hover:text-emerald-800'
                      }`}
                    >
                      {sec.sectionNumber}
                    </span>
                  </div>

                  <h3 className={`font-black text-sm sm:text-base mb-1 leading-snug transition-colors ${
                    isSelected ? 'text-[#064e3b]' : 'text-slate-800 group-hover:text-[#064e3b]'
                  }`}>
                    {sec.title}
                  </h3>
                  <p className={`text-xs font-semibold tabular-nums ${
                    isSelected ? 'text-emerald-700' : 'text-slate-500'
                  }`}>
                    {sec.questions.length} سؤالاً تدريبياً
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Main Start Form & Information Split */}
      <div id="start-section" className="grid lg:grid-cols-12 gap-8 items-start">
        {/* Right Form Card (Start Section) */}
        <div className="lg:col-span-5 order-1 lg:order-2">
          <div className="bg-white rounded-3xl border border-emerald-900/10 shadow-[0_4px_25px_rgba(6,78,59,0.08)] overflow-hidden">
            {/* Form Header Band */}
            <div className="bg-[#064e3b] text-white p-5 sm:p-6 flex items-center justify-between">
              <div>
                <span className="inline-block bg-[#032e22] text-amber-300 border border-emerald-700/50 text-[11px] font-black px-2.5 py-0.5 rounded-full mb-1.5 shadow-xs">
                  جاهز للاختبار الفوري
                </span>
                <h3 className="text-xl font-black text-white">
                  ابدئي اختبار {currentSection.title}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#f59e0b] text-black font-black text-lg flex items-center justify-center font-mono shadow-sm shrink-0">
                {currentSection.sectionNumber}
              </div>
            </div>

            <form onSubmit={handleStart} className="p-6 sm:p-7 space-y-5">
              <div>
                <label htmlFor="studentName" className="block text-sm font-bold text-slate-800 mb-2">
                  اسم الطالبة الثلاثي <span className="text-rose-500">*</span>
                </label>
                <input
                  id="studentName"
                  type="text"
                  value={studentName}
                  onChange={(e) => {
                    setStudentName(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="اكتبي اسمكِ الثلاثي..."
                  className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-emerald-600 focus:bg-white rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none text-base font-bold transition-all shadow-xs"
                  dir="rtl"
                />
                {error && (
                  <p className="text-rose-600 text-xs font-bold mt-2">
                    {error}
                  </p>
                )}
              </div>

              <div className="bg-emerald-50/80 rounded-2xl p-4 border border-emerald-200 space-y-2.5 text-xs font-bold text-slate-700 tabular-nums">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">القسم المختار:</span>
                  <span className="font-extrabold text-[#064e3b]">{currentSection.title}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">عدد الأسئلة:</span>
                  <span className="font-black text-slate-900 font-mono">
                    {currentSection.questions.length} سؤالاً
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">الزمن المتاح:</span>
                  <span className="font-black text-slate-900">{config.durationMinutes} دقيقة</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">نسبة الاجتياز:</span>
                  <span className="font-black text-emerald-700">{config.passPercentage}٪</span>
                </div>
              </div>

              <ul className="space-y-2 text-xs font-bold text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>سؤال واحد في كل شاشة مع خيارات أ، ب، ج، د</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>إمكانية تمييز الأسئلة للمراجعة قبل التسليم النهائي</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>ظهور النتيجة فوراً مع تسجيل الدرجة في لوحة الشرف</span>
                </li>
              </ul>

              <button
                type="submit"
                className="w-full py-4 bg-[#f59e0b] hover:bg-[#d97706] text-black font-black text-base rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shadow-md active:scale-98"
              >
                <span>بدء اختبار {currentSection.title} الآن</span>
                <Play className="w-4 h-4 fill-black text-black shrink-0" />
              </button>

              <p className="text-center text-[11px] text-slate-500 font-semibold">
                {COPYRIGHT_TEXT}
              </p>
            </form>
          </div>
        </div>

        {/* Left Info & Guidance side */}
        <div className="lg:col-span-7 space-y-6 order-2 lg:order-1">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
            <span className="bg-emerald-100 px-2.5 py-0.5 rounded-full">محاكاة نظام قياس المحوسب</span>
            <span aria-hidden="true">·</span>
            <span>{AUTHOR_CREDIT}</span>
          </div>

          <h2
            className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight"
            style={{ textWrap: 'balance' }}
          >
            استعدي للدرجة الكاملة مع نموذج{' '}
            <span className="text-[#064e3b]">
              {currentSection.title}
            </span>
          </h2>

          <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-medium">
            اختبار تفاعلي يحاكي اختبارات القدرات العامة الرسمية بواقع{' '}
            <span className="font-extrabold text-[#064e3b] tabular-nums">
              {currentSection.questions.length} سؤالاً
            </span>{' '}
            تشمل مهارات التناظر اللفظي، إكمال الجمل، الخطأ السياقي، استيعاب المقروء، والمفاهيم الكمية، مع توقيت زمني دقيق وإمكانية تمييز الأسئلة للمراجعة قبل تسليم الاختبار.
          </p>

          <div className="grid sm:grid-cols-3 gap-4 pt-1">
            <div className="p-4 rounded-2xl bg-white border border-emerald-900/10 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-3">
                <ListChecks className="w-5 h-5" />
              </div>
              <h3 className="font-black text-slate-900 text-sm mb-1">واجهة محوسبة دقيقة</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                سؤال واحد بكل شاشة، وعرض قطع استيعاب المقروء بوضوح وتنسيق مريح.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-emerald-900/10 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-3">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="font-black text-slate-900 text-sm mb-1">مؤقت زمني دقيق</h3>
              <p className="text-xs text-slate-500 leading-relaxed tabular-nums font-medium">
                {config.durationMinutes} دقيقة لإنهاء القسم مع تنبيه ذكي عند اقتراب انتهاء الوقت.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-emerald-900/10 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-3">
                <Award className="w-5 h-5" />
              </div>
              <h3 className="font-black text-slate-900 text-sm mb-1">تصحيح وشرح فوري</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                رصد آلي فوري للدرجة مع إمكانية مراجعة الشرح التفصيلي لكل سؤال.
              </p>
            </div>
          </div>

          {/* Educational tips in deep emerald container */}
          <div className="bg-gradient-to-br from-[#043d2e] via-[#064e3b] to-[#044333] text-white rounded-3xl p-6 sm:p-7 shadow-md space-y-3 relative overflow-hidden">
            <div className="flex items-center gap-2 text-amber-300 font-black text-sm">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>إرشادات ذهبية للتفوق في القدرات العامة</span>
            </div>
            <ul className="space-y-2.5 text-xs sm:text-sm text-emerald-100 list-disc list-inside font-medium leading-relaxed">
              <li>
                <strong className="text-amber-300 font-bold">إدارة الوقت:</strong> خصصي دقيقة واحدة لكل سؤال كحد أقصى، ولا تترددي في تمييز السؤال الصعب بالزر الأصفر للرجوع إليه لاحقاً.
              </li>
              <li>
                <strong className="text-amber-300 font-bold">التناظر اللفظي:</strong> ركزي على تكوين جملة تربط بين الكلمتين في رأس السؤال ثم طبقيها بحذر على الخيارات الأربعة.
              </li>
              <li>
                <strong className="text-amber-300 font-bold">استيعاب المقروء:</strong> اقرئي الأسئلة أولاً لمعرفة المطلوب من النص بدقة قبل قراءة القطعة.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
