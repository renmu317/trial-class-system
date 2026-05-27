/**
 * Debug Orchestrator System Prompt
 *
 * 目标：通过 Q1→Q2→Q3→Q4 序列分类 bug
 * Token 预算：~200 tokens
 *
 * 模型负责判断：
 * - bug 分类 A/B/C
 * - 路由决策
 *
 * 代码负责：
 * - round 计数
 * - Q 状态追踪
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
 * 构建 Debug Orchestrator System Prompt
 *
 * @param {string} contextString - 格式化后的上下文
 * @param {number} currentRound - 当前轮数
 * @param {Object} [qState] - Q 状态追踪
 * @param {string} [language='en'] - 语言 ('en' 或 'zh')
 * @returns {string}
 */
export function buildOrchestratorPrompt(contextString, currentRound, qState = null, language = 'en') {
  const maxRounds = 5;
  const isFinalRound = currentRound >= maxRounds;

  // 构建 Q 状态显示和下一步指导
  let qStateSection = '';
  let nextStep = '';

  if (qState) {
    qStateSection = `ANSWERED: Q1=${qState.q1 || '?'} Q2=${qState.q2 || '?'} Q3=${qState.q3 || '?'} Q4=${qState.q4 || '?'}`;

    // 决定下一步
    if (qState.q1 === 'crashed') {
      nextStep = 'ROUTE NOW: reset_tool (game crashed)';
    } else if (qState.q2 === 'multiple') {
      nextStep = 'ROUTE NOW: reset_tool (multiple bugs)';
    } else if (qState.q3 === 'missing') {
      nextStep = 'ROUTE NOW: prompt_tool (feature missing)';
    } else if (qState.q4 === 'opposite') {
      nextStep = 'ROUTE NOW: prompt_tool (opposite behavior)';
    } else if (qState.q4 === 'detail') {
      nextStep = 'ROUTE NOW: code_tool (detail wrong)';
    } else if (!qState.q1) {
      nextStep = 'ASK Q1: Is your game running or did it crash/freeze?';
    } else if (!qState.q2) {
      nextStep = 'ASK Q2: Is the problem with ONE specific thing, or MULTIPLE things broken?';
    } else if (!qState.q3) {
      nextStep = 'ASK Q3: Is the feature MISSING entirely, or is it there but WRONG?';
    } else if (!qState.q4) {
      nextStep = 'ASK Q4: Is it doing the OPPOSITE of what you wanted, or just a small DETAIL is wrong?';
    }
  }

  const languageInstruction = getLanguageInstruction(language);

  return `IMPORTANT: Return JSON only. Start { end }. No markdown. ONE QUESTION ONLY.
${languageInstruction}

You are classifying a bug. Follow this decision tree:
${qStateSection}
${nextStep ? `\nNEXT: ${nextStep}` : ''}

DECISION TREE:
Q1: Game running? → "crashed/froze/stuck" = reset_tool | "running but..." = continue
Q2: One or multiple? → "many/all/everything" = reset_tool | "one/specific" = continue
Q3: Missing or wrong? → "not there/missing/don't see" = prompt_tool | "wrong/different" = continue
Q4: Opposite or detail? → "opposite/reverse" = prompt_tool | "detail/slightly" = code_tool

CRITICAL: When student answers a Q, move to the NEXT Q. Do NOT repeat the same question.
- Student says "one specific X" → Q2 is answered (one), ask Q3 next
- Student says "it's missing" → Q3 is answered (missing), route to prompt_tool

Round ${currentRound} of ${maxRounds}.
${isFinalRound ? 'FINAL ROUND: You MUST route now. Pick the most likely tool.' : ''}

Return:
{"response":"your question","route":"pending|prompt_tool|code_tool|reset_tool|no_bug","q_asked":"Q1|Q2|Q3|Q4|S0|done","bug_summary":"brief description","related_upgrade":null}

[Context]
${contextString}`;
}

/**
 * 构建带有 Gate 2 失败上下文的 Orchestrator Prompt
 * 用于 Gate 2 → Debug 直连场景
 *
 * @param {string} contextString
 * @param {number} currentRound
 * @param {Object} debugPreKnown - Gate 2 失败上下文
 * @param {string} [language='en'] - 语言 ('en' 或 'zh')
 * @returns {string}
 */
export function buildOrchestratorWithPreKnownPrompt(contextString, currentRound, debugPreKnown, language = 'en') {
  const basePrompt = buildOrchestratorPrompt(contextString, currentRound, null, language);

  const preKnownSection = debugPreKnown
    ? `
PRE-KNOWN FROM GATE 2:
- Failed upgrade: ${debugPreKnown.failed_upgrade}
- Student said: "${debugPreKnown.student_said}"
- Failure type: ${debugPreKnown.failure_type}

Start with Q1 to classify, but you already know one thing is broken.`
    : '';

  return basePrompt + preKnownSection;
}
