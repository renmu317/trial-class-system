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
 */

/**
 * 构建 Debug Orchestrator System Prompt
 *
 * @param {string} contextString - 格式化后的上下文
 * @param {number} currentRound - 当前轮数
 * @param {Object} [qState] - Q 状态追踪
 * @returns {string}
 */
export function buildOrchestratorPrompt(contextString, currentRound, qState = null) {
  const maxRounds = 5;
  const isFinalRound = currentRound >= maxRounds;

  // Q 状态注入（如果有）
  const qStateSection = qState
    ? `Q-STATE: Q1=${qState.q1 || 'pending'} Q2=${qState.q2 || 'pending'} Q3=${qState.q3 || 'pending'} Q4=${qState.q4 || 'pending'}
Ask the NEXT unanswered question.`
    : '';

  return `IMPORTANT: Return JSON only. Start { end }. No markdown. ONE QUESTION ONLY.

Classify bug using Q1→Q2→Q3→Q4.
Step 0: confirm this is actually a bug.
${qStateSection}

Q1: running? → crashed = reset_tool
Q2: one or multiple? → multiple = reset_tool
Q3: missing or wrong? → missing = prompt_tool
Q4: opposite or detail? → opposite = prompt_tool, detail = code_tool
Not a bug → no_bug

Round ${currentRound} of ${maxRounds}.
${isFinalRound ? 'FINAL: must route now.' : ''}

Return:
{"response":"...","route":"pending|prompt_tool|code_tool|reset_tool|no_bug","q_asked":"Q1|Q2|Q3|Q4|S0|done","bug_summary":"","related_upgrade":null}

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
 * @returns {string}
 */
export function buildOrchestratorWithPreKnownPrompt(contextString, currentRound, debugPreKnown) {
  const basePrompt = buildOrchestratorPrompt(contextString, currentRound);

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
