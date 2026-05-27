/**
 * Debug Code Tool System Prompt
 *
 * 目标：帮助学生描述代码 bug 的预期行为
 * Token 预算：~150 tokens
 *
 * 三轮流程：
 * - Round 1: 问具体发生了什么，什么时候发生
 * - Round 2: 问是否每次都发生
 * - Round 3: 学生写预期行为
 *
 * 注意：不引用 Gate 1 上下文（B 类 bug 与 prompt 无关）
 *
 * 模型负责判断：
 * - fix_quality: precise/specific/vague
 *
 * 2026-05-26: V17 Phase B 重构
 * 2026-05-27: 添加多语言支持
 */

/**
 * 获取语言指令
 * @param {string} language - 'en' or 'zh'
 * @returns {string}
 */
function getLanguageInstruction(language) {
  return language === 'zh'
    ? '用中文回复学生。'
    : 'Reply to student in English.';
}

/**
 * 构建 Debug Code Tool System Prompt
 *
 * @param {string} contextString - 格式化后的上下文
 * @param {string} bugSummary - bug 描述摘要
 * @param {number} currentRound - 当前轮数
 * @param {number} maxRounds - 最大轮数
 * @param {Object} [options] - 额外选项
 * @param {number} [options.attemptCount=0] - 尝试次数
 * @param {string} [options.language='en'] - 语言 ('en' 或 'zh')
 * @returns {string}
 */
export function buildCodeToolPrompt(contextString, bugSummary, currentRound, maxRounds, options = {}) {
  const { attemptCount = 0, language = 'en' } = options;
  const isFinalRound = currentRound >= maxRounds;

  // 脚手架模式
  const scaffoldHint = attemptCount >= 2
    ? `SCAFFOLD MODE: Student tried ${attemptCount} times. Give sentence frame:
"Try: Fix [feature]: it should [expected behavior]"
After they fill it, pass unconditionally.`
    : '';

  const languageInstruction = getLanguageInstruction(language);

  return `IMPORTANT: Return JSON only. Start { end }. No markdown. ONE QUESTION ONLY.
${languageInstruction}

Bug: "${bugSummary}"
Round: ${currentRound} of ${maxRounds}
${isFinalRound ? 'FINAL: accept answer, set continue:false.' : ''}
${scaffoldHint}

Round guide:
1: What exactly happens? (what + when + how)
2: How do you trigger it? Every time?
3: Student writes: "Fix [feature]: it should [expected] instead of [current]"

Do NOT reference Gate 1 context.

Return:
{"response":"...","round":${currentRound},"continue":true,"student_fix":"","fix_quality":""}

[Context]
${contextString}`;
}

/**
 * 构建 Debug Reset Tool System Prompt (Phase 1)
 *
 * Reset 工具用于游戏完全崩溃需要重建的场景
 *
 * @param {string} contextString
 * @param {string} bugSummary
 * @param {number} step - 当前步骤 (1, 2, 3)
 * @param {Array} selectedUpgrades - 学生选择保留的功能
 * @param {number} [attemptCount=0]
 * @param {string} [language='en'] - 语言 ('en' 或 'zh')
 * @returns {string}
 */
export function buildResetToolPrompt(contextString, bugSummary, step, selectedUpgrades = [], attemptCount = 0, language = 'en') {
  const scaffoldHint = attemptCount >= 2 && step === 3
    ? `SCAFFOLD MODE: Student tried ${attemptCount} times. Let them continue with what they wrote.
Give gentle guidance on what's missing, then unconditionally pass.`
    : '';

  const languageInstruction = getLanguageInstruction(language);

  return `IMPORTANT: Return JSON only. Start { end }. No markdown. ONE QUESTION ONLY.
${languageInstruction}

Bug: "${bugSummary}"
Step: ${step}
Selected to keep: ${selectedUpgrades.join(', ') || 'None selected yet'}
${scaffoldHint}

Three-Step Flow:
Step 1: Confirm - "Sometimes starting fresh is faster. Which features to keep?"
Step 2: Show feature selector (UI handles this)
Step 3: Student writes new prompt

Return:
{"response":"...","step":${step},"show_upgrade_selector":${step === 2},"continue":true,"final_new_prompt":""}

[Context]
${contextString}`;
}
