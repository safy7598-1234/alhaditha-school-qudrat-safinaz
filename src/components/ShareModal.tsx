import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Copy,
  Check,
  X,
  QrCode,
  Download,
  Send,
  Globe,
  Layers,
  MessageCircle,
  RefreshCw,
  CheckCircle2,
  Link2,
  ShieldCheck,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { QuizSection } from '../types/quiz';
import {
  AUTHOR_CREDIT,
  PLATFORM_FULL_NAME
} from '../data/curriculum';
import {
  isDevPreviewOrigin,
  normalizeCustomPublicUrl,
  selectBestPublicOrigin,
  buildShareLink,
  buildWhatsAppShareUrl,
  buildTelegramShareUrl,
  copyToClipboard,
  PERMANENT_APP_ORIGIN
} from '../utils/shareUrl';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  sections: QuizSection[];
  activeSectionId: string;
  customPublicUrl?: string;
  serverPublicOrigin?: string;
  isOriginStarting?: boolean;
  onRefreshOrigin?: () => Promise<void>;
  onSaveCustomUrl?: (url: string) => void;
  isAdmin?: boolean;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  sections,
  activeSectionId,
  customPublicUrl,
  serverPublicOrigin,
  isOriginStarting,
  onRefreshOrigin,
  onSaveCustomUrl,
  isAdmin = false
}) => {
  const [target, setTarget] = useState<string>('all');
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [customUrlInput, setCustomUrlInput] = useState(customPublicUrl || '');
  const [customUrlError, setCustomUrlError] = useState('');
  const [customUrlSaved, setCustomUrlSaved] = useState(false);
  const [showCustomUrlBox, setShowCustomUrlBox] = useState(false);

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const publicOrigin = selectBestPublicOrigin({
    currentOrigin,
    customPublicUrl,
    serverPublicOrigin
  });

  const shareUrl =
    target === 'leaderboard'
      ? buildShareLink(publicOrigin, { view: 'leaderboard' })
      : target === 'all'
      ? buildShareLink(publicOrigin)
      : buildShareLink(publicOrigin, { sectionId: target });

  const selectedLabel =
    target === 'all'
      ? 'الصفحة الرئيسية للمنصة'
      : target === 'leaderboard'
      ? 'لوحة صدارة المتفوقات'
      : sections.find((s) => s.id === target)?.title || 'اختبار القدرات';

  useEffect(() => {
    setCustomUrlInput(customPublicUrl || '');
  }, [customPublicUrl]);

  useEffect(() => {
    if (!isOpen || !onRefreshOrigin) return;
    onRefreshOrigin();
  }, [isOpen, onRefreshOrigin]);

  useEffect(() => {
    if (!isOpen || !shareUrl) return;
    let active = true;
    QRCode.toDataURL(shareUrl, {
      width: 240,
      margin: 2,
      color: {
        dark: '#064e3b',
        light: '#ffffff'
      }
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [isOpen, shareUrl]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomUrlError('');
    setCustomUrlSaved(false);

    const trimmed = customUrlInput.trim();
    if (!trimmed) {
      if (onSaveCustomUrl) onSaveCustomUrl('');
      setCustomUrlSaved(true);
      setTimeout(() => setCustomUrlSaved(false), 2500);
      return;
    }

    const normalized = normalizeCustomPublicUrl(trimmed);
    if (!normalized) {
      setCustomUrlError('يرجى كتابة رابط صحيح يبدأ بـ https://');
      return;
    }

    if (onSaveCustomUrl) onSaveCustomUrl(normalized);
    setCustomUrlInput(normalized);
    setCustomUrlSaved(true);
    setTimeout(() => setCustomUrlSaved(false), 2500);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `باركود_منصة_القدرات_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const waShareUrl = buildWhatsAppShareUrl(shareUrl, selectedLabel);
  const tgShareUrl = buildTelegramShareUrl(shareUrl, selectedLabel);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl bg-white text-slate-800 rounded-3xl border border-emerald-900/15 shadow-[0_20px_50px_rgba(6,78,59,0.2)] p-5 sm:p-7 space-y-5 my-8 max-h-[92vh] overflow-y-auto relative overflow-hidden"
        dir="rtl"
      >
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-600 via-amber-400 to-emerald-700" />

        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-emerald-100 pb-3">
          <h2 id="share-modal-title" className="text-lg sm:text-xl font-black text-[#043d2e] flex items-center gap-2">
            <Link2 className="w-5 h-5 text-emerald-600" />
            <span>مشاركة رابط المنصة</span>
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة المشاركة"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Selector */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setTarget('all')}
            className={`flex-1 min-w-[110px] py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
              target === 'all'
                ? 'bg-[#f59e0b] hover:bg-[#d97706] text-black shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            المنصة بالكامل
          </button>

          <button
            type="button"
            onClick={() => setTarget(activeSectionId)}
            className={`flex-1 min-w-[110px] py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
              target === activeSectionId
                ? 'bg-[#f59e0b] hover:bg-[#d97706] text-black shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            القسم الحالي
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setTarget('leaderboard')}
              className={`flex-1 min-w-[110px] py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                target === 'leaderboard'
                  ? 'bg-[#f59e0b] hover:bg-[#d97706] text-black shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              لوحة الصدارة (المشرفة)
            </button>
          )}
        </div>

        {/* Link Box */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="flex-1 px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-300 text-xs sm:text-sm font-mono text-slate-800 font-semibold select-all focus:outline-none focus:border-emerald-600 text-left"
            dir="ltr"
          />
          <button
            type="button"
            onClick={handleCopy}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm active:scale-95 ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-[#f59e0b] hover:bg-[#d97706] text-black'
            }`}
          >
            {copied ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Copy className="w-4 h-4 stroke-[2.5]" />}
            <span>{copied ? 'تم النسخ!' : 'نسخ الرابط'}</span>
          </button>
        </div>

        {/* Instant Share Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href={waShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-black transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <MessageCircle className="w-4 h-4" />
            <span>واتساب</span>
          </a>

          <a
            href={tgShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-black transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Send className="w-4 h-4" />
            <span>تيليجرام</span>
          </a>
        </div>

        {/* QR Code Section */}
        {qrDataUrl && (
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src={qrDataUrl}
                alt="رمز QR"
                className="w-20 h-20 rounded-xl border border-emerald-200 bg-white p-1 shrink-0 shadow-sm"
              />
              <div>
                <h3 className="font-black text-xs sm:text-sm text-[#043d2e]">
                  رمز الباركود (QR Code)
                </h3>
                <span className="text-[11px] text-slate-500 font-medium">
                  مسح مباشر بكاميرا الجوال
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadQr}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
              <span>تحميل الباركود</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
