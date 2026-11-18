import React from 'react';
import { Share2, BookOpen, Trophy, ShieldCheck, Lock, MessageSquareQuote } from 'lucide-react';
import { ViewMode } from '../types/quiz';
import { AUTHOR_CREDIT, PLATFORM_FULL_NAME, PLATFORM_SHORT_NAME } from '../data/curriculum';
import { SchoolLogo } from './SchoolLogo';

interface NavbarProps {
  currentView: ViewMode;
  onNavigate: (view: ViewMode) => void;
  onOpenShare: () => void;
  isAdmin: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  onOpenShare,
  isAdmin
}) => {
  const handleGoHome = () => {
    onNavigate('home');
  };

  return (
    <header className="sticky top-0 z-40 shadow-lg select-none">
      {/* 1. Top Micro Bar (Exact from Video) */}
      <div className="bg-[#032e22] text-emerald-100/90 text-[11px] sm:text-xs py-1.5 px-3 sm:px-6 border-b border-emerald-800/40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-900/80 text-emerald-200 border border-emerald-700/50 px-2 py-0.5 rounded text-[10px] font-bold">
              المملكة العربية السعودية | تعليم البنات
            </span>
          </div>
          <div className="truncate text-left font-semibold text-emerald-200/90">
            <span>بوابة التفوق في القدرات العامة المحوسبة · {AUTHOR_CREDIT}</span>
          </div>
        </div>
      </div>

      {/* 2. Main Forest Green Brand Section */}
      <div className="bg-gradient-to-r from-[#043d2e] via-[#064e3b] to-[#044333] text-white px-3 sm:px-6 py-4 border-b border-emerald-900/60 relative overflow-hidden">
        {/* Subtle geometric pattern / glow */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fbbf24_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 relative z-10">
          {/* Right Brand info */}
          <button
            type="button"
            onClick={handleGoHome}
            className="flex items-center gap-3.5 cursor-pointer text-right group"
          >
            <SchoolLogo size="md" className="shrink-0 shadow-md ring-2 ring-amber-400" />
            <div>
              <div className="text-[11px] sm:text-xs font-bold text-amber-300 flex items-center gap-1.5 mb-0.5">
                <span>المملكة العربية السعودية · تعليم البنات</span>
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight group-hover:text-amber-200 transition-colors">
                {PLATFORM_FULL_NAME}
              </h1>
              <p className="text-xs sm:text-sm font-bold text-amber-300/95 mt-0.5">
                منظومة التدريب والاختبار المحوسب المعتمدة · {AUTHOR_CREDIT}
              </p>
            </div>
          </button>

          {/* Left: Supervisor quick action */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="bg-[#032e22]/80 border border-emerald-600/30 rounded-2xl p-2.5 max-w-xs text-right">
              <p className="text-[11px] text-emerald-100 font-medium leading-relaxed">
                منظومة المحاكاة والتدريب الشامل لاختبار القدرات المحوسب تضمن دقة التوقيت والتصحيح الفوري وشرح الحلول.
              </p>
            </div>
          </div>
        </div>

        {/* 3. Navigation Tabs Bar (Directly from Video) */}
        <div className="max-w-7xl mx-auto mt-4 pt-3 border-t border-emerald-600/30 flex flex-wrap items-center justify-between gap-2.5">
          <nav aria-label="التنقل الرئيسي" className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm font-bold">
            <button
              type="button"
              onClick={handleGoHome}
              className={`px-4 sm:px-5 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 font-black ${
                currentView === 'home'
                  ? 'bg-[#f59e0b] hover:bg-[#d97706] text-black shadow-md'
                  : 'bg-[#033628] hover:bg-[#075942] text-white border border-emerald-700/40'
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>الرئيسية والأقسام</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => onNavigate('leaderboard')}
                className={`px-4 sm:px-5 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 font-black ${
                  currentView === 'leaderboard'
                    ? 'bg-[#f59e0b] hover:bg-[#d97706] text-black shadow-md'
                    : 'bg-[#033628] hover:bg-[#075942] text-white border border-emerald-700/40'
                }`}
              >
                <Trophy className="w-4 h-4 shrink-0 text-amber-400" />
                <span>لوحة الصدارة (المشرفة)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onNavigate('questions-feedback')}
              className={`px-4 sm:px-5 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 font-black ${
                currentView === 'questions-feedback'
                  ? 'bg-[#f59e0b] hover:bg-[#d97706] text-black shadow-md'
                  : 'bg-[#033628] hover:bg-[#075942] text-white border border-emerald-700/40'
              }`}
            >
              <MessageSquareQuote className="w-4 h-4 shrink-0" />
              <span>الأسئلة والتقييم</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('admin')}
              className={`px-4 sm:px-5 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 font-black ${
                currentView === 'admin'
                  ? 'bg-[#f59e0b] hover:bg-[#d97706] text-black shadow-md'
                  : 'bg-[#033628] hover:bg-[#075942] text-white border border-emerald-700/40'
              }`}
            >
              {isAdmin ? (
                <ShieldCheck className="w-4 h-4 shrink-0" />
              ) : (
                <Lock className="w-4 h-4 shrink-0" />
              )}
              <span>{isAdmin ? 'لوحة المشرفين الأكاديمية' : 'دخول المشرفين'}</span>
            </button>
          </nav>

          {/* Share Button (Vibrant Gold) */}
          <button
            type="button"
            onClick={onOpenShare}
            aria-label="مشاركة الرابط المباشر للمنصة"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black bg-[#f59e0b] hover:bg-[#d97706] text-black transition-all cursor-pointer whitespace-nowrap shadow-md active:scale-95"
          >
            <Share2 className="w-4 h-4 shrink-0 text-black stroke-[2.5]" />
            <span>مشاركة الرابط</span>
          </button>
        </div>
      </div>
    </header>
  );
};
