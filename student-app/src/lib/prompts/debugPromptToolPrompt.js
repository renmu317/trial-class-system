/**
 * Debug Prompt Tool System Prompt
 *
 * 目标：帮助学生发现和修复 prompt 描述问题
 * Token 预算：~200 tokens
 *
 * 四轮流程：
 * - Round 1: 确认 bug 描述（不评估 fix_quality）
 * - Round 2: 问是否在 prompt 里描述过（不评估 fix_quality）
 * - Round 3: 问缺了什么描述（不评估 fix_quality）
 * - Round 4: 学生写修复句子（这时才评估 fix_quality）
 *
 * 重要设计原则：
 * - fix_quality 只在 Round 4 有意义（学生写修复指令时）
 * - Round 1-3 的 fix_quality 和 student_fix 始终返回空字符串
 *
 * 代码负责：
 * - round 计数
 * - attemptCount 追踪
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
 * 构建 Debug Prompt Tool System Prompt
 *
 * @param {string} contextString - 格式化后的上下文
 * @param {string} bugSummary - bug 描述摘要
 * @param {number} currentRound - 当前轮数
 * @param {number} maxRounds - 最大轮数
 * @param {Object} [options] - 额外选项
 * @param {number} [options.attemptCount=0] - 尝试次数
 * @param {boolean} [options.isFirstAfterRoute=false] - 是否是路由后第一条
 * @param {string} [options.language='en'] - 语言 ('en' 或 'zh')
 * @returns {string}
 */
export function buildPromptToolPrompt(contextString, bugSummary, currentRound, maxRounds, options = {}) {
  const { attemptCount = 0, isFirstAfterRoute = false, language = 'en' } = options;
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

  // Round 4 才评估 fix_quality
  const isExecutionRound = currentRound >= 4;

  const fixQualityRule = isExecutionRound
    ? `YOUR JUDGMENT on fix_quality (Round 4+ ONLY):
- precise: feature + specific behavior + detail (e.g. "patrol left and right every 2 seconds")
- specific: feature + behavior, missing details
- vague: unclear what should happen
- Extract student's fix sentence into student_fix field`
    : `FIX_QUALITY RULE (Round 1-3):
- fix_quality only applies in Round 4 when student writes a fix instruction
- In Round 1-3, ALWAYS return fix_quality: "" and student_fix: ""
- DO NOT evaluate student's response as a "fix" — they are describing the bug, not fixing it`;

  const languageInstruction = getLanguageInstruction(language);

  return `IMPORTANT: Return JSON only. Start { end }. No markdown. ONE QUESTION ONLY.
${languageInstruction}

Bug: "${bugSummary}"
Round: ${currentRound} of ${maxRounds}
${isFinalRound ? 'FINAL: accept answer, set continue:false.' : ''}
${openingRule}
${scaffoldHint}

Round guide:
1: Confirm bug understood, ask if student told Claude about this
2: Ask what description was missing from prompt
3: Ask student to write a fix sentence
4: Evaluate fix quality, set ready_to_execute if precise/specific

${fixQualityRule}

Return:
{"response":"...","round":${currentRound},"continue":true,"student_fix":"","fix_quality":"","ready_to_execute":false}

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
