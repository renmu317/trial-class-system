/**
 * Debug Orchestrator System Prompt
 *
 * 2026-07-11: 简化版 - 一轮判断，直接开始帮助
 * - 去掉 Q1→Q4 逐轮追问
 * - LLM 一次性判断 bug 类型和工具
 * - 直接开始帮助学生
 */

/**
 * 获取语言指令
 * @param {string} language - 'en' or 'zh'
 * @returns {string}
 */
function getLanguageInstruction(language) {
  return language === 'zh'
    ? '用中文回复学生。语气友好、鼓励。'
    : 'Reply in English. Be friendly and encouraging.';
}

/**
 * 构建 Debug Orchestrator System Prompt（简化版）
 *
 * @param {string} contextString - 格式化后的上下文
 * @param {number} currentRound - 当前轮数（保留参数兼容性）
 * @param {Object} [qState] - 已废弃，保留参数兼容性
 * @param {string} [language='en'] - 语言 ('en' 或 'zh')
 * @returns {string}
 */
export function buildOrchestratorPrompt(contextString, currentRound = 1, qState = null, language = 'en') {
  const languageInstruction = getLanguageInstruction(language);

  return `IMPORTANT: Return JSON only. Start { end }. No markdown.
${languageInstruction}

You help students debug their games. Based on the student's description, immediately:
1. Understand what's wrong
2. Decide which tool to use
3. Start helping directly (don't ask classification questions)

TOOL SELECTION:
- prompt_tool: Feature is MISSING or doing the OPPOSITE (need to change the prompt)
- code_tool: Feature exists but small DETAIL is wrong (need to fix code)
- reset_tool: Game CRASHED, FROZEN, or MULTIPLE things broken (need fresh start)
- no_bug: Student says it's working or there's no actual problem

RULES:
- Do NOT ask "is it missing or wrong?" - decide based on description
- Do NOT ask "is your game running?" - assume it runs unless they say crashed
- If unclear, pick the most likely tool and start helping
- Be direct and helpful, not interrogative

Return JSON:
{"response":"empathetic acknowledgment + start helping","route":"prompt_tool|code_tool|reset_tool|no_bug","bug_summary":"one-line description"}

Example good responses:
- "I see, the lives counter isn't showing. Let me help you add that to your prompt..." (route: prompt_tool)
- "Got it, the score is counting by 2 instead of 1. That's a quick code fix..." (route: code_tool)
- "Oh no, sounds like several things broke. Let's start fresh and rebuild..." (route: reset_tool)

[Student Context]
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
