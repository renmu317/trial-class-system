/**
 * Agent Guards — 代码层判断
 *
 * 边界原则：不需要读懂意思 → 代码
 *
 * 本模块负责：
 * - round 计数（事件计数，无语义）
 * - 「ok/yes」不是修复指令（单词匹配）
 * - 少于 3 个词不是有效回答（长度检查）
 * - 超过 N 轮强制放行（兜底规则）
 *
 * 2026-05-26: V17 Phase B 重构
 */

// ─────────────────────────────────────────────────────────
// 1. Round 计数器
// ─────────────────────────────────────────────────────────

/**
 * Round 计数器类
 * 用于追踪对话轮数，由代码负责递增，不受模型返回值影响
 */
export class RoundCounter {
  constructor() {
    this.round = 1;
  }

  /**
   * 递增轮数
   * @returns {number} 递增后的轮数
   */
  increment() {
    this.round += 1;
    return this.round;
  }

  /**
   * 重置轮数（路由切换时调用）
   */
  reset() {
    this.round = 1;
  }

  /**
   * 获取当前轮数
   * @returns {number}
   */
  get() {
    return this.round;
  }
}

// ─────────────────────────────────────────────────────────
// 2. 明显无效输入检测
// ─────────────────────────────────────────────────────────

/**
 * 确认性单词正则
 * 这些单词不是有效的修复指令或描述
 */
const CONFIRMATION_WORDS = /^(ok|okay|yes|no|sure|good|great|yeah|yep|got\s*it|fine|alright|k|y|n)\.?$/i;

/**
 * 最小单词数
 * 少于此数量的输入被视为无效
 */
const MIN_WORD_COUNT = 3;

/**
 * 检测明显无效的输入
 *
 * @param {string} text - 用户输入
 * @returns {{ invalid: boolean, reason?: string }}
 *   - invalid: true 表示输入无效
 *   - reason: 'empty' | 'confirmation' | 'too_short'
 */
export const checkObviouslyInvalid = (text) => {
  const trimmed = text?.trim() || '';

  // 空输入
  if (!trimmed) {
    return { invalid: true, reason: 'empty' };
  }

  // 确认性单词（英文）
  if (CONFIRMATION_WORDS.test(trimmed)) {
    return { invalid: true, reason: 'confirmation' };
  }

  // 中文确认词
  const CHINESE_CONFIRMATION = /^(好|好的|是|是的|对|对的|行|嗯|可以|没问题|知道了|明白|ok)$/i;
  if (CHINESE_CONFIRMATION.test(trimmed)) {
    return { invalid: true, reason: 'confirmation' };
  }

  // 太短检测：
  // - 英文：少于 3 个词
  // - 中文：少于 5 个字符（因为中文没有空格分隔）
  const hasChineseChars = /[\u4e00-\u9fa5]/.test(trimmed);

  if (hasChineseChars) {
    // 中文：按字符长度判断（去掉标点后）
    const chineseCharsOnly = trimmed.replace(/[^\u4e00-\u9fa5]/g, '');
    if (chineseCharsOnly.length < 5) {
      return { invalid: true, reason: 'too_short' };
    }
  } else {
    // 英文：按单词数判断
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount < MIN_WORD_COUNT) {
      return { invalid: true, reason: 'too_short' };
    }
  }

  return { invalid: false };
};

/**
 * 无效输入的标准回复模板
 * 用于直接追问，不消耗 API
 * 支持多语言
 */
export const INVALID_RESPONSE_TEMPLATES = {
  en: {
    empty: "Please describe what's happening in your game.",
    confirmation: 'Can you describe it in a full sentence? For example: "Fix the [feature]: it should [behavior]"',
    too_short: 'Can you say more? Describe what the feature should do.',
  },
  zh: {
    empty: "请描述你的游戏中发生了什么。",
    confirmation: '能用完整的句子描述吗？例如："修复[功能]：它应该[行为]"',
    too_short: '能说更多吗？描述一下这个功能应该做什么。',
  }
};

/**
 * 获取无效输入的回复（支持多语言）
 * @param {string} reason - 'empty' | 'confirmation' | 'too_short'
 * @param {string} language - 'en' | 'zh'
 * @returns {string}
 */
export const getInvalidResponse = (reason, language = 'en') => {
  const templates = INVALID_RESPONSE_TEMPLATES[language] || INVALID_RESPONSE_TEMPLATES.en;
  return templates[reason] || templates.empty;
};

// ─────────────────────────────────────────────────────────
// 3. 最大轮次兜底
// ─────────────────────────────────────────────────────────

/**
 * 各模式的最大轮次配置
 */
const MAX_ROUNDS = {
  // Gate 1
  gate1_easy: 1,
  gate1_medium: 3,
  gate1_hard: 4,

  // Debug
  debug_orchestrator: 5,
  debug_prompt: 5,
  debug_code: 4,
  debug_reset: 3,

  // 默认值
  default: 5,
};

/**
 * 检查是否超过最大轮次
 *
 * @param {string} mode - 当前模式
 * @param {number} currentRound - 当前轮数
 * @returns {{ exceeded: boolean, maxRounds: number }}
 */
export const checkMaxRounds = (mode, currentRound) => {
  const maxRounds = MAX_ROUNDS[mode] || MAX_ROUNDS.default;

  if (currentRound > maxRounds) {
    return { exceeded: true, maxRounds };
  }

  return { exceeded: false, maxRounds };
};

/**
 * 获取模式的最大轮次
 *
 * @param {string} mode - 模式名
 * @returns {number}
 */
export const getMaxRounds = (mode) => {
  return MAX_ROUNDS[mode] || MAX_ROUNDS.default;
};

// ─────────────────────────────────────────────────────────
// 4. 统一预检入口
// ─────────────────────────────────────────────────────────

/**
 * 统一预检输入
 *
 * @param {string} text - 用户输入
 * @param {string} mode - 当前模式
 * @param {number} currentRound - 当前轮数
 * @param {string} language - 语言 ('en' | 'zh')
 * @returns {{
 *   shouldCallModel: boolean,
 *   directResponse?: string,
 *   forceRelease?: boolean,
 *   reason?: string,
 *   maxRounds?: number
 * }}
 */
export const preCheckInput = (text, mode, currentRound, language = 'en') => {
  const trimmed = text?.trim() || '';

  // Debug Orchestrator asks short diagnostic questions where "no", "it froze",
  // or "too fast" can carry useful routing signal. Only block empty input here.
  if (mode === 'debug_orchestrator') {
    const roundCheck = checkMaxRounds(mode, currentRound);
    if (!trimmed) {
      return {
        shouldCallModel: false,
        directResponse: getInvalidResponse('empty', language),
        reason: 'empty',
      };
    }
    if (roundCheck.exceeded) {
      return {
        shouldCallModel: false,
        forceRelease: true,
        reason: 'max_rounds_exceeded',
        maxRounds: roundCheck.maxRounds,
      };
    }
    return {
      shouldCallModel: true,
      maxRounds: roundCheck.maxRounds,
    };
  }

  // 检查明显无效输入
  const invalidCheck = checkObviouslyInvalid(text);
  if (invalidCheck.invalid) {
    return {
      shouldCallModel: false,
      directResponse: getInvalidResponse(invalidCheck.reason, language),
      reason: invalidCheck.reason,
    };
  }

  // 检查最大轮次
  const roundCheck = checkMaxRounds(mode, currentRound);
  if (roundCheck.exceeded) {
    return {
      shouldCallModel: false,
      forceRelease: true,
      reason: 'max_rounds_exceeded',
      maxRounds: roundCheck.maxRounds,
    };
  }

  // 通过预检，需要调用模型
  return {
    shouldCallModel: true,
    maxRounds: roundCheck.maxRounds,
  };
};

// ─────────────────────────────────────────────────────────
// 5. 辅助函数
// ─────────────────────────────────────────────────────────

/**
 * 判断是否应该强制放行（用于模型返回后的二次检查）
 *
 * @param {string} mode - 当前模式
 * @param {number} currentRound - 当前轮数
 * @param {boolean} modelContinue - 模型返回的 continue 值
 * @returns {boolean} - true 表示应该强制放行
 */
export const shouldForceRelease = (mode, currentRound, modelContinue) => {
  // 如果模型已经说不继续，直接放行
  if (!modelContinue) {
    return false; // 不是"强制"放行，是正常放行
  }

  // 检查是否超过最大轮次
  const { exceeded } = checkMaxRounds(mode, currentRound);
  return exceeded;
};

/**
 * 生成强制放行时的默认响应
 *
 * @param {string} mode - 当前模式
 * @returns {string}
 */
export const getForceReleaseResponse = (mode) => {
  if (mode.startsWith('gate1')) {
    return "Great job describing your idea! Let's move on.";
  }
  if (mode.startsWith('debug')) {
    return "Okay, let's try your fix and see if it works.";
  }
  return "Let's move on.";
};
