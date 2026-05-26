/**
 * Timeline — 时间线层
 *
 * 负责 session_timeline 表的读写和格式化
 *
 * 写入函数：writeEvent, writeBuildComplete, writeGate1Round, 等
 * 读取函数：getTimeline（带 30 秒缓存）
 * 格式化函数：formatForGate1, formatForDebug, 等
 *
 * 2026-05-26: V17 Phase B 重构
 */

import { supabase } from './supabase';

// =====================================================
// 写入函数
// =====================================================

/**
 * 统一写入入口
 *
 * @param {string} studentId
 * @param {string} sessionId
 * @param {Object} event
 * @param {string} event.type - 事件类型
 * @param {string} [event.lessonType]
 * @param {string} [event.upgradeId]
 * @param {string} event.role - 'student' | 'agent' | 'system'
 * @param {string} event.content - 事件内容
 * @param {Object} [event.metadata]
 * @param {boolean} [event.visibleToAgent=true]
 * @param {boolean} [event.isSystemMarker=false]
 * @param {boolean} [event.displayInUI=true]
 */
export async function writeEvent(studentId, sessionId, event) {
  const { error } = await supabase.from('session_timeline').insert({
    student_id: studentId,
    session_id: sessionId,
    lesson_type: event.lessonType,
    event_type: event.type,
    upgrade_id: event.upgradeId || null,
    role: event.role,
    content: event.content,
    metadata: event.metadata || {},
    visible_to_agent: event.visibleToAgent !== false,
    is_system_marker: event.isSystemMarker || false,
    display_in_ui: event.displayInUI !== false,
  });

  if (error) {
    console.error('Failed to write timeline event:', error);
  }

  // 写入后清除缓存
  invalidateCache();
}

/**
 * Build Tab 完成
 */
export const writeBuildComplete = (studentId, sessionId, choices, lessonType) =>
  writeEvent(studentId, sessionId, {
    type: 'build_complete',
    lessonType,
    role: 'system',
    content: `[BUILD] Student designed: ${JSON.stringify(choices)}`,
    metadata: { choices },
    isSystemMarker: true,
  });

/**
 * Prompt 生成
 */
export const writePromptGenerated = (studentId, sessionId, prompt, lessonType) =>
  writeEvent(studentId, sessionId, {
    type: 'prompt_generated',
    lessonType,
    role: 'system',
    content: `[PROMPT] Generated: ${prompt.slice(0, 100)}...`,
    metadata: { prompt },
    isSystemMarker: true,
  });

/**
 * Prompt 复制
 */
export const writePromptCopied = (studentId, sessionId, lessonType) =>
  writeEvent(studentId, sessionId, {
    type: 'prompt_copied',
    lessonType,
    role: 'system',
    content: '[COPIED] Student copied prompt to Claude',
    isSystemMarker: true,
  });

/**
 * Gate 1 每轮对话
 */
export const writeGate1Round = (studentId, sessionId, upgradeId, round, input, scores, lessonType) =>
  writeEvent(studentId, sessionId, {
    type: 'gate1_round',
    lessonType,
    upgradeId,
    role: 'student',
    content: input,
    metadata: { round, scores },
  });

/**
 * Gate 1 完成
 */
export const writeGate1Complete = (studentId, sessionId, upgradeId, data, lessonType) =>
  writeEvent(studentId, sessionId, {
    type: 'gate1_complete',
    lessonType,
    upgradeId,
    role: 'system',
    content: `[GATE1-COMPLETE] ${data.upgradeLabel}: student said "${data.bestQuote}"`,
    metadata: {
      best_quote: data.bestQuote,
      actual_rounds: data.actualRounds,
      early_release: data.earlyRelease,
      draft_prompt: data.draftPrompt || null,
    },
    isSystemMarker: true,
  });

/**
 * Gate 2 验证
 */
export const writeGate2Verify = (studentId, sessionId, upgradeId, data, lessonType) =>
  writeEvent(studentId, sessionId, {
    type: 'gate2_verify',
    lessonType,
    upgradeId,
    role: 'system',
    content: `[GATE2] ${data.upgradeLabel}: ${data.appeared ? '✓' : '✗'} appeared`,
    metadata: {
      upgrade_appeared: data.appeared,
      failure_type: data.failureType,
      gate2_mode: data.gate2Mode,
    },
    isSystemMarker: true,
  });

/**
 * Debug 消息（每轮对话）
 */
export const writeDebugMessage = (studentId, sessionId, role, content, debugSessionId, mode, lessonType) =>
  writeEvent(studentId, sessionId, {
    type: 'debug_message',
    lessonType,
    role,
    content,
    metadata: { debug_session_id: debugSessionId, agent_mode: mode },
    displayInUI: false,
  });

/**
 * Debug 工具切换
 */
export const writeDebugToolSwitch = (studentId, sessionId, toMode, bugSummary, lessonType) =>
  writeEvent(studentId, sessionId, {
    type: 'debug_message',
    lessonType,
    role: 'system',
    content: `[ROUTED-TO-${toMode.toUpperCase()}] Bug: "${bugSummary}"`,
    isSystemMarker: true,
    displayInUI: false,
  });

/**
 * Debug 完成
 */
export const writeDebugComplete = (studentId, sessionId, bugType, fixText, resolved, lessonType) =>
  writeEvent(studentId, sessionId, {
    type: 'debug_complete',
    lessonType,
    role: 'system',
    content: `[DEBUG-COMPLETE] ${bugType}: ${resolved ? 'resolved' : 'unresolved'}. Fix: "${fixText}"`,
    isSystemMarker: true,
  });

/**
 * 游戏重新生成
 */
export const writeGameRegenerated = (studentId, sessionId, lessonType) =>
  writeEvent(studentId, sessionId, {
    type: 'game_regenerated',
    lessonType,
    role: 'system',
    content: '[REGENERATED] Student regenerated game with updated prompt',
    isSystemMarker: true,
  });

// =====================================================
// 读取函数（带 30 秒缓存）
// =====================================================

let _cache = null;
let _cacheTime = null;
let _cacheKey = null;
const CACHE_TTL = 30000; // 30 秒

/**
 * 获取时间线
 *
 * @param {string} studentId
 * @param {string} sessionId
 * @returns {Promise<Array>}
 */
export async function getTimeline(studentId, sessionId) {
  const cacheKey = `${studentId}:${sessionId}`;
  const now = Date.now();

  // 缓存命中
  if (_cache && _cacheKey === cacheKey && now - _cacheTime < CACHE_TTL) {
    return _cache;
  }

  // 查询数据库
  const { data, error } = await supabase
    .from('session_timeline')
    .select('*')
    .eq('student_id', studentId)
    .eq('session_id', sessionId)
    .eq('visible_to_agent', true)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to get timeline:', error);
    return [];
  }

  // 更新缓存
  _cache = data || [];
  _cacheTime = now;
  _cacheKey = cacheKey;

  return _cache;
}

/**
 * 清除缓存
 */
export function invalidateCache() {
  _cache = null;
  _cacheTime = null;
  _cacheKey = null;
}

// =====================================================
// 格式化函数
// =====================================================

/**
 * Gate 1 格式化：只需完成的 Upgrade 记录
 *
 * @param {Array} timeline
 * @param {string} demoDescription
 * @param {string} currentPrompt
 * @returns {string}
 */
export function formatForGate1(timeline, demoDescription, currentPrompt) {
  const completed = timeline
    .filter(e => e.event_type === 'gate1_complete')
    .map(e => e.content)
    .join('\n');

  return `Demo: ${demoDescription}
Current prompt: ${currentPrompt || 'not yet generated'}
${completed ? `\nCompleted upgrades:\n${completed}` : ''}`.trim();
}

/**
 * Gate 2 格式化：Gate 1 记录 + 时间模式
 *
 * @param {Array} timeline
 * @param {string} gate2Mode
 * @param {string} currentPrompt
 * @returns {string}
 */
export function formatForGate2(timeline, gate2Mode, currentPrompt) {
  const gate1 = timeline
    .filter(e => e.event_type === 'gate1_complete')
    .map(e => e.content)
    .join('\n');

  return `Current prompt: ${currentPrompt || 'N/A'}
Time mode: ${gate2Mode}
Gate 1 records:
${gate1 || 'none'}`.trim();
}

/**
 * Debug 格式化：完整时间线自然语言叙事
 *
 * @param {Array} timeline
 * @param {string} currentPrompt
 * @returns {string}
 */
export function formatForDebug(timeline, currentPrompt) {
  const lines = timeline
    .map(e => {
      if (e.is_system_marker) return e.content;
      if (e.role === 'student') return `Student: ${e.content}`;
      if (e.role === 'agent') return `Agent: ${e.content}`;
      return null;
    })
    .filter(Boolean);

  return `Current prompt: ${currentPrompt || 'N/A'}
Session history:
${lines.join('\n') || 'No history yet'}`.trim();
}

/**
 * Report 格式化：完整结构化数据
 *
 * @param {Array} timeline
 * @returns {string}
 */
export function formatForReport(timeline) {
  return timeline
    .filter(e => e.is_system_marker)
    .map(e => e.content)
    .join('\n');
}

/**
 * 获取成功的 Upgrade 列表（用于 Reset Tool）
 *
 * @param {Array} timeline
 * @returns {Array<{id: string, label: string, studentSaid: string}>}
 */
export function getSuccessfulUpgrades(timeline) {
  return timeline
    .filter(e => e.event_type === 'gate2_verify' && e.metadata?.upgrade_appeared === true)
    .map(e => ({
      id: e.upgrade_id,
      label: e.metadata?.upgrade_label || e.upgrade_id,
      studentSaid: e.metadata?.best_quote || '',
    }));
}

/**
 * 获取最近的 Debug 记录
 *
 * @param {Array} timeline
 * @param {number} [limit=5]
 * @returns {Array}
 */
export function getRecentBugs(timeline, limit = 5) {
  return timeline
    .filter(e => e.event_type === 'debug_complete')
    .slice(-limit)
    .map(e => ({
      bugType: e.metadata?.bug_type,
      bugDescription: e.content,
      resolved: e.metadata?.resolved,
    }));
}
