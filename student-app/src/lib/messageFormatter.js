/**
 * MessageFormatter - 统一消息格式
 *
 * 2026-07-11: 方案 C - Session Memory
 * - 统一 Gate 1, Gate 2, Debug 的消息格式
 * - 提供转换工具（DB 格式、API 格式、UI 显示）
 * - 支持系统标记和用户消息分离
 */

/**
 * 统一消息类
 */
export class Message {
  constructor({
    role,           // 'user' | 'assistant' | 'system'
    content,        // 文本内容
    agentType = null, // 'gate1' | 'gate2' | 'debug' | null
    imagePreview = null, // 可选：图片预览 URL
    metadata = {},  // 可选：元数据
    timestamp = null, // 可选：时间戳
  }) {
    this.role = role;
    this.content = content;
    this.agentType = agentType;
    this.imagePreview = imagePreview;
    this.metadata = metadata;
    this.timestamp = timestamp || new Date().toISOString();
  }

  /**
   * 转为数据库存储格式
   */
  toDBFormat() {
    return {
      role: this.role,
      content: typeof this.content === 'string'
        ? this.content
        : JSON.stringify(this.content),
      timestamp: this.timestamp,
      ...(this.agentType && { agent_type: this.agentType }),
      ...(Object.keys(this.metadata).length > 0 && { metadata: this.metadata }),
    };
  }

  /**
   * 转为 API 调用格式
   */
  toAPIFormat() {
    // 如果有图片，使用 Vision 格式
    if (this.imagePreview && this.imagePreview.startsWith('data:')) {
      return {
        role: this.role,
        content: [
          { type: 'text', text: this.content || '' },
          { type: 'image_url', image_url: { url: this.imagePreview } },
        ],
      };
    }

    return {
      role: this.role,
      content: this.content,
    };
  }

  /**
   * 是否应该在 UI 中显示
   */
  isVisibleInUI() {
    // 过滤系统标记
    if (this.metadata?.isSystemMarker) return false;
    if (this.metadata?.isToolResult) return false;

    // 过滤路由标记
    const content = String(this.content || '');
    if (content.includes('[ROUTED-TO-')) return false;
    if (content.includes('[ORCHESTRATOR-SUMMARY]')) return false;
    if (content.includes('[CHAT-INSIGHT]')) return false;
    if (content.includes('[SWITCH-TO-DEBUG]')) return false;

    return true;
  }

  /**
   * 是否是系统标记
   */
  isSystemMarker() {
    return this.role === 'system' && this.metadata?.isSystemMarker;
  }

  /**
   * 估算 Token 数量（粗略估计）
   */
  estimateTokens() {
    const text = typeof this.content === 'string'
      ? this.content
      : JSON.stringify(this.content);
    // 粗略估计：1 token ≈ 4 字符（英文）或 1.5 字符（中文）
    return Math.ceil(text.length / 3);
  }
}

// =====================================================
// 工厂函数
// =====================================================

/**
 * 创建用户消息
 */
export function createUserMessage(content, agentType = null, metadata = {}) {
  return new Message({
    role: 'user',
    content,
    agentType,
    metadata,
  });
}

/**
 * 创建助手消息
 */
export function createAssistantMessage(content, agentType = null, metadata = {}) {
  return new Message({
    role: 'assistant',
    content,
    agentType,
    metadata,
  });
}

/**
 * 创建系统标记
 */
export function createSystemMarker(markerType, content, metadata = {}) {
  return new Message({
    role: 'system',
    content: `[${markerType}] ${content}`,
    metadata: {
      isSystemMarker: true,
      markerType,
      ...metadata,
    },
  });
}

/**
 * 创建带图片的用户消息
 */
export function createImageMessage(content, imagePreview, agentType = null, metadata = {}) {
  return new Message({
    role: 'user',
    content: content || '[Image attached]',
    agentType,
    imagePreview,
    metadata: {
      hasImage: true,
      ...metadata,
    },
  });
}

// =====================================================
// 转换工具
// =====================================================

/**
 * 从数据库格式转换为 Message 对象
 */
export function fromDBFormat(dbMessage, agentType = null) {
  return new Message({
    role: dbMessage.role,
    content: dbMessage.content,
    agentType: dbMessage.agent_type || agentType,
    metadata: dbMessage.metadata || {},
    timestamp: dbMessage.timestamp || dbMessage.created_at,
  });
}

/**
 * 批量转换数据库消息
 */
export function fromDBMessages(dbMessages, agentType = null) {
  return (dbMessages || []).map(m => fromDBFormat(m, agentType));
}

/**
 * 转换为数据库格式数组
 */
export function toDBMessages(messages) {
  return messages.map(m => {
    if (m instanceof Message) {
      return m.toDBFormat();
    }
    // 兼容普通对象
    return {
      role: m.role || 'user',
      content: typeof m.content === 'string' ? m.content : String(m.content || ''),
      timestamp: m.timestamp || new Date().toISOString(),
    };
  });
}

/**
 * 转换为 API 格式数组
 */
export function toAPIMessages(messages) {
  return messages.map(m => {
    if (m instanceof Message) {
      return m.toAPIFormat();
    }
    return { role: m.role, content: m.content };
  });
}

/**
 * 过滤出 UI 可见消息
 */
export function filterVisibleMessages(messages) {
  return messages.filter(m => {
    if (m instanceof Message) {
      return m.isVisibleInUI();
    }
    // 兼容普通对象
    const content = String(m.content || '');
    if (content.includes('[ROUTED-TO-')) return false;
    if (m.isToolResult) return false;
    if (content.includes('[ORCHESTRATOR-SUMMARY]')) return false;
    return true;
  });
}

// =====================================================
// Token 管理
// =====================================================

/**
 * 估算消息列表的总 Token 数
 */
export function estimateTotalTokens(messages) {
  return messages.reduce((total, m) => {
    if (m instanceof Message) {
      return total + m.estimateTokens();
    }
    const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
    return total + Math.ceil(content.length / 3);
  }, 0);
}

/**
 * 裁剪消息列表以符合 Token 预算
 * 保留最新的消息，删除最旧的
 */
export function trimToTokenBudget(messages, maxTokens = 2000) {
  if (!messages || messages.length === 0) return [];

  let totalTokens = estimateTotalTokens(messages);

  // 如果已经在预算内，直接返回
  if (totalTokens <= maxTokens) return messages;

  // 复制数组，从头部删除直到符合预算
  const trimmed = [...messages];

  while (totalTokens > maxTokens && trimmed.length > 2) {
    const removed = trimmed.shift();
    const removedTokens = removed instanceof Message
      ? removed.estimateTokens()
      : Math.ceil(String(removed.content || '').length / 3);
    totalTokens -= removedTokens;
  }

  console.log(`[MessageFormatter] Trimmed from ${messages.length} to ${trimmed.length} messages`);
  return trimmed;
}

/**
 * 智能裁剪：保留系统标记 + 最新对话
 */
export function smartTrim(messages, maxTokens = 2000) {
  if (!messages || messages.length === 0) return [];

  // 分离系统标记和普通消息
  const systemMarkers = messages.filter(m =>
    (m instanceof Message ? m.isSystemMarker() : m.role === 'system')
  );
  const normalMessages = messages.filter(m =>
    !(m instanceof Message ? m.isSystemMarker() : m.role === 'system')
  );

  // 计算系统标记的 Token
  const systemTokens = estimateTotalTokens(systemMarkers);

  // 剩余预算给普通消息
  const remainingBudget = maxTokens - systemTokens;

  // 裁剪普通消息
  const trimmedNormal = trimToTokenBudget(normalMessages, remainingBudget);

  // 合并：系统标记在前，普通消息在后
  return [...systemMarkers, ...trimmedNormal];
}
