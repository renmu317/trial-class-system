// Lesson Configuration Manager
// Supports switching between different lessons via URL parameter

import { LESSON, RECOVERY, LEVEL_CONFIG, TABS } from './lesson';
import { LESSON_2, RECOVERY_2, LEVEL_CONFIG_2, TABS_2 } from './lesson2';

// Available lessons registry
export const LESSONS = {
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
