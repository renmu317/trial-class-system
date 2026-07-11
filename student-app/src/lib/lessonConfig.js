// Lesson Configuration Manager
// Supports switching between different lessons via URL parameter
// Supports language switching (en/zh)

import { LESSON, RECOVERY, LEVEL_CONFIG, TABS } from './lesson';
import { LESSON_2, RECOVERY_2, LEVEL_CONFIG_2, TABS_2 } from './lesson2';
import { LESSON_3, RECOVERY_3, LEVEL_CONFIG_3, TABS_3 } from './lesson3';
import { LESSON_4, RECOVERY_4, LEVEL_CONFIG_4, TABS_4 } from './lesson4';
import { LESSON_5, RECOVERY_5, LEVEL_CONFIG_5, TABS_5 } from './lesson5';
import {
  LESSON_6, LESSON_7, LESSON_8, LESSON_9, LESSON_10,
  RECOVERY_6, RECOVERY_7, RECOVERY_8, RECOVERY_9, RECOVERY_10,
  LEVEL_CONFIG_6, LEVEL_CONFIG_7, LEVEL_CONFIG_8, LEVEL_CONFIG_9, LEVEL_CONFIG_10,
  TABS_6, TABS_7, TABS_8, TABS_9, TABS_10,
} from './lessonRobloxTycoon';
import { LESSON_ZH, RECOVERY_ZH, LEVEL_CONFIG_ZH, TABS_ZH } from './lessonZh';
import { LESSON_2_ZH, RECOVERY_2_ZH, LEVEL_CONFIG_2_ZH, TABS_2_ZH } from './lesson2Zh';
import { LESSON_3_ZH, RECOVERY_3_ZH, LEVEL_CONFIG_3_ZH, TABS_3_ZH } from './lesson3Zh';
import { LESSON_4_ZH, RECOVERY_4_ZH, LEVEL_CONFIG_4_ZH, TABS_4_ZH } from './lesson4Zh';
import { LESSON_5_ZH, RECOVERY_5_ZH, LEVEL_CONFIG_5_ZH, TABS_5_ZH } from './lesson5Zh';
import {
  LESSON_6_ZH, LESSON_7_ZH, LESSON_8_ZH, LESSON_9_ZH, LESSON_10_ZH,
  RECOVERY_6_ZH, RECOVERY_7_ZH, RECOVERY_8_ZH, RECOVERY_9_ZH, RECOVERY_10_ZH,
  LEVEL_CONFIG_6_ZH, LEVEL_CONFIG_7_ZH, LEVEL_CONFIG_8_ZH, LEVEL_CONFIG_9_ZH, LEVEL_CONFIG_10_ZH,
  TABS_6_ZH, TABS_7_ZH, TABS_8_ZH, TABS_9_ZH, TABS_10_ZH,
} from './lessonRobloxTycoonZh';

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
  'lesson3': {
    id: 'lesson3',
    name: 'Class 1: Zombie Survival Runner',
    lesson: LESSON_3,
    recovery: RECOVERY_3,
    levelConfig: LEVEL_CONFIG_3,
    tabs: TABS_3,
  },
  'lesson4': {
    id: 'lesson4',
    name: 'Class 2: Tower Defense: Protect Your Base (Claude)',
    lesson: LESSON_4,
    recovery: RECOVERY_4,
    levelConfig: LEVEL_CONFIG_4,
    tabs: TABS_4,
  },
  'lesson5': {
    id: 'lesson5',
    name: 'Class 3: Racing Game Design (Claude)',
    lesson: LESSON_5,
    recovery: RECOVERY_5,
    levelConfig: LEVEL_CONFIG_5,
    tabs: TABS_5,
  },
  'lesson6': {
    id: 'lesson6',
    name: 'Class 4: Roblox Tycoon - Planning and Core Systems',
    lesson: LESSON_6,
    recovery: RECOVERY_6,
    levelConfig: LEVEL_CONFIG_6,
    tabs: TABS_6,
  },
  'lesson7': {
    id: 'lesson7',
    name: 'Class 5: Roblox Tycoon - Expanding the Tycoon',
    lesson: LESSON_7,
    recovery: RECOVERY_7,
    levelConfig: LEVEL_CONFIG_7,
    tabs: TABS_7,
  },
  'lesson8': {
    id: 'lesson8',
    name: 'Class 6: Roblox Tycoon - Completing the Game',
    lesson: LESSON_8,
    recovery: RECOVERY_8,
    levelConfig: LEVEL_CONFIG_8,
    tabs: TABS_8,
  },
  'lesson9': {
    id: 'lesson9',
    name: 'Class 7: Roblox Tycoon - Creativity and Polish',
    lesson: LESSON_9,
    recovery: RECOVERY_9,
    levelConfig: LEVEL_CONFIG_9,
    tabs: TABS_9,
  },
  'lesson10': {
    id: 'lesson10',
    name: 'Class 8: Roblox Tycoon - Publishing and Sharing',
    lesson: LESSON_10,
    recovery: RECOVERY_10,
    levelConfig: LEVEL_CONFIG_10,
    tabs: TABS_10,
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
  'lesson3': {
    id: 'lesson3',
    name: '第1课：僵尸生存跑酷',
    lesson: LESSON_3_ZH,
    recovery: RECOVERY_3_ZH,
    levelConfig: LEVEL_CONFIG_3_ZH,
    tabs: TABS_3_ZH,
  },
  'lesson4': {
    id: 'lesson4',
    name: '第2课：Tower Defense: Protect Your Base (Claude)',
    lesson: LESSON_4_ZH,
    recovery: RECOVERY_4_ZH,
    levelConfig: LEVEL_CONFIG_4_ZH,
    tabs: TABS_4_ZH,
  },
  'lesson5': {
    id: 'lesson5',
    name: '第3课：Racing Game Design (Claude)',
    lesson: LESSON_5_ZH,
    recovery: RECOVERY_5_ZH,
    levelConfig: LEVEL_CONFIG_5_ZH,
    tabs: TABS_5_ZH,
  },
  'lesson6': {
    id: 'lesson6',
    name: '第4课：Roblox Tycoon - Planning and Core Systems',
    lesson: LESSON_6_ZH,
    recovery: RECOVERY_6_ZH,
    levelConfig: LEVEL_CONFIG_6_ZH,
    tabs: TABS_6_ZH,
  },
  'lesson7': {
    id: 'lesson7',
    name: '第5课：Roblox Tycoon - Expanding the Tycoon',
    lesson: LESSON_7_ZH,
    recovery: RECOVERY_7_ZH,
    levelConfig: LEVEL_CONFIG_7_ZH,
    tabs: TABS_7_ZH,
  },
  'lesson8': {
    id: 'lesson8',
    name: '第6课：Roblox Tycoon - Completing the Game',
    lesson: LESSON_8_ZH,
    recovery: RECOVERY_8_ZH,
    levelConfig: LEVEL_CONFIG_8_ZH,
    tabs: TABS_8_ZH,
  },
  'lesson9': {
    id: 'lesson9',
    name: '第7课：Roblox Tycoon - Creativity and Polish',
    lesson: LESSON_9_ZH,
    recovery: RECOVERY_9_ZH,
    levelConfig: LEVEL_CONFIG_9_ZH,
    tabs: TABS_9_ZH,
  },
  'lesson10': {
    id: 'lesson10',
    name: '第8课：Roblox Tycoon - Publishing and Sharing',
    lesson: LESSON_10_ZH,
    recovery: RECOVERY_10_ZH,
    levelConfig: LEVEL_CONFIG_10_ZH,
    tabs: TABS_10_ZH,
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
 * @param {string} lessonType - 'lesson1' | 'lesson2' | ... | 'lesson10'
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
 * URL: ?lesson=lesson3 or ?lesson=zombie
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
    'zombie': 'lesson3',
    'runner': 'lesson3',
    '3': 'lesson3',
    'tower': 'lesson4',
    'defense': 'lesson4',
    'tower-defense': 'lesson4',
    'base': 'lesson4',
    '4': 'lesson4',
    'racing': 'lesson5',
    'race': 'lesson5',
    'car': 'lesson5',
    'driving': 'lesson5',
    '5': 'lesson5',
    'roblox': 'lesson6',
    'tycoon': 'lesson6',
    'planning': 'lesson6',
    'core': 'lesson6',
    '6': 'lesson6',
    'expanding': 'lesson7',
    'expand': 'lesson7',
    '7': 'lesson7',
    'completing': 'lesson8',
    'complete': 'lesson8',
    '8': 'lesson8',
    'polish': 'lesson9',
    'creativity': 'lesson9',
    '9': 'lesson9',
    'publishing': 'lesson10',
    'publish': 'lesson10',
    'sharing': 'lesson10',
    '10': 'lesson10',
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
