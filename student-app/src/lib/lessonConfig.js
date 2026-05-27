// Lesson Configuration Manager
// Supports switching between different lessons via URL parameter
// Supports language switching (en/zh)

import { LESSON, RECOVERY, LEVEL_CONFIG, TABS } from './lesson';
import { LESSON_2, RECOVERY_2, LEVEL_CONFIG_2, TABS_2 } from './lesson2';
import { LESSON_ZH, RECOVERY_ZH, LEVEL_CONFIG_ZH, TABS_ZH } from './lessonZh';
import { LESSON_2_ZH, RECOVERY_2_ZH, LEVEL_CONFIG_2_ZH, TABS_2_ZH } from './lesson2Zh';

// Available lessons registry - organized by language
const LESSONS_EN = {
  'lesson1': {
    id: 'lesson1',
    name: 'Catch Falling Game',
    lesson: LESSON,
    recovery: RECOVERY,
    levelConfig: LEVEL_CONFIG,
    tabs: TABS,
  },
  'lesson2': {
    id: 'lesson2',
    name: 'AI Maze Game',
    lesson: LESSON_2,
    recovery: RECOVERY_2,
    levelConfig: LEVEL_CONFIG_2,
    tabs: TABS_2,
  },
};

const LESSONS_ZH = {
  'lesson1': {
    id: 'lesson1',
    name: '接落物游戏',
    lesson: LESSON_ZH,
    recovery: RECOVERY_ZH,
    levelConfig: LEVEL_CONFIG_ZH,
    tabs: TABS_ZH,
  },
  'lesson2': {
    id: 'lesson2',
    name: 'AI迷宫游戏',
    lesson: LESSON_2_ZH,
    recovery: RECOVERY_2_ZH,
    levelConfig: LEVEL_CONFIG_2_ZH,
    tabs: TABS_2_ZH,
  },
};

// Default export for backward compatibility
export const LESSONS = LESSONS_EN;

/**
 * Get lessons by language
 * @param {string} language - 'en' or 'zh'
 */
export function getLessonsByLanguage(language = 'en') {
  return language === 'zh' ? LESSONS_ZH : LESSONS_EN;
}

/**
 * Get specific lesson config by lesson type and language
 * @param {string} lessonType - 'lesson1' or 'lesson2'
 * @param {string} language - 'en' or 'zh'
 */
export function getLessonConfig(lessonType, language = 'en') {
  const lessons = getLessonsByLanguage(language);
  return lessons[lessonType] || lessons['lesson1'];
}

// Default lesson
export const DEFAULT_LESSON = 'lesson1';

/**
 * Get lesson configuration from URL parameter or default
 * URL: ?lesson=lesson2 or ?lesson=maze
 */
export function getLessonFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const lessonParam = params.get('lesson');

  if (!lessonParam) {
    return LESSONS[DEFAULT_LESSON];
  }

  // Support both full name and shortcuts
  const lessonKey = lessonParam.toLowerCase();

  // Direct match
  if (LESSONS[lessonKey]) {
    return LESSONS[lessonKey];
  }

  // Shortcut matches
  const shortcuts = {
    'catch': 'lesson1',
    'catching': 'lesson1',
    'falling': 'lesson1',
    '1': 'lesson1',
    'maze': 'lesson2',
    '2': 'lesson2',
  };

  if (shortcuts[lessonKey]) {
    return LESSONS[shortcuts[lessonKey]];
  }

  // Default fallback
  return LESSONS[DEFAULT_LESSON];
}

/**
 * Get all available lessons (for admin/TA selection)
 */
export function getAvailableLessons() {
  return Object.values(LESSONS).map(l => ({
    id: l.id,
    name: l.name,
    emoji: l.lesson.emoji,
    title: l.lesson.title,
  }));
}

/**
 * Check if a lesson supports Rule Design tab
 */
export function hasRuleDesign(lessonConfig) {
  return lessonConfig?.lesson?.ruleDesign?.enabled === true;
}

/**
 * Check if a lesson supports Debug Log tab
 */
export function hasDebugLog(lessonConfig) {
  return lessonConfig?.lesson?.debugLog?.enabled === true;
}
