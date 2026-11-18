import {
  Question,
  QuizConfig,
  QuizData,
  StudentResult,
  QuizSection,
  SubjectBankEntry,
  SubjectBanksMap,
  StudentQuestionItem,
  PlatformFeedbackItem,
  QuestionReply
} from '../types/quiz';
import { DEFAULT_QUDURAT_SECTIONS } from '../data/defaultSections';
import {
  LockoutEvaluation,
  LockoutRecord,
  evaluateLockoutState,
  recordFailedLoginAttempt,
  resetLockoutRecord
} from '../utils/adminLockout';
import {
  FullPlatformBackup,
  mergeStudentResults,
  mergeFeedbackItems,
  mergeStudentQuestions,
  mergeSections,
  safeJsonParse,
  buildBackupPayload
} from '../utils/dataVault';

export interface ClientTombstones {
  results: string[];
  feedback: string[];
  questions: string[];
}

const STORAGE_KEYS = {
  QUIZ: 'cbt_quiz_data',
  SUBJECT_BANKS: 'cbt_subject_banks_v1',
  RESULTS: 'cbt_quiz_results_v4',
  PENDING_RESULTS: 'cbt_pending_results_v1',
  CONFIG: 'cbt_quiz_config',
  ADMIN_PIN: 'cbt_admin_pin',
  ADMIN_AUTH: 'cbt_admin_authenticated',
  ADMIN_TOKEN: 'cbt_admin_token_v1',
  ADMIN_LOCKOUT: 'cbt_admin_lockout_v1',
  CLIENT_ID: 'cbt_client_id_v1',
  ACTIVE_SECTION: 'cbt_active_section_id',
  SECTIONS: 'cbt_qudurat_sections_v3',
  STUDENT_QUESTIONS: 'cbt_student_questions_v1',
  MY_QUESTION_IDS: 'cbt_my_question_ids_v1',
  STUDENT_NAME: 'cbt_current_student_name',
  FEEDBACK: 'cbt_platform_feedback_v1',
  // Immutable Disaster Recovery Vault Keys (Never wiped by standard UI operations)
  VAULT_RESULTS: 'cbt_immutable_vault_results_v1',
  VAULT_FEEDBACK: 'cbt_immutable_vault_feedback_v1',
  VAULT_QUESTIONS: 'cbt_immutable_vault_questions_v1',
  VAULT_SECTIONS: 'cbt_immutable_vault_sections_v1',
  TOMBSTONES: 'cbt_deleted_ids_tombstones_v1'
};

function readClientTombstones(): ClientTombstones {
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEYS.TOMBSTONES);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          results: Array.isArray(parsed?.results) ? parsed.results : [],
          feedback: Array.isArray(parsed?.feedback) ? parsed.feedback : [],
          questions: Array.isArray(parsed?.questions) ? parsed.questions : []
        };
      }
    }
  } catch {}
  return { results: [], feedback: [], questions: [] };
}

// Automatic Recovery & Migration: gathers records across all legacy and current keys so NO past score is ever lost,
// while strictly respecting supervisor deletions via tombstones.
try {
  if (typeof window !== 'undefined') {
    const tombstones = readClientTombstones();
    const deletedResSet = new Set(tombstones.results);
    const historicalResultKeys = [
      'cbt_quiz_results',
      'cbt_quiz_results_v1',
      'cbt_quiz_results_v2',
      'cbt_quiz_results_v3',
      STORAGE_KEYS.RESULTS,
      STORAGE_KEYS.VAULT_RESULTS
    ];
    let gathered: StudentResult[] = [];
    for (const k of historicalResultKeys) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            gathered = mergeStudentResults(gathered, parsed, deletedResSet);
          }
        }
      } catch {}
    }
    if (gathered.length > 0) {
      localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(gathered));
      localStorage.setItem(STORAGE_KEYS.VAULT_RESULTS, JSON.stringify(gathered));
    }
  }
} catch {
  // ignore
}

export const DEFAULT_ADMIN_PIN = '2200564603';

export const DEFAULT_CONFIG: QuizConfig = {
  title: 'اختبار القدرات العامة (القسم اللفظي 1 - محاكاة محوسبة 2026)',
  description: 'اختبار تجريبي تفاعلي من 13 سؤالاً يحاكي القسم 1 من أقسام اللفظي مع مؤقت وتصحيح آلي فوري.',
  durationMinutes: 13,
  shuffleQuestions: false,
  allowReview: true,
  passPercentage: 60,
  adminPin: DEFAULT_ADMIN_PIN
};

// 13 Authentic Verbal Questions from Section 1 (القسم 1)
export const DEFAULT_VERBAL_13_QUESTIONS: Question[] = [
  {
    id: 'q_sec1_1',
    text: 'التناظر اللفظي: (ثوب : جسم)',
    options: ['خشب : طاولة', 'قدم : حذاء', 'قماش : خياط', 'قبعة : رأس'],
    correctIndex: 3,
    explanation: 'العلاقة إحاطة وستر؛ فالثوب يحيط بالجسم ويستره، والقبعة تحيط بالرأس وتستره.',
    category: 'لفظي'
  },
  {
    id: 'q_sec1_2',
    text: 'التناظر اللفظي: (شظف : رخاء)',
    options: ['ترح : مرح', 'بذور : جذور', 'إذاعة : تلفاز', 'بذل : عطاء'],
    correctIndex: 0,
    explanation: 'العلاقة تضاد؛ فشظف العيش يقابله الرخاء، والترح (الحزن والغم) يقابله المرح والسرور.',
    category: 'لفظي'
  },
  {
    id: 'q_sec1_3',
    text: 'التناظر اللفظي: (قلم : كتابة)',
    options: ['تعليم : معلم', 'رسام : رسم', 'حصاد : حصادة', 'تحذير : محذر'],
    correctIndex: 1,
    explanation: 'العلاقة أداة ووظيفتها؛ فالقلم أداة وظيفته الكتابة، والرسام وظيفته الرسم.',
    category: 'لفظي'
  },
  {
    id: 'q_sec1_4',
    text: 'التناظر اللفظي: (حصان : مضمار)',
    options: ['سفينة : بحر', 'سيارة : طريق', 'طائرة : سماء', 'قطار : سكة'],
    correctIndex: 3,
    explanation: 'العلاقة مسار ومكان سير مقيد ومحدد؛ فالحصان مساره المحدد في السباق المضمار، والقطار مساره المحدد السكة.',
    category: 'لفظي'
  },
  {
    id: 'q_sec1_5',
    text: 'إكمال الجمل: "إذا جلست للناس فكن ...... لقلبك ولنفسك ولا يغرنك اجتماعهم عليك فإنهم يراقبون ظاهرك والله تعالى ..... باطنك."',
    options: ['مستخدماً – يشاهد', 'مجتهداً – يرى', 'مقلباً – يبصر', 'واعظاً – يراقب'],
    correctIndex: 3,
    explanation: 'المعنى: كن ناصحاً وواعظاً لقلبك، فالناس ينظرون إلى الظاهر بينما الله تعالى رقيب على السرائر والبواطن.',
    category: 'لفظي'
  },
  {
    id: 'q_sec1_6',
    text: 'إكمال الجمل: "الطلاقة ...... ملكة تعين الإنسان على حسن ..... والإقناع."',
    options: ['الشعرية – التوازي', 'الحسية – الاستنطاق', 'الفكرية – الاستماع', 'اللفظية – التعبير'],
    correctIndex: 3,
    explanation: 'الطلاقة اللفظية ملكة بيانية تعين المتحدث على حسن التعبير عن أفكاره وقدرته على الإقناع.',
    category: 'لفظي'
  },
  {
    id: 'q_sec1_7',
    text: 'الخطأ السياقي: "أسوأ الناس من إذا هجوته سكت ، وإذا مدحته خجل."',
    options: ['أسوأ', 'سكت', 'هجوته', 'خجل'],
    correctIndex: 0,
    explanation: 'الكلمة الخاطئة سياقياً هي (أسوأ)، والتصحيح: (أكرم / أفضل الناس) من يترفع عن رد الهجاء ويخجل عند المدح.',
    category: 'لفظي'
  },
  {
    id: 'q_sec1_8',
    text: 'الخطأ السياقي: "لا تجعل الغضب مانعاً للإنتقام."',
    options: ['تجعل', 'الغضب', 'مانعاً', 'للإنتقام'],
    correctIndex: 2,
    explanation: 'الكلمة الخاطئة سياقياً هي (مانعاً)، والتصحيح: (دافعاً / سبباً للانتقام)؛ لأن الغضب يدفع للإنتقام ولا يمنعه.',
    category: 'لفظي'
  },
  {
    id: 'q_sec1_9',
    text: 'استيعاب المقروء (قطعة المعادلة الظالمة): يفهم من النص أن يكون الإنسان:',
    passage: 'يشعر كثير من الناس بالعدوانية والسبب في هذه المشاعر السيئة هو الاستغراب في مستنقع مخيف، وهو المقارنة والإشكالية في هذا أن هؤلاء قد غاب عنهم أنهم نسيج وحدهم و غاب عنهم أنهم ليسوا مطالبين بأن يكونوا مثل فلان وفلان ، قد خلق الله كل إنسان بصفة تميز لمسة تفرد، إن النجاح الحقيقي لا يكون بمقارنة أوضاعك بالآخرين أو إنجازاتك بإنجازاتهم أو موقعك بموقعهم فهذا درب ينسف العطاءات ويقتل الطموحات. إن الرأي القاصر يكمن في الحكم على ذواتنا بمعايير عالية ومقاييس جادة في حين نحكم على الآخرين وبأفعالهم ، ونجاحك الحقيقي يحدده التقارب بين إنجازاتك وقدراتك واستغلال مواهبك واستثمار قدراتك، وإن كنت ولا بد من طالب النجاح فلا خيار لديك غير بذل الجهد والاستعداد التام لدفع الثمن والصعود خطوة خطوة على قدميك.',
    options: ['مستقلاً', 'تابعاً', 'ناجحاً', 'متغيراً'],
    correctIndex: 0,
    explanation: 'الحل (أ): يدعو النص إلى استقلال الإنسان بذاته وتفرده، وعدم مقارنة نفسه بالآخرين أو التبعية لهم.',
    category: 'لفظي'
  },
  {
    id: 'q_sec1_10',
    text: 'استيعاب المقروء (قطعة المطر الحمضي): يفهم من الفقرة السابقة أن:',
    passage: 'يعتبر المطر الحمضي من أخطر مشكلات البيئة التي تواجهها، ويؤثر على قطاع كبير منها.',
    options: ['مشكلات البيئة تواجه عقبات', 'المطر له مخاطر', 'المطر جزء من مشكلات البيئة', 'البيئة تتأثر بالمطر'],
    correctIndex: 3,
    explanation: 'الحل (د): النص بيّن صراحة أن المطر الحمضي يؤثر تأثيراً مباشراً وخطيراً على قطاع كبير من البيئة.',
    category: 'لفظي'
  },
  {
    id: 'q_sec1_11',
    text: 'استيعاب المقروء (قطعة الزلزال): يفهم من الفقرتين (1) و (2) أن عدد ضحايا الزلزال يرتبط بـ:',
    passage: '(1) منذ بدء تسجيل الزلازل علمياً فإن أعنف الزلازل كانت على النحو التالي بمقياس ريختر: زلزال تشيلي عام (1960) فقد سجل 9.5، وقتل ألفي شخص، وشرد ثلاثة آلاف آخرين، كما انتقلت هزاته إلى جزر هاواي، وقتلت 61 شخصاً، وإلى اليابان حيث قضت على 138 شخصاً، وزلزال ألاسكا عام 1964 الذي وصلت قوته إلى 9.2 درجات، ويعد أعنف زلزال شهده النصف الشمالي من الأرض، وتسبب بوفاة 125 شخصاً.\n(2) وزلزال جزر أندريانوف عام 1957 في ألاسكا أيضاً وبلغت قوته 9.1 درجات، وقد دمر جزيرة أداك بصورة كاملة، كما تسبب في تدمير حوض السفن في جزيرة إنماك المجاورة، وخطوط النفط الضخمة في منطقة ساندباي. وزلزال كمتشكه عام 1952م الذي بلغت قوته تسع درجات وضرب منطقة كمتشكه على الحدود بين اليابان وروسيا وإن لم يسفر عن خسائر في الأرواح، واقتصرت أضراره على الماديات فقط، والزلزال الذي وقع قبالة سواحل سومطرة في نهاية ديسمبر عام 2004م وبلغت قوته 8.9 درجات، وقضى على أكثر من 200 ألف شخص، إضافة إلى الخسائر المادية الجسيمة.',
    options: ['بقوة الزلزال', 'بتاريخ وقوعه', 'بنوع المكان', 'بتعدد حدوثه'],
    correctIndex: 2,
    explanation: 'الحل (ج): يوضح النص أن عدد الضحايا يرتبط بنوع المكان وكثافة سكانه؛ فبينما بلغت قوة زلزال كمتشكه 9 درجات ولم يسفر عن ضحايا في الأرواح، فإن زلزال سومطرة بقوة 8.9 أودى بأكثر من 200 ألف شخص.',
    category: 'لفظي'
  },
  {
    id: 'q_sec1_12',
    text: 'استيعاب المقروء (قطعة مرض السكري): تعد جملة "سيشعر المصاب بالسكري بالحاجة الدائمة إلى التبول..." في النص:',
    passage: 'يعد مرض السكري من الأمراض المنتشرة في هذا العصر، ومتى أهمل المريض علاجه والسيطرة عليه فقد يؤدي إلى مضاعفات خطيرة، بل ربما إلى الوفاة المبكرة، ويعد العامل الوراثي أحد أسباب هذا المرض، وقد يكون لأسباب أخرى. ولهذا المرض أعراض كثيرة منها: الشعور بالعطش بشكل كبير بسبب زيادة معدل الجلوكوز في الجسم، والذي يعمل على خروج المياه من أنسجة الجسم ويشعرك بجفاف الفم والحلق، مما يؤدي إلى تناول كميات كبيرة من الماء والسوائل، وبالتالي سيشعر المصاب بالسكري بالحاجة الدائمة إلى التبول، ومن الأعراض أيضاً الشعور بالتعب والدوار بشكل مستمر، فتصبح الرؤية لدى المريض ضبابية وغير واضحة ومشوشة، وكذلك الشعور بالصداع والإحساس بالقلق والتوتر، مما يؤدي إلى سرعة الغضب لأبسط الأمور. ومن أبرز تلك الأعراض البطء في اندمال الجروح والإصابات.',
    options: ['سبباً لما قبله', 'نتيجة لما قبلها', 'تأكيداً لما بعدها', 'تمهيداً لما بعدها'],
    correctIndex: 1,
    explanation: 'الحل (ب): عبارة (وبالتالي سيشعر المصاب...) توضح أنها نتيجة لما قبلها من تناول كميات كبيرة من الماء والسوائل.',
    category: 'لفظي'
  },
  {
    id: 'q_sec1_13',
    text: 'استيعاب المقروء (قطعة إدارة المراعي): نستنبط من النص أن تقنية «غمر الأرض» تؤدي إلى زيادة:',
    passage: 'من سبل إدارة المراعي على نحو مثمر: إنشاء سدود ترابية وعقوم وحواجز من أجل توزيع مياه الأمطار والاستفادة من مياه الجريان السطحي ونشرها على أراضي المراعي المجاورة والصالحة؛ لنمو النباتات. وقد تصل أحياناً كمية المياه المستخدمة في غمر الأرض الرعوية بهذه الطريقة ما نسبته 5 إلى 10 أمثال الهطول المطري، ويتوقف ذلك على كفاءة الطريقة المستخدمة؛ مما يساعد على عدم اعتماد الرعاة في تغذية حيواناتهم على الأعلاف المروية تقليدياً؛ ويعني بالتالي توفير كميات هائلة من مياه الآبار التي تستخدم في ري محاصيل الأعلاف.',
    options: ['هطول الأمطار', 'المياه الجوفية المستهلكة', 'المياه المستفاد منها', 'المياه السطحية الموفرة'],
    correctIndex: 2,
    explanation: 'الحل (ج): تقنية غمر الأرض بالسدود والعقوم تؤدي إلى زيادة كمية المياه المستفاد منها بنسبة 5 إلى 10 أمثال الهطول المعتاد.',
    category: 'لفظي'
  }
];

export const StorageService = {
  getQuiz(): QuizData {
    const raw = localStorage.getItem(STORAGE_KEYS.QUIZ);
    if (!raw) {
      const initial: QuizData = {
        title: DEFAULT_CONFIG.title,
        sourceFilename: 'أقسام_اللفظي_1_-_50_(القسم_1).pdf',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        questions: DEFAULT_VERBAL_13_QUESTIONS
      };
      localStorage.setItem(STORAGE_KEYS.QUIZ, JSON.stringify(initial));
      // Do NOT push default quiz to server on visitor load so teacher's custom quiz is never overwritten
      return initial;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return {
        title: DEFAULT_CONFIG.title,
        questions: DEFAULT_VERBAL_13_QUESTIONS,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
  },

  async syncQuizFromServer(): Promise<QuizData | null> {
    try {
      const res = await fetch('/api/quiz');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.questions) && data.questions.length > 0) {
          localStorage.setItem(STORAGE_KEYS.QUIZ, JSON.stringify(data));
          return data;
        }
      }
    } catch (e) {
      console.warn('Could not sync quiz from server:', e);
    }
    return null;
  },

  async syncQuizToServer(quiz: QuizData): Promise<void> {
    if (!this.isAdminAuthenticated()) return;
    try {
      await fetch('/api/quiz', {
        method: 'POST',
        headers: this.getAdminHeaders(true),
        body: JSON.stringify(quiz)
      });
    } catch (e) {
      console.warn('Could not sync quiz to server:', e);
    }
  },

  saveQuiz(quiz: QuizData): void {
    if (!this.isAdminAuthenticated()) return;
    quiz.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.QUIZ, JSON.stringify(quiz));
    this.syncQuizToServer(quiz).catch(() => {});
  },

  getSections(): QuizSection[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SECTIONS);
      const vaultRaw = localStorage.getItem(STORAGE_KEYS.VAULT_SECTIONS);
      const local = raw ? JSON.parse(raw) : [];
      const vault = vaultRaw ? JSON.parse(vaultRaw) : [];
      const consolidated = mergeSections(
        DEFAULT_QUDURAT_SECTIONS,
        [...(Array.isArray(local) ? local : []), ...(Array.isArray(vault) ? vault : [])]
      );
      return consolidated;
    } catch {
      return DEFAULT_QUDURAT_SECTIONS;
    }
  },

  async syncSectionsFromServer(): Promise<QuizSection[]> {
    try {
      const res = await fetch('/api/sections');
      if (res.ok) {
        const serverSections = await res.json();
        if (Array.isArray(serverSections) && serverSections.length > 0) {
          const current = this.getSections();
          const merged = mergeSections(current, serverSections);
          this.saveSections(merged, false);
          return merged;
        }
      }
    } catch (e) {
      console.warn('Could not sync sections from server:', e);
    }
    return this.getSections();
  },

  saveSections(sections: QuizSection[], syncToServer = true): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SECTIONS, JSON.stringify(sections));
      localStorage.setItem(STORAGE_KEYS.VAULT_SECTIONS, JSON.stringify(sections));
    } catch {
      // ignore
    }
    if (syncToServer && this.isAdminAuthenticated()) {
      fetch('/api/sections', {
        method: 'POST',
        headers: this.getAdminHeaders(true),
        body: JSON.stringify(sections)
      }).catch(() => {});
    }
  },

  saveSectionQuestions(
    sectionId: string,
    questions: Question[],
    sourceFilename?: string,
    customTitle?: string
  ): QuizSection[] {
    const sections = [...this.getSections()];
    const index = sections.findIndex((s) => s.id === sectionId);
    if (index >= 0) {
      sections[index] = {
        ...sections[index],
        questions,
        ...(sourceFilename ? { sourceFilename } : {}),
        ...(customTitle ? { title: customTitle } : {})
      };
    } else {
      sections.push({
        id: sectionId,
        sectionNumber: sections.length + 1,
        title: customTitle || `القسم (${sections.length + 1})`,
        sourceFilename: sourceFilename || 'custom_section.pdf',
        questions
      });
    }
    this.saveSections(sections);
    return sections;
  },

  getSubjectBanks(): SubjectBanksMap {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SUBJECT_BANKS);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  },

  async syncSubjectBanksFromServer(): Promise<SubjectBanksMap> {
    try {
      const res = await fetch('/api/subject-banks', { cache: 'no-store' });
      if (res.ok) {
        const remote = await res.json();
        if (remote && typeof remote === 'object') {
          localStorage.setItem(STORAGE_KEYS.SUBJECT_BANKS, JSON.stringify(remote));
          return remote;
        }
      }
    } catch (e) {
      console.warn('Could not sync subject banks from server:', e);
    }
    return this.getSubjectBanks();
  },

  saveSubjectBank(entry: SubjectBankEntry): SubjectBanksMap {
    const current = this.getSubjectBanks();
    if (!this.isAdminAuthenticated()) {
      return current;
    }
    const updatedEntry: SubjectBankEntry = {
      ...entry,
      updatedAt: new Date().toISOString()
    };
    const nextMap: SubjectBanksMap = {
      ...current,
      [entry.bankKey]: updatedEntry
    };
    try {
      localStorage.setItem(STORAGE_KEYS.SUBJECT_BANKS, JSON.stringify(nextMap));
    } catch {
      // ignore storage quota errors
    }

    fetch(`/api/subject-banks/${encodeURIComponent(entry.bankKey)}`, {
      method: 'POST',
      headers: this.getAdminHeaders(true),
      body: JSON.stringify(updatedEntry)
    }).catch((err) => {
      console.warn('Could not save subject bank to server:', err);
    });

    return nextMap;
  },

  deleteSubjectBank(bankKey: string): SubjectBanksMap {
    const current = this.getSubjectBanks();
    if (!this.isAdminAuthenticated()) {
      return current;
    }
    const nextMap: SubjectBanksMap = { ...current };
    delete nextMap[bankKey];
    try {
      localStorage.setItem(STORAGE_KEYS.SUBJECT_BANKS, JSON.stringify(nextMap));
    } catch {
      // ignore
    }

    fetch(`/api/subject-banks/${encodeURIComponent(bankKey)}`, {
      method: 'DELETE',
      headers: this.getAdminHeaders(false)
    }).catch((err) => {
      console.warn('Could not delete subject bank on server:', err);
    });

    return nextMap;
  },

  getCurrentSectionId(): string {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_SECTION) || 'sec_1';
  },

  loadSection(sectionId: string, persistToServer = false): QuizData {
    const sections = this.getSections();
    const sec =
      sections.find((s) => s.id === sectionId) || sections[0] || DEFAULT_QUDURAT_SECTIONS[0];
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SECTION, sec.id);

    const sectionQuizData: QuizData = {
      title: `اختبار القدرات العامة (${sec.title} - محاكاة محوسبة 2026)`,
      sourceFilename: sec.sourceFilename,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      questions: sec.questions
    };

    localStorage.setItem(STORAGE_KEYS.QUIZ, JSON.stringify(sectionQuizData));
    if (persistToServer) {
      this.syncQuizToServer(sectionQuizData).catch(() => {});
    }
    return sectionQuizData;
  },

  resetToDefaultQuiz(): QuizData {
    return this.loadSection('sec_1', true);
  },

  loadReference13MathQuiz(): QuizData {
    const refQuestions: Question[] = Array.from({ length: 13 }, (_, i) => {
      const n = i + 1;
      const ans = n + n;
      return {
        id: `ref_q_${n}`,
        text: `What is ${n} + ${n}? (ما هو ناتج ${n} + ${n}؟)`,
        options: [`${ans}`, `${ans + 1}`, `${ans + 2}`, `${ans + 3}`],
        correctIndex: 0,
        explanation: `${n} + ${n} = ${ans}`,
        category: 'كمي'
      };
    });

    const refData: QuizData = {
      title: 'اختبار القدرات (نموذج الموقع الأصلي - 13 سؤالاً)',
      sourceFilename: 'sample.pdf',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      questions: refQuestions
    };
    localStorage.setItem(STORAGE_KEYS.QUIZ, JSON.stringify(refData));
    this.syncQuizToServer(refData).catch(() => {});
    return refData;
  },

  getTombstones(): ClientTombstones {
    return readClientTombstones();
  },

  addTombstone(category: 'results' | 'feedback' | 'questions', id: string): void {
    if (!id || typeof id !== 'string') return;
    try {
      const current = this.getTombstones();
      if (!current[category].includes(id)) {
        current[category].push(id);
        localStorage.setItem(STORAGE_KEYS.TOMBSTONES, JSON.stringify(current));
      }
    } catch {}
  },

  mergeServerTombstones(serverDeleted: Partial<ClientTombstones>): void {
    if (!serverDeleted) return;
    try {
      const current = this.getTombstones();
      let changed = false;
      for (const cat of ['results', 'feedback', 'questions'] as const) {
        const list = serverDeleted[cat];
        if (Array.isArray(list)) {
          for (const id of list) {
            if (id && !current[cat].includes(id)) {
              current[cat].push(id);
              changed = true;
            }
          }
        }
      }
      if (changed) {
        localStorage.setItem(STORAGE_KEYS.TOMBSTONES, JSON.stringify(current));
      }
    } catch {}
  },

  async syncDeletedIdsFromServer(): Promise<ClientTombstones> {
    try {
      const res = await fetch('/api/deleted-ids');
      if (res.ok) {
        const remoteDeleted = await res.json();
        this.mergeServerTombstones(remoteDeleted);
      }
    } catch {}
    return this.getTombstones();
  },

  getResults(): StudentResult[] {
    const tombstones = this.getTombstones();
    const deletedSet = new Set(tombstones.results);

    const raw = localStorage.getItem(STORAGE_KEYS.RESULTS);
    if (!raw) {
      return this.getVaultResults().filter((r) => r && r.id && !deletedSet.has(r.id));
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((r) => r && r.id && !deletedSet.has(r.id))
        : this.getVaultResults().filter((r) => r && r.id && !deletedSet.has(r.id));
    } catch {
      return this.getVaultResults().filter((r) => r && r.id && !deletedSet.has(r.id));
    }
  },

  getVaultResults(): StudentResult[] {
    const tombstones = this.getTombstones();
    const deletedSet = new Set(tombstones.results);
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.VAULT_RESULTS);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter((r) => r && r.id && !deletedSet.has(r.id)) : [];
    } catch {
      return [];
    }
  },

  getPendingResults(): StudentResult[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PENDING_RESULTS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  setPendingResults(queue: StudentResult[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PENDING_RESULTS, JSON.stringify(queue));
    } catch {
      // ignore storage quota errors
    }
  },

  async flushPendingResults(): Promise<void> {
    const pending = this.getPendingResults();
    if (pending.length === 0) return;

    const remaining: StudentResult[] = [];
    for (const item of pending) {
      const ok = await this.syncResultToServer(item);
      if (!ok) {
        remaining.push(item);
      }
    }
    this.setPendingResults(remaining);
  },

  async syncResultsFromServer(): Promise<StudentResult[]> {
    await this.flushPendingResults();
    const tombstones = this.getTombstones();
    const deletedSet = new Set(tombstones.results);

    try {
      const res = await fetch('/api/results', {
        headers: this.getAdminHeaders(false)
      });
      if (res.ok) {
        const serverResults: StudentResult[] = await res.json();
        if (Array.isArray(serverResults)) {
          const filteredServer = serverResults.filter((r) => r && r.id && !deletedSet.has(r.id));
          const local = this.getResults();
          const vault = this.getVaultResults();
          const pending = this.getPendingResults().filter((r) => r && r.id && !deletedSet.has(r.id));
          // Strictly non-destructive merge: NEVER wipe existing student scores, permanently honoring tombstones!
          const merged = mergeStudentResults([...local, ...vault, ...pending], filteredServer, deletedSet);
          
          localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(merged));
          localStorage.setItem(STORAGE_KEYS.VAULT_RESULTS, JSON.stringify(merged));

          // If local had results that the server was missing (e.g. fresh container or restarted server)
          // immediately re-seed the server so no data is lost!
          if (merged.length > filteredServer.length) {
            this.reconcileWithServer({ results: merged }).catch(() => {});
          }

          return merged;
        }
      }
    } catch (e) {
      console.warn('Could not sync results from server:', e);
    }
    return this.getResults();
  },

  async syncResultToServer(result: StudentResult): Promise<boolean> {
    try {
      const res = await fetch('/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      });
      return res.ok;
    } catch (e) {
      console.warn('Failed to post result to server:', e);
      return false;
    }
  },

  saveResult(result: StudentResult): void {
    const tombstones = this.getTombstones();
    const deletedSet = new Set(tombstones.results);
    const list = mergeStudentResults(this.getResults(), [result], deletedSet);
    localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(list));
    localStorage.setItem(STORAGE_KEYS.VAULT_RESULTS, JSON.stringify(list));

    // Queue until confirmed saved on server so no student submission is ever lost
    const pending = this.getPendingResults().filter((r) => r.id !== result.id && !deletedSet.has(r.id));
    pending.push(result);
    this.setPendingResults(pending);

    this.syncResultToServer(result).then((ok) => {
      if (ok) {
        const updatedPending = this.getPendingResults().filter((r) => r.id !== result.id);
        this.setPendingResults(updatedPending);
      }
    });
  },

  deleteResult(id: string): void {
    if (!this.isAdminAuthenticated()) return;
    if (!id) return;

    // 1. Permanently record tombstone
    this.addTombstone('results', id);

    // 2. Immediately strip from primary results, vault results, and pending queue
    const list = this.getResults().filter((r) => r.id !== id);
    localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(list));

    const vault = this.getVaultResults().filter((r) => r.id !== id);
    localStorage.setItem(STORAGE_KEYS.VAULT_RESULTS, JSON.stringify(vault));

    this.setPendingResults(this.getPendingResults().filter((r) => r.id !== id));

    // 3. Dispatch delete to server
    fetch(`/api/results/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.getAdminHeaders(false)
    }).catch(() => {});
  },

  clearAllResults(): void {
    if (!this.isAdminAuthenticated()) return;
    // Clear active list view but keep disaster recovery vault intact for supervisor
    localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify([]));
    this.setPendingResults([]);
    fetch('/api/results', {
      method: 'DELETE',
      headers: this.getAdminHeaders(false)
    }).catch(() => {});
  },

  getConfig(): QuizConfig {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (!raw) {
      return { ...DEFAULT_CONFIG, adminPin: this.getAdminPin() };
    }
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw), adminPin: this.getAdminPin() };
    } catch {
      return { ...DEFAULT_CONFIG, adminPin: this.getAdminPin() };
    }
  },

  async syncConfigFromServer(): Promise<QuizConfig | null> {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const remoteCfg = await res.json();
        if (remoteCfg && typeof remoteCfg === 'object' && Object.keys(remoteCfg).length > 0) {
          const current = this.getConfig();
          const merged: QuizConfig = {
            ...current,
            ...(typeof remoteCfg.title === 'string' ? { title: remoteCfg.title } : {}),
            ...(typeof remoteCfg.description === 'string' ? { description: remoteCfg.description } : {}),
            ...(typeof remoteCfg.durationMinutes === 'number' ? { durationMinutes: remoteCfg.durationMinutes } : {}),
            ...(typeof remoteCfg.shuffleQuestions === 'boolean' ? { shuffleQuestions: remoteCfg.shuffleQuestions } : {}),
            ...(typeof remoteCfg.allowReview === 'boolean' ? { allowReview: remoteCfg.allowReview } : {}),
            ...(typeof remoteCfg.passPercentage === 'number' ? { passPercentage: remoteCfg.passPercentage } : {}),
            ...(typeof remoteCfg.activeSectionId === 'string' ? { activeSectionId: remoteCfg.activeSectionId } : {}),
            ...(typeof remoteCfg.customPublicUrl === 'string' ? { customPublicUrl: remoteCfg.customPublicUrl } : {}),
            adminPin: this.getAdminPin()
          };
          localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(merged));
          return merged;
        }
      }
    } catch (e) {
      console.warn('Could not sync config from server:', e);
    }
    return null;
  },

  saveConfig(config: Partial<QuizConfig>): void {
    if (!this.isAdminAuthenticated()) return;
    const current = this.getConfig();
    const updated = { ...current, ...config };
    if (config.adminPin) {
      this.setAdminPin(config.adminPin);
    }
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(updated));

    const { adminPin: _pin, ...publicPayload } = updated;
    fetch('/api/config', {
      method: 'POST',
      headers: this.getAdminHeaders(true),
      body: JSON.stringify(publicPayload)
    }).catch(() => {});
  },

  getClientId(): string {
    try {
      const existing = localStorage.getItem(STORAGE_KEYS.CLIENT_ID);
      if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) {
        return existing;
      }
      const generated =
        'cid_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 12);
      localStorage.setItem(STORAGE_KEYS.CLIENT_ID, generated);
      return generated;
    } catch {
      return 'cid_fallback_browser';
    }
  },

  getAdminToken(): string {
    try {
      return sessionStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN) || '';
    } catch {
      return '';
    }
  },

  getAdminHeaders(includeJsonContentType = true): Record<string, string> {
    const headers: Record<string, string> = {
      'X-Client-Id': this.getClientId()
    };
    if (includeJsonContentType) {
      headers['Content-Type'] = 'application/json';
    }
    const token = this.getAdminToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },

  getLocalLockoutRecord(): LockoutRecord | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ADMIN_LOCKOUT);
      if (!raw) return null;
      return JSON.parse(raw) as LockoutRecord;
    } catch {
      return null;
    }
  },

  saveLocalLockoutRecord(record: LockoutRecord): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ADMIN_LOCKOUT, JSON.stringify(record));
    } catch {
      // ignore
    }
  },

  getLocalLockoutState(nowMs: number = Date.now()): LockoutEvaluation {
    const record = this.getLocalLockoutRecord();
    return evaluateLockoutState(record, nowMs);
  },

  async fetchAdminAuthStatus(): Promise<
    LockoutEvaluation & { authenticated: boolean; currentPin?: string }
  > {
    try {
      const res = await fetch('/api/admin/status', {
        headers: this.getAdminHeaders(false),
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        const syncedRecord: LockoutRecord = {
          failedAttempts: typeof data.failedAttempts === 'number' ? data.failedAttempts : 0,
          lockedUntil: typeof data.lockedUntil === 'number' ? data.lockedUntil : null
        };
        this.saveLocalLockoutRecord(syncedRecord);
        const evalState = evaluateLockoutState(syncedRecord);
        const authenticated = Boolean(data.authenticated);
        if (!authenticated && this.isAdminAuthenticated()) {
          this.setAdminAuthenticated(false);
        }
        if (authenticated && typeof data.currentPin === 'string' && data.currentPin.trim()) {
          this.setAdminPin(data.currentPin.trim());
        }
        return {
          ...evalState,
          authenticated,
          ...(typeof data.currentPin === 'string' ? { currentPin: data.currentPin } : {})
        };
      }
    } catch {
      // fallback to local lockout state
    }
    return {
      ...this.getLocalLockoutState(),
      authenticated: this.isAdminAuthenticated()
    };
  },

  async loginAdmin(
    enteredPin: string
  ): Promise<{ success: boolean; status: LockoutEvaluation; error?: string }> {
    const trimmed = enteredPin.trim();
    const localPreCheck = this.getLocalLockoutState();
    if (localPreCheck.isLocked) {
      return {
        success: false,
        status: localPreCheck,
        error: 'تم قفل محاولات تسجيل الدخول لمدة ساعة كاملة بسبب ٤ محاولات خاطئة متتالية.'
      };
    }

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: this.getAdminHeaders(true),
        body: JSON.stringify({ pin: trimmed })
      });
      const data = await res.json();

      if (res.ok && data.success && typeof data.token === 'string') {
        sessionStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, data.token);
        sessionStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, 'true');
        this.saveLocalLockoutRecord(resetLockoutRecord());
        this.setAdminPin(trimmed);
        return {
          success: true,
          status: evaluateLockoutState(null)
        };
      }

      const nextRecord: LockoutRecord = {
        failedAttempts: typeof data.failedAttempts === 'number' ? data.failedAttempts : 0,
        lockedUntil: typeof data.lockedUntil === 'number' ? data.lockedUntil : null
      };
      this.saveLocalLockoutRecord(nextRecord);
      this.setAdminAuthenticated(false);
      return {
        success: false,
        status: evaluateLockoutState(nextRecord),
        error: typeof data.error === 'string' ? data.error : 'رمز الدخول غير صحيح.'
      };
    } catch {
      // Offline fallback enforcing the exact same 4-attempt 1-hour lockout
      if (this.verifyAdminPin(trimmed)) {
        sessionStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, 'local_offline_token');
        sessionStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, 'true');
        this.saveLocalLockoutRecord(resetLockoutRecord());
        return { success: true, status: evaluateLockoutState(null) };
      }
      const { nextRecord, status } = recordFailedLoginAttempt(this.getLocalLockoutRecord());
      this.saveLocalLockoutRecord(nextRecord);
      this.setAdminAuthenticated(false);
      return {
        success: false,
        status,
        error: status.isLocked
          ? 'تم قفل محاولات تسجيل الدخول لمدة ساعة كاملة بسبب إدخال الرمز خطأ ٤ مرات متتالية.'
          : 'رمز الدخول غير صحيح.'
      };
    }
  },

  async logoutAdmin(): Promise<void> {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: this.getAdminHeaders(true)
      });
    } catch {
      // ignore
    }
    this.setAdminAuthenticated(false);
  },

  async changeAdminPin(newPin: string): Promise<boolean> {
    const trimmed = newPin.trim();
    if (trimmed.length < 3 || !this.isAdminAuthenticated()) return false;
    try {
      const res = await fetch('/api/admin/change-pin', {
        method: 'POST',
        headers: this.getAdminHeaders(true),
        body: JSON.stringify({ newPin: trimmed })
      });
      if (res.ok) {
        this.setAdminPin(trimmed);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  getAdminPin(): string {
    const saved = localStorage.getItem(STORAGE_KEYS.ADMIN_PIN);
    if (!saved || saved === '1234') {
      localStorage.setItem(STORAGE_KEYS.ADMIN_PIN, DEFAULT_ADMIN_PIN);
      return DEFAULT_ADMIN_PIN;
    }
    return saved;
  },

  setAdminPin(pin: string): void {
    localStorage.setItem(STORAGE_KEYS.ADMIN_PIN, pin.trim());
  },

  verifyAdminPin(enteredPin: string): boolean {
    const currentPin = this.getAdminPin();
    return enteredPin.trim() === currentPin.trim();
  },

  isAdminAuthenticated(): boolean {
    return (
      sessionStorage.getItem(STORAGE_KEYS.ADMIN_AUTH) === 'true' &&
      Boolean(sessionStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN))
    );
  },

  setAdminAuthenticated(auth: boolean): void {
    if (auth) {
      sessionStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, 'true');
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH);
      sessionStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
    }
  },

  // ====================== Student Questions Tracking & Privacy ======================
  getMyQuestionIds(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.MY_QUESTION_IDS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  addMyQuestionId(id: string): void {
    try {
      const ids = this.getMyQuestionIds();
      if (!ids.includes(id)) {
        ids.push(id);
        localStorage.setItem(STORAGE_KEYS.MY_QUESTION_IDS, JSON.stringify(ids));
      }
    } catch {
      // ignore
    }
  },

  removeMyQuestionId(id: string): void {
    try {
      const ids = this.getMyQuestionIds().filter((existing) => existing !== id);
      localStorage.setItem(STORAGE_KEYS.MY_QUESTION_IDS, JSON.stringify(ids));
    } catch {
      // ignore
    }
  },

  getSavedStudentName(): string {
    try {
      return localStorage.getItem(STORAGE_KEYS.STUDENT_NAME) || '';
    } catch {
      return '';
    }
  },

  setSavedStudentName(name: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.STUDENT_NAME, name.trim());
    } catch {
      // ignore
    }
  },

  // ====================== Student Questions ======================
  async getStudentQuestions(): Promise<StudentQuestionItem[]> {
    const tombstones = this.getTombstones();
    const deletedSet = new Set(tombstones.questions);

    const local = safeJsonParse<StudentQuestionItem[]>(
      localStorage.getItem(STORAGE_KEYS.STUDENT_QUESTIONS),
      []
    ).filter((item) => item && item.id && !deletedSet.has(item.id));

    const vault = safeJsonParse<StudentQuestionItem[]>(
      localStorage.getItem(STORAGE_KEYS.VAULT_QUESTIONS),
      []
    ).filter((item) => item && item.id && !deletedSet.has(item.id));

    let consolidated = mergeStudentQuestions(local, vault, deletedSet);

    try {
      const res = await fetch('/api/student-questions', {
        headers: this.getAdminHeaders(false)
      });
      if (res.ok) {
        const serverData = await res.json();
        if (Array.isArray(serverData)) {
          const filteredServer = serverData.filter((item) => item && item.id && !deletedSet.has(item.id));
          consolidated = mergeStudentQuestions(consolidated, filteredServer, deletedSet);
          if (consolidated.length > filteredServer.length) {
            this.reconcileWithServer({ studentQuestions: consolidated }).catch(() => {});
          }
        }
      }
    } catch {
      // fallback to consolidated local
    }

    try {
      localStorage.setItem(STORAGE_KEYS.STUDENT_QUESTIONS, JSON.stringify(consolidated));
      localStorage.setItem(STORAGE_KEYS.VAULT_QUESTIONS, JSON.stringify(consolidated));
    } catch {
      // ignore
    }
    return consolidated;
  },

  async addStudentQuestion(q: {
    studentName: string;
    category: string;
    text: string;
    imageUrl?: string;
  }): Promise<StudentQuestionItem> {
    if (q.studentName?.trim()) {
      this.setSavedStudentName(q.studentName.trim());
    }

    try {
      const res = await fetch('/api/student-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(q)
      });
      if (res.ok) {
        const body = await res.json();
        if (body.question) {
          this.addMyQuestionId(body.question.id);
          const list = await this.getStudentQuestions();
          const filtered = list.filter((item) => item.id !== body.question.id);
          filtered.unshift(body.question);
          localStorage.setItem(STORAGE_KEYS.STUDENT_QUESTIONS, JSON.stringify(filtered));
          localStorage.setItem(STORAGE_KEYS.VAULT_QUESTIONS, JSON.stringify(filtered));
          return body.question;
        }
      }
    } catch {
      // offline/client fallback
    }

    const fallbackItem: StudentQuestionItem = {
      id: 'sq_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
      studentName: q.studentName.trim() || 'طالبة',
      category: q.category || 'لفظي',
      text: q.text.trim(),
      imageUrl: q.imageUrl || '',
      createdAt: new Date().toISOString(),
      replies: []
    };
    this.addMyQuestionId(fallbackItem.id);
    try {
      const list = await this.getStudentQuestions();
      list.unshift(fallbackItem);
      localStorage.setItem(STORAGE_KEYS.STUDENT_QUESTIONS, JSON.stringify(list));
      localStorage.setItem(STORAGE_KEYS.VAULT_QUESTIONS, JSON.stringify(list));
    } catch {
      // ignore
    }
    return fallbackItem;
  },

  async replyToQuestion(
    questionId: string,
    reply: { authorName: string; text: string; isSupervisor?: boolean }
  ): Promise<QuestionReply> {
    try {
      const res = await fetch(`/api/student-questions/${encodeURIComponent(questionId)}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.getAdminHeaders(false) },
        body: JSON.stringify(reply)
      });
      if (res.ok) {
        const body = await res.json();
        if (body.reply) {
          return body.reply;
        }
      }
    } catch {
      // fallback
    }

    const fallbackReply: QuestionReply = {
      id: 'rep_' + Date.now().toString(36),
      authorName: reply.authorName || (reply.isSupervisor ? 'المشرفة الأكاديمية' : 'طالبة'),
      isSupervisor: reply.isSupervisor,
      text: reply.text,
      createdAt: new Date().toISOString()
    };
    try {
      const list = await this.getStudentQuestions();
      const q = list.find((item) => item.id === questionId);
      if (q) {
        if (!Array.isArray(q.replies)) q.replies = [];
        q.replies.push(fallbackReply);
        localStorage.setItem(STORAGE_KEYS.STUDENT_QUESTIONS, JSON.stringify(list));
        localStorage.setItem(STORAGE_KEYS.VAULT_QUESTIONS, JSON.stringify(list));
      }
    } catch {
      // ignore
    }
    return fallbackReply;
  },

  async deleteStudentQuestion(id: string): Promise<boolean> {
    if (!id) return false;
    // 1. Permanently record tombstone
    this.addTombstone('questions', id);
    this.removeMyQuestionId(id);

    // 2. Immediately strip from both primary local storage and immutable vault
    try {
      const local = safeJsonParse<StudentQuestionItem[]>(
        localStorage.getItem(STORAGE_KEYS.STUDENT_QUESTIONS),
        []
      );
      const filteredLocal = local.filter((item) => item.id !== id);
      localStorage.setItem(STORAGE_KEYS.STUDENT_QUESTIONS, JSON.stringify(filteredLocal));

      const vault = safeJsonParse<StudentQuestionItem[]>(
        localStorage.getItem(STORAGE_KEYS.VAULT_QUESTIONS),
        []
      );
      const filteredVault = vault.filter((item) => item.id !== id);
      localStorage.setItem(STORAGE_KEYS.VAULT_QUESTIONS, JSON.stringify(filteredVault));
    } catch {
      // ignore
    }

    // 3. Dispatch delete to server
    try {
      await fetch(`/api/student-questions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: this.getAdminHeaders(false)
      });
    } catch {
      // ignore
    }

    return true;
  },

  // ====================== Platform Feedback ======================
  async getFeedback(): Promise<PlatformFeedbackItem[]> {
    const tombstones = this.getTombstones();
    const deletedSet = new Set(tombstones.feedback);

    const local = safeJsonParse<PlatformFeedbackItem[]>(
      localStorage.getItem(STORAGE_KEYS.FEEDBACK),
      []
    ).filter((item) => item && item.id && !deletedSet.has(item.id));

    const vault = safeJsonParse<PlatformFeedbackItem[]>(
      localStorage.getItem(STORAGE_KEYS.VAULT_FEEDBACK),
      []
    ).filter((item) => item && item.id && !deletedSet.has(item.id));

    let consolidated = mergeFeedbackItems(local, vault, deletedSet);

    try {
      const res = await fetch('/api/feedback');
      if (res.ok) {
        const serverData = await res.json();
        if (Array.isArray(serverData)) {
          const filteredServer = serverData.filter((item) => item && item.id && !deletedSet.has(item.id));
          consolidated = mergeFeedbackItems(consolidated, filteredServer, deletedSet);
          if (consolidated.length > filteredServer.length) {
            this.reconcileWithServer({ feedback: consolidated }).catch(() => {});
          }
        }
      }
    } catch {
      // offline fallback
    }

    try {
      localStorage.setItem(STORAGE_KEYS.FEEDBACK, JSON.stringify(consolidated));
      localStorage.setItem(STORAGE_KEYS.VAULT_FEEDBACK, JSON.stringify(consolidated));
    } catch {
      // ignore
    }
    return consolidated;
  },

  async addFeedback(f: {
    studentName: string;
    rating: number;
    comment: string;
  }): Promise<PlatformFeedbackItem> {
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f)
      });
      if (res.ok) {
        const body = await res.json();
        if (body.feedback) {
          const list = await this.getFeedback();
          const filtered = list.filter((item) => item.id !== body.feedback.id);
          filtered.unshift(body.feedback);
          localStorage.setItem(STORAGE_KEYS.FEEDBACK, JSON.stringify(filtered));
          localStorage.setItem(STORAGE_KEYS.VAULT_FEEDBACK, JSON.stringify(filtered));
          return body.feedback;
        }
      }
    } catch {
      // offline/client fallback
    }

    const fallbackFeedback: PlatformFeedbackItem = {
      id: 'fb_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
      studentName: f.studentName.trim() || 'طالبة',
      rating: Math.max(1, Math.min(5, f.rating || 5)),
      comment: f.comment.trim(),
      createdAt: new Date().toISOString()
    };
    try {
      const list = await this.getFeedback();
      list.unshift(fallbackFeedback);
      localStorage.setItem(STORAGE_KEYS.FEEDBACK, JSON.stringify(list));
      localStorage.setItem(STORAGE_KEYS.VAULT_FEEDBACK, JSON.stringify(list));
    } catch {
      // ignore
    }
    return fallbackFeedback;
  },

  async deleteFeedback(id: string): Promise<boolean> {
    if (!id) return false;
    // 1. Permanently record tombstone
    this.addTombstone('feedback', id);

    // 2. Immediately strip from both primary local storage and immutable vault
    try {
      const local = safeJsonParse<PlatformFeedbackItem[]>(
        localStorage.getItem(STORAGE_KEYS.FEEDBACK),
        []
      );
      const filteredLocal = local.filter((item) => item.id !== id);
      localStorage.setItem(STORAGE_KEYS.FEEDBACK, JSON.stringify(filteredLocal));

      const vault = safeJsonParse<PlatformFeedbackItem[]>(
        localStorage.getItem(STORAGE_KEYS.VAULT_FEEDBACK),
        []
      );
      const filteredVault = vault.filter((item) => item.id !== id);
      localStorage.setItem(STORAGE_KEYS.VAULT_FEEDBACK, JSON.stringify(filteredVault));
    } catch {
      // ignore
    }

    // 3. Dispatch delete to server
    try {
      await fetch(`/api/feedback/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: this.getAdminHeaders(false)
      });
    } catch {
      // ignore
    }

    return true;
  },

  // ====================== Multi-Layer Reconciliation & Backup Tools ======================
  async reconcileWithServer(payload: {
    results?: StudentResult[];
    feedback?: PlatformFeedbackItem[];
    studentQuestions?: StudentQuestionItem[];
    sections?: QuizSection[];
  }): Promise<boolean> {
    try {
      const res = await fetch('/api/sync/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.deletedIds) {
          this.mergeServerTombstones(data.deletedIds);
        }
        const tombstones = this.getTombstones();
        const delRes = new Set(tombstones.results);
        const delFb = new Set(tombstones.feedback);
        const delQ = new Set(tombstones.questions);

        if (data.results && Array.isArray(data.results)) {
          const filteredResults = data.results.filter((r: any) => r && r.id && !delRes.has(r.id));
          localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(filteredResults));
          localStorage.setItem(STORAGE_KEYS.VAULT_RESULTS, JSON.stringify(filteredResults));
        }
        if (data.feedback && Array.isArray(data.feedback)) {
          const filteredFeedback = data.feedback.filter((f: any) => f && f.id && !delFb.has(f.id));
          localStorage.setItem(STORAGE_KEYS.FEEDBACK, JSON.stringify(filteredFeedback));
          localStorage.setItem(STORAGE_KEYS.VAULT_FEEDBACK, JSON.stringify(filteredFeedback));
        }
        if (data.studentQuestions && Array.isArray(data.studentQuestions)) {
          const filteredQuestions = data.studentQuestions.filter((q: any) => q && q.id && !delQ.has(q.id));
          localStorage.setItem(STORAGE_KEYS.STUDENT_QUESTIONS, JSON.stringify(filteredQuestions));
          localStorage.setItem(STORAGE_KEYS.VAULT_QUESTIONS, JSON.stringify(filteredQuestions));
        }
        if (data.sections && Array.isArray(data.sections)) {
          localStorage.setItem(STORAGE_KEYS.SECTIONS, JSON.stringify(data.sections));
          localStorage.setItem(STORAGE_KEYS.VAULT_SECTIONS, JSON.stringify(data.sections));
        }
        return true;
      }
    } catch (e) {
      console.warn('Reconcile request failed:', e);
    }
    return false;
  },

  exportFullBackup(): FullPlatformBackup {
    const tombstones = this.getTombstones();
    const results = this.getResults();
    const vaultResults = this.getVaultResults();
    const allResults = mergeStudentResults(results, vaultResults, tombstones.results);

    const feedback = safeJsonParse<PlatformFeedbackItem[]>(localStorage.getItem(STORAGE_KEYS.FEEDBACK), []);
    const vaultFeedback = safeJsonParse<PlatformFeedbackItem[]>(localStorage.getItem(STORAGE_KEYS.VAULT_FEEDBACK), []);
    const allFeedback = mergeFeedbackItems(feedback, vaultFeedback, tombstones.feedback);

    const questions = safeJsonParse<StudentQuestionItem[]>(localStorage.getItem(STORAGE_KEYS.STUDENT_QUESTIONS), []);
    const vaultQuestions = safeJsonParse<StudentQuestionItem[]>(localStorage.getItem(STORAGE_KEYS.VAULT_QUESTIONS), []);
    const allQuestions = mergeStudentQuestions(questions, vaultQuestions, tombstones.questions);

    const sections = this.getSections();
    const quiz = this.getQuiz();
    const subjectBanks = this.getSubjectBanks();
    const config = this.getConfig();

    return buildBackupPayload({
      results: allResults,
      feedback: allFeedback,
      studentQuestions: allQuestions,
      sections,
      quiz,
      subjectBanks,
      config
    });
  },

  downloadBackupJsonFile(): void {
    const backup = this.exportFullBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `نسخة_احتياطية_منصة_الحديثة_صافيناز_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  async restoreFullBackup(backupData: any, mode: 'merge' | 'replace' = 'merge'): Promise<{ success: boolean; message: string }> {
    if (!backupData || !backupData.data) {
      return { success: false, message: 'ملف النسخة الاحتياطية غير صالح' };
    }
    const incoming = backupData.data;
    const tombstones = this.getTombstones();

    if (mode === 'merge') {
      const mergedRes = mergeStudentResults(this.getResults(), incoming.results || [], tombstones.results);
      localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(mergedRes));
      localStorage.setItem(STORAGE_KEYS.VAULT_RESULTS, JSON.stringify(mergedRes));

      const curFb = safeJsonParse<PlatformFeedbackItem[]>(localStorage.getItem(STORAGE_KEYS.FEEDBACK), []);
      const mergedFb = mergeFeedbackItems(curFb, incoming.feedback || [], tombstones.feedback);
      localStorage.setItem(STORAGE_KEYS.FEEDBACK, JSON.stringify(mergedFb));
      localStorage.setItem(STORAGE_KEYS.VAULT_FEEDBACK, JSON.stringify(mergedFb));

      const curQ = safeJsonParse<StudentQuestionItem[]>(localStorage.getItem(STORAGE_KEYS.STUDENT_QUESTIONS), []);
      const mergedQ = mergeStudentQuestions(curQ, incoming.studentQuestions || [], tombstones.questions);
      localStorage.setItem(STORAGE_KEYS.STUDENT_QUESTIONS, JSON.stringify(mergedQ));
      localStorage.setItem(STORAGE_KEYS.VAULT_QUESTIONS, JSON.stringify(mergedQ));

      if (Array.isArray(incoming.sections) && incoming.sections.length > 0) {
        const mergedSec = mergeSections(this.getSections(), incoming.sections);
        this.saveSections(mergedSec);
      }
    } else {
      if (Array.isArray(incoming.results)) {
        localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(incoming.results));
        localStorage.setItem(STORAGE_KEYS.VAULT_RESULTS, JSON.stringify(incoming.results));
      }
      if (Array.isArray(incoming.feedback)) {
        localStorage.setItem(STORAGE_KEYS.FEEDBACK, JSON.stringify(incoming.feedback));
        localStorage.setItem(STORAGE_KEYS.VAULT_FEEDBACK, JSON.stringify(incoming.feedback));
      }
      if (Array.isArray(incoming.studentQuestions)) {
        localStorage.setItem(STORAGE_KEYS.STUDENT_QUESTIONS, JSON.stringify(incoming.studentQuestions));
        localStorage.setItem(STORAGE_KEYS.VAULT_QUESTIONS, JSON.stringify(incoming.studentQuestions));
      }
      if (Array.isArray(incoming.sections)) {
        this.saveSections(incoming.sections);
      }
      if (incoming.quiz) {
        this.saveQuiz(incoming.quiz);
      }
    }

    try {
      await fetch('/api/backup/restore', {
        method: 'POST',
        headers: this.getAdminHeaders(true),
        body: JSON.stringify({ backup: backupData, mode })
      });
    } catch {
      // server sync fallback
    }

    return {
      success: true,
      message: mode === 'merge' ? 'تم دمج النسخة الاحتياطية بنجاح والحفاظ على جميع السجلات السابقة' : 'تمت استعادة النسخة الاحتياطية بنجاح'
    };
  },

  recoverFromImmutableVault(): { resultsCount: number; feedbackCount: number; questionsCount: number; sectionsCount: number } {
    const vaultResults = this.getVaultResults();
    const vaultFeedback = safeJsonParse<PlatformFeedbackItem[]>(localStorage.getItem(STORAGE_KEYS.VAULT_FEEDBACK), []);
    const vaultQuestions = safeJsonParse<StudentQuestionItem[]>(localStorage.getItem(STORAGE_KEYS.VAULT_QUESTIONS), []);
    const vaultSections = safeJsonParse<QuizSection[]>(localStorage.getItem(STORAGE_KEYS.VAULT_SECTIONS), []);

    if (vaultResults.length > 0) {
      localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(vaultResults));
    }
    if (vaultFeedback.length > 0) {
      localStorage.setItem(STORAGE_KEYS.FEEDBACK, JSON.stringify(vaultFeedback));
    }
    if (vaultQuestions.length > 0) {
      localStorage.setItem(STORAGE_KEYS.STUDENT_QUESTIONS, JSON.stringify(vaultQuestions));
    }
    if (vaultSections.length > 0) {
      this.saveSections(vaultSections);
    }

    this.reconcileWithServer({
      results: vaultResults,
      feedback: vaultFeedback,
      studentQuestions: vaultQuestions,
      sections: vaultSections
    }).catch(() => {});

    return {
      resultsCount: vaultResults.length,
      feedbackCount: vaultFeedback.length,
      questionsCount: vaultQuestions.length,
      sectionsCount: vaultSections.length
    };
  },

  async fetchProtectionStatus(): Promise<{ protected: boolean; shieldActive?: boolean; counts?: any }> {
    try {
      const res = await fetch('/api/backup/status');
      if (res.ok) return await res.json();
    } catch {}
    return {
      protected: true,
      shieldActive: true,
      counts: {
        results: this.getResults().length,
        vaultResults: this.getVaultResults().length,
        sections: this.getSections().length
      }
    };
  }
};

