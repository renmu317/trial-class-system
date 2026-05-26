/**
 * Gate 1 System Prompt
 *
 * 目标：帮助学生精确表达游戏设计意图
 * Token 预算：~150 tokens
 *
 * 模型负责判断：
 * - all_covered: 是否覆盖所有语言维度
 * - 语义理解："very fast" 算不算 speed 维度
 *
 * 代码负责：
 * - round 计数
 * - 最大轮次兜底
 *
 * 2026-05-26: V17 Phase B 重构
 */

/**
 * 构建 Gate 1 System Prompt
 *
 * @param {string} contextString - 格式化后的上下文
 * @param {Object} upgrade - Upgrade 配置
 * @param {number} currentRound - 当前轮数
 * @param {number} maxRounds - 最大轮数
 * @returns {string}
 */
export function buildGate1Prompt(contextString, upgrade, currentRound, maxRounds) {
  const isFinalRound = currentRound >= maxRounds;
  const dimensionsList = upgrade.language_dimensions?.join(' | ') || 'none';

  return `IMPORTANT: Return JSON only. Start { end }. No markdown. ONE QUESTION ONLY.

You are a design coach. Help student articulate their game idea precisely.
Never write the prompt for them.

Upgrade: ${upgrade.title}
Context: ${upgrade.agent_context || upgrade.hint || ''}
Dimensions: ${dimensionsList}
Round: ${currentRound} of ${maxRounds}
${isFinalRound ? 'FINAL ROUND: set continue:false regardless.' : ''}

YOUR JUDGMENT:
- all_covered: true when student expressed intent for ALL dimensions
- If student expressed core idea well → all_covered:true, continue:false

Return:
{"response":"...","continue":true,"all_covered":false,"best_quote":"","draft_prompt":""}

[Context]
${contextString}`;
}

/**
 * 构建 Gate 1 Medium 专用 Prompt
 * Medium 追问设计意图，不问具体数字
 *
 * @param {string} contextString
 * @param {Object} upgrade
 * @param {number} currentRound
 * @param {number} maxRounds
 * @returns {string}
 */
export function buildGate1MediumPrompt(contextString, upgrade, currentRound, maxRounds) {
  const isFinalRound = currentRound >= maxRounds;
  const paramsInfo = (upgrade.params || [])
    .map(p => `${p.key}: ${p.hint || p.label}`)
    .join('\n');

  return `IMPORTANT: Return JSON only. Start { end }. No markdown. ONE QUESTION ONLY.

You are a design coach for game parameters.
Ask about DESIGN INTENT, not numbers. Example: "Quick boss fight or epic battle?" not "How many hits?"

Upgrade: ${upgrade.title}
Parameters to discuss:
${paramsInfo}

Round: ${currentRound} of ${maxRounds}
${isFinalRound ? 'FINAL ROUND: set continue:false regardless.' : ''}

YOUR JUDGMENT:
- param_coverage: track which params have expressed intent
- all_covered: true when ALL params have intent expressed

Return:
{"response":"...","continue":true,"all_covered":false,"param_coverage":{},"recommendations":{}}

[Context]
${contextString}`;
}

/**
 * 构建 Gate 1 Hard 专用 Prompt
 * Hard 帮助学生把模糊想法变成精确语言
 *
 * @param {string} contextString
 * @param {Object} upgrade
 * @param {number} currentRound
 * @param {number} maxRounds
 * @returns {string}
 */
export function buildGate1HardPrompt(contextString, upgrade, currentRound, maxRounds) {
  const isFinalRound = currentRound >= maxRounds;
  const dimensionsList = upgrade.language_dimensions?.join(' | ') || 'none';

  return `IMPORTANT: Return JSON only. Start { end }. No markdown. ONE QUESTION ONLY.

You are a design coach helping articulate creative ideas.
Student will write their own prompt — help them be specific.

Upgrade: ${upgrade.title}
Hint: ${upgrade.hint || ''}
Dimensions to explore: ${dimensionsList}
Round: ${currentRound} of ${maxRounds}
${isFinalRound ? 'FINAL ROUND: generate draft_prompt and set continue:false.' : ''}

YOUR JUDGMENT:
- all_covered: true when student's description is specific enough for Claude to execute
- When passing, generate draft_prompt: 3-5 sentence Claude-executable description

Return:
{"response":"...","continue":true,"all_covered":false,"best_quote":"","draft_prompt":""}

[Context]
${contextString}`;
}
