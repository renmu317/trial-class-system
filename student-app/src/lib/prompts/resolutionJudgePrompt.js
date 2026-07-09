/**
 * Resolution Judge Prompt
 *
 * Judges whether student confirmed their bug is fixed.
 * Uses AI to handle natural language variations.
 *
 * Returns:
 * - resolved: true  → student confirmed it works
 * - resolved: false → student says it's not fixed
 * - resolved: null  → unclear, ask again
 *
 * 2026-06-04: P7 Cognitive Behavior System
 */

export function buildResolutionJudgePrompt(isResetScenario, keptCount, previousCount, language = 'en') {

  const iterationQuestion = language === 'zh'
    ? '修好啦！🎉 现在它能用了——如果你能让这个功能更好或更有趣，你会怎么改？'
    : "Nice work fixing it! 🎉 Now that it works — if you could make this feature even better or more interesting, what would you change?";

  const recoveryQuestion = language === 'zh'
    ? '重建成功了！你从这次经历中学到了什么？下次做东西时会怎么用？'
    : "You restarted and it worked — what's one thing you learned from this that you'll use next time you build something?";

  const recoveryHint = language === 'zh'
    ? `这次你保留了 ${keptCount} 个功能，之前有 ${previousCount} 个——这说明 Claude 是怎么工作的？`
    : `You kept ${keptCount} features this time instead of ${previousCount} — what does that tell you about how Claude works?`;

  const notFixedResponse = language === 'zh'
    ? "好的，我们继续找问题。你看到了什么？"
    : "Okay, let's keep looking. What do you see?";

  const unclearResponse = language === 'zh'
    ? "游戏现在运行正常了吗？"
    : "Is the game working properly now?";

  const resolvedFollowUp = isResetScenario ? recoveryQuestion : iterationQuestion;

  return `IMPORTANT: Return JSON only. { } No markdown. ONE response only.

You are judging whether a student confirmed their game bug is fixed.
They were asked "Did the fix work?" or "Is your new game running?"

JUDGE their reply:
- resolved: true  → student clearly confirms it works
  (yes, worked, fixed, it's good, 好了, 修好了, 可以了, 正常了, works now, it works, yep, yeah, etc.)
- resolved: false → student says it's not fixed
  (no, still broken, didn't work, not fixed, 没好, 还是不行, 不行, still, nope, etc.)
- resolved: null  → unclear or ambiguous (ask again)

RESPONSE rules:
- If resolved=true: respond with the follow-up question below
- If resolved=false: respond with encouragement + ask what's still wrong
- If resolved=null: ask once more clearly

Follow-up question when resolved=true:
"${resolvedFollowUp}"

Recovery hint (only if isResetScenario=true AND student says they don't know):
"${recoveryHint}"

Not fixed response:
"${notFixedResponse}"

Unclear response:
"${unclearResponse}"

Return:
{
  "resolved": true | false | null,
  "response": "the next thing to say to the student",
  "isIterationPrompt": true | false,
  "isRecoveryPrompt": true | false
}

Rules for flags:
- isIterationPrompt: true only when resolved=true AND NOT isResetScenario (${!isResetScenario})
- isRecoveryPrompt: true only when resolved=true AND isResetScenario (${isResetScenario})
- Both false in all other cases`;
}
