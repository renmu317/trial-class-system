/**
 * SessionMemoryManager - 统一会话记忆管理
 *
 * 2026-07-11: 方案 C - Session Memory
 * - 统一所有缓存管理
 * - 统一消息格式
 * - 提供单一接口给所有 Agent
 *
 * 解决的问题：
 * - 对话历史分散（Gate 用内存，Debug 用 DB）
 * - 两套历史系统并存（timeline vs conversation_history）
 * - 缓存管理分散（两个独立的 30 秒缓存）
 * - 上下文注入不统一
 */

import { supabase } from './supabase';
import { formatForDebug, formatForGate1, formatForGate2 } from './timeline';

// 缓存 TTL（毫秒）
const CACHE_TTL = 30 * 1000; // 30 秒

/**
 * 统一的会话记忆管理器
 */
class SessionMemoryManager {
  constructor() {
    // 缓存存储
    this._cache = {
      timeline: null,
      context: null,
      conversations: {},
      agentSessions: null,
    };

    // 缓存时间戳
    this._cacheTime = {
      timeline: null,
      context: null,
      agentSessions: null,
    };

    // 当前会话信息
    this._studentId = null;
    this._sessionId = null;
  }

  /**
   * 设置当前会话
   */
  setSession(studentId, sessionId) {
    if (this._studentId !== studentId || this._sessionId !== sessionId) {
      // 会话变更，清空所有缓存
      this.clearAllCaches();
    }
    this._studentId = studentId;
    this._sessionId = sessionId;
  }

  /**
   * 检查缓存是否有效
   */
  _isCacheValid(cacheType) {
    const cacheTime = this._cacheTime[cacheType];
    if (!cacheTime) return false;
    return Date.now() - cacheTime < CACHE_TTL;
  }

  // =====================================================
  // Timeline 操作
  // =====================================================

  /**
   * 获取完整时间线（30秒缓存）
   */
  async getTimeline(studentId = this._studentId, sessionId = this._sessionId) {
    if (!studentId || !sessionId) {
      console.warn('[SessionMemory] Missing studentId or sessionId');
      return [];
    }

    // 检查缓存
    if (this._cache.timeline && this._isCacheValid('timeline')) {
      return this._cache.timeline;
    }

    try {
      const { data, error } = await supabase
        .from('session_timeline')
        .select('*')
        .eq('student_id', studentId)
        .eq('session_id', sessionId)
        .eq('visible_to_agent', true)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[SessionMemory] getTimeline error:', error);
        return [];
      }

      this._cache.timeline = data || [];
      this._cacheTime.timeline = Date.now();
      return this._cache.timeline;
    } catch (e) {
      console.error('[SessionMemory] getTimeline exception:', e);
      return [];
    }
  }

  /**
   * 写入事件到时间线
   */
  async writeEvent(event) {
    const studentId = this._studentId;
    const sessionId = this._sessionId;

    if (!studentId || !sessionId) {
      console.warn('[SessionMemory] Cannot write event: missing session');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('session_timeline')
        .insert({
          student_id: studentId,
          session_id: sessionId,
          ...event,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[SessionMemory] writeEvent error:', error);
        return null;
      }

      // 清除时间线缓存
      this.invalidateTimeline();
      return data;
    } catch (e) {
      console.error('[SessionMemory] writeEvent exception:', e);
      return null;
    }
  }

  // =====================================================
  // Agent Sessions 操作
  // =====================================================

  /**
   * 获取 Agent Sessions（Gate 1/2 记录）
   */
  async getAgentSessions(studentId = this._studentId) {
    if (!studentId) return [];

    if (this._cache.agentSessions && this._isCacheValid('agentSessions')) {
      return this._cache.agentSessions;
    }

    try {
      const { data, error } = await supabase
        .from('agent_sessions')
        .select(`
          id,
          target_upgrade_id,
          gate1_completed,
          actual_rounds,
          best_student_quote,
          upgrade_appeared,
          gate2_failure_type,
          draft_prompt,
          created_at
        `)
        .eq('student_id', studentId)
        .eq('gate1_completed', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[SessionMemory] getAgentSessions error:', error);
        return [];
      }

      this._cache.agentSessions = data || [];
      this._cacheTime.agentSessions = Date.now();
      return this._cache.agentSessions;
    } catch (e) {
      console.error('[SessionMemory] getAgentSessions exception:', e);
      return [];
    }
  }

  // =====================================================
  // Debug Conversations 操作
  // =====================================================

  /**
   * 获取特定 Debug 对话历史
   */
  async getDebugConversation(debugSessionId) {
    if (!debugSessionId) return [];

    // 检查缓存
    if (this._cache.conversations[debugSessionId]) {
      return this._cache.conversations[debugSessionId];
    }

    try {
      const { data, error } = await supabase
        .from('debug_sessions')
        .select('conversation_history')
        .eq('id', debugSessionId)
        .single();

      if (error) {
        console.error('[SessionMemory] getDebugConversation error:', error);
        return [];
      }

      const history = data?.conversation_history || [];
      this._cache.conversations[debugSessionId] = history;
      return history;
    } catch (e) {
      console.error('[SessionMemory] getDebugConversation exception:', e);
      return [];
    }
  }

  /**
   * 更新 Debug 对话历史
   */
  async updateDebugConversation(debugSessionId, messages) {
    if (!debugSessionId) return false;

    try {
      // 清理消息格式
      const dbMessages = messages.map(m => ({
        role: m.role || 'user',
        content: typeof m.content === 'string' ? m.content : String(m.content || ''),
        timestamp: m.timestamp || new Date().toISOString(),
        ...(m.metadata && { metadata: m.metadata }),
      }));

      const { error } = await supabase
        .from('debug_sessions')
        .update({ conversation_history: dbMessages })
        .eq('id', debugSessionId);

      if (error) {
        console.error('[SessionMemory] updateDebugConversation error:', error);
        return false;
      }

      // 更新缓存
      this._cache.conversations[debugSessionId] = dbMessages;
      return true;
    } catch (e) {
      console.error('[SessionMemory] updateDebugConversation exception:', e);
      return false;
    }
  }

  // =====================================================
  // 统一上下文构建
  // =====================================================

  /**
   * 构建统一上下文（所有 Agent 共用）
   */
  async buildUnifiedContext(currentPrompt = '') {
    const studentId = this._studentId;
    const sessionId = this._sessionId;

    if (!studentId || !sessionId) {
      return { timeline: [], agentSessions: [], formatted: {} };
    }

    // 并行获取数据
    const [timeline, agentSessions] = await Promise.all([
      this.getTimeline(),
      this.getAgentSessions(),
    ]);

    // 构建格式化上下文
    const formatted = {
      forGate1: formatForGate1 ? formatForGate1(timeline, currentPrompt) : '',
      forGate2: formatForGate2 ? formatForGate2(timeline, currentPrompt) : '',
      forDebug: formatForDebug(timeline, currentPrompt),
    };

    return {
      timeline,
      agentSessions,
      currentPrompt,
      studentId,
      sessionId,
      formatted,
    };
  }

  /**
   * 为特定 Agent 类型获取格式化上下文
   */
  async getContextForAgent(agentType, currentPrompt = '') {
    const context = await this.buildUnifiedContext(currentPrompt);

    switch (agentType) {
      case 'gate1':
        return context.formatted.forGate1;
      case 'gate2':
        return context.formatted.forGate2;
      case 'debug':
      case 'debug_unified':
        return context.formatted.forDebug;
      default:
        return context.formatted.forDebug;
    }
  }

  // =====================================================
  // 缓存管理
  // =====================================================

  /**
   * 清除所有缓存
   */
  clearAllCaches() {
    this._cache = {
      timeline: null,
      context: null,
      conversations: {},
      agentSessions: null,
    };
    this._cacheTime = {
      timeline: null,
      context: null,
      agentSessions: null,
    };
    console.log('[SessionMemory] All caches cleared');
  }

  /**
   * 清除时间线缓存
   */
  invalidateTimeline() {
    this._cache.timeline = null;
    this._cacheTime.timeline = null;
  }

  /**
   * 清除 Agent Sessions 缓存
   */
  invalidateAgentSessions() {
    this._cache.agentSessions = null;
    this._cacheTime.agentSessions = null;
  }

  /**
   * 清除特定 Debug 对话缓存
   */
  invalidateConversation(debugSessionId) {
    if (debugSessionId) {
      delete this._cache.conversations[debugSessionId];
    } else {
      this._cache.conversations = {};
    }
  }

  // =====================================================
  // 便捷方法
  // =====================================================

  /**
   * 获取成功的 Upgrades（用于 Reset）
   */
  async getSuccessfulUpgrades() {
    const timeline = await this.getTimeline();

    // 找到所有 gate1_complete 事件
    const completedUpgrades = timeline
      .filter(e => e.event_type === 'gate1_complete')
      .map(e => ({
        upgradeId: e.upgrade_id,
        label: e.metadata?.upgrade_label || e.upgrade_id,
        timestamp: e.created_at,
      }));

    return completedUpgrades;
  }

  /**
   * 获取最近的 Bug 记录
   */
  async getRecentBugs(limit = 5) {
    const studentId = this._studentId;
    if (!studentId) return [];

    try {
      const { data, error } = await supabase
        .from('debug_sessions')
        .select('id, bug_type, bug_description, resolved, started_at')
        .eq('student_id', studentId)
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[SessionMemory] getRecentBugs error:', error);
        return [];
      }

      return data || [];
    } catch (e) {
      console.error('[SessionMemory] getRecentBugs exception:', e);
      return [];
    }
  }
}

// 全局单例
export const sessionMemory = new SessionMemoryManager();

// 导出类（用于测试）
export { SessionMemoryManager };
