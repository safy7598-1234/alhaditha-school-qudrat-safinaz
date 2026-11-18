/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  QuizConfig,
  QuizData,
  QuizSection,
  StudentResult,
  ViewMode
} from './types/quiz';
import {
  COPYRIGHT_TEXT,
  PLATFORM_FULL_NAME
} from './data/curriculum';
import { StorageService } from './services/storage';
import { calculateScore } from './utils/scoring';
import { fetchServerPublicOrigin } from './utils/shareUrl';
import {
  EXAM_THEME_STORAGE_KEY,
  ExamTheme,
  resolveInitialExamTheme,
  toggleExamTheme
} from './utils/theme';
import { Navbar } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { QuizView } from './components/QuizView';
import { ResultView } from './components/ResultView';
import { LeaderboardView } from './components/LeaderboardView';
import { QuestionsFeedbackView } from './components/QuestionsFeedbackView';
import { AdminView } from './components/AdminView';
import { ShareModal } from './components/ShareModal';
import { SchoolLogo } from './components/SchoolLogo';

interface ActiveExamSession {
  track: 'qudurat';
  quiz: QuizData;
  durationMinutes: number;
  subjectTitle?: string;
}

export default function App() {
  const [currentView, setCurrentView] = useState<ViewMode>('home');
  const [sections, setSections] = useState<QuizSection[]>(() => StorageService.getSections());
  const [activeSectionId, setActiveSectionId] = useState<string>(() =>
    StorageService.getCurrentSectionId()
  );

  const [examTheme, setExamTheme] = useState<ExamTheme>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return resolveInitialExamTheme({
        queryTheme: params.get('theme'),
        storedTheme: window.localStorage.getItem(EXAM_THEME_STORAGE_KEY)
      });
    } catch {
      return 'light';
    }
  });

  const [studentName, setStudentName] = useState('');
  const [quizData, setQuizData] = useState<QuizData>(() => StorageService.getQuiz());
  const [activeExamSession, setActiveExamSession] = useState<ActiveExamSession | null>(null);
  const [config, setConfig] = useState<QuizConfig>(() => StorageService.getConfig());
  const [results, setResults] = useState<StudentResult[]>(() => StorageService.getResults());
  const [isAdmin, setIsAdmin] = useState<boolean>(() => StorageService.isAdminAuthenticated());
  const [lastResult, setLastResult] = useState<StudentResult | null>(null);

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [serverPublicOrigin, setServerPublicOrigin] = useState<string>('');
  const [isOriginStarting, setIsOriginStarting] = useState<boolean>(false);

  const handleToggleExamTheme = useCallback(() => {
    setExamTheme((prev) => {
      const next = toggleExamTheme(prev);
      try {
        window.localStorage.setItem(EXAM_THEME_STORAGE_KEY, next);
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
  }, []);

  const refreshPublicOrigin = useCallback(async () => {
    const info = await fetchServerPublicOrigin(window.location.origin);
    if (info.origin) {
      setServerPublicOrigin(info.origin);
      setIsOriginStarting(false);
    } else if (info.starting) {
      setIsOriginStarting(true);
    } else {
      setIsOriginStarting(false);
    }
    return info;
  }, []);

  // Sync URL deep-links (?section=sec_2, ?view=leaderboard, ?view=admin, ?autostart=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    const sectionParam = params.get('section');
    const path = window.location.pathname;

    const availableSections = StorageService.getSections();
    setSections(availableSections);

    let initialQuiz = StorageService.getQuiz();
    const requestedSection =
      sectionParam && availableSections.some((s) => s.id === sectionParam) ? sectionParam : null;

    if (requestedSection) {
      setActiveSectionId(requestedSection);
      initialQuiz = StorageService.loadSection(requestedSection, false);
      setQuizData(initialQuiz);
    } else {
      const savedSectionId = StorageService.getCurrentSectionId();
      if (savedSectionId && availableSections.some((s) => s.id === savedSectionId)) {
        initialQuiz = StorageService.loadSection(savedSectionId, false);
        setQuizData(initialQuiz);
      }
    }

    if (viewParam === 'admin' || path === '/admin') {
      setCurrentView('admin');
    } else if (viewParam === 'results' || path === '/results' || viewParam === 'leaderboard') {
      setCurrentView('leaderboard');
    } else if (
      viewParam === 'questions-feedback' ||
      viewParam === 'questions' ||
      viewParam === 'feedback' ||
      path === '/questions'
    ) {
      setCurrentView('questions-feedback');
    } else if (params.get('autostart') === '1') {
      setStudentName('طالبة تجريبية');
      setActiveExamSession({
        track: 'qudurat',
        quiz: initialQuiz,
        durationMinutes: config.durationMinutes || 13,
        subjectTitle: initialQuiz.title
      });
      setCurrentView('quiz');
    }

    StorageService.syncSectionsFromServer().then((remoteSections) => {
      if (remoteSections && remoteSections.length > 0) setSections(remoteSections);
    });

    StorageService.syncConfigFromServer().then((remoteCfg) => {
      if (remoteCfg) setConfig(remoteCfg);
    });

    StorageService.syncResultsFromServer().then((remoteResults) => {
      if (remoteResults) setResults(remoteResults);
    });

    StorageService.syncQuizFromServer().then((remoteQuiz) => {
      if (remoteQuiz) setQuizData(remoteQuiz);
    });

    refreshPublicOrigin();

    const handleOnline = () => {
      StorageService.flushPendingResults().then(() => {
        StorageService.syncResultsFromServer().then((res) => {
          if (res) setResults(res);
        });
      });
      refreshPublicOrigin();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [refreshPublicOrigin, config.durationMinutes]);

  // Poll briefly while server public gateway initializes
  useEffect(() => {
    if (!isOriginStarting) return;
    const timer = setInterval(() => {
      refreshPublicOrigin();
    }, 1500);
    return () => clearInterval(timer);
  }, [isOriginStarting, refreshPublicOrigin]);

  // Live polling for student submissions when admin or leaderboard is active
  useEffect(() => {
    if (currentView === 'admin' || currentView === 'leaderboard') {
      StorageService.syncResultsFromServer().then((updated) => {
        if (updated) setResults(updated);
      });

      const interval = setInterval(() => {
        StorageService.syncResultsFromServer().then((updated) => {
          if (updated) setResults(updated);
        });
      }, 7000);
      return () => clearInterval(interval);
    }
  }, [currentView]);

  const handleRefreshResults = async () => {
    const updated = await StorageService.syncResultsFromServer();
    setResults(updated);
  };

  const handleStartExam = (name: string) => {
    setStudentName(name);

    const currentSec =
      sections.find((s) => s.id === activeSectionId) ||
      sections[0];
    const examQuestions = currentSec?.questions?.length ? currentSec.questions : quizData.questions;

    setActiveExamSession({
      track: 'qudurat',
      quiz: {
        title: currentSec?.title || quizData.title,
        sourceFilename: currentSec?.sourceFilename || quizData.sourceFilename,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        questions: examQuestions
      },
      durationMinutes: config.durationMinutes || 13,
      subjectTitle: currentSec?.title || quizData.title
    });

    setCurrentView('quiz');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    const updated = StorageService.loadSection(sectionId, false);
    setQuizData(updated);
  };

  const handleAddSection = (title: string) => {
    const newSecId = `sec_${Date.now()}`;
    const updatedSections = StorageService.saveSectionQuestions(newSecId, [], 'custom_section.pdf', title);
    setSections(updatedSections);
    handleSelectSection(newSecId);
  };

  const handleFinishExam = (answers: Record<string, number>, timeSpentSeconds: number) => {
    const sessionQuiz = activeExamSession?.quiz || quizData;
    const summary = calculateScore(sessionQuiz.questions, answers, config.passPercentage);

    const newResult: StudentResult = {
      id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      studentName: studentName.trim() || 'طالبة اختبار',
      track: 'qudurat',
      sectionTitle: activeExamSession?.subjectTitle || quizData.title,
      score: summary.score,
      total: summary.total,
      percentage: summary.percentage,
      timeSeconds: timeSpentSeconds,
      submittedAt: new Date().toISOString(),
      answers
    };

    setLastResult(newResult);
    StorageService.saveResult(newResult);
    setResults(StorageService.getResults());
    setCurrentView('result');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReloadPreset = (preset: 'default' | 'ref13') => {
    if (preset === 'default') {
      const updated = StorageService.resetToDefaultQuiz();
      setActiveSectionId('sec_1');
      setQuizData(updated);
      setSections(StorageService.getSections());
    } else {
      const updated = StorageService.loadReference13MathQuiz();
      setQuizData(updated);
    }
  };

  const handleUpdateQuiz = (newQuiz: QuizData) => {
    StorageService.saveQuiz(newQuiz);
    setQuizData(newQuiz);
    setSections(StorageService.getSections());
  };

  const handleUpdateConfig = (newCfg: Partial<QuizConfig>) => {
    StorageService.saveConfig(newCfg);
    setConfig(StorageService.getConfig());
  };

  const handleDeleteResult = (id: string) => {
    StorageService.deleteResult(id);
    setResults(StorageService.getResults());
  };

  const handleClearResults = () => {
    StorageService.clearAllResults();
    setResults([]);
  };

  const activeQuizForSession = activeExamSession?.quiz || quizData;
  const isExamSurfaceDark =
    examTheme === 'dark' && (currentView === 'quiz' || currentView === 'result');

  return (
    <div
      className="min-h-screen flex flex-col font-sans transition-colors bg-[#f3f7f4] text-slate-900 selection:bg-emerald-600 selection:text-white"
      dir="rtl"
    >
      {currentView !== 'quiz' && (
        <Navbar
          currentView={currentView}
          onNavigate={(view) => {
            setCurrentView(view);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onOpenShare={() => setIsShareModalOpen(true)}
          isAdmin={isAdmin}
        />
      )}

      <main className="flex-1">
        {currentView === 'home' && (
          <HomeView
            examTheme={examTheme}
            onToggleExamTheme={handleToggleExamTheme}
            quizData={quizData}
            config={config}
            sections={sections}
            activeSectionId={activeSectionId}
            onSelectSection={handleSelectSection}
            onStartExam={handleStartExam}
            onOpenShare={() => setIsShareModalOpen(true)}
          />
        )}

        {currentView === 'quiz' && (
          <QuizView
            studentName={studentName || 'طالبة اختبار'}
            quizData={activeQuizForSession}
            config={config}
            durationMinutesOverride={activeExamSession?.durationMinutes}
            theme={examTheme}
            onToggleTheme={handleToggleExamTheme}
            onSubmit={handleFinishExam}
            onExit={() => setCurrentView('home')}
          />
        )}

        {currentView === 'result' && lastResult && (
          <ResultView
            result={lastResult}
            questions={activeQuizForSession.questions}
            theme={examTheme}
            onToggleTheme={handleToggleExamTheme}
            onRetake={() => setCurrentView('quiz')}
            onGoHome={() => setCurrentView('home')}
            onGoToLeaderboard={() => setCurrentView('leaderboard')}
            isAdmin={isAdmin}
          />
        )}

        {currentView === 'leaderboard' && (
          <LeaderboardView
            results={results}
            onStartExam={() => setCurrentView('home')}
            onGoHome={() => setCurrentView('home')}
            isAdmin={isAdmin}
            onAdminUnlock={() => setIsAdmin(true)}
            onClearResults={handleClearResults}
            onRefreshResults={handleRefreshResults}
          />
        )}

        {currentView === 'questions-feedback' && (
          <QuestionsFeedbackView
            isAdmin={isAdmin}
            onGoHome={() => setCurrentView('home')}
            onStartExam={() => setCurrentView('home')}
            onAdminUnlock={() => setIsAdmin(true)}
          />
        )}

        {currentView === 'admin' && (
          <AdminView
            quizData={quizData}
            config={config}
            results={results}
            sections={sections}
            activeSectionId={activeSectionId}
            onSelectSection={handleSelectSection}
            onAddSection={handleAddSection}
            isAuthenticated={isAdmin}
            onLogin={() => setIsAdmin(true)}
            onLogout={() => setIsAdmin(false)}
            onUpdateQuiz={handleUpdateQuiz}
            onUpdateConfig={handleUpdateConfig}
            onDeleteResult={handleDeleteResult}
            onClearResults={handleClearResults}
            onGoHome={() => setCurrentView('home')}
            onReloadPreset={handleReloadPreset}
            onRefreshResults={handleRefreshResults}
            onOpenShare={() => setIsShareModalOpen(true)}
            serverPublicOrigin={serverPublicOrigin}
          />
        )}
      </main>

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        sections={sections}
        activeSectionId={activeSectionId}
        customPublicUrl={config.customPublicUrl}
        serverPublicOrigin={serverPublicOrigin}
        isOriginStarting={isOriginStarting}
        onRefreshOrigin={async () => {
          await refreshPublicOrigin();
        }}
        onSaveCustomUrl={(url) => handleUpdateConfig({ customPublicUrl: url })}
        isAdmin={isAdmin}
      />

      {currentView !== 'quiz' && (
        <footer className="bg-[#032e22] border-t-2 border-[#f59e0b] py-6 mt-12 text-emerald-100 text-xs transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-right">
              <SchoolLogo size="xs" className="ring-1 ring-amber-400 shadow-sm" />
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="font-extrabold text-white">
                  {PLATFORM_FULL_NAME}
                </span>
                <span className="hidden sm:inline text-emerald-400/60" aria-hidden="true">
                  ·
                </span>
                <span className="font-bold text-amber-300">
                  {COPYRIGHT_TEXT}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-bold shrink-0 text-emerald-100">
              <button
                type="button"
                onClick={() => setIsShareModalOpen(true)}
                className="hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap"
              >
                مشاركة الرابط
              </button>
              <button
                type="button"
                onClick={() => setCurrentView('home')}
                className="hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap"
              >
                الرئيسية
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setCurrentView('leaderboard')}
                  className="hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap text-amber-300 font-bold"
                >
                  لوحة الصدارة (المشرفة)
                </button>
              )}
              <button
                type="button"
                onClick={() => setCurrentView('questions-feedback')}
                className="hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap"
              >
                الأسئلة والتقييم
              </button>
              <button
                type="button"
                onClick={() => setCurrentView('admin')}
                className="hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap"
              >
                {isAdmin ? 'لوحة المشرفين' : 'دخول المشرفين'}
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
