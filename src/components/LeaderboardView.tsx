import React, { useState } from 'react';
import {
  Trophy,
  Search,
  Clock,
  Play,
  UserCheck,
  Trash2,
  Eye,
  EyeOff,
  Award,
  ShieldCheck,
  RefreshCw,
  Lock,
  KeyRound,
  AlertCircle
} from 'lucide-react';
import { StudentResult } from '../types/quiz';
import { AUTHOR_CREDIT, PLATFORM_FULL_NAME } from '../data/curriculum';
import { formatTime } from '../utils/scoring';
import { StorageService } from '../services/storage';
import { SchoolLogo } from './SchoolLogo';

interface LeaderboardViewProps {
  results: StudentResult[];
  onStartExam: () => void;
  onGoHome: () => void;
  isAdmin?: boolean;
  onAdminUnlock?: () => void;
  onClearResults?: () => void;
  onRefreshResults?: () => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  results,
  onStartExam,
  onGoHome,
  isAdmin,
  onAdminUnlock,
  onClearResults,
  onRefreshResults
}) => {
  const [search, setSearch] = useState('');
  const [hideNames, setHideNames] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Supervisor PIN Gate State
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSupervisorUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = pinInput.trim();
    if (!trimmed) {
      setPinError('يرجى إدخال رمز المشرفة');
      return;
    }
    setIsVerifying(true);
    setPinError('');
    try {
      const res = await StorageService.loginAdmin(trimmed);
      if (res.success) {
        onAdminUnlock?.();
        if (onRefreshResults) await onRefreshResults();
      } else {
        setPinError(res.error || 'رمز الدخول غير صحيح');
      }
    } catch {
      setPinError('تعذر التحقق من الرمز، يرجى المحاولة ثانية');
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 text-slate-800">
        <div className="bg-white rounded-3xl border-2 border-emerald-900/10 p-8 sm:p-12 shadow-[0_8px_30px_rgba(6,78,59,0.08)] text-center relative overflow-hidden">
          <div className="flex justify-center mb-5">
            <SchoolLogo size="lg" className="ring-4 ring-emerald-50 shadow-md" />
          </div>

          <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3.5 py-1 rounded-full mb-4 shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>خصوصية وسرية درجات الطالبات</span>
            <span aria-hidden="true">·</span>
            <span>{AUTHOR_CREDIT}</span>
          </div>

          <div className="w-16 h-16 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-700 flex items-center justify-center mx-auto mb-4 shadow-xs">
            <Lock className="w-8 h-8" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-[#064e3b] mb-3">
            لوحة الصدارة وسجل الدرجات مخصص للمشرفة فقط
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-lg mx-auto mb-8 font-medium">
            حفاظاً على خصوصية الطالبات، تُعرض لوحة الصدارة وسجل المتفوقات حصرياً للمشرفة الأكاديمية <strong>أ/ صافيناز عبدالعزيز</strong>. تظهر لكل طالبة درجتها الخاصة ومراجعة إجاباتها فقط فور الانتهاء من الاختبار دون نشرها للعامة.
          </p>

          <form onSubmit={handleSupervisorUnlock} className="max-w-sm mx-auto space-y-4 mb-8">
            <div className="relative">
              <KeyRound className="w-4 h-4 text-emerald-700 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  if (pinError) setPinError('');
                }}
                placeholder="أدخلي رمز المشرفة (PIN) لعرض اللوحة..."
                className="w-full pr-10 pl-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors"
                autoFocus
              />
            </div>

            {pinError && (
              <div className="flex items-center gap-2 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-3 bg-[#f59e0b] hover:bg-[#d97706] disabled:bg-amber-300 text-black font-black text-sm rounded-2xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isVerifying ? 'جارٍ التحقق...' : 'فتح لوحة الصدارة (خاص بالمشرفة)'}</span>
            </button>
          </form>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={onStartExam}
              className="px-5 py-2.5 bg-[#064e3b] hover:bg-[#043d2e] text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>خوض اختبار جديد</span>
            </button>

            <button
              type="button"
              onClick={onGoHome}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl transition-all active:scale-95 cursor-pointer"
            >
              العودة للرئيسية
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      await StorageService.syncDeletedIdsFromServer();
      if (onRefreshResults) {
        await onRefreshResults();
      } else {
        await StorageService.syncResultsFromServer();
      }
    } finally {
      setTimeout(() => setIsSyncing(false), 500);
    }
  };

  const getDisplayName = (originalName: string, rankIndex: number) => {
    if (!hideNames) return originalName;
    return `طالبة متفوقة #${rankIndex + 1}`;
  };

  const sorted = [...results].sort((a, b) => {
    if (b.percentage !== a.percentage) {
      return b.percentage - a.percentage;
    }
    return a.timeSeconds - b.timeSeconds;
  });

  const filtered = sorted.filter((r) =>
    (r.studentName || '').toLowerCase().includes(search.toLowerCase().trim())
  );

  const top3 = sorted.slice(0, 3);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8 text-slate-800">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <SchoolLogo size="md" className="ring-2 ring-amber-400 shadow-sm" />
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full mb-2">
              <Trophy className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>لوحة الشرف والتفوق في القدرات</span>
              <span aria-hidden="true" className="text-emerald-400">·</span>
              <span className="text-emerald-900">{AUTHOR_CREDIT}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#064e3b]">
              لوحة صدارة المتفوقات
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <p className="text-xs sm:text-sm text-slate-500">{PLATFORM_FULL_NAME}</p>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300 shadow-2xs">
                <ShieldCheck className="w-3 h-3 text-amber-700" />
                <span>عرض خاص بالمشرفة الأكاديمية فقط (محمي ضد وصول الطالبات)</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 shadow-xs"
            title="تحديث ومزامنة النتائج مع الخزانة السحابية"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-700' : ''}`} />
            <span>{isSyncing ? 'جارٍ التحديث...' : 'تحديث النتائج'}</span>
          </button>
          <button
            type="button"
            onClick={onStartExam}
            className="px-5 py-2.5 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shadow-md active:scale-95"
          >
            <Play className="w-4 h-4 fill-black stroke-black" />
            <span>خوض اختبار جديد</span>
          </button>
          <button
            type="button"
            onClick={onGoHome}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap active:scale-95 shadow-xs"
          >
            الرئيسية
          </button>
        </div>
      </div>

      {/* Champion Card (Matches video aesthetic) */}
      {top3.length > 0 && top3[0] && (
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-3xl p-7 border-2 border-[#f59e0b] flex flex-col items-center text-center shadow-[0_8px_30px_rgba(245,158,11,0.15)] relative overflow-hidden">
            <div className="w-12 h-12 rounded-full bg-[#f59e0b] text-black flex items-center justify-center font-black text-xl mb-3 font-mono shadow-md">
              1
            </div>
            <h3 className="font-black text-slate-900 text-xl mb-1 truncate max-w-full">
              {getDisplayName(top3[0].studentName, 0)}
            </h3>
            <p className="text-xs text-emerald-700 mb-2 font-bold">{top3[0].sectionTitle || 'القسم الأول (1)'}</p>
            <div className="text-3xl font-black text-[#064e3b] font-mono tabular-nums mb-1">
              {top3[0].percentage}%
            </div>
            <div className="text-xs text-slate-500 mb-3 flex items-center gap-1 font-mono tabular-nums">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>{formatTime(top3[0].timeSeconds)}</span>
            </div>
            <span className="text-xs font-black text-black bg-[#f59e0b] px-4 py-1 rounded-full shadow-xs">
              المركز الأول 🏆
            </span>
          </div>
        </div>
      )}

      {/* Main Table Card (Matches video aesthetic) */}
      <div className="bg-white rounded-3xl border border-emerald-900/10 p-6 sm:p-8 shadow-[0_4px_25px_rgba(6,78,59,0.06)] space-y-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-emerald-600 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحثي عن اسم الطالبة في القائمة..."
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors"
            />
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setHideNames(!hideNames)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95"
            >
              {hideNames ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>{hideNames ? 'إظهار الأسماء' : 'وضع الخصوصية (إخفاء)'}</span>
            </button>

            {isAdmin && onClearResults && (
              <button
                type="button"
                onClick={() => {
                  if (confirmClear) {
                    onClearResults();
                    setConfirmClear(false);
                  } else {
                    setConfirmClear(true);
                    setTimeout(() => setConfirmClear(false), 4000);
                  }
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  confirmClear
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                }`}
              >
                {confirmClear ? 'تأكيد المسح؟' : 'مسح السجل'}
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500 space-y-3">
            <Award className="w-12 h-12 mx-auto text-emerald-600 opacity-60" />
            <p className="font-bold text-sm text-slate-600">لا توجد نتائج مسجلة حتى الآن في لوحة الصدارة.</p>
            <button
              type="button"
              onClick={onStartExam}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#f59e0b] hover:bg-[#d97706] text-black rounded-xl text-xs font-black shadow-md cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-black stroke-black" />
              <span>كوني أول من يخوض الاختبار!</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b-2 border-emerald-700 text-[#064e3b] font-black">
                  <th className="py-3 px-3">الترتيب</th>
                  <th className="py-3 px-3">اسم الطالبة</th>
                  <th className="py-3 px-3">القسم المختبر</th>
                  <th className="py-3 px-3">الدرجة</th>
                  <th className="py-3 px-3">النسبة المئوية</th>
                  <th className="py-3 px-3">الوقت المستغرق</th>
                  <th className="py-3 px-3">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r, idx) => (
                  <tr key={r.id || idx} className="hover:bg-emerald-50/50 transition-colors">
                    <td className="py-3.5 px-3">
                      <span
                        className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center font-mono ${
                          idx === 0
                            ? 'bg-[#f59e0b] text-black shadow-xs'
                            : idx === 1
                            ? 'bg-slate-200 text-slate-900 font-bold'
                            : idx === 2
                            ? 'bg-amber-100 text-amber-800 border border-amber-300 font-bold'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-bold text-slate-900">
                      {getDisplayName(r.studentName, idx)}
                    </td>
                    <td className="py-3.5 px-3 font-medium text-slate-600">
                      {r.sectionTitle || 'القسم الأول (1)'}
                    </td>
                    <td className="py-3.5 px-3 font-mono font-bold text-[#064e3b]">
                      {r.score} / {r.total}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="font-bold font-mono px-3 py-1 rounded-full text-xs bg-emerald-100 border border-emerald-300 text-emerald-800 shadow-xs">
                        {r.percentage}%
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-slate-600">
                      {formatTime(r.timeSeconds)}
                    </td>
                    <td className="py-3.5 px-3 text-slate-500 font-mono text-xs">
                      {new Date(r.submittedAt).toLocaleDateString('ar-SA')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
