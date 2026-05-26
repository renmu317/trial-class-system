/**
 * Agent Caller — 调用层
 *
 * 整合代码层预检和模型调用
 * 流程：代码层预检 → 裁剪对话历史 → 调用模型 → 代码层后处理
 *
 * 2026-05-26: V17 Phase B 重构
 */

import { preCheckInput, checkMaxRounds, getForceReleaseResponse } from './agentGuards';
import { trimConversationHistory } from './conversationHistory';

// Supabase Edge Function URL for DeepSeek proxy
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const DEEPSEEK_PROXY_URL = `${SUPABASE_URL}/functions/v1/deepseek-proxy`;

// ─────────────────────────────────────────────────────────
// DeepSeek API 调用
// ─────────────────────────────────────────────────────────

/**
 * JSON 格式强制约束消息
 * 紧挨输出，不会被遗忘
 */
const JSON_FORMAT_CONSTRAINT = {
  role: 'user',
  content: '__FORMAT__: Return JSON only. { } No other text.',
};

/**
 * 调用 DeepSeek API
 *
 * @param {Object} options
 * @param {string} options.systemPrompt - System Prompt
 * @param {Array} options.messages - 对话历史
 * @param {number} [options.temperature=0.7] - 温度
 * @param {number} [options.maxTokens=500] - 最大 tokens
 * @param {boolean} [options.hasImage=false] - 是否包含图片
 * @returns {Promise<string>} - API 原始响应
 */
async function callDeepSeek({ systemPrompt, messages, temperature = 0.7, maxTokens = 500, hasImage = false }) {
  // 构建完整消息列表
  const fullMessages = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  // 非图片模式添加 JSON 格式约束
  const messagesWithConstraint = hasImage ? fullMessages : [...fullMessages, JSON_FORMAT_CONSTRAINT];

  const response = await fetch(DEEPSEEK_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      messages: messagesWithConstraint,
      temperature,
      max_tokens: maxTokens,
      model: hasImage ? 'deepseek-vl' : 'deepseek-chat',
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ─────────────────────────────────────────────────────────
// JSON 解析
// ─────────────────────────────────────────────────────────

/**
 * 多策略 JSON 解析
 *
 * @param {string} rawText - API 原始响应
 * @param {number} currentRound - 当前轮数（fallback 用）
 * @returns {Object} - 解析后的响应对象
 */
function parseAgentResponse(rawText, currentRound = 1) {
  // 策略1：直接解析
  try {
    return JSON.parse(rawText.trim());
  } catch {}

  // 策略2：提取 ```json``` 代码块
  const jsonBlock = rawText.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlock) {
    try {
      return JSON.parse(jsonBlock[1]);
    } catch {}
  }

  // 策略3：提取第一个 {...} 块
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    // 策略3a：直接解析
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {}

    // 策略3b：修复 string 值里的换行（DeepSeek 常见问题）
    try {
      const fixed = jsonMatch[0].replace(/:\s*"([^"]*?)"/gs, (match, value) => {
        return ': "' + value.replace(/\n/g, ' ').replace(/\r/g, '').trim() + '"';
      });
      return JSON.parse(fixed);
    } catch {}
  }

  // Fallback：返回原始文本作为 response
  console.warn('JSON parse failed, using fallback:', rawText);
  return {
    response: rawText,
    continue: true,
    round: currentRound,
    ready_to_execute: false,
    student_fix: '',
  };
}

// ─────────────────────────────────────────────────────────
// 统一调用入口
// ─────────────────────────────────────────────────────────

/**
 * 统一 Agent 调用入口
 *
 * @param {Object} options
 * @param {string} options.mode - 当前模式 (gate1_easy, debug_prompt, 等)
 * @param {string} options.userInput - 用户输入
 * @param {number} options.currentRound - 当前轮数
 * @param {string} options.systemPrompt - System Prompt
 * @param {Array} options.conversationHistory - 对话历史
 * @param {number} [options.maxTokens=500] - 最大 tokens
 * @param {number} [options.temperature=0.7] - 温度
 * @returns {Promise<Object>} - 解析后的响应
 */
export async function callAgent({
  mode,
  userInput,
  currentRound,
  systemPrompt,
  conversationHistory,
  maxTokens = 500,
  temperature = 0.7,
}) {
  // ─────────────────────────────────────────────────────
  // Step 1: 代码层预检
  // ─────────────────────────────────────────────────────
  const preCheck = preCheckInput(userInput, mode, currentRound);

  if (!preCheck.shouldCallModel) {
    // 明显无效输入：直接返回模板回复
    if (preCheck.directResponse) {
      return {
        response: preCheck.directResponse,
        continue: true,
        skippedModel: true,
        reason: preCheck.reason,
      };
    }

    // 超过最大轮次：强制放行
    if (preCheck.forceRelease) {
      return {
        response: getForceReleaseResponse(mode),
        continue: false,
        forceReleased: true,
        reason: preCheck.reason,
      };
    }
  }

  // ─────────────────────────────────────────────────────
  // Step 2: 裁剪对话历史
  // ─────────────────────────────────────────────────────
  const trimmedHistory = trimConversationHistory(conversationHistory);

  // 构建消息列表（添加用户输入）
  const messages = [
    ...trimmedHistory.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userInput },
  ];

  // ─────────────────────────────────────────────────────
  // Step 3: 调用模型
  // ─────────────────────────────────────────────────────
  const rawResponse = await callDeepSeek({
    systemPrompt,
    messages,
    maxTokens,
    temperature,
  });

  // ─────────────────────────────────────────────────────
  // Step 4: 解析响应
  // ─────────────────────────────────────────────────────
  const parsed = parseAgentResponse(rawResponse, currentRound);

  // ─────────────────────────────────────────────────────
  // Step 5: 代码层后处理（最大轮次兜底）
  // ─────────────────────────────────────────────────────
  const { exceeded } = checkMaxRounds(mode, currentRound);
  if (exceeded && parsed.continue) {
    // 模型说继续但已超限：强制放行
    parsed.continue = false;
    parsed.forceReleased = true;
  }

  return parsed;
}

/**
 * 简化版调用（不经过预检，用于特殊场景）
 *
 * @param {Object} options
 * @param {string} options.systemPrompt
 * @param {Array} options.messages
 * @param {number} [options.maxTokens=500]
 * @param {number} [options.temperature=0.7]
 * @param {boolean} [options.hasImage=false]
 * @returns {Promise<Object>}
 */
export async function callAgentDirect({
  systemPrompt,
  messages,
  maxTokens = 500,
  temperature = 0.7,
  hasImage = false,
}) {
  const rawResponse = await callDeepSeek({
    systemPrompt,
    messages,
    maxTokens,
    temperature,
    hasImage,
  });

  return hasImage
    ? { response: rawResponse, continue: true }
    : parseAgentResponse(rawResponse, 1);
}

// 导出解析函数供其他模块使用
export { parseAgentResponse };
