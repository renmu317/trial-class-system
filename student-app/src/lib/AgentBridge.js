/**
 * V17 Agent Bridge
 *
 * 连接 Student App 和 Agent Panel 的桥梁
 * 负责 Gate 1/2 触发逻辑和 Supabase 交互
 *
 * 2026-05-24: Student Context Layer 重构
 * - 所有 Agent 共享统一的 buildStudentContext()
 * - 30秒缓存机制减少 DB 查询
 * - formatContext 工具函数按需注入
 *
 * 2026-05-26: V17 Phase B 集成
 * - 添加 timeline 模块的 invalidateCache 调用
 * - Gate 完成时同步刷新 timeline 缓存
 *
 * 2026-07-11: 方案 C - Session Memory
 * - 使用 sessionMemory 统一缓存管理
 */

import { supabase } from './supabase';
import { LESSON } from './lesson';
import { invalidateCache as invalidateTimelineCache } from './timeline';
import { sessionMemory } from './sessionMemory';

// 内部状态
let _sessionId = null;
let _studentId = null;
let _lesson = null;
let _session = null;
let _onOpenPanel = null;

// =====================================================
// Student Context Layer - 30秒缓存
// =====================================================
let _contextCache = null;
let _contextCacheTime = null;
let _contextCacheStudentId = null;
const CONTEXT_CACHE_TTL = 30 * 1000; // 30秒

/**
 * Student Context Layer - 核心函数
 * 所有 Agent 共享的上下文构建函数
 *
 * @param {string} studentId
 * @param {string} sessionId
 * @param {string} currentPrompt - 当前 prompt 内容（从 App 状态传入，显式参数）
 * @returns {Promise<StudentContext>}
 */
export async function buildStudentContext(studentId, sessionId, currentPrompt) {
  // 缓存命中检查（同一学生，30秒内）
  const now = Date.now();
  if (
    _contextCache &&
    _contextCacheStudentId === studentId &&
    now - _contextCacheTime < CONTEXT_CACHE_TTL
  ) {
    // 更新 currentPrompt（实时状态，不缓存）
    return { ..._contextCache, currentPrompt };
  }

  // 并行读取三张表
  const [agentSessionsResult, debugSessionsResult, sessionResult] = await Promise.all([
    supabase
      .from('agent_sessions')
      .select([
        'target_upgrade_id',
        'target_upgrade_label',
        'upgrade_difficulty',
        'best_student_quote',
        'language_growth_note',
        'upgrade_appeared',
        'gate2_failure_type',
        'language_dimensions_covered',
        'language_dimensions_total',
        'actual_rounds',
        'early_release',
        'gate1_completed',
        'final_prompt_quality',
      ].join(', '))
      .eq('student_id', studentId)
      .eq('gate1_completed', true)
      .order('upgrade_sequence', { ascending: true }),

    supabase
      .from('debug_sessions')
      .select([
        'id',
        'bug_type',
        'bug_description',
        'root_cause',
        'resolved',
        'best_debug_quote',
        'insight_note',
        'related_upgrade_id',
        'fix_quality',
      ].join(', '))
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(5),

    supabase
      .from('sessions')
      .select('created_at, lesson_type')
      .eq('id', sessionId)
      .single(),
  ]);

  const agentSessions = agentSessionsResult.data || [];
  const debugSessions = debugSessionsResult.data || [];
  const session = sessionResult.data;

  // 构建 context
  const context = {
    // ── Gate 1/2 用：Upgrade 完整记录 ──────────────────────
    upgradeSummaries: agentSessions.map(s => ({
      upgradeId: s.target_upgrade_id,
      upgradeLabel: s.target_upgrade_label,
      difficulty: s.upgrade_difficulty,
      studentSaid: s.best_student_quote,        // Gate 1 精华：最精确的一句话
      languageGrowth: s.language_growth_note,
      appearedInGame: s.upgrade_appeared,       // Gate 2 结果：出现了吗
      failureType: s.gate2_failure_type,        // no_prompt | prompt_ignored
      dimensionsCovered: s.language_dimensions_covered,
      dimensionsTotal: s.language_dimensions_total,
      rounds: s.actual_rounds,
      earlyRelease: s.early_release,            // 1 轮放行
      promptQuality: s.final_prompt_quality,
    })),

    // ── Reset Tool 用：已验证成功的 Upgrade ────────────────
    successfulUpgrades: agentSessions
      .filter(s => s.upgrade_appeared === true)
      .map(s => ({
        id: s.target_upgrade_id,
        label: s.target_upgrade_label,
        studentSaid: s.best_student_quote,
      })),

    // ── Debug 用：最近 bug 历史 ──────────────────────────────
    recentBugs: debugSessions,
    resolvedBugs: debugSessions.filter(d => d.resolved).length,
    unresolvedBugs: debugSessions.filter(d => !d.resolved).length,

    // ── Gate 2 用：时间计算 ────────────────────────────────
    timeRemaining: computeTimeRemaining(session),
    gate2Mode: computeTimeRemaining(session) > 8 * 60 * 1000 ? 'retry' : 'diagnose',

    // ── 所有 Agent 用 ───────────────────────────────────────
    lessonType: session?.lesson_type || 'maze-game-v1',
    demoDescription: _lesson?.agent?.demo_description || '',
    sessionId,
    studentId,

    // ── 实时状态（不缓存，每次传入）─────────────────────
    currentPrompt, // 显式参数，不从 DB 读
  };

  // 写入缓存（不含 currentPrompt）
  const { currentPrompt: _, ...cacheable } = context;
  _contextCache = cacheable;
  _contextCacheTime = now;
  _contextCacheStudentId = studentId;

  return context;
}

/**
 * 手动刷新缓存
 * 在 Gate 切换、Upgrade 完成、Debug 完成时调用
 *
 * 方案 C: 同时清除 sessionMemory 缓存
 */
export function invalidateContextCache() {
  _contextCache = null;
  _contextCacheTime = null;
  _contextCacheStudentId = null;

  // 方案 C: 清除 sessionMemory 缓存
  sessionMemory.clearAllCaches();
}

/**
 * R5 修复：三层时间 fallback
 */
function computeTimeRemaining(session) {
  if (!session) return 20 * 60 * 1000;
  if (session.scheduled_end_at) {
    return new Date(session.scheduled_end_at) - Date.now();
  }
  if (session.created_at) {
    return new Date(session.created_at).getTime() + 90 * 60 * 1000 - Date.now();
  }
  return 20 * 60 * 1000; // 倾向 retry
}

// =====================================================
// formatContext - 各 Agent 的 Context 格式化工具
// =====================================================

export const formatContext = {
  // Gate 1 用
  forGate1: (context) => `
Demo maze description: ${context.demoDescription}
Student's current prompt: ${context.currentPrompt || 'not yet generated'}
`.trim(),

  // Gate 2 用
  forGate2: (context) => `
Completed upgrades and Gate 1 records:
${context.upgradeSummaries.map(s =>
  `- ${s.upgradeLabel}: student said "${s.studentSaid || 'not recorded'}", appeared in game: ${s.appearedInGame ?? 'not verified'}`
).join('\n') || 'none'}

Time remaining mode: ${context.gate2Mode}
Current prompt: ${context.currentPrompt || 'not available'}
`.trim(),

  // Debug Orchestrator 用
  forDebugOrchestrator: (context) => `
Completed upgrades: ${context.upgradeSummaries.length > 0
  ? context.upgradeSummaries.map(s => `${s.upgradeLabel}`).join(', ')
  : 'none'}
Recent bugs: ${context.recentBugs.length > 0
  ? context.recentBugs.slice(0, 3).map(b => `${b.bug_type}: ${b.bug_description}`).join('; ')
  : 'none'}
Current prompt: ${context.currentPrompt || 'not available'}
`.trim(),

  // Debug Prompt Tool 用（含 Gate 1 best_quote）
  forDebugPrompt: (context, bugSummary, relatedUpgrade) => `
Bug summary: ${bugSummary}
${relatedUpgrade ? `
Related upgrade Gate 1 record:
  Upgrade: ${relatedUpgrade.upgradeLabel}
  Student said in Gate 1: "${relatedUpgrade.studentSaid || 'not recorded'}"
  Appeared in game: ${relatedUpgrade.appearedInGame ?? 'not verified'}
  Failure type: ${relatedUpgrade.failureType || 'unknown'}
` : 'No related upgrade found.'}
Current prompt: ${context.currentPrompt || 'not available'}
`.trim(),

  // Debug Code Tool 用（不含 Gate 1）
  forDebugCode: (context, bugSummary) => `
Bug summary: ${bugSummary}
Current prompt: ${context.currentPrompt || 'not available'}
`.trim(),

  // Reset Tool 用
  forReset: (context, bugSummary) => `
Bug summary: ${bugSummary}
Successfully working features that can be kept:
${context.successfulUpgrades.length > 0
  ? context.successfulUpgrades.map(s => `- ${s.label}: "${s.studentSaid || ''}"`)
    .join('\n')
  : 'none verified yet'}
Base prompt for reference: ${context.currentPrompt || 'not available'}
`.trim(),

  // Report Agent 用（完整）
  forReport: (context) => `
Language precision training:
${context.upgradeSummaries.map(s =>
  `- ${s.upgradeLabel} (${s.difficulty}): ${s.rounds} rounds, early_release: ${s.earlyRelease}, quote: "${s.studentSaid || ''}"`
).join('\n')}

Debug history:
- Resolved bugs: ${context.resolvedBugs}
- Unresolved bugs: ${context.unresolvedBugs}
${context.recentBugs.map(b =>
  `- ${b.bug_type}: ${b.bug_description} → ${b.resolved ? 'resolved' : 'unresolved'}`
).join('\n')}
`.trim(),
};

/**
 * 初始化 AgentBridge
 *
 * @param {string} sessionId - 当前 session ID
 * @param {string} studentId - 当前 student ID
 * @param {Object} lesson - LESSON 配置
 * @param {Function} onOpenPanel - 打开 AgentPanel 的回调
 */
export function init(sessionId, studentId, lesson, onOpenPanel) {
  _sessionId = sessionId;
  _studentId = studentId;
  _lesson = lesson;
  _onOpenPanel = onOpenPanel;

  // 获取 session 详情
  loadSession(sessionId);
}

/**
 * 加载 session 详情
 */
async function loadSession(sessionId) {
  const { data } = await supabase
    .from('sessions')
    .select('id, created_at, lesson_type')
    .eq('id', sessionId)
    .single();

  if (data) {
    _session = data;
  }
}

/**
 * 获取学生当前 Upgrade 序号
 */
async function getUpgradeSequence(studentId) {
  const { count } = await supabase
    .from('agent_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId);

  return (count || 0) + 1;
}

/**
 * 获取当前 prompt（用于 Gate 1 上下文）
 * 从 localStorage 或 App 状态获取
 */
function getCurrentPrompt() {
  // 简单实现：返回空字符串，实际可以从 App 状态传入
  return '';
}

/**
 * 触发 Gate 事件
 *
 * @param {string} eventType - 'upgrade_started' | 'prompt_tab_revisited'
 * @param {string} upgradeId - 触发的 Upgrade ID
 * @param {string} difficulty - 难度等级
 */
export async function trigger(eventType, upgradeId, difficulty) {
  if (!_studentId || !_onOpenPanel) {
    console.warn('AgentBridge not initialized');
    return;
  }

  if (eventType === 'upgrade_started') {
    await handleUpgradeStarted(upgradeId, difficulty);
  } else if (eventType === 'prompt_tab_revisited') {
    await handlePromptTabRevisited();
  }
}

/**
 * Gate 1 触发：学生点击 Start 按钮
 */
async function handleUpgradeStarted(upgradeId, difficulty) {
  const upgrade = _lesson.upgrades.find(u => u.id === upgradeId);
  if (!upgrade) {
    console.warn('Upgrade not found:', upgradeId);
    return;
  }

  // 防重复：同一 Upgrade 不重复触发
  const { data: existing } = await supabase
    .from('agent_sessions')
    .select('id')
    .eq('student_id', _studentId)
    .eq('target_upgrade_id', upgradeId);

  if (existing && existing.length > 0) {
    console.log('Gate 1 already triggered for this upgrade:', upgradeId);
    // 如果已存在但未完成，可以继续（resume）
    const { data: incomplete } = await supabase
      .from('agent_sessions')
      .select('*')
      .eq('student_id', _studentId)
      .eq('target_upgrade_id', upgradeId)
      .eq('gate1_completed', false)
      .single();

    if (incomplete) {
      // 恢复未完成的 Gate 1
      _onOpenPanel({
        mode: 'gate1',
        sessionRecordId: incomplete.id,
        upgrade,
        lesson: _lesson,  // 传递当前课程配置
        currentPrompt: getCurrentPrompt(),
        resumeData: incomplete,
      });
      return;
    }

    // 已完成，不重复触发
    return;
  }

  // 创建新的 agent_session 记录
  const seq = await getUpgradeSequence(_studentId);
  const { data: record, error } = await supabase
    .from('agent_sessions')
    .insert({
      student_id: _studentId,
      session_id: _sessionId,
      lesson_type: _lesson.id,
      upgrade_sequence: seq,
      target_upgrade_id: upgrade.id,
      target_upgrade_label: upgrade.title,
      upgrade_difficulty: difficulty,
      language_dimensions_total: upgrade.language_dimensions?.length || 0,
      gate1_completed: false, // R4修复：默认 false
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create agent_session:', error);
    return;
  }

  // 刷新缓存：新记录已创建
  invalidateContextCache();

  // 通知 App.jsx 打开 AgentPanel
  _onOpenPanel({
    mode: 'gate1',
    sessionRecordId: record.id,
    upgrade,
    lesson: _lesson,  // 传递当前课程配置
    currentPrompt: getCurrentPrompt(),
  });
}

/**
 * Gate 2 重设计：静默标记
 *
 * 学生返回 Prompt Tab 时，不再弹出 Agent 对话框。
 * 直接把所有 pending 的 Upgrade 标记为 appeared=true（推断值）。
 *
 * 真正的失败记录由 Debug Agent 完成：
 * - 学生去 Debug → Debug Agent 记录 appeared=false
 * - 学生不去 Debug → 推断游戏正常，标记 appeared=true
 */
async function handlePromptTabRevisited() {
  if (!_studentId || !_sessionId) return;

  // 静默标记所有 pending 的 Upgrade 为 appeared=true
  await markPendingUpgradesAsAppeared(_studentId, _sessionId);
}

/**
 * 静默标记 pending 的 Upgrade 为 appeared=true
 *
 * 逻辑：学生返回 Prompt Tab 但没去 Debug，推断游戏正常运行
 */
async function markPendingUpgradesAsAppeared(studentId, sessionId) {
  // 找到所有 Gate 1 完成但 upgrade_appeared 还是 null 的记录
  const { data: pendingRecords } = await supabase
    .from('agent_sessions')
    .select('id')
    .eq('student_id', studentId)
    .eq('session_id', sessionId)
    .eq('gate1_completed', true)
    .is('upgrade_appeared', null);

  if (!pendingRecords || pendingRecords.length === 0) return;

  // 批量标记为 true（推断：学生没去 Debug 说明游戏正常）
  const ids = pendingRecords.map(r => r.id);
  await supabase
    .from('agent_sessions')
    .update({
      upgrade_appeared: true,
      gate2_failure_type: null,
      // gate2_inferred: true,  // TODO: 等数据库迁移后启用
    })
    .in('id', ids);

  console.log(`[AgentBridge] Marked ${ids.length} upgrades as appeared (inferred)`);
}

/**
 * Gate 1 完成回调
 *
 * @param {string} sessionRecordId - agent_session 记录 ID
 * @param {Object} data - 完成数据
 */
export async function onGate1Complete(sessionRecordId, data) {
  const {
    roundNum,
    input,
    scores,
    earlyRelease,
    bestQuote,
    draftPrompt,
    languageGrowth,
    dynamicParams,
    promptTemplate,
  } = data;

  const updateData = {
    gate1_completed: true,
    actual_rounds: roundNum,
    early_release: earlyRelease || false,
    best_student_quote: bestQuote,
    draft_prompt: draftPrompt || null,  // Hard upgrade 的初始 draft
    language_growth_note: languageGrowth,
  };

  // Medium Own Idea: persist dynamic params and template as JSON in draft_prompt
  // (draft_prompt is only used by Hard upgrades, safe to reuse for Medium)
  if (dynamicParams?.length > 0 && promptTemplate) {
    updateData.draft_prompt = JSON.stringify({
      _type: 'medium_dynamic',
      params: dynamicParams,
      template: promptTemplate,
    });
  }

  // 更新对应轮次的数据
  if (roundNum >= 1) {
    updateData.round_1_input = data.rounds?.[0]?.input;
    updateData.round_1_mode = data.rounds?.[0]?.mode;
    updateData.round_1_score_specificity = data.rounds?.[0]?.scores?.specificity;
    updateData.round_1_score_causality = data.rounds?.[0]?.scores?.causality;
    updateData.round_1_score_autonomy = data.rounds?.[0]?.scores?.autonomy;
    updateData.round_1_total = data.rounds?.[0]?.scores?.total;
  }
  if (roundNum >= 2) {
    updateData.round_2_input = data.rounds?.[1]?.input;
    updateData.round_2_mode = data.rounds?.[1]?.mode;
    updateData.round_2_score_specificity = data.rounds?.[1]?.scores?.specificity;
    updateData.round_2_score_causality = data.rounds?.[1]?.scores?.causality;
    updateData.round_2_score_autonomy = data.rounds?.[1]?.scores?.autonomy;
    updateData.round_2_total = data.rounds?.[1]?.scores?.total;
  }
  if (roundNum >= 3) {
    updateData.round_3_input = data.rounds?.[2]?.input;
    updateData.round_3_mode = data.rounds?.[2]?.mode;
    updateData.round_3_score_specificity = data.rounds?.[2]?.scores?.specificity;
    updateData.round_3_score_causality = data.rounds?.[2]?.scores?.causality;
    updateData.round_3_score_autonomy = data.rounds?.[2]?.scores?.autonomy;
    updateData.round_3_total = data.rounds?.[2]?.scores?.total;
  }

  const { error } = await supabase
    .from('agent_sessions')
    .update(updateData)
    .eq('id', sessionRecordId);

  if (error) {
    console.error('Failed to update agent_session:', error);
  }

  // 刷新缓存：新数据已写入
  invalidateContextCache();
  invalidateTimelineCache(); // V17 Phase B: 同步刷新 timeline 缓存
}

/**
 * Gate 2 完成回调
 *
 * @param {Array} updates - 批量更新数据
 */
export async function onGate2Complete(updates) {
  for (const update of updates) {
    if (update.type === 'verify') {
      // 构建更新数据
      const updateData = {
        upgrade_appeared: update.upgrade_appeared,
        student_attributed: update.attributed,
        gate2_failure_type: update.failure_type,
        gate2_mode: update.gate2Mode,
        gate2_input: update.input,
        student_diagnosed: update.diagnosed,
        retry_count: update.retry_count || 0,
        retry_appeared: update.retry_appeared,
      };

      // Hard 专用字段（如果存在）
      if (update.upgrade_matched !== undefined) {
        updateData.upgrade_matched = update.upgrade_matched;
      }
      if (update.mismatch_detail) {
        updateData.mismatch_detail = update.mismatch_detail;
      }

      await supabase
        .from('agent_sessions')
        .update(updateData)
        .eq('id', update.sessionId);
    } else if (update.type === 'resume_complete') {
      // 恢复并完成的 Gate 1
      await supabase
        .from('agent_sessions')
        .update({
          gate1_completed: true,
          actual_rounds: update.roundNum,
          best_student_quote: update.best_quote,
          language_growth_note: update.language_growth,
        })
        .eq('id', update.sessionId);
    }
  }

  // 刷新缓存：Gate 2 结果已写入
  invalidateContextCache();
  invalidateTimelineCache(); // V17 Phase B: 同步刷新 timeline 缓存
}

/**
 * 获取 Upgrade 的 agent_session 记录
 * 用于检查是否已完成 Gate 1
 */
export async function getAgentSession(upgradeId) {
  if (!_studentId) return null;

  const { data } = await supabase
    .from('agent_sessions')
    .select('*')
    .eq('student_id', _studentId)
    .eq('target_upgrade_id', upgradeId)
    .single();

  return data;
}

/**
 * 批量获取所有已完成 Gate 1 的 Upgrade ID 列表
 * 同时返回动态 params 和 template（用于 Medium Own Idea）
 */
export async function getCompletedUpgradeIds() {
  if (!_studentId) return { ids: [], dynamicConfigs: {} };

  const { data } = await supabase
    .from('agent_sessions')
    .select('target_upgrade_id, draft_prompt')
    .eq('student_id', _studentId)
    .eq('gate1_completed', true);

  const ids = (data || []).map(d => d.target_upgrade_id);
  const dynamicConfigs = {};
  (data || []).forEach(d => {
    if (d.draft_prompt) {
      try {
        const parsed = JSON.parse(d.draft_prompt);
        if (parsed._type === 'medium_dynamic' && parsed.params && parsed.template) {
          dynamicConfigs[d.target_upgrade_id] = {
            params: parsed.params,
            template: parsed.template,
          };
        }
      } catch {
        // Not JSON — likely a Hard upgrade string, ignore
      }
    }
  });

  return { ids, dynamicConfigs };
}

// =====================================================
// Debug Multi-Agent System Functions
// （使用统一的 buildStudentContext）
// =====================================================

/**
 * Debug Tab 打开时触发
 */
export async function triggerDebug() {
  if (!_studentId || !_onOpenPanel) return;

  const context = await buildStudentContext(_studentId, _sessionId, getCurrentPrompt());

  _onOpenPanel({
    mode: 'debug_orchestrator',
    studentContext: context,
    contextString: formatContext.forDebugOrchestrator(context),
  });
}

/**
 * Orchestrator 完成分类后路由到对应 Tool
 *
 * @param {string} route - 'prompt_tool' | 'code_tool' | 'reset_tool'
 * @param {string} bugSummary - bug 描述摘要
 * @param {string|null} relatedUpgrade - 相关 Upgrade 名字（A类专用）
 * @param {string} orchestratorSessionId - debug_session 记录 ID
 */
export async function routeDebug(route, bugSummary, relatedUpgrade, orchestratorSessionId) {
  const context = await buildStudentContext(_studentId, _sessionId, getCurrentPrompt());

  // 查找相关 Upgrade 的完整记录
  const relatedUpgradeRecord = context.upgradeSummaries.find(
    s => s.upgradeLabel === relatedUpgrade || s.upgradeId === relatedUpgrade
  );

  if (route === 'prompt_tool') {
    _onOpenPanel({
      mode: 'debug_prompt',
      studentContext: context,
      contextString: formatContext.forDebugPrompt(context, bugSummary, relatedUpgradeRecord),
      bugSummary,
      relatedUpgrade,
      debugSessionId: orchestratorSessionId,
    });
  } else if (route === 'code_tool') {
    _onOpenPanel({
      mode: 'debug_code',
      studentContext: context,
      contextString: formatContext.forDebugCode(context, bugSummary),
      bugSummary,
      debugSessionId: orchestratorSessionId,
    });
  } else if (route === 'reset_tool') {
    _onOpenPanel({
      mode: 'debug_reset_phase1',
      studentContext: context,
      contextString: formatContext.forReset(context, bugSummary),
      bugSummary,
      debugSessionId: orchestratorSessionId,
    });
  }
}

/**
 * Debug 执行后返回，触发验证
 *
 * @param {Object} pendingVerification - { type, debugSessionId }
 */
export async function triggerDebugVerification(pendingVerification) {
  const { type, debugSessionId } = pendingVerification;
  const context = await buildStudentContext(_studentId, _sessionId, getCurrentPrompt());

  if (type === 'reset') {
    // Reset 直接触发 Phase 2 认知反思
    _onOpenPanel({
      mode: 'debug_reset_phase2',
      studentContext: context,
      debugSessionId,
    });
  } else {
    // Prompt Fix / Code Fix 验证
    _onOpenPanel({
      mode: 'debug_verify',
      type,
      studentContext: context,
      debugSessionId,
    });
  }
}

/**
 * 创建 debug_session 记录
 *
 * @param {string} bugType - 'prompt' | 'code' | 'reset'
 * @param {string} severity - 'light' | 'heavy'
 * @param {string} bugDescription - bug 描述
 * @param {string|null} relatedUpgradeId - 相关 Upgrade ID
 */
export async function createDebugSession(bugType, severity, bugDescription, relatedUpgradeId = null) {
  const { data: record, error } = await supabase
    .from('debug_sessions')
    .insert({
      student_id: _studentId,
      session_id: _sessionId,
      bug_type: bugType,
      severity,
      bug_description: bugDescription,
      related_upgrade_id: relatedUpgradeId,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create debug_session:', error);
    return null;
  }

  return record;
}

/**
 * 更新 debug_session 记录
 */
export async function updateDebugSession(debugSessionId, data) {
  const { error } = await supabase
    .from('debug_sessions')
    .update(data)
    .eq('id', debugSessionId);

  if (error) {
    console.error('Failed to update debug_session:', error);
  }

  // 刷新缓存：Debug 记录已更新
  invalidateContextCache();
  invalidateTimelineCache(); // V17 Phase B: 同步刷新 timeline 缓存
}

/**
 * 获取 debug_session 记录
 */
export async function getDebugSession(debugSessionId) {
  const { data } = await supabase
    .from('debug_sessions')
    .select('*')
    .eq('id', debugSessionId)
    .single();

  return data;
}

// 导出 agentBridge 对象供 App.jsx 使用
export const agentBridge = {
  init,
  trigger,
  onGate1Complete,
  onGate2Complete,
  getAgentSession,
  getCompletedUpgradeIds,
  // Debug functions
  triggerDebug,
  routeDebug,
  triggerDebugVerification,
  createDebugSession,
  updateDebugSession,
  getDebugSession,
  // Student Context Layer
  buildStudentContext,
  invalidateContextCache,
  formatContext,
};

export default agentBridge;
