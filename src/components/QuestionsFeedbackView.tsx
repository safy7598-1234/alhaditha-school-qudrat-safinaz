import React, { useState, useEffect, useRef } from 'react';
import {
  HelpCircle,
  Star,
  Image as ImageIcon,
  Send,
  Upload,
  X,
  MessageCircle,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Trash2,
  CornerDownLeft,
  Search,
  Layers,
  Award,
  ChevronDown,
  ShieldCheck,
  Maximize2,
  RefreshCw
} from 'lucide-react';
import {
  StudentQuestionItem,
  PlatformFeedbackItem,
  QuestionReply,
  VerbalCategory
} from '../types/quiz';
import {
  AUTHOR_CREDIT,
  PLATFORM_FULL_NAME
} from '../data/curriculum';
import { StorageService } from '../services/storage';
import {
  filterQuestionsForViewer,
  canUserDeleteQuestion,
  canUserDeleteFeedback,
  calculateAverageRating
} from '../utils/questionsFeedback';
import { SchoolLogo } from './SchoolLogo';

interface QuestionsFeedbackViewProps {
  isAdmin?: boolean;
  onGoHome: () => void;
  onStartExam: () => void;
  onAdminUnlock?: () => void;
}

export const QuestionsFeedbackView: React.FC<QuestionsFeedbackViewProps> = ({
  isAdmin = false,
  onGoHome,
  onStartExam,
  onAdminUnlock
}) => {
  // Main Sub-Tab: 'questions' (الأسئلة بصورة أو نص) or 'feedback' (التقييم بالاسم والكتابة)
  const [activeTab, setActiveTab] = useState<'questions' | 'feedback'>('questions');

  // Supervisor authentication & Student Ownership
  const [adminAuthenticated, setAdminAuthenticated] = useState<boolean>(() =>
    isAdmin || StorageService.isAdminAuthenticated()
  );
  const [myQuestionIds, setMyQuestionIds] = useState<string[]>(() =>
    StorageService.getMyQuestionIds()
  );
  const [currentSavedStudentName, setCurrentSavedStudentName] = useState<string>(() =>
    StorageService.getSavedStudentName()
  );

  // Quick Supervisor Login Modal
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminPinError, setAdminPinError] = useState('');
  const [isAdminSubmitting, setIsAdminSubmitting] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      setAdminAuthenticated(true);
    }
  }, [isAdmin]);

  // ================= Questions State =================
  const [questions, setQuestions] = useState<StudentQuestionItem[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [questionSearch, setQuestionSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Add Question Form
  const [qStudentName, setQStudentName] = useState('');
  const [qCategory, setQCategory] = useState<VerbalCategory>('تناظر لفظي');
  const [qText, setQText] = useState('');
  const [qImageBase64, setQImageBase64] = useState<string>('');
  const [qError, setQError] = useState('');
  const [qSuccess, setQSuccess] = useState('');
  const [isSubmittingQ, setIsSubmittingQ] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active question image modal (Lightbox)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Active replies expand state: questionId -> boolean
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [replyInputs, setReplyInputs] = useState<Record<string, { author: string; text: string }>>({});

  // ================= Feedback State =================
  const [feedbacks, setFeedbacks] = useState<PlatformFeedbackItem[]>([]);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(true);

  // Add Feedback Form
  const [fbStudentName, setFbStudentName] = useState('');
  const [fbRating, setFbRating] = useState<number>(5);
  const [fbComment, setFbComment] = useState('');
  const [fbError, setFbError] = useState('');
  const [fbSuccess, setFbSuccess] = useState('');
  const [isSubmittingFb, setIsSubmittingFb] = useState(false);

  // Load initial data
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        await StorageService.syncDeletedIdsFromServer();
        const [qList, fbList] = await Promise.all([
          StorageService.getStudentQuestions(),
          StorageService.getFeedback()
        ]);
        if (isMounted) {
          setQuestions(qList);
          setFeedbacks(fbList);
          setIsLoadingQuestions(false);
          setIsLoadingFeedback(false);
        }
      } catch (err) {
        console.error('Failed to load questions or feedback', err);
        if (isMounted) {
          setIsLoadingQuestions(false);
          setIsLoadingFeedback(false);
        }
      }
    };
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Handle Question Image Upload
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setQError('يرجى اختيار ملف صورة صالح (PNG, JPG, WEBP)');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setQError('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 8 ميجابايت');
      return;
    }

    setQError('');
    const reader = new FileReader();
    reader.onload = () => {
      setQImageBase64(reader.result as string);
    };
    reader.onerror = () => {
      setQError('تعذر قراءة الصورة، يرجى المحاولة مرة أخرى');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setQImageBase64('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Supervisor quick unlock handler
  const handleAdminUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPinError('');
    setIsAdminSubmitting(true);
    try {
      const ok = await StorageService.verifyAdminPin(adminPinInput.trim());
      if (ok) {
        setAdminAuthenticated(true);
        setShowAdminModal(false);
        setAdminPinInput('');
        if (onAdminUnlock) onAdminUnlock();
        // reload questions with admin headers
        const allQuestions = await StorageService.getStudentQuestions();
        setQuestions(allQuestions);
      } else {
        setAdminPinError('رمز المشرف غير صحيح');
      }
    } catch {
      setAdminPinError('حدث خطأ أثناء التحقق');
    } finally {
      setIsAdminSubmitting(false);
    }
  };

  // Submit Question
  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setQError('');
    setQSuccess('');

    const nameTrimmed = qStudentName.trim();
    const textTrimmed = qText.trim();

    if (!nameTrimmed) {
      setQError('يرجى كتابة اسم الطالبة الثلاثي');
      return;
    }

    if (!textTrimmed && !qImageBase64) {
      setQError('يرجى كتابة نص السؤال أو إرفاق صورة للسؤال');
      return;
    }

    setIsSubmittingQ(true);
    try {
      const created = await StorageService.addStudentQuestion({
        studentName: nameTrimmed,
        category: qCategory,
        text: textTrimmed,
        imageUrl: qImageBase64 || undefined
      });

      setQuestions((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
      setMyQuestionIds(StorageService.getMyQuestionIds());
      setCurrentSavedStudentName(nameTrimmed);
      setQText('');
      setQImageBase64('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setQSuccess('تم إرسال ونشر سؤالكِ بنجاح! سيظهر هنا فقط لكِ مع رد وتوجيه المشرفة الأكاديمية.');
      setTimeout(() => setQSuccess(''), 4500);
    } catch {
      setQError('تعذر حفظ السؤال، يرجى التحقق من الاتصال');
    } finally {
      setIsSubmittingQ(false);
    }
  };

  // Submit Reply
  const handleReplySubmit = async (questionId: string) => {
    const currentInput = replyInputs[questionId] || { author: '', text: '' };
    const textTrimmed = currentInput.text.trim();
    const authorTrimmed =
      currentInput.author.trim() ||
      (adminAuthenticated ? 'المشرفة الأكاديمية أ/ صافيناز عبدالعزيز' : 'طالبة');

    if (!textTrimmed) return;

    try {
      const newReply = await StorageService.replyToQuestion(questionId, {
        authorName: authorTrimmed,
        isSupervisor: adminAuthenticated,
        text: textTrimmed
      });

      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id === questionId) {
            const replies = Array.isArray(q.replies) ? [...q.replies, newReply] : [newReply];
            return { ...q, replies };
          }
          return q;
        })
      );

      setReplyInputs((prev) => ({
        ...prev,
        [questionId]: { author: '', text: '' }
      }));
    } catch (err) {
      console.error('Failed to submit reply:', err);
    }
  };

  // Delete Question
  const handleDeleteQuestion = async (id: string) => {
    if (!window.confirm('هل أنتِ متأكدة من حذف هذا السؤال؟')) return;
    const ok = await StorageService.deleteStudentQuestion(id);
    if (ok) {
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      setMyQuestionIds(StorageService.getMyQuestionIds());
    }
  };

  // Submit Feedback
  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFbError('');
    setFbSuccess('');

    const nameTrimmed = fbStudentName.trim();
    const commentTrimmed = fbComment.trim();

    if (!nameTrimmed) {
      setFbError('يرجى كتابة اسم الطالبة الثلاثي');
      return;
    }

    if (!commentTrimmed) {
      setFbError('يرجى كتابة تقييمكِ ورأيكِ عن الموقع');
      return;
    }

    setIsSubmittingFb(true);
    try {
      const created = await StorageService.addFeedback({
        studentName: nameTrimmed,
        rating: fbRating,
        comment: commentTrimmed
      });

      setFeedbacks((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
      setFbComment('');
      setFbSuccess('شكراً لكِ! تم تسجيل تقييمكِ الرائع بنجاح.');
      setTimeout(() => setFbSuccess(''), 4000);
    } catch {
      setFbError('تعذر إرسال التقييم، يرجى المحاولة لاحقاً');
    } finally {
      setIsSubmittingFb(false);
    }
  };

  // Delete Feedback
  const handleDeleteFeedback = async (id: string) => {
    if (!window.confirm('هل أنتِ متأكدة من حذف هذا التقييم؟')) return;
    const ok = await StorageService.deleteFeedback(id);
    if (ok) {
      setFeedbacks((prev) => prev.filter((f) => f.id !== id));
    }
  };

  // Filtered Questions with Privacy Enforcement
  const visibleQuestions = filterQuestionsForViewer(questions, {
    isAdmin: adminAuthenticated,
    studentName: qStudentName || currentSavedStudentName,
    ownedQuestionIds: myQuestionIds
  });

  const filteredQuestions = visibleQuestions.filter((q) => {
    const matchesCat = categoryFilter === 'all' || q.category === categoryFilter;
    const matchesText =
      !questionSearch ||
      q.text.toLowerCase().includes(questionSearch.toLowerCase()) ||
      q.studentName.toLowerCase().includes(questionSearch.toLowerCase());
    return matchesCat && matchesText;
  });

  // Calculate Average Rating
  const avgRating = calculateAverageRating(feedbacks);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8 text-slate-800">
      {/* 1. Header & Section Switcher (Matches Video Theme) */}
      <section className="bg-white rounded-3xl border border-emerald-900/10 p-6 sm:p-8 shadow-[0_4px_25px_rgba(6,78,59,0.06)] relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <SchoolLogo size="md" className="shrink-0 shadow-md ring-2 ring-amber-400" />
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full mb-1.5 w-fit">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>قسم التفاعل الطلابي المعتمد</span>
                <span aria-hidden="true" className="text-emerald-400">·</span>
                <span className="text-emerald-900">{AUTHOR_CREDIT}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#064e3b]">
                قسم الأسئلة والتقييم
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <p className="text-xs sm:text-sm text-slate-600">
                  طرح استفسارات وأسئلة القدرات (نصياً أو بصورة) + تسجيل تقييمات وآراء الطالبات في المنصة.
                </p>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>التقييمات والأسئلة محفوظة ومؤمنة ضد أي تعديل</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                StorageService.getFeedback().then((list) => setFeedbacks(list));
                StorageService.getStudentQuestions().then((list) => setQuestions(list));
              }}
              className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-[#064e3b] border border-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap active:scale-95"
              title="تحديث ومزامنة التقييمات والأسئلة"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
              <span>تحديث البيانات</span>
            </button>

            {!adminAuthenticated ? (
              <button
                type="button"
                onClick={() => setShowAdminModal(true)}
                className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-[#064e3b] border border-emerald-300 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap active:scale-95"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>دخول المشرفة (للتحكم)</span>
              </button>
            ) : (
              <div className="px-3 py-2 bg-amber-50 border border-amber-300 rounded-xl text-xs font-black text-amber-900 flex items-center gap-1.5 whitespace-nowrap shadow-xs">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>صلاحية المشرفة مفعّلة</span>
              </div>
            )}

            <button
              type="button"
              onClick={onStartExam}
              className="px-4 py-2.5 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer shadow-md active:scale-95 whitespace-nowrap"
            >
              <span>بدء الاختبار</span>
            </button>
            <button
              type="button"
              onClick={onGoHome}
              className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap shadow-xs active:scale-95"
            >
              الرئيسية
            </button>
          </div>
        </div>

        {/* The Two Distinct Parts Toggle Switcher */}
        <div className="mt-6 pt-5 border-t border-emerald-100 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('questions')}
            className={`flex-1 min-w-[240px] py-3.5 px-5 rounded-2xl text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2.5 shadow-sm active:scale-98 ${
              activeTab === 'questions'
                ? 'bg-[#064e3b] text-white shadow-md'
                : 'bg-emerald-50/70 hover:bg-emerald-100 text-emerald-950 border border-emerald-200'
            }`}
          >
            <HelpCircle className="w-5 h-5 shrink-0 text-[#fbbf24]" />
            <div className="text-right">
              <div>الجزء الأول: بنك واستفسارات الأسئلة</div>
              <div className="text-[11px] font-semibold opacity-90">
                {adminAuthenticated
                  ? '(عرض وتحكم بجميع أسئلة الطالبات)'
                  : '(أسئلتكِ الخاصة فقط بنظام الخصوصية)'}
              </div>
            </div>
            <span
              className={`mr-auto text-xs px-2.5 py-0.5 rounded-full font-bold font-mono ${
                activeTab === 'questions'
                  ? 'bg-[#f59e0b] text-black'
                  : 'bg-emerald-200 text-emerald-900'
              }`}
            >
              {adminAuthenticated ? `${questions.length} سؤالاً (الكل)` : `${visibleQuestions.length} سؤالاً`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('feedback')}
            className={`flex-1 min-w-[240px] py-3.5 px-5 rounded-2xl text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2.5 shadow-sm active:scale-98 ${
              activeTab === 'feedback'
                ? 'bg-[#064e3b] text-white shadow-md'
                : 'bg-emerald-50/70 hover:bg-emerald-100 text-emerald-950 border border-emerald-200'
            }`}
          >
            <Star className="w-5 h-5 shrink-0 text-[#fbbf24] fill-[#fbbf24]" />
            <div className="text-right">
              <div>الجزء الثاني: تقييم وآراء الطالبات</div>
              <div className="text-[11px] font-semibold opacity-90">
                (كتابة الاسم والتقييم عن المنصة)
              </div>
            </div>
            <span
              className={`mr-auto text-xs px-2.5 py-0.5 rounded-full font-bold font-mono ${
                activeTab === 'feedback'
                  ? 'bg-[#f59e0b] text-black'
                  : 'bg-emerald-200 text-emerald-900'
              }`}
            >
              {feedbacks.length} تقييماً
            </span>
          </button>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 2. PART 1: QUESTIONS (نص كتابي أو صورة) */}
      {/* ======================================================== */}
      {activeTab === 'questions' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Question Submission Card */}
          <section className="bg-white rounded-3xl border border-emerald-900/10 shadow-[0_4px_25px_rgba(6,78,59,0.06)] overflow-hidden">
            {/* Header band */}
            <div className="bg-[#064e3b] text-white p-5 sm:p-6 flex items-center justify-between">
              <div>
                <span className="inline-block bg-[#032e22] text-amber-300 border border-emerald-700/50 text-[11px] font-black px-2.5 py-0.5 rounded-full mb-1 shadow-xs">
                  مشاركة تفاعلية مباشرة
                </span>
                <h2 className="text-xl font-black text-white">
                  طرح سؤال أو استفسار جديد (نص كتابي أو صورة)
                </h2>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#f59e0b] text-black font-black text-lg flex items-center justify-center font-mono shadow-sm shrink-0">
                ؟
              </div>
            </div>

            <form onSubmit={handleQuestionSubmit} className="p-6 sm:p-8 space-y-6">
              {qSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-sm font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{qSuccess}</span>
                </div>
              )}

              {qError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-sm font-bold flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>{qError}</span>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-5">
                {/* Student Name */}
                <div>
                  <label htmlFor="qStudentName" className="block text-xs font-black text-slate-700 mb-1.5">
                    اسم الطالبة الثلاثي <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="qStudentName"
                    type="text"
                    value={qStudentName}
                    onChange={(e) => {
                      setQStudentName(e.target.value);
                      if (qError) setQError('');
                    }}
                    placeholder="اكتبي اسمكِ الثلاثي..."
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 focus:border-emerald-600 focus:bg-white rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none text-sm font-bold transition-all shadow-xs"
                    dir="rtl"
                  />
                </div>

                {/* Category Selector */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    مهارة / قسم السؤال اللفظي <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(['تناظر لفظي', 'إكمال الجمل', 'الخطأ السياقي', 'استيعاب المقروء', 'المفردة الشاذة'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setQCategory(cat)}
                        className={`px-3 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          qCategory === cat
                            ? 'bg-[#064e3b] text-white shadow-sm ring-2 ring-amber-400'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Question Text */}
              <div>
                <label htmlFor="qText" className="block text-xs font-black text-slate-700 mb-1.5">
                  نص السؤال اللفظي كتابياً
                </label>
                <textarea
                  id="qText"
                  rows={4}
                  value={qText}
                  onChange={(e) => {
                    setQText(e.target.value);
                    if (qError) setQError('');
                  }}
                  placeholder="اكتبي نص السؤال اللفظي (تناظر، إكمال جمل، خطأ سياقي، استيعاب مقروء) هنا بكل وضوح..."
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 focus:border-emerald-600 focus:bg-white rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none text-sm font-medium transition-all shadow-xs leading-relaxed"
                  dir="rtl"
                />
              </div>

              {/* Question Image Attachment */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  إرفاق صورة للسؤال (تصوير الشاشة أو صورة مسألة من كتاب/مذكرة)
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageFileChange}
                  accept="image/*"
                  className="hidden"
                  id="qImageUpload"
                />

                {!qImageBase64 ? (
                  <label
                    htmlFor="qImageUpload"
                    className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all text-center group"
                  >
                    <div className="w-12 h-12 rounded-full bg-emerald-100 group-hover:bg-emerald-200 flex items-center justify-center text-emerald-700 mb-2 transition-colors">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-black text-emerald-900">
                      اضغطي هنا لرفع صورة السؤال من جهازكِ أو جوالكِ
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5">
                      يدعم صور PNG, JPG, JPEG, WEBP حتى 8 ميجابايت
                    </span>
                  </label>
                ) : (
                  <div className="relative inline-block border-2 border-emerald-500 rounded-2xl overflow-hidden shadow-md bg-slate-900">
                    <img
                      src={qImageBase64}
                      alt="معاينة صورة السؤال المرفق"
                      className="max-h-56 max-w-full rounded-2xl object-contain"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-2 left-2 p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-lg transition-colors cursor-pointer"
                      title="إزالة الصورة"
                    >
                      <X className="w-4 h-4 stroke-[3]" />
                    </button>
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-md font-mono">
                      صورة جاهزة للنشر
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex items-center justify-between">
                <p className="text-xs text-slate-500 font-medium">
                  يتاح للطالبات وللمشرفة الأكاديمية التفاعل وحل الأسئلة فور نشرها.
                </p>
                <button
                  type="submit"
                  disabled={isSubmittingQ}
                  className="px-6 py-3.5 bg-[#f59e0b] hover:bg-[#d97706] text-black font-black text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
                >
                  <Send className="w-4 h-4 stroke-[2.5]" />
                  <span>{isSubmittingQ ? 'جاري النشر...' : 'نشر السؤال في البنك'}</span>
                </button>
              </div>
            </form>
          </section>

          {/* Questions Feed & Search */}
          <section className="bg-white rounded-3xl border border-emerald-900/10 p-6 sm:p-8 shadow-[0_4px_25px_rgba(6,78,59,0.06)] space-y-6">
            {/* Privacy / Supervisor Status Banner */}
            {!adminAuthenticated ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center gap-3 text-xs leading-relaxed text-emerald-950 font-bold">
                <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
                <span>
                  🔒 نظام الخصوصية التامة: تظهر هنا أسئلتكِ واستفساراتكِ الخاصة فقط مع ردود وتوجيهات المشرفة الأكاديمية أ/ صافيناز عبدالعزيز، ولا يمكن لأي طالبة أخرى الاطلاع عليها.
                </span>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs leading-relaxed text-amber-950 font-bold">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0" />
                  <span>
                    ⭐ وضع المشرفة الأكاديمية: معروض أمامكِ الآن جميع الأسئلة الواردة من كافة الطالبات ({questions.length} سؤالاً) مع إمكانية الرد الفوري أو حذف أي سؤال.
                  </span>
                </div>
                <span className="text-[11px] bg-[#f59e0b] text-black px-2.5 py-1 rounded-lg font-black shrink-0 w-fit">
                  تحكم كامل للمشرفة
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-emerald-100 pb-5">
              <div>
                <h3 className="text-xl font-black text-[#064e3b]">
                  {adminAuthenticated ? 'جميع أسئلة واستفسارات الطالبات' : 'أسئلتي واستفساراتي المطروحة'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {adminAuthenticated
                    ? 'متابعة أسئلة الطالبات، إرسال الشروحات، وحذف الأسئلة'
                    : 'تابعي الردود والشروحات الخاصة بأسئلتكِ من المشرفة الأكاديمية'}
                </p>
              </div>

              {/* Search & Category Filter */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-emerald-600 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={questionSearch}
                    onChange={(e) => setQuestionSearch(e.target.value)}
                    placeholder="ابحثي في الأسئلة..."
                    className="pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl">
                  {['all', 'تناظر لفظي', 'إكمال الجمل', 'الخطأ السياقي', 'استيعاب المقروء', 'المفردة الشاذة'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        categoryFilter === cat
                          ? 'bg-[#064e3b] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {cat === 'all' ? 'الكل' : cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Questions List */}
            {isLoadingQuestions ? (
              <div className="text-center py-12 text-slate-500 font-bold">
                جاري تحميل الأسئلة...
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="text-center py-16 text-slate-500 space-y-3">
                <HelpCircle className="w-12 h-12 mx-auto text-emerald-600 opacity-60" />
                <p className="font-bold text-sm text-slate-700">
                  {adminAuthenticated
                    ? 'لا توجد أسئلة مطروحة في هذا القسم حتى الآن.'
                    : 'لم تطرحي أي أسئلة حتى الآن.'}
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {adminAuthenticated
                    ? 'ستظهر هنا أسئلة واستفسارات الطالبات فور إرسالها.'
                    : 'اطرحي سؤالكِ أو استفساركِ اللفظي في النموذج أعلاه (كنص أو بصورة)، وستظهر لكِ هنا مع رد وتوجيه المشرفة الأكاديمية بكل خصوصية.'}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {filteredQuestions.map((q) => {
                  const isExpanded = Boolean(expandedReplies[q.id]);
                  const replies = q.replies || [];
                  const currentReplyInput = replyInputs[q.id] || { author: '', text: '' };
                  const canDelete = canUserDeleteQuestion(q, {
                    isAdmin: adminAuthenticated,
                    studentName: qStudentName || currentSavedStudentName,
                    ownedQuestionIds: myQuestionIds
                  });

                  return (
                    <article
                      key={q.id}
                      className="bg-slate-50/70 rounded-2xl border border-emerald-900/10 p-5 sm:p-6 space-y-4 hover:border-emerald-300 transition-all shadow-xs"
                    >
                      {/* Top Question Info */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-sm">
                            {q.studentName.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-black text-slate-900 text-sm">{q.studentName}</h4>
                              <span
                                className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300"
                              >
                                {q.category || 'لفظي'}
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

                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="p-1.5 text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold shadow-2xs"
                            title="حذف هذا السؤال"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>حذف</span>
                          </button>
                        )}
                      </div>

                      {/* Question Text */}
                      {q.text && (
                        <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-medium bg-white p-4 rounded-xl border border-slate-200">
                          {q.text}
                        </p>
                      )}

                      {/* Question Image (if attached) */}
                      {q.imageUrl && (
                        <div className="relative group w-fit max-w-full">
                          <img
                            src={q.imageUrl}
                            alt="صورة السؤال المرفق"
                            onClick={() => setLightboxImage(q.imageUrl || null)}
                            className="max-h-80 max-w-full rounded-xl border-2 border-emerald-200 shadow-sm cursor-zoom-in object-contain bg-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => setLightboxImage(q.imageUrl || null)}
                            className="absolute bottom-2 left-2 bg-black/75 hover:bg-black text-white text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-md cursor-pointer transition-colors"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                            <span>تكبير الصورة</span>
                          </button>
                        </div>
                      )}

                      {/* Replies Toggle & Counter */}
                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedReplies((prev) => ({ ...prev, [q.id]: !isExpanded }))
                          }
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#064e3b] hover:text-emerald-900 cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>
                            {replies.length > 0
                              ? `عرض الشروحات والردود (${replies.length})`
                              : 'كتابة أول شرح أو حل للسؤال'}
                          </span>
                        </button>
                      </div>

                      {/* Expanded Replies Section */}
                      {isExpanded && (
                        <div className="space-y-3 pt-2">
                          {/* Existing Replies */}
                          {replies.length > 0 && (
                            <div className="space-y-2.5 pr-4 border-r-2 border-emerald-400">
                              {replies.map((rep) => (
                                <div
                                  key={rep.id}
                                  className={`p-3 rounded-xl text-xs space-y-1 ${
                                    rep.isSupervisor
                                      ? 'bg-emerald-50 border border-emerald-300 text-emerald-950'
                                      : 'bg-white border border-slate-200 text-slate-800'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 font-black">
                                      {rep.isSupervisor && (
                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                                      )}
                                      <span>{rep.authorName}</span>
                                      {rep.isSupervisor && (
                                        <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.2 rounded-full">
                                          مشرفة
                                        </span>
                                      )}
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

                          {/* Add Reply Input */}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={currentReplyInput.text}
                              onChange={(e) =>
                                setReplyInputs((prev) => ({
                                  ...prev,
                                  [q.id]: {
                                    ...prev[q.id],
                                    text: e.target.value
                                  }
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleReplySubmit(q.id);
                                }
                              }}
                              placeholder="اكتبي حلكِ أو شرحكِ للسؤال هنا..."
                              className="flex-1 px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
                            />
                            <button
                              type="button"
                              onClick={() => handleReplySubmit(q.id)}
                              className="px-4 py-2.5 bg-[#064e3b] hover:bg-[#043d2e] text-white text-xs font-black rounded-xl cursor-pointer flex items-center gap-1 shrink-0"
                            >
                              <span>إرسال الحل</span>
                              <CornerDownLeft className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. PART 2: FEEDBACK & EVALUATION (كتابة الاسم والتقييم) */}
      {/* ======================================================== */}
      {activeTab === 'feedback' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Average Rating Score Card */}
          <div className="grid md:grid-cols-3 gap-5">
            <div className="bg-white rounded-3xl border border-emerald-900/10 p-6 shadow-sm flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-600 shrink-0">
                <Star className="w-7 h-7 fill-amber-500 text-amber-500" />
              </div>
              <div>
                <div className="text-3xl font-black text-[#064e3b] font-mono tabular-nums">
                  {avgRating} <span className="text-sm font-bold text-slate-500">/ 5.0</span>
                </div>
                <div className="text-xs text-slate-600 font-bold">متوسط تقييم الطالبات للمنصة</div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-emerald-900/10 p-6 shadow-sm flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 shrink-0">
                <Award className="w-7 h-7" />
              </div>
              <div>
                <div className="text-3xl font-black text-[#064e3b] font-mono tabular-nums">
                  {feedbacks.length}
                </div>
                <div className="text-xs text-slate-600 font-bold">إجمالي التقييمات المسجلة</div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-emerald-900/10 p-6 shadow-sm flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                <Sparkles className="w-7 h-7" />
              </div>
              <div>
                <div className="text-base font-black text-[#064e3b] leading-tight">
                  مدارس الحديثة الأهلية بنات
                </div>
                <div className="text-xs text-slate-600 font-semibold mt-1">
                  {AUTHOR_CREDIT}
                </div>
              </div>
            </div>
          </div>

          {/* Feedback Submission Form */}
          <section className="bg-white rounded-3xl border border-emerald-900/10 shadow-[0_4px_25px_rgba(6,78,59,0.06)] overflow-hidden">
            {/* Header Band */}
            <div className="bg-[#064e3b] text-white p-5 sm:p-6 flex items-center justify-between">
              <div>
                <span className="inline-block bg-[#032e22] text-amber-300 border border-emerald-700/50 text-[11px] font-black px-2.5 py-0.5 rounded-full mb-1 shadow-xs">
                  صوت الطالبات
                </span>
                <h2 className="text-xl font-black text-white">
                  شاركينا رأيكِ وتقييمكِ لمنصة مدارس الحديثة الأهلية
                </h2>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#f59e0b] text-black font-black text-lg flex items-center justify-center font-mono shadow-sm shrink-0">
                ⭐
              </div>
            </div>

            <form onSubmit={handleFeedbackSubmit} className="p-6 sm:p-8 space-y-6">
              {fbSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-sm font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{fbSuccess}</span>
                </div>
              )}

              {fbError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-sm font-bold flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>{fbError}</span>
                </div>
              )}

              {/* Student Name */}
              <div>
                <label htmlFor="fbStudentName" className="block text-xs font-black text-slate-700 mb-1.5">
                  اسم الطالبة الثلاثي <span className="text-rose-500">*</span>
                </label>
                <input
                  id="fbStudentName"
                  type="text"
                  value={fbStudentName}
                  onChange={(e) => {
                    setFbStudentName(e.target.value);
                    if (fbError) setFbError('');
                  }}
                  placeholder="اكتبي اسمكِ الثلاثي..."
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 focus:border-emerald-600 focus:bg-white rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none text-sm font-bold transition-all shadow-xs"
                  dir="rtl"
                />
              </div>

              {/* Interactive Star Rating */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  تقييمكِ للمنصة بالنجوم <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-4 w-fit">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFbRating(star)}
                      className="p-1 hover:scale-125 transition-transform cursor-pointer"
                      title={`${star} نجوم`}
                    >
                      <Star
                        className={`w-7 h-7 ${
                          star <= fbRating
                            ? 'text-[#f59e0b] fill-[#f59e0b]'
                            : 'text-slate-300 hover:text-amber-300'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-black text-emerald-900 mr-3">
                    {fbRating === 5 && 'ممتاز جداً 🌟'}
                    {fbRating === 4 && 'رائع جداً 👍'}
                    {fbRating === 3 && 'جيد 👏'}
                    {fbRating === 2 && 'مقبول'}
                    {fbRating === 1 && 'يحتاج تطوير'}
                  </span>
                </div>
              </div>

              {/* Comment Textarea */}
              <div>
                <label htmlFor="fbComment" className="block text-xs font-black text-slate-700 mb-1.5">
                  رأيكِ وتقييمكِ كتابياً عن المنصة <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="fbComment"
                  rows={4}
                  value={fbComment}
                  onChange={(e) => {
                    setFbComment(e.target.value);
                    if (fbError) setFbError('');
                  }}
                  placeholder="اكتبي رأيكِ في اختبارات القدرات، سهولة التوقيت، وضوح الأسئلة، وجودة المنصة..."
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 focus:border-emerald-600 focus:bg-white rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none text-sm font-medium transition-all shadow-xs leading-relaxed"
                  dir="rtl"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex items-center justify-between">
                <p className="text-xs text-slate-500 font-medium">
                  آراؤكن وتقييماتكن هي الداعم الأكبر لتطوير المنصة والوصول لأعلى الدرجات.
                </p>
                <button
                  type="submit"
                  disabled={isSubmittingFb}
                  className="px-6 py-3.5 bg-[#f59e0b] hover:bg-[#d97706] text-black font-black text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
                >
                  <Star className="w-4 h-4 fill-black stroke-black" />
                  <span>{isSubmittingFb ? 'جاري الإرسال...' : 'إرسال التقييم'}</span>
                </button>
              </div>
            </form>
          </section>

          {/* Feedback Feed */}
          <section className="bg-white rounded-3xl border border-emerald-900/10 p-6 sm:p-8 shadow-[0_4px_25px_rgba(6,78,59,0.06)] space-y-6">
            <div className="border-b border-emerald-100 pb-4">
              <h3 className="text-xl font-black text-[#064e3b]">
                سجل آراء وتقييمات الطالبات
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تجارب طالبات مدارس الحديثة الأهلية في اختبارات القدرات
              </p>
            </div>

            {isLoadingFeedback ? (
              <div className="text-center py-12 text-slate-500 font-bold">
                جاري تحميل التقييمات...
              </div>
            ) : feedbacks.length === 0 ? (
              <div className="text-center py-16 text-slate-500 space-y-3">
                <Star className="w-12 h-12 mx-auto text-amber-500 opacity-60" />
                <p className="font-bold text-sm text-slate-700">
                  لا توجد تقييمات مسجلة حتى الآن.
                </p>
                <p className="text-xs text-slate-500">
                  كوني أول من يكتب تقييمه وتجربته مع المنصة في النموذج أعلاه!
                </p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {feedbacks.map((fb) => (
                  <div
                    key={fb.id}
                    className="bg-slate-50 rounded-2xl border border-emerald-900/10 p-5 space-y-3 hover:border-emerald-300 transition-all shadow-xs flex flex-col justify-between"
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
                        {adminAuthenticated && (
                          <button
                            type="button"
                            onClick={() => handleDeleteFeedback(fb.id)}
                            className="p-1.5 text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold shadow-2xs"
                            title="حذف هذا التقييم"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف</span>
                          </button>
                        )}
                      </div>

                      <p className="text-xs sm:text-sm text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
                        "{fb.comment}"
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                      <span className="font-bold text-[#064e3b]">{fb.studentName}</span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(fb.createdAt).toLocaleDateString('ar-SA')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Lightbox Image Modal */}
      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-3xl p-3 border border-emerald-500/40 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 left-4 p-2 rounded-full bg-black/80 text-white hover:bg-rose-600 transition-colors cursor-pointer z-10"
              title="إغلاق"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
            <img
              src={lightboxImage}
              alt="صورة السؤال بالحجم الكامل"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain mx-auto"
            />
          </div>
        </div>
      )}

      {/* Supervisor Quick Unlock Modal */}
      {showAdminModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-unlock-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-3xl p-6 border border-emerald-900/15 shadow-2xl space-y-4 text-right relative overflow-hidden"
            dir="rtl"
          >
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-600 via-amber-400 to-emerald-700" />
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-700" />
                <h3 id="admin-unlock-title" className="font-black text-base text-[#064e3b]">
                  دخول المشرفة الأكاديمية
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              أدخلي رمز المرور لتفعيل صلاحية المشرفة، وعرض جميع الأسئلة والتحكم بحذف التقييمات والأسئلة.
            </p>

            <form onSubmit={handleAdminUnlock} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  رمز مرور المشرف
                </label>
                <input
                  type="password"
                  value={adminPinInput}
                  onChange={(e) => {
                    setAdminPinInput(e.target.value);
                    if (adminPinError) setAdminPinError('');
                  }}
                  placeholder="أدخلي رمز المرور..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-center font-mono text-base tracking-widest focus:outline-none focus:border-emerald-600"
                  dir="ltr"
                  autoFocus
                />
              </div>

              {adminPinError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{adminPinError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isAdminSubmitting}
                className="w-full py-2.5 bg-[#f59e0b] hover:bg-[#d97706] text-black font-black text-xs sm:text-sm rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isAdminSubmitting ? 'جاري التحقق...' : 'تأكيد الدخول'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
