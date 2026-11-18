export type ExamTheme = 'light' | 'dark';

export const EXAM_THEME_STORAGE_KEY = 'cbt_exam_theme_v1';

export function normalizeExamTheme(value: unknown): ExamTheme | null {
  if (value === 'dark' || value === 'light') {
    return value;
  }
  return null;
}

export function resolveInitialExamTheme(params: {
  queryTheme?: string | null;
  storedTheme?: string | null;
}): ExamTheme {
  const fromQuery = normalizeExamTheme(params.queryTheme?.trim().toLowerCase());
  if (fromQuery) return fromQuery;

  const fromStorage = normalizeExamTheme(params.storedTheme?.trim().toLowerCase());
  if (fromStorage) return fromStorage;

  return 'light';
}

export function toggleExamTheme(current: ExamTheme): ExamTheme {
  return current === 'dark' ? 'light' : 'dark';
}

export function getExamThemeToggleLabel(current: ExamTheme): {
  currentModeLabel: string;
  actionLabel: string;
} {
  if (current === 'dark') {
    return {
      currentModeLabel: 'الوضع المظلم مفعّل',
      actionLabel: 'الوضع المضيء'
    };
  }
  return {
    currentModeLabel: 'الوضع المضيء مفعّل',
    actionLabel: 'الوضع المظلم'
  };
}
