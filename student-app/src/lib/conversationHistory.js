/**
 * Conversation History — 对话历史管理
 *
 * 负责对话历史的 system turn 注入和裁剪
 *
 * 触发时机：
 * - addRouteMarker() → handleRoute() 里，setCurrentMode() 之前
 * - trimConversationHistory() → callAgent() 里，messages 构建时
 * - compressTool() → handleToolComplete() 里，学生点 Go Generate 时
 * - compressChat() → handleResolvedConfirm() 里，学生说修好了时
 *
 * 2026-05-26: V17 Phase B 重构
 */

// =====================================================
// 工具调用结果写入（作为 system turn）
// =====================================================

/**
 * Orchestrator 路由完成 — 在 handleRoute() 里调用
 *
 * @param {Array} conversationHistory - 当前对话历史
 * @param {string} route - 路由目标 (prompt_tool, code_tool, reset_tool)
 * @param {string} bugSummary - bug 摘要
 * @returns {Array} - 新的对话历史
 */
export const addRouteMarker = (conversationHistory, route, bugSummary) => [
  ...conversationHistory,
  {
    role: 'system',
    content: `[ROUTED-TO-${route.toUpperCase()}] Bug confirmed: "${bugSummary}". Now help student find root cause.`,
    isToolResult: true,
    timestamp: new Date().toISOString(),
  },
];

/**
 * Gate 2 失败切换 Debug
 *
 * @param {Array} conversationHistory
 * @param {string} failedUpgrade - 失败的 Upgrade 名称
 * @param {string} studentSaid - 学生说的话
 * @returns {Array}
 */
export const addGate2DebugSwitch = (conversationHistory, failedUpgrade, studentSaid) => [
  ...conversationHistory,
  {
    role: 'system',
    content: `[SWITCH-TO-DEBUG] ${failedUpgrade} did not appear. Student said: "${studentSaid}". Starting debug classification.`,
    isToolResult: true,
    timestamp: new Date().toISOString(),
  },
];

/**
 * Gate 1 Medium 推荐值生成
 *
 * @param {Array} conversationHistory
 * @param {Object} recommendations - 参数推荐值
 * @returns {Array}
 */
export const addParamRecommendations = (conversationHistory, recommendations) => [
  ...conversationHistory,
  {
    role: 'system',
    content: `[PARAM-RECOMMENDATIONS] ${
      Object.entries(recommendations)
        .map(([k, v]) => `${k}=${v.value} (${v.reason})`)
        .join(', ')
    }`,
    isToolResult: true,
    timestamp: new Date().toISOString(),
  },
];

/**
 * Gate 1 完成标记
 *
 * @param {Array} conversationHistory
 * @param {string} upgradeLabel
 * @param {string} bestQuote
 * @returns {Array}
 */
export const addGate1CompletionMarker = (conversationHistory, upgradeLabel, bestQuote) => [
  ...conversationHistory,
  {
    role: 'system',
    content: `[GATE1-COMPLETE] ${upgradeLabel}: "${bestQuote}"`,
    isToolResult: true,
    timestamp: new Date().toISOString(),
  },
];

// =====================================================
// 对话历史裁剪 — 在 callAgent() 里调用
// =====================================================

/**
 * 裁剪对话历史
 *
 * 策略：
 * 1. 找到最后一个路由标记
 * 2. 路由前的对话：只保留 system 标记
 * 3. 路由后的对话：全部保留
 *
 * @param {Array} history - 完整对话历史
 * @returns {Array} - 裁剪后的对话历史
 */
export const trimConversationHistory = (history) => {
  if (!history || history.length === 0) {
    return [];
  }

  // 找到最后一个路由标记的位置
  const lastRouteIdx = history.reduce((acc, turn, i) => {
    if (turn.content?.includes('[ROUTED-TO-') || turn.isToolResult) {
      return i;
    }
    return acc;
  }, -1);

  // 还在 Orchestrator 阶段，全部保留
  if (lastRouteIdx === -1) {
    return history;
  }

  const beforeRoute = history.slice(0, lastRouteIdx);
  const currentTool = history.slice(lastRouteIdx);

  // 之前的 Tool 对话：只保留标记
  const compressed = beforeRoute.filter(
    t =>
      t.isToolResult ||
      t.content?.includes('[CHAT-INSIGHT]') ||
      t.content?.includes('[ORCHESTRATOR-SUMMARY]') ||
      t.content?.includes('[GATE1-COMPLETE]') ||
      t.content?.includes('[DEBUG-COMPLETE]')
  );

  return [...compressed, ...currentTool];
};

/**
 * 计算对话历史的估算 token 数
 *
 * @param {Array} history
 * @returns {number}
 */
export const estimateTokenCount = (history) => {
  const totalChars = history.reduce((acc, turn) => acc + (turn.content?.length || 0), 0);
  // 粗略估算：1 token ≈ 4 字符
  return Math.ceil(totalChars / 4);
};

/**
 * 强制裁剪到指定 token 数以下
 *
 * @param {Array} history
 * @param {number} maxTokens
 * @returns {Array}
 */
export const forceTokenLimit = (history, maxTokens = 600) => {
  let trimmed = trimConversationHistory(history);

  // 如果还是太长，从头部开始删除（保留最近的对话）
  while (estimateTokenCount(trimmed) > maxTokens && trimmed.length > 2) {
    // 保留第一条 system 消息（如果有）
    const firstIsSystem = trimmed[0]?.role === 'system';
    if (firstIsSystem) {
      trimmed = [trimmed[0], ...trimmed.slice(2)];
    } else {
      trimmed = trimmed.slice(1);
    }
  }

  return trimmed;
};

// =====================================================
// Tool/Chat 完成时压缩
// =====================================================

/**
 * Tool 完成时压缩 — 在 handleToolComplete() 里调用（学生点 Go Generate）
 *
 * @param {Array} history
 * @param {string} toolType - 'prompt' | 'code' | 'reset'
 * @param {string} studentFix - 学生的修复描述
 * @returns {Array}
 */
export const compressTool = (history, toolType, studentFix) => {
  // 找到最后一个路由标记
  const lastRouteIdx = history.reduce((acc, t, i) =>
    t.content?.includes('[ROUTED-TO-') ? i : acc,
    -1
  );

  const before = lastRouteIdx > 0 ? history.slice(0, lastRouteIdx) : [];

  return [
    ...before,
    {
      role: 'system',
      content: `[${toolType.toUpperCase()}-SUMMARY] Student identified fix: "${studentFix}"`,
      isToolResult: true,
      timestamp: new Date().toISOString(),
    },
  ];
};

/**
 * Chat resolved 时压缩 — 在 handleResolvedConfirm() 里调用（学生说修好了）
 *
 * @param {Array} history - 不使用，直接返回新数组
 * @param {string} bugType
 * @param {string} fixText
 * @returns {Array}
 */
export const compressChat = (history, bugType, fixText) => [
  {
    role: 'system',
    content: `[CHAT-INSIGHT] ${bugType} bug. Fix: "${fixText}". Resolved.`,
    isToolResult: true,
    displayInUI: false,
    timestamp: new Date().toISOString(),
  },
];

// =====================================================
// 辅助函数
// =====================================================

/**
 * 检查对话历史中是否有特定标记
 *
 * @param {Array} history
 * @param {string} markerType - 'ROUTED-TO' | 'GATE1-COMPLETE' | 等
 * @returns {boolean}
 */
export const hasMarker = (history, markerType) => {
  return history.some(t => t.content?.includes(`[${markerType}`));
};

/**
 * 获取最后一个路由的目标
 *
 * @param {Array} history
 * @returns {string|null} - 'prompt_tool' | 'code_tool' | 'reset_tool' | null
 */
export const getLastRouteTarget = (history) => {
  for (let i = history.length - 1; i >= 0; i--) {
    const content = history[i].content;
    if (content?.includes('[ROUTED-TO-PROMPT_TOOL]')) return 'prompt_tool';
    if (content?.includes('[ROUTED-TO-CODE_TOOL]')) return 'code_tool';
    if (content?.includes('[ROUTED-TO-RESET_TOOL]')) return 'reset_tool';
  }
  return null;
};

/**
 * 提取对话历史中的所有 bug 修复摘要
 *
 * @param {Array} history
 * @returns {Array<string>}
 */
export const extractFixSummaries = (history) => {
  return history
    .filter(t => t.content?.includes('-SUMMARY]'))
    .map(t => {
      const match = t.content.match(/Student identified fix: "(.+?)"/);
      return match ? match[1] : null;
    })
    .filter(Boolean);
};
