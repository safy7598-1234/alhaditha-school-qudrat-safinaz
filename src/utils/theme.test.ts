import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveInitialExamTheme,
  toggleExamTheme,
  getExamThemeToggleLabel
} from './theme';

test('resolveInitialExamTheme prioritizes query parameter, then saved storage, defaulting to light', () => {
  assert.equal(resolveInitialExamTheme({}), 'light');
  assert.equal(resolveInitialExamTheme({ storedTheme: 'dark' }), 'dark');
  assert.equal(resolveInitialExamTheme({ queryTheme: 'dark', storedTheme: 'light' }), 'dark');
  assert.equal(resolveInitialExamTheme({ queryTheme: 'invalid', storedTheme: 'dark' }), 'dark');
});

test('toggleExamTheme switches deterministically between light and dark modes with clear Arabic labels', () => {
  assert.equal(toggleExamTheme('light'), 'dark');
  assert.equal(toggleExamTheme('dark'), 'light');

  const lightLabels = getExamThemeToggleLabel('light');
  assert.equal(lightLabels.actionLabel, 'الوضع المظلم');

  const darkLabels = getExamThemeToggleLabel('dark');
  assert.equal(darkLabels.actionLabel, 'الوضع المضيء');
});
