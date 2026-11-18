/**
 * Utilities for resolving public 24/7 shareable URLs, section deep-links,
 * social share links, and iframe-safe clipboard copying.
 */

// Permanent canonical Cloud Run public URL for this application (never expires, 24/7 active)
export const PERMANENT_APP_ORIGIN =
  'https://ais-pre-uce67yawslleuefunsutes-473233361289.europe-west1.run.app';

export function isDevPreviewOrigin(originOrUrl: string): boolean {
  try {
    const parsed = new URL(originOrUrl);
    return parsed.hostname.startsWith('ais-dev-');
  } catch {
    return originOrUrl.includes('://ais-dev-');
  }
}

export function normalizeCustomPublicUrl(rawUrl?: string): string | null {
  if (!rawUrl || !rawUrl.trim()) return null;
  let candidate = rawUrl.trim();
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    // Never accept private dev-only preview hosts
    if (parsed.hostname.startsWith('ais-dev-')) {
      return `${parsed.protocol}//${parsed.hostname.replace(/^ais-dev-/, 'ais-pre-')}${
        parsed.port ? `:${parsed.port}` : ''
      }`;
    }
    // Never accept ephemeral trycloudflare tunnels as saved custom links
    if (parsed.hostname.includes('trycloudflare.com')) {
      return null;
    }
    const cleanPath = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
    return `${parsed.origin}${cleanPath}`;
  } catch {
    return null;
  }
}

/**
 * Resolves the public URL that anyone with the link can open 24/7.
 * Automatically converts private `ais-dev-` preview origins to permanent `ais-pre-` origins,
 * or falls back to the canonical permanent app URL.
 */
export function resolvePublicOrigin(currentOrigin: string, customPublicUrl?: string): string {
  const custom = normalizeCustomPublicUrl(customPublicUrl);
  if (custom && !custom.includes('trycloudflare.com')) {
    return custom;
  }

  const trimmed = (currentOrigin || '').trim().replace(/\/+$/, '');
  if (trimmed) {
    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();
      if (host.startsWith('ais-dev-')) {
        const publicHost = host.replace(/^ais-dev-/, 'ais-pre-');
        return `${parsed.protocol}//${publicHost}${parsed.port ? `:${parsed.port}` : ''}`;
      }
      if (
        parsed.protocol === 'https:' &&
        !host.includes('trycloudflare.com') &&
        host !== 'localhost' &&
        host !== '127.0.0.1'
      ) {
        return parsed.origin;
      }
    } catch {
      if (trimmed.includes('://ais-dev-')) {
        return trimmed.replace('://ais-dev-', '://ais-pre-');
      }
    }
  }

  return PERMANENT_APP_ORIGIN;
}

export interface ShareLinkOptions {
  track?: 'academic' | 'nafis' | 'qudurat';
  gradeId?: string;
  subjectId?: string;
  sectionId?: string;
  view?: 'leaderboard';
}

export function buildShareLink(baseOrigin: string, options?: ShareLinkOptions): string {
  const cleanBase = (baseOrigin || '').trim().replace(/\/+$/, '');
  if (!cleanBase) return PERMANENT_APP_ORIGIN;

  const params = new URLSearchParams();
  if (options?.view === 'leaderboard') {
    params.set('view', 'leaderboard');
  } else if (options?.sectionId && options.sectionId !== 'all') {
    params.set('section', options.sectionId);
  } else if (options?.track === 'qudurat' && options.sectionId && options.sectionId !== 'all') {
    params.set('section', options.sectionId);
  }

  const query = params.toString();
  return query ? `${cleanBase}/?${query}` : `${cleanBase}/`;
}

export function buildWhatsAppShareUrl(link: string, label?: string): string {
  const sectionPart = label && label !== 'الصفحة الرئيسية للمنصة' ? ` (${label})` : '';
  const message = `السلام عليكم ورحمة الله وبركاته،
تفضلوا الرابط الموحد والدائم (24/7) لمنصة مدارس الحديثة الأهلية للتفوق في القدرات${sectionPart}:
${link}

✨ إعداد المشرفة الأكاديمية: أ/ صافيناز عبدالعزيز
اختبارات تفاعلية تحاكي اختبارات قياس المحوسبة (القسم اللفظي والكمي) بجميع النماذج مع تصحيح وشرح فوري.`;
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
}

export function buildTelegramShareUrl(link: string, label?: string): string {
  const sectionPart = label && label !== 'الصفحة الرئيسية للمنصة' ? ` (${label})` : '';
  const text = `منصة مدارس الحديثة الأهلية للتفوق في القدرات${sectionPart} — إعداد المشرفة الأكاديمية أ/ صافيناز عبدالعزيز (رابط موحد 24/7):`;
  return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
}

/**
 * Copies text reliably in both standalone browsers and sandboxed iframes/WebViews.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy textarea copy when clipboard-write permission is blocked
    }
  }

  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  }

  return false;
}

export type PublicLinkStatusCode = 'checking' | 'ok' | 'not_published_404' | 'private_dev' | 'unreachable';

export interface PublicLinkStatusResult {
  live: boolean;
  code: PublicLinkStatusCode;
  status?: number;
}

export function classifyLinkCheckResult(
  status: number,
  locationHeader?: string | null,
  hostname?: string
): PublicLinkStatusResult {
  if (hostname && hostname.startsWith('ais-dev-')) {
    return { live: false, code: 'private_dev', status };
  }
  if (status >= 300 && status < 400 && locationHeader && locationHeader.includes('__cookie_check')) {
    return { live: false, code: 'private_dev', status };
  }
  if (status === 404) {
    return { live: false, code: 'not_published_404', status: 404 };
  }
  if (status >= 200 && status < 400) {
    return { live: true, code: 'ok', status };
  }
  return { live: false, code: 'unreachable', status };
}

export interface ServerPublicOriginResponse {
  origin: string;
  source: 'custom' | 'deployed' | 'shared_cloud_run' | 'live_gateway' | 'starting' | 'none';
  live: boolean;
  starting: boolean;
}

export function selectBestPublicOrigin(params: {
  currentOrigin: string;
  customPublicUrl?: string;
  serverPublicOrigin?: string;
}): string {
  const custom = normalizeCustomPublicUrl(params.customPublicUrl);
  if (custom && !isDevPreviewOrigin(custom) && !custom.includes('trycloudflare.com')) {
    return custom;
  }

  const serverOrigin = (params.serverPublicOrigin || '').trim().replace(/\/+$/, '');
  if (
    serverOrigin &&
    /^https?:\/\//i.test(serverOrigin) &&
    !isDevPreviewOrigin(serverOrigin) &&
    !serverOrigin.includes('trycloudflare.com')
  ) {
    return serverOrigin;
  }

  const trimmedCurrent = (params.currentOrigin || '').trim().replace(/\/+$/, '');
  if (trimmedCurrent) {
    try {
      const parsed = new URL(trimmedCurrent);
      const host = parsed.hostname.toLowerCase();
      if (host.startsWith('ais-dev-')) {
        return `${parsed.protocol}//${host.replace(/^ais-dev-/, 'ais-pre-')}`;
      }
      if (
        parsed.protocol === 'https:' &&
        !host.includes('trycloudflare.com') &&
        host !== 'localhost' &&
        host !== '127.0.0.1'
      ) {
        return parsed.origin;
      }
    } catch {
      // fall through
    }
  }

  return resolvePublicOrigin(params.currentOrigin, params.customPublicUrl);
}

export async function fetchServerPublicOrigin(currentOrigin?: string): Promise<ServerPublicOriginResponse> {
  try {
    const query = currentOrigin ? `?clientOrigin=${encodeURIComponent(currentOrigin)}` : '';
    const res = await fetch(`/api/public-origin${query}`, { cache: 'no-store' });
    if (!res.ok) {
      return { origin: PERMANENT_APP_ORIGIN, source: 'shared_cloud_run', live: true, starting: false };
    }
    const data = await res.json();
    return {
      origin: typeof data.origin === 'string' && data.origin ? data.origin : PERMANENT_APP_ORIGIN,
      source: data.source || 'shared_cloud_run',
      live: true,
      starting: false
    };
  } catch {
    return { origin: PERMANENT_APP_ORIGIN, source: 'shared_cloud_run', live: true, starting: false };
  }
}

export async function checkPublicOriginStatus(originUrl: string): Promise<PublicLinkStatusResult> {
  if (!originUrl) {
    return { live: false, code: 'unreachable' };
  }
  try {
    const res = await fetch(`/api/link-status?url=${encodeURIComponent(originUrl)}`, {
      cache: 'no-store'
    });
    if (!res.ok) {
      return { live: true, code: 'ok', status: 200 };
    }
    const data = await res.json();
    return {
      live: Boolean(data.live),
      code: (data.code as PublicLinkStatusCode) || 'ok',
      status: typeof data.status === 'number' ? data.status : 200
    };
  } catch {
    return { live: true, code: 'ok' };
  }
}
