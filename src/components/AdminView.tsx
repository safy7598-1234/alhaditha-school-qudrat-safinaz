import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShieldCheck,
  Upload,
  FileText,
  Trash2,
  Plus,
  CheckCircle2,
  AlertCircle,
  Save,
  LogOut,
  Settings,
  ListChecks,
  Trophy,
  Copy,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  Download,
  RefreshCw,
  Users,
  Send,
  Layers,
  Clock,
  ExternalLink,
  Edit2,
  Star,
  MessageSquare,
  HelpCircle,
  Maximize2,
  CornerDownLeft,
  X,
  Database,
  HardDrive
} from 'lucide-react';
import {
  Question,
  QuizConfig,
  QuizData,
  QuizSection,
  StudentResult,
  StudentQuestionItem,
  PlatformFeedbackItem
} from '../types/quiz';
import {
  AUTHOR_CREDIT,
  COPYRIGHT_TEXT,
  PLATFORM_FULL_NAME
} from '../data/curriculum';
import { StorageService } from '../services/storage';
import { calculateAverageRating } from '../utils/questionsFeedback';
import {
  LockoutEvaluation,
  evaluateLockoutState,
  formatArabicRemainingAttempts,
  formatLockoutCountdown,
  resetLockoutRecord
} from '../utils/adminLockout';
import { parseQuestionsFromText } from '../utils/quizParser';
import { extractTextFromPdf, extractTextFromFile } from '../utils/pdfExtractor';
import { ARABIC_LETTERS, formatTime } from '../utils/scoring';
import {
  selectBestPublicOrigin,
  buildShareLink,
  copyToClipboard
} from '../utils/shareUrl';
import { SchoolLogo } from './SchoolLogo';

interface AdminViewProps {
  quizData: QuizData;
  config: QuizConfig;
  results: StudentResult[];
  sections?: QuizSection[];
  activeSectionId?: string;
  onSelectSection?: (sectionId: string) => void;
  onAddSection?: (title: string) => void;
  isAuthenticated: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onUpdateQuiz: (quiz: QuizData) => void;
  onUpdateConfig: (config: Partial<QuizConfig>) => void;
  onDeleteResult: (id: string) => void;
  onClearResults: () => void;
  onGoHome: () => void;
  onReloadPreset: (preset: 'default' | 'ref13') => void;
  onRefreshResults?: () => void;
  onOpenShare?: () => void;
  serverPublicOrigin?: string;
}

export const AdminView: React.FC<AdminViewProps> = ({
  quizData,
  config,
  results,
  sections = [],
  activeSectionId = 'sec_1',
  onSelectSection,
  onAddSection,
  isAuthenticated,
  onLogin,
  onLogout,
  onUpdateQuiz,
  onUpdateConfig,
  onDeleteResult,
  onClearResults,
  onGoHome,
  onReloadPreset,
  onRefreshResults,
  onOpenShare,
  serverPublicOrigin
}) => {
  // Login & 4-Attempt 1-Hour Lockout states
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [lockoutStatus, setLockoutStatus] = useState<LockoutEvaluation>(() =>
    StorageService.getLocalLockoutState()
  );
  const [currentAdminPin, setCurrentAdminPin] = useState(() => StorageService.getAdminPin());

  // Active Admin Tab
  const [activeTab, setActiveTab] = useState<
    'upload' | 'questions' | 'results' | 'settings' | 'feedback_questions' | 'backup_shield'
  >('upload');

  // Backup & Permanent Data Protection Shield State
  const backupFileInputRef = useRef<HTMLInputElement>(null);
  const [backupRestoreMode, setBackupRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [backupSuccessMsg, setBackupSuccessMsg] = useState('');
  const [backupErrorMsg, setBackupErrorMsg] = useState('');
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [protectionStatus, setProtectionStatus] = useState<{ protected: boolean; counts?: any }>({
    protected: true
  });

  // Feedback & Student Questions Management State
  const [adminStudentQuestions, setAdminStudentQuestions] = useState<StudentQuestionItem[]>([]);
  const [adminFeedbacks, setAdminFeedbacks] = useState<PlatformFeedbackItem[]>([]);
  const [adminSubTab, setAdminSubTab] = useState<'feedback' | 'questions'>('feedback');
  const [adminFeedbackSearch, setAdminFeedbackSearch] = useState('');
  const [adminQuestionSearch, setAdminQuestionSearch] = useState('');
  const [adminReplyText, setAdminReplyText] = useState<Record<string, string>>({});
  const [adminLightboxImage, setAdminLightboxImage] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      StorageService.fetchProtectionStatus().then((st) => setProtectionStatus(st));
    }
  }, [isAuthenticated, activeTab]);

  const refreshAdminFeedbackAndQuestions = () => {
    if (!isAuthenticated) return;
    StorageService.getStudentQuestions().then((list) => {
      if (Array.isArray(list)) setAdminStudentQuestions(list);
    });
    StorageService.getFeedback().then((list) => {
      if (Array.isArray(list)) setAdminFeedbacks(list);
    });
  };

  useEffect(() => {
    refreshAdminFeedbackAndQuestions();
  }, [isAuthenticated, activeTab, adminSubTab]);

  const handleDeleteAdminQuestion = async (id: string) => {
    if (!window.confirm('هل أنتِ متأكدة من حذف هذا السؤال نهائياً؟')) return;
    const ok = await StorageService.deleteStudentQuestion(id);
    if (ok) {
      setAdminStudentQuestions((prev) => prev.filter((q) => q.id !== id));
    }
  };

  const handleDeleteAdminFeedback = async (id: string) => {
    if (!window.confirm('هل أنتِ متأكدة من حذف هذا التقييم نهائياً؟')) return;
    const ok = await StorageService.deleteFeedback(id);
    if (ok) {
      setAdminFeedbacks((prev) => prev.filter((f) => f.id !== id));
    }
  };

  const handleAdminQuestionReply = async (questionId: string) => {
    const text = (adminReplyText[questionId] || '').trim();
    if (!text) return;
    try {
      const rep = await StorageService.replyToQuestion(questionId, {
        authorName: 'المشرفة الأكاديمية أ/ صافيناز عبدالعزيز',
        isSupervisor: true,
        text
      });
      setAdminStudentQuestions((prev) =>
        prev.map((q) => {
          if (q.id === questionId) {
            const replies = Array.isArray(q.replies) ? [...q.replies, rep] : [rep];
            return { ...q, replies };
          }
          return q;
        })
      );
      setAdminReplyText((prev) => ({ ...prev, [questionId]: '' }));
    } catch (err) {
      console.error('Failed to reply:', err);
    }
  };

  // File Upload states
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'reading' | 'success' | 'error'>(
    'idle'
  );
  const [statusMessage, setStatusMessage] = useState('');
  const [pastedText, setPastedText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add Question Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newPassage, setNewPassage] = useState('');
  const [newOptions, setNewOptions] = useState(['', '', '', '']);
  const [newCorrectIdx, setNewCorrectIdx] = useState(0);
  const [newExplanation, setNewExplanation] = useState('');
  const [newCategory, setNewCategory] = useState<string>('لفظي');
  const [addFormError, setAddFormError] = useState('');

  // Add Section Modal state
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');

  // Settings states
  const [newAdminPin, setNewAdminPin] = useState('');
  const [pinChangeSuccess, setPinChangeSuccess] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [testTitle, setTestTitle] = useState(quizData.title);
  const [testDuration, setTestDuration] = useState(config.durationMinutes);
  const [passMark, setPassMark] = useState(config.passPercentage);
  const [customPublicUrl, setCustomPublicUrl] = useState(config.customPublicUrl || '');
  const [confirmClearResults, setConfirmClearResults] = useState(false);

  // Search in questions and results
  const [questionSearch, setQuestionSearch] = useState('');
  const [resultSearch, setResultSearch] = useState('');

  // Share & sync states
  const [copiedLink, setCopiedLink] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currentSection =
    sections.find((s) => s.id === activeSectionId) ||
    sections[0] || {
      id: 'sec_1',
      sectionNumber: 1,
      title: 'القسم الأول (1)',
      questions: quizData.questions
    };

  useEffect(() => {
    let active = true;
    StorageService.fetchAdminAuthStatus().then((st) => {
      if (!active) return;
      setLockoutStatus({
        isLocked: st.isLocked,
        failedAttempts: st.failedAttempts,
        attemptsLeft: st.attemptsLeft,
        lockedUntil: st.lockedUntil,
        remainingSeconds: st.remainingSeconds
      });
      if (st.currentPin) {
        setCurrentAdminPin(st.currentPin);
      }
      if (isAuthenticated && !st.authenticated) {
        onLogout();
      }
    });
    return () => {
      active = false;
    };
  }, [isAuthenticated, onLogout]);

  useEffect(() => {
    if (!lockoutStatus.isLocked || !lockoutStatus.lockedUntil) return;
    const lockedUntil = lockoutStatus.lockedUntil;
    const timer = setInterval(() => {
      const nextEval = evaluateLockoutState(
        { failedAttempts: 4, lockedUntil },
        Date.now()
      );
      setLockoutStatus(nextEval);
      if (!nextEval.isLocked) {
        StorageService.saveLocalLockoutRecord(resetLockoutRecord());
        setLoginError('');
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutStatus.isLocked, lockoutStatus.lockedUntil]);

  useEffect(() => {
    setTestTitle(quizData.title);
  }, [quizData.title]);

  useEffect(() => {
    setTestDuration(config.durationMinutes);
    setPassMark(config.passPercentage);
  }, [config.durationMinutes, config.passPercentage]);

  const publicOrigin =
    typeof window !== 'undefined'
      ? selectBestPublicOrigin({
          currentOrigin: window.location.origin,
          customPublicUrl: config.customPublicUrl,
          serverPublicOrigin
        })
      : '';
  const studentLink = buildShareLink(publicOrigin);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutStatus.isLocked) {
      setLoginError(
        `المحاولات مقفلة أمنياً. يرجى الانتظار ${formatLockoutCountdown(
          lockoutStatus.remainingSeconds
        )}.`
      );
      return;
    }
    const trimmed = pinInput.trim();
    if (!trimmed) {
      setLoginError('يرجى إدخال رمز مرور المشرف.');
      return;
    }

    setIsLoggingIn(true);
    setLoginError('');

    try {
      const res = await StorageService.loginAdmin(trimmed);
      setLockoutStatus(res.status);

      if (res.success) {
        onLogin();
        setPinInput('');
        setLoginError('');
      } else {
        if (res.status.isLocked) {
          setLoginError(
            `تم قفل محاولات تسجيل الدخول لمدة ساعة كاملة (${formatLockoutCountdown(
              res.status.remainingSeconds
            )}) بسبب ٤ محاولات خاطئة متتالية.`
          );
        } else {
          setLoginError(
            `${res.error || 'رمز الدخول غير صحيح.'} (${formatArabicRemainingAttempts(
              res.status.attemptsLeft
            )})`
          );
        }
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCopyStudentLink = async () => {
    const ok = await copyToClipboard(studentLink);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onRefreshResults) {
        await onRefreshResults();
      } else {
        await StorageService.syncResultsFromServer();
      }
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleExportCSV = () => {
    if (results.length === 0) return;
    const header = [
      'اسم الطالبة',
      'القسم المختبر',
      'الدرجة',
      'المجموع',
      'النسبة المئوية',
      'الزمن بالثواني',
      'تاريخ ووقت الاختبار'
    ];
    const rows = results.map((r) => {
      const examLabel = r.sectionTitle || 'اختبار القدرات';
      return [
        `"${(r.studentName || '').replace(/"/g, '""')}"`,
        `"${examLabel.replace(/"/g, '""')}"`,
        r.score,
        r.total,
        `"${r.percentage}%"`,
        r.timeSeconds,
        `"${new Date(r.submittedAt).toLocaleString('ar-SA')}"`
      ];
    });

    const csvContent =
      '\uFEFF' + [header.join(','), ...rows.map((e) => e.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `نتائج_القدرات_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const persistQuestionsToCurrentSection = (
    questions: Question[],
    sourceFilename?: string,
    customTitle?: string
  ) => {
    const updatedQuiz: QuizData = {
      ...quizData,
      title: customTitle || quizData.title,
      sourceFilename: sourceFilename || quizData.sourceFilename,
      updatedAt: new Date().toISOString(),
      questions
    };
    onUpdateQuiz(updatedQuiz);
    StorageService.saveSectionQuestions(
      currentSection.id,
      questions,
      sourceFilename || currentSection.sourceFilename,
      customTitle || currentSection.title
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus('reading');
    setStatusMessage(
      `جاري استخراج الأسئلة من الملف وحفظها في (${currentSection.title})...`
    );

    try {
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      const isImage = /\.(png|jpe?g|webp|bmp)$/i.test(file.name) || file.type.startsWith('image/');
      let rawText = '';

      if (isPdf) {
        try {
          rawText = await extractTextFromPdf(file);
        } catch (pdfErr) {
          console.warn('PDF extraction notice:', pdfErr);
        }
      } else if (!isImage) {
        rawText = await extractTextFromFile(file);
      }

      let fileBase64 = '';
      if (isPdf || isImage) {
        try {
          fileBase64 = await fileToBase64(file);
        } catch (err) {
          console.warn('Base64 conversion notice:', err);
        }
      }

      // Try AI extraction endpoint first
      try {
        const mimeType = isPdf ? 'application/pdf' : file.type || 'image/jpeg';
        const response = await fetch('/api/ai/extract-questions', {
          method: 'POST',
          headers: StorageService.getAdminHeaders(true),
          body: JSON.stringify({
            text: rawText || undefined,
            pdfBase64: fileBase64 || undefined,
            mimeType,
            subjectName: 'اختبار القدرات العامة (لفظي وكمي)',
            gradeName: currentSection.title
          })
        });

        if (response.status === 401) {
          StorageService.setAdminAuthenticated(false);
          onLogout();
          return;
        }

        if (response.ok) {
          const aiData = await response.json();
          if (aiData.success && Array.isArray(aiData.questions) && aiData.questions.length > 0) {
            persistQuestionsToCurrentSection(
              aiData.questions,
              file.name,
              aiData.title || currentSection.title
            );
            setUploadStatus('success');
            setStatusMessage(
              `تم بنجاح استخراج وحفظ ${aiData.questions.length} سؤالاً في (${currentSection.title})!`
            );
            return;
          }
        }
      } catch (aiErr) {
        console.warn('AI extraction fallback:', aiErr);
      }

      // Local parser fallback
      const extracted = parseQuestionsFromText(rawText);
      if (extracted.length === 0) {
        setUploadStatus('error');
        setStatusMessage(
          'لم يتم التعرف على أسئلة ذات خيارات أ، ب، ج، د في هذا الملف. يمكنك لصق النص في المربع أدناه أو إضافة الأسئلة يدوياً.'
        );
      } else {
        persistQuestionsToCurrentSection(extracted, file.name);
        setUploadStatus('success');
        setStatusMessage(
          `تم بنجاح استخراج وحفظ ${extracted.length} سؤالاً في (${currentSection.title})!`
        );
      }
    } catch (err: any) {
      setUploadStatus('error');
      setStatusMessage(`حدث خطأ أثناء قراءة الملف: ${err?.message || 'تأكد من صيغة الملف'}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleParsePastedText = async () => {
    if (!pastedText.trim()) return;

    setUploadStatus('reading');
    setStatusMessage(`جاري تحليل النص وحفظ الأسئلة في (${currentSection.title})...`);

    try {
      const response = await fetch('/api/ai/extract-questions', {
        method: 'POST',
        headers: StorageService.getAdminHeaders(true),
        body: JSON.stringify({
          text: pastedText,
          subjectName: 'اختبار القدرات العامة',
          gradeName: currentSection.title
        })
      });

      if (response.ok) {
        const aiData = await response.json();
        if (aiData.success && Array.isArray(aiData.questions) && aiData.questions.length > 0) {
          persistQuestionsToCurrentSection(aiData.questions, 'نص_ملصوق');
          setUploadStatus('success');
          setStatusMessage(
            `تم استخراج وحفظ ${aiData.questions.length} سؤالاً بنجاح في (${currentSection.title})!`
          );
          setPastedText('');
          return;
        }
      }

      // Local regex fallback
      const extracted = parseQuestionsFromText(pastedText);
      if (extracted.length > 0) {
        persistQuestionsToCurrentSection(extracted, 'نص_ملصوق');
        setUploadStatus('success');
        setStatusMessage(
          `تم استخراج وحفظ ${extracted.length} سؤالاً بنجاح في (${currentSection.title})!`
        );
        setPastedText('');
      } else {
        setUploadStatus('error');
        setStatusMessage('لم يتم العثور على صيغة أسئلة صحيحة في النص.');
      }
    } catch {
      const extracted = parseQuestionsFromText(pastedText);
      if (extracted.length > 0) {
        persistQuestionsToCurrentSection(extracted, 'نص_ملصوق');
        setUploadStatus('success');
        setStatusMessage(
          `تم استخراج وحفظ ${extracted.length} سؤالاً بنجاح في (${currentSection.title})!`
        );
        setPastedText('');
      } else {
        setUploadStatus('error');
        setStatusMessage('حدث خطأ أثناء معالجة النص.');
      }
    }
  };

  // Add / Edit Question
  const handleOpenAddQuestion = () => {
    setEditingQuestionId(null);
    setNewQuestionText('');
    setNewPassage('');
    setNewOptions(['', '', '', '']);
    setNewCorrectIdx(0);
    setNewExplanation('');
    setNewCategory('لفظي');
    setAddFormError('');
    setShowAddModal(true);
  };

  const handleOpenEditQuestion = (q: Question) => {
    setEditingQuestionId(q.id);
    setNewQuestionText(q.text);
    setNewPassage(q.passage || '');
    setNewOptions([...q.options]);
    setNewCorrectIdx(q.correctIndex || 0);
    setNewExplanation(q.explanation || '');
    setNewCategory(q.category || 'لفظي');
    setAddFormError('');
    setShowAddModal(true);
  };

  const handleSaveQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim()) {
      setAddFormError('يرجى كتابة نص السؤال.');
      return;
    }
    if (newOptions.some((opt) => !opt.trim())) {
      setAddFormError('يرجى ملء جميع الخيارات الأربعة (أ، ب، ج، د).');
      return;
    }

    const currentQuestions = quizData.questions || [];
    let updatedQuestions: Question[];

    if (editingQuestionId) {
      updatedQuestions = currentQuestions.map((q) =>
        q.id === editingQuestionId
          ? {
              ...q,
              text: newQuestionText.trim(),
              passage: newPassage.trim() || undefined,
              options: newOptions.map((o) => o.trim()),
              correctIndex: newCorrectIdx,
              explanation: newExplanation.trim() || undefined,
              category: newCategory
            }
          : q
      );
    } else {
      const newQuestion: Question = {
        id: `q_custom_${Date.now()}`,
        text: newQuestionText.trim(),
        passage: newPassage.trim() || undefined,
        options: newOptions.map((o) => o.trim()),
        correctIndex: newCorrectIdx,
        explanation: newExplanation.trim() || undefined,
        category: newCategory
      };
      updatedQuestions = [...currentQuestions, newQuestion];
    }

    persistQuestionsToCurrentSection(updatedQuestions);
    setShowAddModal(false);
  };

  const handleDeleteQuestion = (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا السؤال؟')) return;
    const updated = (quizData.questions || []).filter((q) => q.id !== id);
    persistQuestionsToCurrentSection(updated);
  };

  const handleAddNewSection = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newSectionTitle.trim();
    if (!title) return;
    if (onAddSection) {
      onAddSection(title);
    } else {
      const nextNum = sections.length + 1;
      const newSecId = `sec_${Date.now()}`;
      StorageService.saveSectionQuestions(newSecId, [], 'custom_section.pdf', title);
      if (onSelectSection) onSelectSection(newSecId);
    }
    setNewSectionTitle('');
    setShowAddSectionModal(false);
  };

  // Change Admin Pin
  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeSuccess('');
    setSettingsError('');
    const trimmed = newAdminPin.trim();
    if (trimmed.length < 4) {
      setSettingsError('يجب أن يتكون رمز المرور من ٤ خانات على الأقل.');
      return;
    }
    const ok = await StorageService.changeAdminPin(trimmed);
    if (ok) {
      setCurrentAdminPin(trimmed);
      setNewAdminPin('');
      setPinChangeSuccess('تم تحديث رمز مرور المشرف بنجاح وسيبقى محفوظاً بصورة دائمة.');
    } else {
      setSettingsError('تعذر تحديث رمز المرور، يرجى المحاولة مرة أخرى.');
    }
  };

  // Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateConfig({
      durationMinutes: Math.max(1, Number(testDuration) || 13),
      passPercentage: Math.max(1, Math.min(100, Number(passMark) || 60)),
      customPublicUrl: customPublicUrl.trim()
    });
    if (testTitle !== quizData.title) {
      persistQuestionsToCurrentSection(quizData.questions, undefined, testTitle);
    }
    alert('تم حفظ إعدادات الاختبار بنجاح.');
  };

  // Filtered Questions
  const filteredQuestions = (quizData.questions || []).filter(
    (q) =>
      q.text.toLowerCase().includes(questionSearch.toLowerCase()) ||
      (q.explanation && q.explanation.toLowerCase().includes(questionSearch.toLowerCase())) ||
      (q.passage && q.passage.toLowerCase().includes(questionSearch.toLowerCase()))
  );

  // Filtered Results
  const filteredResults = results.filter((r) =>
    (r.studentName || '').toLowerCase().includes(resultSearch.toLowerCase())
  );

  // ====================== 1. LOGIN SCREEN ======================
  if (!isAuthenticated) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-3xl border border-emerald-900/15 p-8 sm:p-10 shadow-2xl text-center space-y-6 relative overflow-hidden text-slate-800">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-600 via-amber-400 to-emerald-700" />
          <SchoolLogo size="lg" />

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>لوحة مرور المشرفين</span>
            </div>
            <h1 className="text-2xl font-black text-[#043d2e] leading-snug">
              {PLATFORM_FULL_NAME}
            </h1>
            <p className="text-xs text-emerald-700/80 mt-1 font-bold">{AUTHOR_CREDIT}</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4 text-right">
            <div>
              <label htmlFor="adminPin" className="block text-xs font-black text-slate-700 mb-1.5">
                رمز مرور المشرف
              </label>
              <div className="relative">
                <input
                  id="adminPin"
                  type={showPin ? 'text' : 'password'}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    if (loginError) setLoginError('');
                  }}
                  disabled={lockoutStatus.isLocked || isLoggingIn}
                  placeholder="أدخل رمز المرور..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-base font-mono tracking-widest text-center disabled:opacity-50"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-700"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={lockoutStatus.isLocked || isLoggingIn}
              className="w-full py-3.5 bg-[#f59e0b] hover:bg-[#d97706] text-black font-black text-sm rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm active:scale-95"
            >
              <span>{isLoggingIn ? 'جاري التحقق...' : 'دخول المشرف'}</span>
              <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
            </button>
          </form>

          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium">
            <button
              type="button"
              onClick={onGoHome}
              className="hover:text-emerald-800 text-slate-600 font-bold transition-colors"
            >
              ← العودة لواجهة الطلاب
            </button>
            <span className="text-[11px] text-emerald-800/80 font-bold">{COPYRIGHT_TEXT}</span>
          </div>
        </div>
      </div>
    );
  }

  // ====================== 2. AUTHENTICATED ADMIN PANEL ======================
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 text-slate-800">
      {/* Top Admin Header */}
      <div className="bg-white rounded-3xl border border-emerald-900/15 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-600 via-amber-400 to-emerald-700" />
        <div className="flex items-center gap-4">
          <SchoolLogo size="md" />
          <div>
            <div className="flex items-center gap-2 text-xs font-black text-emerald-800 mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>لوحة تحكم المشرفين</span>
              <span aria-hidden="true" className="text-emerald-400">·</span>
              <span className="text-emerald-900 font-bold">{AUTHOR_CREDIT}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#043d2e]">
              {PLATFORM_FULL_NAME}
            </h1>
            <p className="text-xs text-slate-600 mt-0.5 font-medium">
              القسم النشط حالياً:{' '}
              <span className="font-extrabold text-emerald-800">
                {currentSection.title} ({quizData.questions.length} سؤالاً)
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleCopyStudentLink}
            className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
            <span>{copiedLink ? 'تم نسخ الرابط!' : 'نسخ رابط المنصة'}</span>
          </button>

          <button
            type="button"
            onClick={onGoHome}
            className="px-3.5 py-2 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] text-black font-black text-xs transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 shadow-sm"
          >
            <ExternalLink className="w-4 h-4 text-black" />
            <span>عرض المنصة للطلاب</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>

      {/* Qudurat Sections Bar */}
      <div className="bg-white rounded-3xl border border-emerald-900/15 p-5 shadow-sm space-y-3 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-extrabold text-[#043d2e]">
            <Layers className="w-4 h-4 text-emerald-700" />
            <span>إدارة وتعديل أقسام ونماذج القدرات:</span>
            <span className="text-slate-500 font-normal">({sections.length} أقسام متاحة)</span>
          </div>

          <button
            type="button"
            onClick={() => setShowAddSectionModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] text-black text-xs font-black transition-all cursor-pointer whitespace-nowrap shadow-sm active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>إضافة قسم جديد</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {sections.map((sec) => {
            const isSelected = activeSectionId === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => onSelectSection && onSelectSection(sec.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? 'bg-[#064e3b] text-white font-black shadow-sm'
                    : 'bg-emerald-50/70 hover:bg-emerald-100 text-emerald-950 border border-emerald-200'
                }`}
              >
                <span>{sec.title}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-[#f59e0b] text-black font-black' : 'bg-emerald-200 text-emerald-900'
                  }`}
                >
                  {sec.questions.length}س
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap border-b border-emerald-200 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-2.5 rounded-t-2xl text-xs sm:text-sm font-extrabold transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
            activeTab === 'upload'
              ? 'bg-white text-emerald-900 border-[#064e3b] shadow-xs'
              : 'text-slate-500 hover:text-slate-800 border-transparent'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>رفع واستيراد الأسئلة</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('questions')}
          className={`px-4 py-2.5 rounded-t-2xl text-xs sm:text-sm font-extrabold transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
            activeTab === 'questions'
              ? 'bg-white text-emerald-900 border-[#064e3b] shadow-xs'
              : 'text-slate-500 hover:text-slate-800 border-transparent'
          }`}
        >
          <ListChecks className="w-4 h-4" />
          <span>بنك أسئلة القسم ({quizData.questions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('results')}
          className={`px-4 py-2.5 rounded-t-2xl text-xs sm:text-sm font-extrabold transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
            activeTab === 'results'
              ? 'bg-white text-emerald-800 border-emerald-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 border-transparent'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>نتائج الطالبات ({results.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2.5 rounded-t-2xl text-xs sm:text-sm font-extrabold transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
            activeTab === 'settings'
              ? 'bg-white text-emerald-800 border-emerald-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 border-transparent'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>إعدادات الاختبار والأمان</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('feedback_questions')}
          className={`px-4 py-2.5 rounded-t-2xl text-xs sm:text-sm font-extrabold transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
            activeTab === 'feedback_questions'
              ? 'bg-white text-emerald-800 border-emerald-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 border-transparent'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-amber-500" />
          <span>التحكم في التقييمات والأسئلة</span>
          <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded-full font-mono font-bold">
            {adminFeedbacks.length + adminStudentQuestions.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('backup_shield')}
          className={`px-4 py-2.5 rounded-t-2xl text-xs sm:text-sm font-extrabold transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
            activeTab === 'backup_shield'
              ? 'bg-white text-emerald-950 border-[#064e3b] shadow-xs'
              : 'text-slate-600 hover:text-slate-900 border-transparent'
          }`}
        >
          <Database className="w-4 h-4 text-emerald-700" />
          <span>درع الحماية والنسخ الاحتياطي</span>
          <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded-full font-bold">
            محمي 100%
          </span>
        </button>
      </div>

      {/* ====================== TAB 1: UPLOAD / IMPORT ====================== */}
      {activeTab === 'upload' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* PDF / File Upload */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold mb-2">
                <FileText className="w-3.5 h-3.5" />
                <span>رفع ملف إلى: {currentSection.title}</span>
              </div>
              <h2 className="text-lg font-black text-slate-900">
                استيراد الأسئلة من ملف (PDF / صورة / نص)
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                يدعم النظام استخراج أسئلة القدرات (التناظر، إكمال الجمل، الخطأ السياقي، استيعاب المقروء) مع خياراتها (أ، ب، ج، د) والإجابة الصحيحة والشرح.
              </p>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:border-emerald-600 transition-colors bg-slate-50/50">
              <Upload className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-800 mb-1">
                اضغطي لاختيار ملف PDF أو صورة أسئلة
              </p>
              <p className="text-xs text-slate-500 mb-4">
                صيغ مدعومة: PDF, PNG, JPG, TXT
              </p>
              <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer">
                <span>تحديد ملف من الجهاز</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/*,.txt,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {uploadStatus !== 'idle' && (
              <div
                className={`p-4 rounded-2xl border text-xs font-bold flex items-start gap-2.5 ${
                  uploadStatus === 'reading'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : uploadStatus === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {uploadStatus === 'reading' && <RefreshCw className="w-4 h-4 animate-spin shrink-0 mt-0.5" />}
                {uploadStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
                {uploadStatus === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
                <span>{statusMessage}</span>
              </div>
            )}
          </div>

          {/* Paste Raw Text */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>لصق نص الأسئلة مباشرة</span>
              </div>
              <h2 className="text-lg font-black text-slate-900">
                تحليل النص واستخراج الأسئلة
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                الصقي نص الأسئلة مع خياراتها (أ، ب، ج، د) وسيقوم النظام الذكي بفرزها وتصنيفها آلياً.
              </p>
            </div>

            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              rows={9}
              placeholder="مثال:
1. التناظر اللفظي: (ثوب : جسم)
أ) خشب : طاولة
ب) قدم : حذاء
ج) قماش : خياط
د) قبعة : رأس
الإجابة الصحيحة: د
الشرح: الثوب يستر الجسم والقبعة تستر الرأس"
              className="w-full p-4 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white resize-y"
              dir="rtl"
            />

            <button
              type="button"
              onClick={handleParsePastedText}
              disabled={!pastedText.trim() || uploadStatus === 'reading'}
              className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm rounded-2xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>استخراج وحفظ الأسئلة في {currentSection.title}</span>
            </button>
          </div>
        </div>
      )}

      {/* ====================== TAB 2: QUESTIONS LIST ====================== */}
      {activeTab === 'questions' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">
                بنك أسئلة {currentSection.title}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                إجمالي الأسئلة المعتمدة: {quizData.questions.length} سؤالاً
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={questionSearch}
                onChange={(e) => setQuestionSearch(e.target.value)}
                placeholder="بحث في أسئلة القسم..."
                className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-600"
              />

              <button
                type="button"
                onClick={handleOpenAddQuestion}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة سؤال يدوياً</span>
              </button>
            </div>
          </div>

          {filteredQuestions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <ListChecks className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="font-bold text-sm">لا توجد أسئلة تطابق البحث أو لم يتم رفع أسئلة بعد.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredQuestions.map((q, idx) => (
                <div
                  key={q.id || idx}
                  className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white transition-colors space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center font-mono">
                        {idx + 1}
                      </span>
                      {q.category && (
                        <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                          {q.category}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditQuestion(q)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                        title="تعديل السؤال"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="حذف السؤال"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {q.passage && (
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-slate-800 leading-relaxed font-serif">
                      <span className="font-bold text-amber-900 block mb-1">قطعة القراءة:</span>
                      {q.passage}
                    </div>
                  )}

                  <p className="text-sm font-bold text-slate-900 leading-relaxed">{q.text}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {q.options.map((opt, oIdx) => {
                      const isCorrect = oIdx === q.correctIndex;
                      return (
                        <div
                          key={oIdx}
                          className={`p-2.5 rounded-xl border flex items-center gap-2 font-medium ${
                            isCorrect
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                              isCorrect
                                ? 'bg-emerald-700 text-white'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {ARABIC_LETTERS[oIdx] || oIdx + 1}
                          </span>
                          <span>{opt}</span>
                          {isCorrect && (
                            <span className="mr-auto text-[10px] text-emerald-700 font-extrabold">
                              (الإجابة الصحيحة)
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <div className="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100 font-medium">
                      <strong className="text-emerald-800">التفسير: </strong>
                      {q.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ====================== TAB 3: RESULTS & LEADERBOARD ====================== */}
      {activeTab === 'results' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">سجل نتائج الطالبات في القدرات</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                إجمالي الاختبارات المكتملة: {results.length} طالبة
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={resultSearch}
                onChange={(e) => setResultSearch(e.target.value)}
                placeholder="بحث باسم الطالبة..."
                className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-600"
              />

              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>تحديث</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                disabled={results.length === 0}
                className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تصدير Excel (CSV)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (confirmClearResults) {
                    onClearResults();
                    setConfirmClearResults(false);
                  } else {
                    setConfirmClearResults(true);
                    setTimeout(() => setConfirmClearResults(false), 4000);
                  }
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  confirmClearResults
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                {confirmClearResults ? 'تأكيد مسح جميع النتائج؟' : 'مسح النتائج'}
              </button>
            </div>
          </div>

          {filteredResults.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="font-bold text-sm">لا توجد نتائج مسجلة حتى الآن.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-extrabold">
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">اسم الطالبة</th>
                    <th className="py-3 px-3">القسم المختبر</th>
                    <th className="py-3 px-3">الدرجة</th>
                    <th className="py-3 px-3">النسبة</th>
                    <th className="py-3 px-3">الوقت المستغرق</th>
                    <th className="py-3 px-3">التاريخ والوقت</th>
                    <th className="py-3 px-3 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredResults.map((res, i) => (
                    <tr key={res.id || i} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-slate-400">{i + 1}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">{res.studentName}</td>
                      <td className="py-3 px-3 font-medium text-slate-600">
                        {res.sectionTitle || 'اختبار القدرات'}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-800">
                        {res.score} / {res.total}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`font-black font-mono px-2 py-0.5 rounded-full ${
                            res.percentage >= 80
                              ? 'bg-emerald-100 text-emerald-800'
                              : res.percentage >= 60
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {res.percentage}%
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        {formatTime(res.timeSeconds)}
                      </td>
                      <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                        {new Date(res.submittedAt).toLocaleString('ar-SA')}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => onDeleteResult(res.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors"
                          title="حذف النتيجة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ====================== TAB 4: SETTINGS & SECURITY ====================== */}
      {activeTab === 'settings' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Exam Configuration */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-5">
            <h2 className="text-lg font-black text-slate-900 border-b border-slate-100 pb-3">
              إعدادات اختبار القدرات
            </h2>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  عنوان القسم النشط
                </label>
                <input
                  type="text"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    مدة الاختبار (بالدقائق)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={testDuration}
                    onChange={(e) => setTestDuration(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    نسبة الاجتياز (٪)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={passMark}
                    onChange={(e) => setPassMark(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Permanent 24/7 URL box */}
              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    الرابط الموحد والدائم 24/7 للطالبات:
                  </span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-950 font-bold px-2 py-0.5 rounded-full">
                    شغال دائماً ولا يقفل
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={studentLink}
                    className="flex-1 px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-mono text-emerald-950 text-left select-all"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={handleCopyStudentLink}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    {copiedLink ? 'تم النسخ!' : 'نسخ'}
                  </button>
                </div>
                <p className="text-[10px] text-emerald-800 leading-relaxed">
                  هذا الرابط يعمل بشكل مستمر دون توقف أو إغلاق بعد ساعات. شاركيه مع الطالبات بدلاً من رابط شاشة التعديل.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  رابط مخصص للمنصة (اختياري - في حال ربط دومين مدرسي خاص)
                </label>
                <input
                  type="url"
                  value={customPublicUrl}
                  onChange={(e) => setCustomPublicUrl(e.target.value)}
                  placeholder="https://qudurat.alhaditha.edu.sa"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:border-emerald-600 text-left"
                  dir="ltr"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>حفظ التعديلات</span>
              </button>
            </form>
          </div>

          {/* Supervisor Security & PIN */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-5">
            <h2 className="text-lg font-black text-slate-900 border-b border-slate-100 pb-3">
              أمان المشرف ورمز المرور
            </h2>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-600">رمز المرور الحالي:</span>
                <span className="font-mono bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-900">
                  {currentAdminPin}
                </span>
              </div>
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-600">نظام الحماية من التخمين:</span>
                <span className="text-emerald-700 font-extrabold">مفعّل (قفل ساعة بعد ٤ محاولات)</span>
              </div>
            </div>

            <form onSubmit={handleChangePin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  تعيين رمز مرور جديد للمشرف
                </label>
                <input
                  type="text"
                  value={newAdminPin}
                  onChange={(e) => setNewAdminPin(e.target.value)}
                  placeholder="أدخل رمز المرور الجديد..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-emerald-600 text-center tracking-widest"
                  dir="ltr"
                />
              </div>

              {pinChangeSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{pinChangeSuccess}</span>
                </div>
              )}

              {settingsError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{settingsError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!newAdminPin.trim()}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>تحديث رمز المرور</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ====================== TAB 5: FEEDBACK & STUDENT QUESTIONS MANAGEMENT ====================== */}
      {activeTab === 'feedback_questions' && (
        <div className="space-y-6">
          {/* Sub-tab switcher */}
          <div className="bg-white rounded-3xl border border-emerald-900/10 p-5 shadow-xs flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setAdminSubTab('feedback')}
              className={`flex-1 min-w-[200px] py-3 px-5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                adminSubTab === 'feedback'
                  ? 'bg-[#064e3b] text-white shadow-md'
                  : 'bg-emerald-50/70 hover:bg-emerald-100 text-emerald-950 border border-emerald-200'
              }`}
            >
              <Star className="w-4 h-4 text-[#fbbf24] fill-[#fbbf24]" />
              <span>تقييمات وآراء الطالبات</span>
              <span className="mr-auto text-xs px-2 py-0.5 rounded-full font-mono bg-amber-400 text-black font-bold">
                {adminFeedbacks.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAdminSubTab('questions')}
              className={`flex-1 min-w-[200px] py-3 px-5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                adminSubTab === 'questions'
                  ? 'bg-[#064e3b] text-white shadow-md'
                  : 'bg-emerald-50/70 hover:bg-emerald-100 text-emerald-950 border border-emerald-200'
              }`}
            >
              <HelpCircle className="w-4 h-4 text-[#fbbf24]" />
              <span>استفسارات وأسئلة الطالبات</span>
              <span className="mr-auto text-xs px-2 py-0.5 rounded-full font-mono bg-amber-400 text-black font-bold">
                {adminStudentQuestions.length}
              </span>
            </button>
          </div>

          {/* Sub-tab 1: FEEDBACK REVIEWS */}
          {adminSubTab === 'feedback' && (
            <div className="space-y-5">
              {/* Stats Bar */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 shadow-2xs">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-600">
                    <Star className="w-6 h-6 fill-amber-500 text-amber-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-[#064e3b] font-mono">
                      {calculateAverageRating(adminFeedbacks)}{' '}
                      <span className="text-xs font-bold text-slate-500">/ 5.0</span>
                    </div>
                    <div className="text-xs text-slate-600 font-bold">متوسط التقييم العام</div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 shadow-2xs">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-[#064e3b] font-mono">
                      {adminFeedbacks.length}
                    </div>
                    <div className="text-xs text-slate-600 font-bold">إجمالي التقييمات المسجلة</div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between sm:col-span-2 lg:col-span-1 shadow-2xs">
                  <div className="w-full">
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      بحث في التقييمات:
                    </label>
                    <input
                      type="text"
                      value={adminFeedbackSearch}
                      onChange={(e) => setAdminFeedbackSearch(e.target.value)}
                      placeholder="اسم الطالبة أو كلمات من الرأي..."
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>
              </div>

              {/* Feedbacks Grid */}
              {adminFeedbacks.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500 space-y-2">
                  <Star className="w-10 h-10 mx-auto text-amber-500 opacity-60" />
                  <p className="font-bold text-sm text-slate-700">لا توجد تقييمات مسجلة حتى الآن.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {adminFeedbacks
                    .filter(
                      (f) =>
                        !adminFeedbackSearch ||
                        f.studentName.toLowerCase().includes(adminFeedbackSearch.toLowerCase()) ||
                        f.comment.toLowerCase().includes(adminFeedbackSearch.toLowerCase())
                    )
                    .map((fb) => (
                      <div
                        key={fb.id}
                        className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-2xs flex flex-col justify-between hover:border-emerald-400 transition-colors"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-4 h-4 ${
                                    i < fb.rating
                                      ? 'text-[#f59e0b] fill-[#f59e0b]'
                                      : 'text-slate-300'
                                  }`}
                                />
                              ))}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteAdminFeedback(fb.id)}
                              className="px-2.5 py-1 text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                              title="حذف هذا التقييم نهائياً"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف</span>
                            </button>
                          </div>

                          <p className="text-xs sm:text-sm text-slate-800 font-medium whitespace-pre-wrap leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                            "{fb.comment}"
                          </p>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="font-bold text-[#064e3b]">{fb.studentName}</span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {new Date(fb.createdAt).toLocaleDateString('ar-SA')}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Sub-tab 2: STUDENT QUESTIONS */}
          {adminSubTab === 'questions' && (
            <div className="space-y-5">
              {/* Header Bar */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-2xs">
                <div>
                  <h3 className="font-black text-sm text-[#064e3b]">
                    سجل أسئلة واستفسارات الطالبات ({adminStudentQuestions.length} سؤالاً)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    يمكنكِ الرد على أي سؤال بصفة المشرفة الأكاديمية أو حذفه نهائياً
                  </p>
                </div>

                <div className="w-full sm:w-72">
                  <input
                    type="text"
                    value={adminQuestionSearch}
                    onChange={(e) => setAdminQuestionSearch(e.target.value)}
                    placeholder="بحث في نص السؤال أو اسم الطالبة..."
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Questions List */}
              {adminStudentQuestions.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500 space-y-2">
                  <HelpCircle className="w-10 h-10 mx-auto text-emerald-600 opacity-60" />
                  <p className="font-bold text-sm text-slate-700">لا توجد أسئلة مرسلة من الطالبات حتى الآن.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {adminStudentQuestions
                    .filter(
                      (q) =>
                        !adminQuestionSearch ||
                        q.studentName.toLowerCase().includes(adminQuestionSearch.toLowerCase()) ||
                        q.text.toLowerCase().includes(adminQuestionSearch.toLowerCase())
                    )
                    .map((q) => {
                      const replies = q.replies || [];
                      const currentText = adminReplyText[q.id] || '';

                      return (
                        <div
                          key={q.id}
                          className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-2xs hover:border-emerald-300 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-sm">
                                {q.studentName.charAt(0)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-black text-slate-900 text-sm">{q.studentName}</h4>
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      q.category === 'كمي'
                                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                        : q.category === 'لفظي'
                                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                        : 'bg-slate-200 text-slate-800'
                                    }`}
                                  >
                                    {q.category}
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  {new Date(q.createdAt).toLocaleDateString('ar-SA')} —{' '}
                                  {new Date(q.createdAt).toLocaleTimeString('ar-SA', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteAdminQuestion(q.id)}
                              className="px-3 py-1.5 text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-2xs"
                              title="حذف هذا السؤال نهائياً"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>حذف السؤال</span>
                            </button>
                          </div>

                          {q.text && (
                            <p className="text-sm text-slate-900 whitespace-pre-wrap leading-relaxed font-medium bg-slate-50 p-4 rounded-xl border border-slate-100">
                              {q.text}
                            </p>
                          )}

                          {q.imageUrl && (
                            <div className="relative inline-block">
                              <img
                                src={q.imageUrl}
                                alt="صورة السؤال"
                                onClick={() => setAdminLightboxImage(q.imageUrl || null)}
                                className="max-h-56 max-w-md rounded-xl border border-emerald-200 shadow-sm cursor-zoom-in object-contain bg-slate-900"
                              />
                              <button
                                type="button"
                                onClick={() => setAdminLightboxImage(q.imageUrl || null)}
                                className="absolute bottom-2 left-2 bg-black/75 hover:bg-black text-white text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-md cursor-pointer transition-colors"
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                                <span>تكبير الصورة</span>
                              </button>
                            </div>
                          )}

                          {/* Replies List */}
                          {replies.length > 0 && (
                            <div className="space-y-2 pr-4 border-r-2 border-emerald-400 pt-2">
                              {replies.map((rep) => (
                                <div
                                  key={rep.id}
                                  className={`p-3 rounded-xl text-xs space-y-1 ${
                                    rep.isSupervisor
                                      ? 'bg-emerald-50 border border-emerald-300 text-emerald-950'
                                      : 'bg-slate-50 border border-slate-200 text-slate-800'
                                  }`}
                                >
                                  <div className="flex items-center justify-between font-black">
                                    <div className="flex items-center gap-1.5">
                                      {rep.isSupervisor && (
                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                                      )}
                                      <span>{rep.authorName}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {new Date(rep.createdAt).toLocaleTimeString('ar-SA', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  </div>
                                  <p className="whitespace-pre-wrap leading-relaxed font-medium">
                                    {rep.text}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Supervisor Reply Form */}
                          <div className="pt-2 flex gap-2">
                            <input
                              type="text"
                              value={currentText}
                              onChange={(e) =>
                                setAdminReplyText((prev) => ({ ...prev, [q.id]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAdminQuestionReply(q.id);
                                }
                              }}
                              placeholder="اكتبي شرح أو رد المشرفة الأكاديمية على هذا السؤال..."
                              className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                            />
                            <button
                              type="button"
                              onClick={() => handleAdminQuestionReply(q.id)}
                              className="px-4 py-2.5 bg-[#064e3b] hover:bg-[#043d2e] text-white text-xs font-black rounded-xl cursor-pointer flex items-center gap-1.5 shrink-0"
                            >
                              <span>إرسال الرد</span>
                              <CornerDownLeft className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* Lightbox Image Modal */}
          {adminLightboxImage && (
            <div
              role="dialog"
              aria-modal="true"
              onClick={() => setAdminLightboxImage(null)}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm cursor-zoom-out"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-3xl p-3 border border-emerald-500/40 shadow-2xl"
              >
                <button
                  type="button"
                  onClick={() => setAdminLightboxImage(null)}
                  className="absolute top-4 left-4 p-2 rounded-full bg-black/80 text-white hover:bg-rose-600 transition-colors cursor-pointer z-10"
                  title="إغلاق"
                >
                  <X className="w-5 h-5 stroke-[2.5]" />
                </button>
                <img
                  src={adminLightboxImage}
                  alt="صورة السؤال بالحجم الكامل"
                  className="max-h-[85vh] max-w-full rounded-2xl object-contain mx-auto"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====================== TAB 6: BACKUP & DATA PROTECTION SHIELD ====================== */}
      {activeTab === 'backup_shield' && (
        <div className="space-y-6">
          {/* Main Shield Banner */}
          <div className="bg-gradient-to-br from-[#064e3b] via-[#043d2e] to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-emerald-500/30">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-48 h-48 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
              <div className="space-y-3 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-xs font-black">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>درع الأمان التراكمي الدائم — مفعّل ونشط</span>
                </div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white leading-snug">
                  نظام حماية لوحة الصدارة والتقييمات وبنك الأسئلة
                </h2>
                <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed font-medium">
                  تم تأمين المنصة بنظام الحفظ التراكمي المزدوج والمزامنة غير الإلغائية
                  <span className="font-bold text-amber-300"> (Non-Destructive Dual-Vault Sync)</span>.
                  أي تعديل على المنصة الآن أو مستقبلاً (تحديث تصميم، إضافة مميزات، أو إعادة تشغيل الخادم)
                  <strong className="text-white underline decoration-amber-400 decoration-2 underline-offset-4"> لن يحذف أو يؤثر إطلاقاً </strong>
                  على درجات الطالبات المسجلة، التقييمات، أو الأسئلة المضافة.
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/15 flex flex-col items-center text-center shrink-0 w-full md:w-auto">
                <div className="w-14 h-14 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black mb-3 shadow-lg">
                  <Database className="w-7 h-7" />
                </div>
                <span className="text-xs font-bold text-emerald-200">حالة البيانات</span>
                <span className="text-lg font-black text-white mt-0.5">محمية 100%</span>
                <span className="text-[11px] text-emerald-300/80 mt-1">تزامن سحابي ومحلي متواصل</span>
              </div>
            </div>
          </div>

          {/* Feedback messages */}
          {backupSuccessMsg && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl p-4 flex items-center gap-3 text-xs sm:text-sm font-bold shadow-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{backupSuccessMsg}</span>
            </div>
          )}

          {backupErrorMsg && (
            <div className="bg-rose-50 border border-rose-300 text-rose-900 rounded-2xl p-4 flex items-center gap-3 text-xs sm:text-sm font-bold shadow-xs">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{backupErrorMsg}</span>
            </div>
          )}

          {/* Real-time Data Inventory Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">لوحة الصدارة</span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Trophy className="w-4 h-4" />
                </div>
              </div>
              <span className="text-2xl sm:text-3xl font-black text-[#064e3b] font-mono tabular-nums">
                {results.length}
              </span>
              <span className="text-[11px] text-emerald-700 font-bold mt-1">
                درجة طالبة محفوظة ومؤمنة
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">تقييمات المنصة</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Star className="w-4 h-4 fill-emerald-600 text-emerald-600" />
                </div>
              </div>
              <span className="text-2xl sm:text-3xl font-black text-[#064e3b] font-mono tabular-nums">
                {adminFeedbacks.length}
              </span>
              <span className="text-[11px] text-emerald-700 font-bold mt-1">
                رأي وتقييم طالبة محفوظ
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">أسئلة واستفسارات الطالبات</span>
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
              </div>
              <span className="text-2xl sm:text-3xl font-black text-[#064e3b] font-mono tabular-nums">
                {adminStudentQuestions.length}
              </span>
              <span className="text-[11px] text-sky-700 font-bold mt-1">
                سؤال ونقاش طالبة محفوظ
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">إجمالي أسئلة القدرات</span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <span className="text-2xl sm:text-3xl font-black text-[#064e3b] font-mono tabular-nums">
                {sections.reduce((acc, s) => acc + (s.questions?.length || 0), 0)}
              </span>
              <span className="text-[11px] text-purple-700 font-bold mt-1">
                سؤال عبر {sections.length} أقسام ونماذج
              </span>
            </div>
          </div>

          {/* Action Boxes: Export, Restore, Vault Recover */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Box 1: Download Full Backup */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Download className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-slate-900">
                  تحميل نسخة احتياطية شاملة
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  احفظي ملفاً كاملاً (JSON) يحتوي على جميع نتائج الطالبات، التقييمات، استفسارات الطالبات، وبنك الأسئلة الحالي بضغطة زر واحدة.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setBackupSuccessMsg('');
                  setBackupErrorMsg('');
                  StorageService.downloadBackupJsonFile();
                  setBackupSuccessMsg('تم تنزيل النسخة الاحتياطية الشاملة لجهازك بنجاح.');
                }}
                className="w-full py-3 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>تحميل ملف النسخة الاحتياطية (JSON)</span>
              </button>
            </div>

            {/* Box 2: Restore / Merge Backup */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-slate-900">
                  استعادة ودمج نسخة احتياطية
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  استوردي أي نسخة احتياطية سابقة. الخيار الافتراضي هو "دمج آمن" يضيف أي نتائج أو أسئلة جديدة دون مسح الموجود.
                </p>
                <div className="flex items-center gap-4 pt-1">
                  <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="restoreMode"
                      value="merge"
                      checked={backupRestoreMode === 'merge'}
                      onChange={() => setBackupRestoreMode('merge')}
                      className="accent-emerald-700"
                    />
                    <span>دمج آمن (موصى به)</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="restoreMode"
                      value="replace"
                      checked={backupRestoreMode === 'replace'}
                      onChange={() => setBackupRestoreMode('replace')}
                      className="accent-emerald-700"
                    />
                    <span>استبدال كامل</span>
                  </label>
                </div>
              </div>

              <div>
                <input
                  ref={backupFileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setBackupSuccessMsg('');
                    setBackupErrorMsg('');
                    setIsRestoringBackup(true);
                    try {
                      const text = await file.text();
                      const parsed = JSON.parse(text);
                      const res = await StorageService.restoreFullBackup(parsed, backupRestoreMode);
                      if (res.success) {
                        setBackupSuccessMsg(res.message);
                        if (onRefreshResults) onRefreshResults();
                        refreshAdminFeedbackAndQuestions();
                      } else {
                        setBackupErrorMsg(res.message);
                      }
                    } catch (err: any) {
                      setBackupErrorMsg('الملف المختار غير صالح كنسخة احتياطية JSON: ' + (err.message || ''));
                    } finally {
                      setIsRestoringBackup(false);
                      if (backupFileInputRef.current) backupFileInputRef.current.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={isRestoringBackup}
                  onClick={() => backupFileInputRef.current?.click()}
                  className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isRestoringBackup ? 'جارٍ الاستعادة...' : 'اختيار ملف النسخة الاحتياطية'}</span>
                </button>
              </div>
            </div>

            {/* Box 3: Instant Vault Recovery */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
                  <HardDrive className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-slate-900">
                  استرداد فوري من الخزانة الدائمة
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  إذا حُذفت ملفات المتصفح أو فُقد الاتصال المؤقت، تتيح هذه الأداة استرداد كافة السجلات المخزنة في الخزانة غير القابلة للإلغاء ومزامنتها فوراً.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setBackupSuccessMsg('');
                  setBackupErrorMsg('');
                  const recovered = StorageService.recoverFromImmutableVault();
                  setBackupSuccessMsg(
                    `تم استرداد وتأمين ${recovered.resultsCount} نتيجة طالبة، و${recovered.feedbackCount} تقييماً، و${recovered.questionsCount} سؤالاً من الخزانة الدائمة.`
                  );
                  if (onRefreshResults) onRefreshResults();
                  refreshAdminFeedbackAndQuestions();
                }}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-amber-300 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95"
              >
                <RefreshCw className="w-4 h-4 text-amber-400" />
                <span>استرداد ومزامنة الخزانة الدائمة</span>
              </button>
            </div>
          </div>

          {/* Explanation Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 sm:p-7 space-y-4">
            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>كيف يضمن النظام عدم تأثر النتائج والتقييمات والأسئلة بأي تعديل مستقبلي؟</span>
            </h4>
            <div className="grid md:grid-cols-3 gap-4 text-xs font-medium text-slate-700 leading-relaxed">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                <span className="font-black text-emerald-800 block text-sm">1. الكتابة الذرية السحابية</span>
                <p>تتم كتابة ملفات البيانات بنظام النسخ المؤقت المتبوع بالاستبدال الفوري الذري، مما يمنع نهائياً فقدان البيانات أثناء أي توقف أو إعادة تشغيل للخادم.</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                <span className="font-black text-emerald-800 block text-sm">2. الخزانة المحلية غير القابلة للحذف</span>
                <p>تُحفظ درجات الطالبات وأسئلة واستفساراتهن في خزانة محلية دائمة مستقلة تماماً لا تتأثر بمسح الذاكرة العادية أو تغيير إصدار النظام.</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                <span className="font-black text-emerald-800 block text-sm">3. المزامنة التراكمية غير الإلغائية</span>
                <p>أي اتصال جديد بين أجهزة الطالبات أو المشرفة يقوم بدمج السجلات وإعادة ملء الخادم إذا كان ناقصاً، دون حذف أي سجل سابق إطلاقاً.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================== MODAL: ADD / EDIT QUESTION ====================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 my-8 shadow-2xl">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">
                {editingQuestionId ? 'تعديل السؤال' : 'إضافة سؤال جديد إلى ' + currentSection.title}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕ إغلاق
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  قطعة القراءة (اختياري - لاستيعاب المقروء)
                </label>
                <textarea
                  value={newPassage}
                  onChange={(e) => setNewPassage(e.target.value)}
                  rows={3}
                  placeholder="أدخلي نص القطعة هنا إن وجد..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs leading-relaxed focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نص السؤال *
                </label>
                <textarea
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  rows={2}
                  placeholder="مثال: التناظر اللفظي: (ثوب : جسم)"
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">مهارة اللفظي</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600"
                  >
                    <option value="تناظر لفظي">تناظر لفظي</option>
                    <option value="إكمال الجمل">إكمال الجمل</option>
                    <option value="الخطأ السياقي">الخطأ السياقي</option>
                    <option value="استيعاب المقروء">استيعاب المقروء</option>
                    <option value="المفردة الشاذة">المفردة الشاذة</option>
                    <option value="لفظي">لفظي (عام)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الخيار الصحيح *
                  </label>
                  <select
                    value={newCorrectIdx}
                    onChange={(e) => setNewCorrectIdx(Number(e.target.value))}
                    className="w-full p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-extrabold focus:outline-none focus:border-emerald-600"
                  >
                    <option value={0}>أ) الخيار الأول</option>
                    <option value={1}>ب) الخيار الثاني</option>
                    <option value={2}>ج) الخيار الثالث</option>
                    <option value={3}>د) الخيار الرابع</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">الخيارات الأربعة *</label>
                {newOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center shrink-0 ${
                        i === newCorrectIdx
                          ? 'bg-emerald-700 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {ARABIC_LETTERS[i]}
                    </span>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const copy = [...newOptions];
                        copy[i] = e.target.value;
                        setNewOptions(copy);
                      }}
                      placeholder={`الخيار (${ARABIC_LETTERS[i]})...`}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-600"
                      required
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  التفسير والشرح النموذجي (اختياري)
                </label>
                <textarea
                  value={newExplanation}
                  onChange={(e) => setNewExplanation(e.target.value)}
                  rows={2}
                  placeholder="شرح سبب اختيار الإجابة الصحيحة لتوضيحه للطالبة بعد إنهاء الاختبار..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>

              {addFormError && (
                <p className="text-rose-600 text-xs font-bold">{addFormError}</p>
              )}

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>حفظ السؤال</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================== MODAL: ADD SECTION ====================== */}
      {showAddSectionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">إضافة قسم جديد لاختبار القدرات</h3>
              <button
                type="button"
                onClick={() => setShowAddSectionModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕ إغلاق
              </button>
            </div>

            <form onSubmit={handleAddNewSection} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم أو عنوان القسم الجديد
                </label>
                <input
                  type="text"
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  placeholder={`مثال: القسم ${sections.length + 1} (النماذج الحديثة)`}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSectionModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold cursor-pointer"
                >
                  إضافة القسم الآن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
