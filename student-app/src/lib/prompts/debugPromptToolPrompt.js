/**
 * Debug Prompt Tool System Prompt
 *
 * 目标：帮助学生发现和修复 prompt 描述问题
 * Token 预算：~200 tokens
 *
 * 三轮流程：
 * - Round 1: 确认 bug，问是否在 prompt 里描述过
 * - Round 2: 问缺了什么描述
 * - Round 3: 学生写修复句子
 *
 * 模型负责判断：
 * - fix_quality: precise/specific/vague
 *
 * 代码负责：
 * - round 计数
 * - attemptCount 追踪
 *
 * 2026-05-26: V17 Phase B 重构
 */

/**
 * 构建 Debug Prompt Tool System Prompt
 *
 * @param {string} contextString - 格式化后的上下文
 * @param {string} bugSummary - bug 描述摘要
 * @param {number} currentRound - 当前轮数
 * @param {number} maxRounds - 最大轮数
 * @param {Object} [options] - 额外选项
 * @param {number} [options.attemptCount=0] - 尝试次数
 * @param {boolean} [options.isFirstAfterRoute=false] - 是否是路由后第一条
 * @returns {string}
 */
export function buildPromptToolPrompt(contextString, bugSummary, currentRound, maxRounds, options = {}) {
  const { attemptCount = 0, isFirstAfterRoute = false } = options;
  const isFinalRound = currentRound >= maxRounds;

  // 脚手架模式（多次尝试后提供句式框架）
  const scaffoldHint = attemptCount >= 2
    ? `SCAFFOLD MODE: Student tried ${attemptCount} times. Give sentence frame:
"Try: Fix [feature]: it should [action] [speed/direction/frequency]"
After they fill it, pass unconditionally.`
    : '';

  // 路由后第一条消息的特殊规则
  const openingRule = isFirstAfterRoute
    ? `OPENING RULE (First message after routing):
This is FIRST round after arriving from Orchestrator. Bug is already known.
- NEVER say "Let me fix that" or offer any solution
- Start with: "Got it — [one sentence bug summary: ${bugSummary}]. Did you tell Claude about this in your description?"`
    : '';

  return `IMPORTANT: Return JSON only. Start { end }. No markdown. ONE QUESTION ONLY.

Bug: "${bugSummary}"
Round: ${currentRound} of ${maxRounds}
${isFinalRound ? 'FINAL: accept answer, set continue:false.' : ''}
${openingRule}
${scaffoldHint}

Round guide:
1: Confirm bug understood, ask if described in prompt
2: Ask what description was missing
3: Ask student to write fix sentence

YOUR JUDGMENT on fix_quality:
- precise: feature + specific behavior + detail (e.g. "patrol left and right every 2 seconds")
- specific: feature + behavior, missing details
- vague: unclear what should happen

Return:
{"response":"...","round":${currentRound},"continue":true,"student_fix":"","fix_quality":""}

[Context]
${contextString}`;
}

/**
 * 构建带有 Gate 1 引用的 Prompt Tool Prompt
 * 用于 A 类 bug（prompt 问题），可引用 Gate 1 的 best_quote
 *
 * @param {string} contextString
 * @param {string} bugSummary
 * @param {number} currentRound
 * @param {number} maxRounds
 * @param {Object} relatedUpgrade - 相关 Upgrade 的 Gate 1 记录
 * @param {Object} [options]
 * @returns {string}
 */
export function buildPromptToolWithGate1Prompt(contextString, bugSummary, currentRound, maxRounds, relatedUpgrade, options = {}) {
  const basePrompt = buildPromptToolPrompt(contextString, bugSummary, currentRound, maxRounds, options);

  if (!relatedUpgrade) {
    return basePrompt;
  }

  const gate1Section = `
GATE 1 REFERENCE:
- Upgrade: ${relatedUpgrade.upgradeLabel}
- Student said in Gate 1: "${relatedUpgrade.studentSaid || 'not recorded'}"
- Appeared in game: ${relatedUpgrade.appearedInGame ?? 'not verified'}
- Failure type: ${relatedUpgrade.failureType || 'unknown'}

Use this to help student see what they described vs what happened.`;

  return basePrompt + gate1Section;
}
