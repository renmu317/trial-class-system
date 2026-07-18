/**
 * V17 Agent Panel
 *
 * 认知对抗 Agent 对话界面
 * 支持 Gate 1（Upgrade 追问）和 Gate 2（验证归因）两种模式
 *
 * V17 Phase B: 集成新架构
 * - RoundCounter: 代码层 round 计数
 * - preCheckInput: 代码层输入验证
 * - timeline: 时间线写入
 */

import { useState, useEffect, useRef } from 'react';
import { X, Send, MessageCircle, CheckCircle, AlertCircle } from 'lucide-react';
import { LESSON, DIMENSION_LIBRARY } from '../lib/lesson';
import { agentBridge } from '../lib/AgentBridge';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../lib/LanguageContext';

// V17 Phase B: 新架构模块
import { RoundCounter, preCheckInput, INVALID_RESPONSE_TEMPLATES } from '../lib/agentGuards';
import { writeGate1Round, writeGate1Complete, getTimeline, formatForGate1, invalidateCache } from '../lib/timeline';

// Supabase Edge Function URL for DeepSeek proxy
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const DEEPSEEK_PROXY_URL = `${SUPABASE_URL}/functions/v1/deepseek-proxy`;

/**
 * 调用 DeepSeek API（通过 Supabase Edge Function 代理，API key 安全存储在服务端）
 */
// JSON格式强制约束（紧挨输出，不会被遗忘）
const JSON_FORMAT_CONSTRAINT = {
  role: 'user',
  content: '__FORMAT__: Respond with a single JSON object only. Start with { end with }. No markdown, no explanation, no line breaks inside string values.'
};

async function callDeepSeek(messages, temperature = 0.7, retries = 2, maxTokens = 800) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Supabase configuration not set');
    throw new Error('Supabase not configured');
  }

  // 在消息末尾添加JSON格式约束
  const messagesWithConstraint = [...messages, JSON_FORMAT_CONSTRAINT];

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
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
          model: 'deepseek-chat',
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`Edge Function error ${response.status}:`, errorData);
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      // 检查空响应，触发重试
      if (!content || content.trim() === '') {
        console.warn(`Empty response from DeepSeek (attempt ${attempt + 1})`);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000)); // 等待1秒后重试
          continue;
        }
        throw new Error('Empty response from DeepSeek');
      }

      return content;
    } catch (error) {
      if (attempt < retries) {
        console.warn(`Retrying API (attempt ${attempt + 2})...`);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      throw error;
    }
  }
}

/**
 * 获取语言指令（用于 System Prompt）
 * @param {string} language - 'en' or 'zh'
 * @returns {string}
 */
function getLanguageInstruction(language) {
  return language === 'zh'
    ? '用中文回复学生。所有 response 字段必须用中文。'
    : 'Respond to student in English. All response fields must be in English.';
}

/**
 * 获取 Agent UI 消息的翻译
 * @param {string} language - 'en' or 'zh'
 * @returns {Object}
 */
function getAgentMessages(language) {
  const messages = {
    en: {
      gate1Welcome: (title) => `Hi! I see you picked "${title}" ✨\n\nTell me, how do you want this feature to work? Share your ideas!`,
      gate2Welcome: (upgradeNames) => `Let's check if your upgrades worked! 🎮\n\nYou added: ${upgradeNames}\nDid they appear in your game?`,
      debugOrchestratorWelcome: `Tell me, what's going wrong with your game?`,
      debugPromptWelcome: (bugSummary) => bugSummary
        ? `Got it — "${bugSummary}"\n\nTell me: What went wrong? What did you WANT to happen?`
        : `Tell me: What went wrong? What did you WANT to happen?`,
      debugCodeWelcome: (bugSummary) => bugSummary
        ? `Got it — "${bugSummary}"\n\nWhat's going wrong? When does it happen?`
        : `What's going wrong? When does it happen?`,
      debugResetPhase1Welcome: `Sometimes starting fresh is the fastest way! 🔄\n\nWhat parts of your game worked well? We can keep those!`,
      debugResetPhase2Welcome: `Welcome back! Is your new game running? 🎮`,
      debugVerifyQuestion: (hasPendingVerification) => hasPendingVerification
        ? `You clicked "Go Generate" — did you paste the fix into Claude?`
        : `You sent the fix request — is the bug gone?`,
      preCheckResponse: `You've shared great ideas! Let's move on to writing them out.`,
      gate2FallbackQuestion: `Did the upgrade appear in your game? Please tell me yes or no.`,
      placeholderDebug: `Describe what's happening...`,
      placeholderIdeas: `Share your ideas...`,
    },
    zh: {
      gate1Welcome: (title) => `你好！我看到你选择了「${title}」✨\n\n告诉我，你想让这个功能怎么运作？分享你的想法吧！`,
      gate2Welcome: (upgradeNames) => `让我们检查一下你的升级是否生效了！🎮\n\n你添加了：${upgradeNames}\n它们出现在你的游戏中了吗？`,
      debugOrchestratorWelcome: `告诉我，你的游戏出了什么问题？`,
      debugPromptWelcome: (bugSummary) => bugSummary
        ? `明白了——「${bugSummary}」\n\n告诉我：出了什么问题？你原本想要什么效果？`
        : `告诉我：出了什么问题？你原本想要什么效果？`,
      debugCodeWelcome: (bugSummary) => bugSummary
        ? `明白了——「${bugSummary}」\n\n出了什么问题？什么时候发生的？`
        : `出了什么问题？什么时候发生的？`,
      debugResetPhase1Welcome: `有时候重新开始是最快的方法！🔄\n\n你的游戏哪些部分运行良好？我们可以保留那些！`,
      debugResetPhase2Welcome: `欢迎回来！你的新游戏运行了吗？🎮`,
      debugVerifyQuestion: (hasPendingVerification) => hasPendingVerification
        ? `你点击了「去生成」——你把修复内容粘贴到 Claude 了吗？`
        : `你发送了修复请求——bug 消失了吗？`,
      preCheckResponse: `你分享了很棒的想法！让我们继续把它们写出来。`,
      gate2FallbackQuestion: `升级功能出现在你的游戏中了吗？请告诉我是或否。`,
      placeholderDebug: `描述发生了什么...`,
      placeholderIdeas: `分享你的想法...`,
    }
  };
  return messages[language] || messages.en;
}

/**
 * 解析 AI 响应中的 JSON（多策略 + 结构化 fallback）
 * @param {string} rawText - AI 响应内容
 * @param {number} currentRound - 当前轮次（用于 fallback）
 */
function parseAIResponse(rawText, currentRound = 1) {
  console.log('Raw AI response:', rawText);

  // 策略1：直接解析
  try {
    return JSON.parse(rawText.trim());
  } catch {}

  // 策略2：提取```json```代码块
  const jsonBlock = rawText.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlock) {
    try { return JSON.parse(jsonBlock[1]); } catch {}
  }

  // 策略3：提取第一个{...}块
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // 策略3b：修复string值里的换行
      try {
        const fixed = jsonMatch[0]
          .replace(/:\s*"([^"]*?)"/gs, (match, value) => {
            // 把string值里的换行替换成空格
            return ': "' + value.replace(/\n/g, ' ').replace(/\r/g, '').trim() + '"';
          });
        return JSON.parse(fixed);
      } catch {}
    }
  }

  // 策略4：所有方法失败 → 结构化 fallback
  console.warn('JSON parse failed after all strategies:', rawText);
  return {
    response: rawText.slice(0, 200),  // 截取前200字符作为response
    route: 'pending',             // Orchestrator：不路由，继续分类
    round: currentRound,          // 维持当前 round
    continue: true,               // 继续对话
    ready_to_execute: false,      // 不进入执行层
    switch_to_debug: false,       // Gate 2：不切换到 Debug
    all_covered: false,           // Medium Gate 1：未全部覆盖
    q_asked: null,                // Orchestrator：未明确问了哪个 Q
    student_fix: '',
    scores: {},
    // Gate 1 兼容
    mode: 'open',
    // Orchestrator 兼容
    severity: 'light',
    bug_summary: '',
    related_upgrade: null,
  };
}

/**
 * 构建评分维度（根据 upgrade level 不同）
 */
function buildScoringDimensions(upgradeLevel) {
  if (upgradeLevel === 'medium') {
    // Medium: 评分意图清晰度，不是具体性
    return `## Scoring Criteria (0-3 each) - FOR INTENT
- **intent_clarity**: How clearly did they express their design intent?
  0=no preference stated, 1=vague direction, 2=clear preference, 3=specific vision
- **design_reasoning**: Did they explain WHY they want this?
  0=no reason, 1=implied reason, 2=stated reason, 3=nuanced reasoning
- **autonomy**: Is this their own idea or echoing the prompt?
  0=repeating prompt, 1=made basic choice, 2=added own twist, 3=unique perspective`;
  }

  // Easy / Hard: 原有评分维度
  return `## Scoring Criteria (0-3 each)
- **specificity**: 0=vague, 1=has direction, 2=has details, 3=directly implementable
- **causality**: 0=no connection, 1=has trigger, 2=has result, 3=complete cause-effect chain
- **autonomy**: 0=repeating prompt, 1=made choices, 2=creative, 3=unique idea`;
}

/**
 * 构建 Upgrade 上下文（根据 level 不同）
 * @param {Object} upgrade - Upgrade 配置
 * @param {string} [language='en'] - 语言 ('en' 或 'zh')
 */
function buildUpgradeContext(upgrade, language = 'en') {
  if (upgrade.level === 'easy') {
    return `
## Upgrade Type: EASY
- Title: ${upgrade.title}
- What it does: ${upgrade.agent_context || ''}
- Fixed prompt: "${upgrade.prompt || ''}"
- Language dimensions to explore: ${(upgrade.language_dimensions || []).join(' | ')}`;
  }

  if (upgrade.level === 'medium') {
    // Medium: 注入 think、params 结构、意图维度
    const paramsDesc = (upgrade.params || [])
      .map(p => `  - ${p.label} (range: ${p.min}–${p.max}, hint: "${p.hint || ''}")`)
      .join('\n');

    return `
## Upgrade Type: MEDIUM
- Title: ${upgrade.title}
- What it does: ${upgrade.agent_context || ''}
- Design question for student: "${upgrade.think || ''}"
- Parameters student will fill AFTER this conversation:
${paramsDesc}
- Intent dimensions to explore (NOT the numbers themselves):
${(upgrade.language_dimensions || []).map(d => `  - ${d}`).join('\n')}

IMPORTANT: Your job is to understand INTENT, not to ask for numbers directly.
Do NOT ask "how many seconds" or "what number" — ask about their design goals.
Example: Instead of "How many hits?", ask "Do you want a quick fight or an epic battle?"`;
  }

  if (upgrade.level === 'hard') {
    // 根据语言生成不同的 draft_prompt 规则
    const draftPromptRules = language === 'zh'
      ? `## HARD UPGRADE: draft_prompt 生成（重要）
当你决定放行时（continue: false），你必须生成 draft_prompt 字段。

draft_prompt 规则：
1. 整合整个对话中所有具体信息
2. 使用第三人称描述（"添加一个..."、"当玩家..."）
3. 包含：位置、触发方式、视觉效果、结果（如果对话中提到了）
4. 3-5句话，Claude 看了能直接执行
5. 不要添加学生没有提到的内容
6. 使用简单的中文，避免技术术语
7. **必须用中文生成 draft_prompt**

对话片段示例：
- "碰到金色的墙就能发现隐藏通道"
- "在起点附近的左边"
- "消失3秒"

draft_prompt 示例：
"在迷宫起点附近的左侧添加一个隐藏通道。当玩家触碰金色墙壁时，墙壁消失3秒，露出一条秘密捷径。隐藏的墙壁应该用金色来暗示秘密。"`
      : `## HARD UPGRADE: draft_prompt Generation (IMPORTANT)
When you decide to release (continue: false), you MUST generate a draft_prompt field.

draft_prompt Rules:
1. Synthesize ALL specific information from the entire conversation
2. Use third-person description ("Add a...", "When the player...")
3. Include: position, trigger, visual effect, result (if mentioned)
4. 3-5 sentences that Claude can directly execute
5. Do NOT add anything the student didn't mention
6. Use simple English, avoid technical jargon

Example conversation fragments:
- "touch the golden wall to reveal a path"
- "left side near the start"
- "disappears for 3 seconds"

Example draft_prompt:
"Add a hidden passage on the left side of the maze near the starting point. When the player touches the golden-colored wall section, it disappears for 3 seconds to reveal a secret shortcut. The hidden wall should look slightly different from normal walls with a golden color to hint at the secret."`;

    return `
## Upgrade Type: HARD
- Title: ${upgrade.title}
- What it does: ${upgrade.agent_context || ''}
- Design hint shown to student: "${upgrade.hint || ''}"
- Language dimensions to explore: ${(upgrade.language_dimensions || []).join(' | ')}
- Student will write their own prompt — help them think precisely.

${draftPromptRules}`;
  }

  return '';
}

/**
 * 构建 Gate 1 System Prompt
 * @param {Object} upgrade - Upgrade 配置
 * @param {Object} lesson - 当前课程配置
 * @param {string} [language='en'] - 语言 ('en' 或 'zh')
 */
function buildGate1SystemPrompt(upgrade, lesson, language = 'en') {
  const upgradeContext = buildUpgradeContext(upgrade, language);
  const scoringDimensions = buildScoringDimensions(upgrade.level);

  // Medium Own Idea: 动态生成 params
  if (upgrade.dynamicParams) {
    return buildMediumOwnIdeaSystemPrompt(lesson, language);
  }

  // Medium Upgrade 使用 param_coverage 放行逻辑
  if (upgrade.level === 'medium') {
    return buildMediumSystemPrompt(upgrade, lesson, upgradeContext, scoringDimensions, language);
  }

  const languageInstruction = getLanguageInstruction(language);

  // Easy / Hard 使用原有分数放行逻辑
  return `You are a cognitive coach helping kids design games. Your job is to ask questions, not give answers.
${languageInstruction}

## Game Context
- Game type: ${lesson.title}
- Demo description: ${lesson.agent?.demo_description || ''}

${upgradeContext}

## Your Task
1. Ask about ONE dimension per round
2. Never accept vague adjectives (cool, fun, hard) — always ask for specifics
3. From Round 2 onwards, reference the student's exact words
4. Never write the prompt for the student

${scoringDimensions}

## Response Format (MUST return JSON)
{
  "scores": {
    "specificity": 0-3,
    "causality": 0-3,
    "autonomy": 0-3,
    "total": 0-9
  },
  "continue": true/false,
  "early_release": true/false,
  "mode": "open" | "fill" | "choice",
  "response": "What you say to the student",
  "fill_template": "Optional: fill-in-the-blank template",
  "choices": ["Optional: Choice A", "Choice B", "Choice C"],
  "best_quote": "Optional: the student's best phrase",
  "draft_prompt": "REQUIRED for HARD when continue:false — 3-5 sentence Claude-executable prompt based on conversation"
}

## Dynamic Round Logic
After Round 1:
- total ≥ 6 → continue: false, early_release: true (pass immediately)
- total 3-5 → continue: true, mode: "fill" (fill-in-blank)
- total ≤ 2 → continue: true, mode: "choice" (multiple choice)

After Round 2:
- improved ≥2 from Round 1 → continue: false
- no improvement → continue: true, mode: "choice"

Round 3: always continue: false

## Important Rules
- After choice questions, MUST follow up to turn the choice into a description
- Keep a friendly, encouraging tone
- OUTPUT ONLY THE JSON OBJECT, NO OTHER TEXT BEFORE OR AFTER
- Do not wrap in markdown code blocks, just raw JSON`;
}

/**
 * 构建 Medium Upgrade 专用 System Prompt（param_coverage 放行逻辑）
 */
function buildMediumSystemPrompt(upgrade, lesson, upgradeContext, scoringDimensions, language = 'en') {
  // 提取 params 的 key 列表
  const paramKeys = (upgrade.params || []).map(p => p.key);
  const paramCoverageExample = paramKeys.reduce((acc, key) => {
    acc[key] = { covered: false, intent: '' };
    return acc;
  }, {});

  return `You are a cognitive coach helping kids design games. Your job is to understand their DESIGN INTENT, not to ask for numbers.

## Game Context
- Game type: ${lesson.title}
- Demo description: ${lesson.agent?.demo_description || ''}

${upgradeContext}

## Your Task for MEDIUM Upgrades
1. Understand the student's INTENT for each parameter (NOT the number itself)
2. Ask about design goals: "Do you want a quick fight or an epic battle?" NOT "How many hits?"
3. Track which intents have been expressed (param_coverage)
4. Release when all intents are covered

${scoringDimensions}

## param_coverage Tracking
For each parameter, track if the student has expressed their intent:
${paramKeys.map(key => `- ${key}: Has the student expressed their design preference for this?`).join('\n')}

## Response Format (MUST return JSON)
{
  "param_coverage": ${JSON.stringify(paramCoverageExample, null, 2).replace(/false/g, 'true/false').replace(/""/g, '"their expressed intent"')},
  "all_covered": true/false,
  "scores": {
    "intent_clarity": 0-3,
    "design_reasoning": 0-3,
    "autonomy": 0-3,
    "total": 0-9
  },
  "continue": true/false,
  "early_release": true/false,
  "mode": "open" | "fill" | "choice",
  "response": "What you say to the student",
  "fill_template": "Optional: fill-in-the-blank template",
  "choices": ["Optional: Choice A", "Choice B", "Choice C"],
  "best_quote": "Optional: the student's best phrase about their design intent"
}

## Release Logic for MEDIUM (based on param_coverage, NOT total score)
- all_covered: true → continue: false, early_release: true (release immediately)
- all_covered: false → continue: true
  - If no intent expressed → mode: "choice" (offer design choices)
  - If partial intent → mode: "open" (ask about remaining params)

After Round 3: always continue: false (release regardless of coverage)

## Example Intent Mapping
Student: "I want the boss to be like a final challenge, you have to work really hard to get there"
→ param_coverage.score: { covered: true, intent: "late-game, high score threshold" }

Student: "The fight should feel epic, not just one hit and done"
→ param_coverage.hits: { covered: true, intent: "multi-hit, extended battle" }

## Important Rules
- NEVER ask for numbers directly ("How many hits?" ❌)
- Ask about feelings and design goals ("Should it be quick or epic?" ✓)
- Reference their exact words when following up
- Keep a friendly, encouraging tone
- ${getLanguageInstruction(language)}
- OUTPUT ONLY THE JSON OBJECT, NO OTHER TEXT`;
}

/**
 * Medium Own Idea System Prompt - 动态生成 params
 */
function buildMediumOwnIdeaSystemPrompt(lesson, language = 'en') {
  return `IMPORTANT: Your response must be a single JSON object. Start with { end with }.
No text before or after. No markdown. No code blocks.

FORMATTING: No **bold**, no *italic*, no bullet points. Plain English only. 1-2 sentences. One question per response.

You are a game design coach helping a student add their own custom feature to a ${lesson.title} game.
Your goal: understand their idea, then generate number parameters for it.
Never write the prompt for the student. Guide them to think precisely.

## Two-Phase Process

Phase 1 - Understand the idea (Round 1-2):
Round 1: Ask what feature they want to add.
- If vague ("cool thing", "something fun") → ask more specifically
- If clear enough → move to Phase 2

Round 2 (if needed): Clarify the core mechanic.
"So you want [X] — when it happens, what does the player experience?"

Phase 2 - Generate params while asking details (Round 2+):
As soon as you understand the core idea, start generating params.
For each aspect that can be controlled by a number, generate one param.

## Param Generation Rules
Each param must follow this structure:
{
  "key": "snake_case_name",
  "label": "Human readable question (e.g. 'How many rocks appear?')",
  "min": [reasonable minimum],
  "max": [reasonable maximum],
  "hint": "min_value = [experience], max_value = [experience]",
  "intent": "what the student said that generated this param"
}

Range constraints:
- Count/quantity: min 1, max 20
- Speed: min 1, max 10
- Time (seconds): min 1, max 30
- Size/scale: min 1, max 10
- Percentage/chance: min 10, max 100

Generate params ONE AT A TIME as you discover each dimension.
After each param, ask about the next aspect.

## Prompt Template Rules
Build the template incrementally. Use {key} syntax for each param.
Example: "Add {rock_count} rocks that fall from the top every {fall_interval} seconds"
Every {key} in the template must have a corresponding param.

## all_covered Condition
When you have enough params to fully describe the feature.
Minimum 1 param, maximum 4 params. Stop at 4 even if more details exist.

## Response Format (MUST return JSON every response)
{
  "response": "question or feedback for student",
  "round": 1,
  "continue": true,
  "all_covered": false,
  "params_so_far": [
    {
      "key": "param_key",
      "label": "label text",
      "min": 1,
      "max": 10,
      "hint": "1 = easy, 10 = hard",
      "intent": "what student said"
    }
  ],
  "prompt_template_so_far": "Add {param_key} rocks that...",
  "best_quote": "most precise thing student said",
  "language_growth": "one sentence about student progress"
}

When all_covered is true (feature fully defined):
{
  "response": "Great! Your feature is ready!",
  "round": 3,
  "continue": false,
  "all_covered": true,
  "params_so_far": [...all params...],
  "prompt_template_so_far": "complete template",
  "best_quote": "...",
  "language_growth": "..."
}

## Important Rules
- Maximum 4 params total
- After Round 3, always set continue: false
- Keep responses friendly and short
- ${getLanguageInstruction(language)}`;
}

/**
 * 为 Medium Upgrade 生成参数推荐
 */
async function buildParamRecommendation(upgrade, conversationHistory) {
  if (!upgrade.params || upgrade.params.length === 0) {
    return null;
  }

  const paramsDesc = upgrade.params
    .map(p => `${p.key}: ${p.label} (range: ${p.min}–${p.max}, hint: ${p.hint || ''})`)
    .join('\n');

  const historyText = conversationHistory
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  const prompt = `Based on this conversation about "${upgrade.title}":

${historyText}

The student will fill these parameters:
${paramsDesc}

Based on their expressed INTENT (not what they said literally),
suggest a specific value for each parameter.

Return ONLY a JSON object, no explanation:
{
  "recommendations": {
    "[param_key]": {
      "value": [suggested number within the valid range],
      "reason": "[one sentence in English: why this number matches their intent]"
    }
  }
}`;

  try {
    const messages = [{ role: 'user', content: prompt }];
    const response = await callDeepSeek(messages, 0.3);
    const parsed = parseAIResponse(response);
    console.log('Param recommendations:', parsed);
    return parsed;
  } catch (e) {
    console.error('Param recommendation failed:', e);
    return null;
  }
}

/**
 * 构建 Gate 2 System Prompt
 */
function buildGate2SystemPrompt(agenda, gate2Mode, language = 'en') {
  // 构建 upgrade 列表，包含难度和 bestQuote
  const upgradesList = agenda.map((item, i) => {
    const difficulty = item.upgrade_difficulty || 'easy';
    const quote = item.best_student_quote ? ` | bestQuote: "${item.best_student_quote}"` : '';
    return `${i + 1}. ${item.target_upgrade_label} [${difficulty}]${quote}`;
  }).join('\n');

  // 检查是否有 Hard upgrade
  const hasHardUpgrade = agenda.some(item => item.upgrade_difficulty === 'hard');
  const hardUpgrades = agenda.filter(item => item.upgrade_difficulty === 'hard');

  // Hard upgrade 的特殊验证逻辑
  const hardVerifyLogic = hasHardUpgrade ? `
## HARD Upgrade Verification (Student wrote their own prompt)

### Key Difference from EASY/MEDIUM
- EASY/MEDIUM: Ask "Did [X] appear in your game?" (yes/no)
- HARD: Ask "Did the result MATCH what you described?" (match quality)

### Why This Matters
For HARD upgrades, the feature almost certainly appeared in some form (Claude executed something).
The real question is: Did Claude understand and implement the student's SPECIFIC vision?

### Verification Flow for HARD Upgrades
1. First ask: "You described [their bestQuote]. Did the result match what you imagined?"
2. If YES (matched):
   - Record: matched = true, attributed = true
   - Ask: "What made it work? What was clear in your description?"
3. If NO (mismatch):
   - Ask: "What's different from what you described?"
   - Then: "Which part of your description was missing or unclear?"
   - This helps the student identify their language gap

### Failure Type Classification for HARD
When result doesn't match:
- **no_prompt**: Student realizes they didn't actually describe that part
  → "You said '${hardUpgrades[0]?.best_student_quote || '[their quote]'}' — did you describe [the missing element] in what you wrote to Claude?"
- **prompt_ignored**: Student described it but Claude did it differently
  → "How exactly did you describe [X]? Was the description specific enough for Claude to understand?"

### HARD Response Format
For HARD upgrades, use "matched" instead of "appeared":
{
  "upgrade_id": "xxx",
  "matched": true/false,      // ← Use "matched" for HARD
  "appeared": true,           // HARD always "appeared" in some form
  "attributed": true/false,
  "failure_type": null | "no_prompt" | "prompt_ignored",
  "mismatch_detail": "Optional: what was different"
}
` : '';

  return `You are a friendly game design assistant helping kids verify and attribute their game upgrades.

## Upgrades to Process
${upgradesList}

## Time Mode: ${gate2Mode === 'retry' ? 'Plenty of time (can retry)' : 'Limited time (diagnose only)'}

## Your Task
1. For EASY/MEDIUM upgrades: Ask "Did [upgrade] appear in your game?"
2. For HARD upgrades: Ask "Did the result MATCH what you described?" (reference their bestQuote)
3. Evaluate the quality of their attribution
4. Decide next steps based on their response
${hardVerifyLogic}
## Attribution Quality Assessment
- **Complete attribution**: Student explains why it appeared/matched or didn't → record directly
- **Partial attribution**: Only states result, no reason → ask about each upgrade
- **No attribution**: Only feelings (like "it was good") → fall back to multiple choice

## Response Format (MUST return JSON)
{
  "response": "What you say to the student",
  "next_action": "continue" | "ask_specific" | "choice" | "done",
  "verified_upgrades": [
    {
      "upgrade_id": "xxx",
      "appeared": true/false,
      "matched": true/false,     // For HARD upgrades: did it match their description?
      "attributed": true/false,
      "failure_type": null | "no_prompt" | "prompt_ignored",
      "mismatch_detail": "Optional: for HARD, what was different"
    }
  ],
  "choices": ["Optional: choice list"]
}

## Failure Handling by Level

### EASY/MEDIUM: When appeared = false
- Type A (no_prompt): Reference best_student_quote, suggest adding to prompt
- Type B (prompt_ignored): Ask about uncovered language_dimensions

### HARD: When matched = false
- First understand: "What's different from what you imagined?"
- Then diagnose:
  - Type A (no_prompt): "Did you actually describe [that part] in your prompt?"
  - Type B (prompt_ignored): "How did you describe it? Was it specific enough?"
- Reference their bestQuote: "You said '[quote]' — was [X] included in that?"

## Time Mode Behavior
${gate2Mode === 'retry'
  ? '- Plenty of time: Let student identify the gap, then suggest they update their prompt and try again'
  : '- Limited time: Focus on learning — "What did you learn about why it didn\'t match?" No retry needed'}

## CRITICAL: Failure Handling — Switch to Debug Mode

When student confirms upgrade did NOT appear (appeared=false) or did NOT match (matched=false):

DO NOT say:
❌ "Okay, thanks for your feedback"
❌ "Got it, recorded"
❌ Any closing statement

INSTEAD, immediately switch to Debug mode:
✅ "Okay, [Upgrade name] didn't appear — is your game still running, or did it crash?"

This becomes Debug Orchestrator Q1. From here, run the full Debug classification flow.

### Response Format for Failure → Debug Switch
{
  "response": "Okay, [Upgrade name] didn't appear — is your game still running, or did it crash?",
  "next_action": "switch_to_debug",
  "switch_to_debug": true,
  "debug_context": {
    "failed_upgrade": "[Upgrade label]",
    "failed_upgrade_id": "[Upgrade ID]",
    "student_said": "[What student said about the failure]",
    "failure_type": "not_appeared" | "not_matched"
  },
  "verified_upgrades": [
    {
      "upgrade_id": "xxx",
      "appeared": false,
      "attributed": false,
      "failure_type": null
    }
  ]
}

## Important Rules
- For HARD: Always reference their bestQuote when discussing mismatch
- For HARD: The question is "match" not "appear"
- When student says upgrade didn't appear/match → IMMEDIATELY switch to Debug
- Keep a friendly, encouraging tone
- Help students see the connection between precise language and results
- ${getLanguageInstruction(language)}
- OUTPUT ONLY THE JSON OBJECT, NO OTHER TEXT`;
}

/**
 * 对话消息组件
 */
function ChatMessage({ message, isUser }) {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl ${
        isUser
          ? 'bg-indigo-500 text-white rounded-br-sm'
          : 'bg-gray-100 text-gray-800 rounded-bl-sm'
      }`}>
        <p className="text-sm whitespace-pre-wrap">{message}</p>
      </div>
    </div>
  );
}

/**
 * 选择按钮组件
 */
function ChoiceButtons({ choices, onSelect, disabled }) {
  return (
    <div className="flex flex-col gap-2 my-3">
      {choices.map((choice, i) => (
        <button
          key={i}
          onClick={() => onSelect(choice)}
          disabled={disabled}
          className="w-full px-4 py-3 text-left text-sm bg-white border-2 border-indigo-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-colors disabled:opacity-50"
        >
          {String.fromCharCode(65 + i)}. {choice}
        </button>
      ))}
    </div>
  );
}

/**
 * 填空模板组件
 */
function FillTemplate({ template, onSubmit }) {
  const [value, setValue] = useState('');

  return (
    <div className="my-3 p-3 bg-blue-50 rounded-xl border-2 border-blue-200">
      <p className="text-sm text-blue-800 mb-2">{template}</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Fill in your idea..."
          className="flex-1 px-3 py-2 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
        />
        <button
          onClick={() => value.trim() && onSubmit(value.trim())}
          disabled={!value.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          OK
        </button>
      </div>
    </div>
  );
}

// =====================================================
// Debug Multi-Agent System Prompts
// =====================================================

// Debug Orchestrator JSON 示例（单行，不能换行）
const DEBUG_JSON_PENDING = '{"response":"Is your game running or frozen?","route":"pending","q_asked":"Q1","severity":"light","bug_summary":"","related_upgrade":null}';
const DEBUG_JSON_ROUTE = '{"response":"Got it, let me help fix that!","route":"prompt_tool","q_asked":"done","severity":"light","bug_summary":"timer not appearing","related_upgrade":"timer"}';
const DEBUG_JSON_NOBUG = '{"response":"Great, your game is working fine!","route":"no_bug","q_asked":"none","severity":"none","bug_summary":"","related_upgrade":null}';

/**
 * Debug Orchestrator System Prompt
 * 分诊层：最多4轮分类 bug → 路由到对应 Tool
 */
function buildDebugOrchestratorPrompt(studentContext, currentRound = 1, preKnown = null, qState = null) {
  // 预知信息模式（从 Gate 2 切换过来时）
  const preKnownSection = preKnown ? `
PRE-KNOWN: ${preKnown.failedUpgrade} did not appear. Student said: "${preKnown.studentSaid || 'N/A'}". Start with Q1.` : '';

  // Q状态注入
  const qStateSection = qState ? `
Q-STATE: Q1=${qState.q1 || 'pending'} Q2=${qState.q2 || 'pending'} Q3=${qState.q3 || 'pending'} Q4=${qState.q4 || 'pending'}
Ask the NEXT unanswered question.` : '';

  return `You are a debug classifier for kids. Use simple words.
${preKnownSection}
${qStateSection}

STRICT SEQUENCE (do not skip):
Q1: "Is your game running, or did it freeze/crash?" → crashed → route:reset_tool | running → Q2
Q2: "Is it just one thing broken, or multiple things?" → multiple → route:reset_tool | one → Q3
Q3: "Is the feature missing, or doing something wrong?" → missing → route:prompt_tool | wrong → Q4
Q4: "Is it doing the opposite, or just a small detail off?" → opposite → route:prompt_tool | detail → route:code_tool

FORBIDDEN: Never ask about prompt content. That is for Tools only.

RESPONSE FORMAT (single line JSON):
Pending: ${DEBUG_JSON_PENDING}
Routing: ${DEBUG_JSON_ROUTE}
No bug: ${DEBUG_JSON_NOBUG}

Round: ${currentRound}`;
}

/**
 * Debug Prompt Tool System Prompt (A类 — 描述不精确)
 */
function buildDebugPromptToolPrompt(studentContext, bugSummary, relatedUpgrade, roundNumber, attemptCount = 0) {
  const relevantUpgrade = (studentContext?.upgradeSummaries || [])
    .find(s => s.upgrade === relatedUpgrade || s.upgradeId === relatedUpgrade);
  const bestQuote = relevantUpgrade?.studentSaid || '';

  // 执行层追问上限逻辑
  const scaffoldHint = attemptCount >= 2 ? `
SCAFFOLD MODE: Student tried ${attemptCount} times. Give sentence frame:
"Try: Fix [feature]: it should [action] [speed/direction/frequency]"
After they fill it, pass unconditionally.` : '';

  return `IMPORTANT: Your response must be a single JSON object. Start with { end with }.
No text before or after. No markdown. No code blocks.
Example: {"response":"Did you tell Claude?","round":2,"continue":true,"ready_to_execute":false,"student_fix":"","fix_quality":""}

FORMATTING: No **bold**, no *italic*, no bullet points. Plain English only. 1-2 sentences. One question per response.

You help kids fix their game descriptions. Use simple words a 10-year-old understands.

=== FOUR ROUNDS ===

Round 1: Ask "What went wrong? What did you WANT to happen?"

Round 2: Ask "Did you tell Claude about that?"
- If student says only "yes" or "no", ask: "What was missing from your description?"
- Do NOT pass until student explains in their own words.

Round 3: Say "Write one sentence to tell Claude how to fix it."
${scaffoldHint}

=== ROUND 3 STRICT SCORING (fix_quality) ===

vague (do NOT pass, ask again):
- Only has noun, no verb describing action
  ❌ "the rocks move" → too vague
  ❌ "make the rocks work" → too vague
- Verb is too vague (move/work/fix/appear) with no specifics
  ❌ "the rocks move around in the maze" → ask: "You said 'move around' — which direction? How fast?"
- Missing: direction OR speed OR frequency
  ❌ "make rocks move left and right" → missing speed/frequency

specific (ask ONE more question):
- Has direction but missing speed/frequency
  ⚠️ "make the rock move left and right" → ask: "How fast? Every few seconds?"

precise (PASS):
- Has: feature name + specific action + at least one number/measurement
  ✅ "Fix the rock: move left and right every 2 seconds"
  ✅ "Make the trap patrol at speed 3"

=== QUOTE RULE ===
When asking follow-up, QUOTE student's exact words:
✅ "You said 'move around' — which direction? How fast?"
❌ "Be more specific — how should it move?"

=== JSON FORMAT ===
{"response":"your message","round":${roundNumber},"continue":true,"ready_to_execute":false,"student_fix":"","fix_quality":"vague"}

When passing (fix_quality is "precise" or scaffold mode):
{"response":"Great!","round":${roundNumber},"continue":false,"ready_to_execute":true,"student_fix":"student's sentence here","fix_quality":"precise"}

Current: round ${roundNumber}, bug "${bugSummary || 'unknown'}", attempts ${attemptCount}

CRITICAL: Output ONLY a JSON object. First character must be {. Last character must be }. No other text.`;
}

/**
 * Debug Code Tool System Prompt (B类 — 代码有bug) - 简化版
 */
function buildDebugCodeToolPrompt(studentContext, bugSummary, roundNumber, attemptCount = 0) {
  const scaffoldHint = attemptCount >= 2 ? `
SCAFFOLD MODE: Student tried ${attemptCount} times. Give sentence frame:
"Try: Fix [feature]: it should [expected behavior]"
After they fill it, pass unconditionally.` : '';

  return `IMPORTANT: Your response must be a single JSON object. Start with { end with }.
No text before or after. No markdown. No code blocks.
Example: {"response":"When does this happen?","round":1,"continue":true,"ready_to_execute":false,"final_fix_request":"","fix_quality":""}

FORMATTING: No **bold**, no *italic*, no bullet points. Plain English only. 1-2 sentences. One question per response.

You help kids fix game bugs. Use simple words a 10-year-old understands.

=== THREE ROUNDS ===

Round 1: Ask "What's going wrong? When does it happen?"

Round 2: Ask "Does this happen every time?"
- If student only says "yes", ask: "Can you describe exactly what happens?"
- Student must describe the problem in their own words.

Round 3: Say "Write one sentence: what SHOULD happen instead?"
${scaffoldHint}

=== ROUND 3 STRICT SCORING ===
Same rules as Prompt Tool: vague/specific/precise.
Quote student's words when asking follow-up.
2 attempts then give sentence frame and pass.

=== JSON FORMAT ===
{"response":"short message","round":${roundNumber},"continue":true,"ready_to_execute":false,"student_fix":""}

Pass Round 3:
{"response":"Got it!","round":${roundNumber},"continue":false,"ready_to_execute":true,"student_fix":"student sentence"}

Current: round ${roundNumber}, bug "${bugSummary || 'unknown'}"

CRITICAL: Output ONLY a JSON object. First character must be {. Last character must be }. No other text.`;
}

/**
 * Debug Reset Phase 1 System Prompt (C类 — 推倒重来)
 */
function buildDebugResetPhase1Prompt(studentContext, step, selectedUpgrades = [], attemptCount = 0, language = 'en') {
  const successfulUpgrades = studentContext?.successfulUpgrades || [];
  const upgradeList = successfulUpgrades.map(u => u.target_upgrade_label).join(', ') || 'None';

  const scaffoldHint = attemptCount >= 2 && step === 3 ? `
IMPORTANT: Student has tried ${attemptCount} times. Let them continue with what they wrote.
Give gentle guidance on what's missing, then unconditionally pass.` : '';

  return `IMPORTANT: Your response must be a single JSON object. Start with { end with }.
No text before or after. No markdown. No code blocks.
Example: {"response":"Which features to keep?","step":1,"continue":true,"show_upgrade_selector":false,"scores":{},"final_new_prompt":""}

FORMATTING: No **bold**, no *italic*, no bullet points. Plain English only. 1-2 sentences. One question per response.

You are a Reset Guide. The student's game is too broken to fix — they need to regenerate.
Help them keep the good parts and write a new prompt. Keep a light tone — don't judge.

## Three-Step Flow

Step 1: Confirm
- "Sometimes starting fresh is faster than fixing. Which features do you want to keep?"
- Don't say "your game is broken" — reduce frustration

Step 2: Show features to keep (UI handles checkbox selection)
- After student selects, proceed to Step 3

Step 3: Student writes new prompt (Execution Layer)
- "Try writing a complete game description including the features you chose"
- Show selected features as reference (NOT a template)
- Check three things:
  1. has_base_game: Did they describe the basic game type?
     ❌ Only wrote features, no game itself
     ✅ "Create a maze game where..."
  2. features_covered: Did they include all selected features?
     Missing → "You chose to keep [X], but it's not in your description — want to add it?"
  3. executable: Can Claude generate a game from this?
- All pass → proceed
${scaffoldHint}

## Tone Principles
- "Starting fresh" is not failure, it's a normal engineering choice
- Don't say "your game broke" or "you messed up"

## Current State
Step: ${step}
Successful Upgrades (upgrade_appeared=true): ${upgradeList}
Selected to Keep: ${selectedUpgrades.join(', ') || 'None selected yet'}
Attempt Count: ${attemptCount}

## Response Format — STRICT JSON
{
  "response": "What you say to the student",
  "step": ${step},
  "show_upgrade_selector": ${step === 2},
  "continue": true/false,
  "scores": {
    "has_base_game": true/false,
    "features_covered": ["covered feature names"],
    "features_missing": ["missing feature names"],
    "executable": true/false
  },
  "final_new_prompt": "Student's complete new prompt (only when passing Step 3)"
}

## Important Rules
- OUTPUT ONLY THE JSON OBJECT, NO OTHER TEXT
- NEVER write the new prompt for the student
- Step 3: after 2 attempts, give guidance then unconditionally pass
- ${getLanguageInstruction(language)}`;
}

/**
 * Debug Reset Phase 2 System Prompt (认知反思)
 */
function buildDebugResetPhase2Prompt(studentContext, keptUpgradesCount, previousUpgradesCount, language = 'en') {
  return `IMPORTANT: Your response must be a single JSON object. Start with { end with }.
No text before or after. No markdown. No code blocks.
Example: {"response":"Is your new game working?","continue":true,"insight_note":"","skipped":false}

FORMATTING: No **bold**, no *italic*, no bullet points. Plain English only. 1-2 sentences. One question per response.

You are a Reflection Guide. The student just regenerated their game.
Gently help them understand why they needed to start over. Don't force.

## Flow

Step 1: Confirm game is working
- "Is your new game running?"

Step 2 (if working): Light reflection
- "Do you know why the previous game needed to be restarted?"

  Student says the reason → record insight, pass
  Student says "I don't know" → give a hint (not the answer):
    "You kept ${keptUpgradesCount} features this time, last time you had ${previousUpgradesCount} — what do you think happens with too many features?"
  Student doesn't want to reflect → pass immediately, don't force

## Tone
Curious, not critical. "Do you know why" is not "you did wrong".

## Response Format — STRICT JSON
{
  "response": "What you say to the student",
  "continue": true/false,
  "insight_note": "What the student understood",
  "skipped": false
}

## Important Rules
- OUTPUT ONLY THE JSON OBJECT, NO OTHER TEXT
- Keep it light and short
- ${getLanguageInstruction(language)}`;
}

/**
 * Agent Panel 主组件
 */
export default function AgentPanel({
  mode,           // 'gate1' | 'gate2' | 'debug_orchestrator' | 'debug_prompt' | 'debug_code' | 'debug_reset_phase1' | 'debug_reset_phase2' | 'debug_verify'
  sessionRecordId,  // Gate 1 用
  upgrade,          // Gate 1 用
  lesson,           // Gate 1 用：当前课程配置
  currentPrompt,    // Gate 1 用
  resumeData,       // Gate 1 恢复用
  agenda,           // Gate 2 用
  gate2Mode,        // Gate 2 用: 'retry' | 'diagnose'
  timeRemaining,    // Gate 2 用
  onClose,
  onGate1Complete,  // Gate 1 完成回调
  // Debug props
  studentContext,       // Debug 用：学生上下文
  bugSummary,          // Debug 用：bug 摘要
  relatedUpgrade,      // Debug 用：相关 Upgrade
  debugSessionId,      // Debug 用：debug_session 记录 ID
  type,                // debug_verify 用：'prompt_fix' | 'code_fix'
  onDebugToolComplete, // Debug 用：工具完成回调
}) {
  // i18n: 获取当前语言
  const { language } = useLanguage();

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [rounds, setRounds] = useState([]);
  const [currentMode, setCurrentMode] = useState('open');
  const [choices, setChoices] = useState([]);
  const [fillTemplate, setFillTemplate] = useState('');
  const [bestQuote, setBestQuote] = useState('');
  const [draftPrompt, setDraftPrompt] = useState(''); // Hard 升级完成时生成的 draft prompt
  const [completed, setCompleted] = useState(false);
  const [paramRecommendations, setParamRecommendations] = useState(null); // Medium 参数推荐
  const [dynamicParams, setDynamicParams] = useState([]); // Medium Own Idea 动态生成的 params
  const [promptTemplate, setPromptTemplate] = useState(''); // Medium Own Idea 动态生成的 template
  const [gate1CompletionData, setGate1CompletionData] = useState(null); // 存储完成数据，等用户点击 Continue 再触发回调

  // Debug 状态
  const [debugStep, setDebugStep] = useState(1); // Reset Phase 1 用
  const [debugAttemptCount, setDebugAttemptCount] = useState(0); // 执行层追问计数
  const [selectedUpgrades, setSelectedUpgrades] = useState([]); // Reset 保留的 Upgrade
  const [debugFinalOutput, setDebugFinalOutput] = useState(null); // 最终输出（学生写的）
  const [debugBestQuote, setDebugBestQuote] = useState(''); // Debug 中的最佳语句
  const [debugInsight, setDebugInsight] = useState(''); // Debug 中的洞察
  const [debugQState, setDebugQState] = useState({ q1: null, q2: null, q3: null, q4: null }); // Orchestrator Q1-Q4 状态

  // Gate 2 → Debug 切换状态
  const [activeMode, setActiveMode] = useState(mode); // 可动态切换的模式
  const [activeDebugSessionId, setActiveDebugSessionId] = useState(debugSessionId); // 动态 debug session ID
  const [debugPreKnown, setDebugPreKnown] = useState(null); // Debug 预知信息（从 Gate 2 传入）
  const [activeBugSummary, setActiveBugSummary] = useState(bugSummary); // 动态 bug summary
  const [activeRelatedUpgrade, setActiveRelatedUpgrade] = useState(relatedUpgrade); // 动态相关 upgrade

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // V17 Phase B: Gate 1 专用 RoundCounter（代码层计数，不受模型返回值影响）
  const gate1RoundCounter = useRef(new RoundCounter());

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 初始化对话（基于 prop mode）
  useEffect(() => {
    if (mode === 'gate1') {
      initGate1();
    } else if (mode === 'gate2') {
      initGate2();
    } else if (mode === 'debug_orchestrator') {
      initDebugOrchestrator();
    } else if (mode === 'debug_prompt') {
      initDebugPrompt();
    } else if (mode === 'debug_code') {
      initDebugCode();
    } else if (mode === 'debug_reset_phase1') {
      initDebugResetPhase1();
    } else if (mode === 'debug_reset_phase2') {
      initDebugResetPhase2();
    } else if (mode === 'debug_verify') {
      initDebugVerify();
    }
    setActiveMode(mode);
  }, [mode]);

  // 响应 activeMode 变化（用于 Gate 2 → Debug 切换）
  useEffect(() => {
    // 只处理从 gate2 切换到 debug 的情况（不重新初始化，因为消息已经在切换时添加）
    if (activeMode !== mode && activeMode === 'debug_orchestrator' && mode === 'gate2') {
      // Gate 2 → Debug 切换：不需要初始化，消息已在 switch 时添加
      console.log('Gate 2 → Debug Orchestrator switch detected');
    }
  }, [activeMode]);

  /**
   * Gate 1 初始化
   * V17 Phase B: 重置 RoundCounter
   */
  async function initGate1() {
    // V17 Phase B: 重置 round 计数器
    gate1RoundCounter.current.reset();
    setCurrentRound(1);

    const msgs = getAgentMessages(language);
    const welcomeMessage = msgs.gate1Welcome(upgrade?.title);

    setMessages([{ role: 'assistant', content: welcomeMessage }]);
    setCurrentMode('open');
  }

  /**
   * Gate 2 初始化
   */
  async function initGate2() {
    if (!agenda || agenda.length === 0) {
      setCompleted(true);
      return;
    }

    const upgradeNames = agenda.map(item => item.target_upgrade_label).join(', ');
    const msgs = getAgentMessages(language);
    const welcomeMessage = msgs.gate2Welcome(upgradeNames);

    setMessages([{ role: 'assistant', content: welcomeMessage }]);
  }

  // =====================================================
  // Debug Mode 初始化函数
  // =====================================================

  /**
   * Debug Orchestrator 初始化
   */
  async function initDebugOrchestrator() {
    const msgs = getAgentMessages(language);
    const welcomeMessage = msgs.debugOrchestratorWelcome;

    setMessages([{ role: 'assistant', content: welcomeMessage }]);
    setCurrentMode('open');
    setCurrentRound(1);
  }

  /**
   * Debug Prompt Tool 初始化 (A类)
   */
  async function initDebugPrompt() {
    // 如果有 bugSummary（从 Orchestrator 传来），直接进入 Round 2
    const msgs = getAgentMessages(language);
    const welcomeMessage = msgs.debugPromptWelcome(bugSummary);

    setMessages([{ role: 'assistant', content: welcomeMessage }]);
    setCurrentMode('open');
    setCurrentRound(bugSummary ? 2 : 1);  // 有摘要从 Round 2 开始
    setDebugAttemptCount(0);
    setCompleted(false);
    setDebugFinalOutput(null);
  }

  /**
   * Debug Code Tool 初始化 (B类)
   */
  async function initDebugCode() {
    // 如果有 bugSummary（从 Orchestrator 传来），直接进入 Round 2
    const msgs = getAgentMessages(language);
    const welcomeMessage = msgs.debugCodeWelcome(bugSummary);

    setMessages([{ role: 'assistant', content: welcomeMessage }]);
    setCurrentMode('open');
    setCurrentRound(bugSummary ? 2 : 1);  // 有摘要从 Round 2 开始
    setCompleted(false);
    setDebugFinalOutput(null);
    setCurrentRound(1);
    setDebugAttemptCount(0);
  }

  /**
   * Debug Reset Phase 1 初始化 (C类)
   */
  async function initDebugResetPhase1() {
    const msgs = getAgentMessages(language);
    const welcomeMessage = msgs.debugResetPhase1Welcome;

    setMessages([{ role: 'assistant', content: welcomeMessage }]);
    setDebugStep(1);
    setSelectedUpgrades([]);
    setDebugAttemptCount(0);
    setCompleted(false);
    setDebugFinalOutput(null);
  }

  /**
   * Debug Reset Phase 2 初始化 (反思阶段)
   */
  async function initDebugResetPhase2() {
    const msgs = getAgentMessages(language);
    const welcomeMessage = msgs.debugResetPhase2Welcome;

    setMessages([{ role: 'assistant', content: welcomeMessage }]);
  }

  /**
   * Debug Verify 初始化
   */
  async function initDebugVerify() {
    const msgs = getAgentMessages(language);
    const verifyQuestion = msgs.debugVerifyQuestion(type === 'prompt_fix');

    setMessages([{ role: 'assistant', content: verifyQuestion }]);
  }

  // =====================================================
  // Debug Mode 消息处理函数
  // =====================================================

  /**
   * 从用户输入和对话历史推断路由（fallback 逻辑）
   */
  function inferRouteFromInput(userInput, round, allMessages = []) {
    const input = userInput.toLowerCase();
    const allText = allMessages.map(m => m.content).join(' ').toLowerCase();

    // Round 3+ 时更积极地路由
    if (round >= 3) {
      // 有明确的 code 信号
      if (input.includes('detail') || input.includes('mostly') || input.includes('little') ||
          input.includes('almost') || input.includes('slightly') || input.includes('bit off')) {
        return 'code_tool';
      }
      // 有明确的 reset 信号
      if (input.includes('crash') || input.includes('freeze') || input.includes('multiple') ||
          input.includes('everything') || input.includes('all broken')) {
        return 'reset_tool';
      }
      // Round 3+ 默认路由到 prompt_tool（最常见的问题类型）
      return 'prompt_tool';
    }

    // Round 1-2: 只在有明确信号时路由
    // Reset 信号
    if (input.includes('crash') || input.includes('freeze') || input.includes('everything broken')) {
      return 'reset_tool';
    }
    // Prompt 信号（描述不精确）
    if (input.includes('opposite') || input.includes('wrong') || input.includes("didn't appear") ||
        input.includes('not there') || input.includes("doesn't appear") || input.includes('missing') ||
        input.includes('should be') || input.includes("shouldn't")) {
      return 'prompt_tool';
    }
    // Code 信号（细节问题）
    if (input.includes('detail') || input.includes('mostly right') || input.includes('small') ||
        input.includes('almost work') || input.includes('close but')) {
      return 'code_tool';
    }

    return null; // 继续追问
  }

  /**
   * 更新 Debug Q 状态（根据学生回答推断）
   */
  function updateDebugQState(qAsked, userInput) {
    const input = userInput.toLowerCase();

    setDebugQState(prev => {
      const newState = { ...prev };

      if (qAsked === 'Q1') {
        // Q1: running or crashed
        if (input.includes('crash') || input.includes('froze') || input.includes('frozen') || input.includes('stuck') || input.includes('broke')) {
          newState.q1 = 'crashed';
        } else {
          newState.q1 = 'running';
        }
      } else if (qAsked === 'Q2') {
        // Q2: one or multiple bugs
        if (input.includes('multiple') || input.includes('many') || input.includes('lot') || input.includes('everything') || input.includes('all')) {
          newState.q2 = 'multiple';
        } else {
          newState.q2 = 'one';
        }
      } else if (qAsked === 'Q3') {
        // Q3: missing or wrong
        if (input.includes('missing') || input.includes('not there') || input.includes('don\'t see') || input.includes('no ') || input.includes('didn\'t')) {
          newState.q3 = 'missing';
        } else {
          newState.q3 = 'wrong';
        }
      } else if (qAsked === 'Q4') {
        // Q4: opposite or detail
        if (input.includes('opposite') || input.includes('reverse') || input.includes('backward') || input.includes('instead')) {
          newState.q4 = 'opposite';
        } else {
          newState.q4 = 'detail';
        }
      }

      return newState;
    });
  }

  /**
   * 发送 Debug Orchestrator 消息
   */
  async function sendDebugOrchestratorMessage(userInput) {
    setLoading(true);
    const newMessages = [...messages, { role: 'user', content: userInput }];
    setMessages(newMessages);

    try {
      // 使用 debugPreKnown（从 Gate 2 切换过来时）和 debugQState
      const systemPrompt = buildDebugOrchestratorPrompt(studentContext, currentRound, debugPreKnown, debugQState);
      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...newMessages.map(m => ({ role: m.role, content: m.content })),
      ];

      const aiResponse = await callDeepSeek(apiMessages, 0.7, 2, 500); // Orchestrator 用 500 tokens
      const parsed = parseAIResponse(aiResponse, currentRound);

      // 更新 Q 状态（根据 AI 说它问了哪个 Q）
      if (parsed.q_asked && parsed.q_asked !== 'done' && parsed.q_asked !== 'none') {
        updateDebugQState(parsed.q_asked, userInput);
      }

      // 如果 AI 没有明确路由，尝试从用户输入推断
      let finalRoute = parsed.route;
      if (!finalRoute || finalRoute === 'pending') {
        const inferredRoute = inferRouteFromInput(userInput, currentRound, newMessages);
        if (inferredRoute) {
          finalRoute = inferredRoute;
          console.log('Inferred route from user input:', finalRoute);
        }
      }

      // 显示 AI 响应
      setMessages([...newMessages, { role: 'assistant', content: parsed.response || parsed.next_question }]);

      // 处理 no_bug 路由：游戏正常，不需要 debug
      if (finalRoute === 'no_bug') {
        setCompleted(true);
        // 延迟关闭，让学生看到消息
        setTimeout(() => {
          onClose();
        }, 2000);
        return;
      }

      // 检查是否需要路由（使用推断的路由或 AI 返回的路由）
      if (finalRoute && finalRoute !== 'pending') {
        // 路由到对应 Tool
        setCompleted(true);

        // 如果已经有 activeDebugSessionId（从 Gate 2 切换过来），使用它
        // 否则创建新的 debug_session
        let sessionIdToUse = activeDebugSessionId;

        if (!sessionIdToUse) {
          // 创建 debug_session 并路由
          const record = await agentBridge.createDebugSession(
            finalRoute === 'reset_tool' ? 'reset' : finalRoute === 'code_tool' ? 'code' : 'prompt',
            parsed.severity || 'light',
            parsed.bug_summary || userInput,
            parsed.related_upgrade || debugPreKnown?.failedUpgrade
          );
          sessionIdToUse = record?.id;
        } else {
          // 更新已有的 debug_session
          await supabase.from('debug_sessions').update({
            bug_type: finalRoute === 'reset_tool' ? 'reset' : finalRoute === 'code_tool' ? 'code' : 'prompt',
            bug_summary: parsed.bug_summary || activeBugSummary || userInput,
            related_upgrade: parsed.related_upgrade || activeRelatedUpgrade,
          }).eq('id', sessionIdToUse);
        }

        if (sessionIdToUse) {
          // 如果是从 Gate 2 切换过来的，在同一个 Panel 内切换模式
          // 否则调用 routeDebug 打开新 Panel
          if (mode === 'gate2' && activeMode === 'debug_orchestrator') {
            // 内部切换：更新状态，不打开新 Panel
            setTimeout(() => {
              // 更新 active state
              setActiveDebugSessionId(sessionIdToUse);
              setActiveBugSummary(parsed.bug_summary || activeBugSummary || userInput);
              setActiveRelatedUpgrade(parsed.related_upgrade || activeRelatedUpgrade || debugPreKnown?.failedUpgrade);

              // 切换到对应的 Tool 模式
              if (finalRoute === 'prompt_tool') {
                setActiveMode('debug_prompt');
                setCurrentRound(1);
                setDebugAttemptCount(0);
                // 发送初始消息
                setMessages(prev => [...prev, {
                  role: 'assistant',
                  content: `Okay, let's fix ${parsed.related_upgrade || activeRelatedUpgrade || 'this feature'}. What went wrong? What did you WANT to happen?`
                }]);
              } else if (finalRoute === 'code_tool') {
                setActiveMode('debug_code');
                setCurrentRound(1);
                setDebugAttemptCount(0);
                setMessages(prev => [...prev, {
                  role: 'assistant',
                  content: `Let's look at this code issue. How do you trigger the problem? Does it happen every time?`
                }]);
              } else if (finalRoute === 'reset_tool') {
                setActiveMode('debug_reset_phase1');
                setDebugStep(1);
                setMessages(prev => [...prev, {
                  role: 'assistant',
                  content: `Let's start fresh! First, what's the main problem you're seeing?`
                }]);
              }
              setCompleted(false);
            }, 1500);
          } else {
            // 正常流程：打开新 Panel
            setTimeout(() => {
              agentBridge.routeDebug(
                finalRoute,
                parsed.bug_summary || activeBugSummary || userInput,
                parsed.related_upgrade || activeRelatedUpgrade,
                sessionIdToUse
              );
            }, 1500);
          }
        }
      } else {
        // 继续追问
        setCurrentRound(prev => Math.min(prev + 1, 4));

        // 最多4轮，强制路由
        if (currentRound >= 4) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: "Let me connect you with a helper to look at this more closely..."
          }]);
          setCompleted(true);

          // 默认路由到 prompt_tool
          let fallbackSessionId = activeDebugSessionId;
          if (!fallbackSessionId) {
            const record = await agentBridge.createDebugSession('prompt', 'light', userInput, debugPreKnown?.failedUpgrade || null);
            fallbackSessionId = record?.id;
          }
          if (fallbackSessionId) {
            setTimeout(() => {
              agentBridge.routeDebug('prompt_tool', activeBugSummary || userInput, activeRelatedUpgrade || debugPreKnown?.failedUpgrade, fallbackSessionId);
            }, 1500);
          }
        }
      }
    } catch (error) {
      console.error('Debug Orchestrator error:', error);
      setMessages([...newMessages, {
        role: 'assistant',
        content: "Sorry, I had trouble understanding that. Can you describe the problem again?"
      }]);
    } finally {
      setLoading(false);
    }
  }

  /**
   * 发送 Debug Prompt Tool 消息 (A类)
   */
  async function sendDebugPromptMessage(userInput) {
    setLoading(true);
    const newMessages = [...messages, { role: 'user', content: userInput }];
    setMessages(newMessages);

    try {
      const systemPrompt = buildDebugPromptToolPrompt(
        studentContext,
        bugSummary,
        relatedUpgrade,
        currentRound,
        debugAttemptCount
      );
      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...newMessages.map(m => ({ role: m.role, content: m.content })),
      ];

      const aiResponse = await callDeepSeek(apiMessages);
      const parsed = parseAIResponse(aiResponse, currentRound);

      // 更新最佳语句
      if (parsed.best_debug_quote) {
        setDebugBestQuote(parsed.best_debug_quote);
      }
      if (parsed.insight_note) {
        setDebugInsight(parsed.insight_note);
      }

      // 显示 AI 响应
      setMessages([...newMessages, { role: 'assistant', content: parsed.response }]);

      // 检查是否完成（兼容新旧字段名）
      const fixOutput = parsed.final_fix_prompt || parsed.student_fix;
      const isReady = !parsed.continue || parsed.ready_to_execute;

      if (isReady && fixOutput) {
        // Round 4 完成，显示执行层 UI
        setDebugFinalOutput(fixOutput);
        setCompleted(true);

        // 更新数据库
        await agentBridge.updateDebugSession(debugSessionId, {
          root_cause: parsed.insight_note,
          student_understood: true,
          fix_quality: 'specific',
          final_fix_prompt: fixOutput,
          best_debug_quote: debugBestQuote || parsed.best_debug_quote,
          insight_note: parsed.insight_note,
        });
      } else {
        // 继续对话
        const newRound = parsed.round || currentRound + 1;
        setCurrentRound(newRound);

        // Round 4 追问计数
        if (newRound === 4) {
          setDebugAttemptCount(prev => prev + 1);
        }
      }
    } catch (error) {
      console.error('Debug Prompt Tool error:', error);
      setMessages([...newMessages, {
        role: 'assistant',
        content: "Let me try that again. What exactly is happening with this feature?"
      }]);
    } finally {
      setLoading(false);
    }
  }

  /**
   * 发送 Debug Code Tool 消息 (B类)
   */
  async function sendDebugCodeMessage(userInput) {
    setLoading(true);
    const newMessages = [...messages, { role: 'user', content: userInput }];
    setMessages(newMessages);

    try {
      const systemPrompt = buildDebugCodeToolPrompt(
        studentContext,
        bugSummary,
        currentRound,
        debugAttemptCount
      );
      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...newMessages.map(m => ({ role: m.role, content: m.content })),
      ];

      const aiResponse = await callDeepSeek(apiMessages);
      const parsed = parseAIResponse(aiResponse, currentRound);

      // 更新最佳语句
      if (parsed.best_debug_quote) {
        setDebugBestQuote(parsed.best_debug_quote);
      }
      if (parsed.insight_note) {
        setDebugInsight(parsed.insight_note);
      }

      // 显示 AI 响应
      setMessages([...newMessages, { role: 'assistant', content: parsed.response }]);

      // 检查是否完成（兼容新旧字段名）
      const fixOutput = parsed.final_fix_request || parsed.student_fix;
      const isReady = !parsed.continue || parsed.ready_to_execute;

      if (isReady && fixOutput) {
        // Round 3 完成，显示执行层 UI
        setDebugFinalOutput(fixOutput);
        setCompleted(true);

        // 更新数据库
        await agentBridge.updateDebugSession(debugSessionId, {
          trigger_condition: parsed.best_debug_quote,
          final_fix_request: fixOutput,
          best_debug_quote: debugBestQuote || parsed.best_debug_quote,
          insight_note: parsed.insight_note,
        });
      } else {
        // 继续对话
        const newRound = parsed.round || currentRound + 1;
        setCurrentRound(newRound);

        // Round 3 追问计数
        if (newRound === 3) {
          setDebugAttemptCount(prev => prev + 1);
        }
      }
    } catch (error) {
      console.error('Debug Code Tool error:', error);
      setMessages([...newMessages, {
        role: 'assistant',
        content: "Let me try that again. What exactly is the bug doing?"
      }]);
    } finally {
      setLoading(false);
    }
  }

  /**
   * 发送 Debug Reset Phase 1 消息 (C类)
   */
  async function sendDebugResetPhase1Message(userInput) {
    setLoading(true);
    const newMessages = [...messages, { role: 'user', content: userInput }];
    setMessages(newMessages);

    try {
      const systemPrompt = buildDebugResetPhase1Prompt(
        studentContext,
        debugStep,
        selectedUpgrades,
        debugAttemptCount,
        language
      );
      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...newMessages.map(m => ({ role: m.role, content: m.content })),
      ];

      const aiResponse = await callDeepSeek(apiMessages);
      const parsed = parseAIResponse(aiResponse, currentRound);

      // 显示 AI 响应
      setMessages([...newMessages, { role: 'assistant', content: parsed.response }]);

      // 检查步骤
      if (parsed.show_upgrade_selector) {
        // 进入 Step 2，显示 Upgrade 选择器
        setDebugStep(2);
      } else if (!parsed.continue && parsed.final_new_prompt) {
        // Step 3 完成，显示执行层 UI
        setDebugFinalOutput(parsed.final_new_prompt);
        setCompleted(true);

        // 更新数据库
        await agentBridge.updateDebugSession(debugSessionId, {
          kept_upgrades: selectedUpgrades,
          final_new_prompt: parsed.final_new_prompt,
        });
      } else {
        // 继续当前步骤或进入下一步
        if (parsed.step) {
          setDebugStep(parsed.step);
        }

        // Step 3 追问计数
        if (debugStep === 3) {
          setDebugAttemptCount(prev => prev + 1);
        }
      }
    } catch (error) {
      console.error('Debug Reset Phase 1 error:', error);
      setMessages([...newMessages, {
        role: 'assistant',
        content: "Let me try that again. What features do you want to keep?"
      }]);
    } finally {
      setLoading(false);
    }
  }

  /**
   * 发送 Debug Reset Phase 2 消息 (反思)
   */
  async function sendDebugResetPhase2Message(userInput) {
    setLoading(true);
    const newMessages = [...messages, { role: 'user', content: userInput }];
    setMessages(newMessages);

    try {
      const keptCount = selectedUpgrades?.length || 0;
      const prevCount = studentContext?.upgradeSummaries?.length || 0;

      const systemPrompt = buildDebugResetPhase2Prompt(studentContext, keptCount, prevCount, language);
      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...newMessages.map(m => ({ role: m.role, content: m.content })),
      ];

      const aiResponse = await callDeepSeek(apiMessages);
      const parsed = parseAIResponse(aiResponse, currentRound);

      // 显示 AI 响应
      setMessages([...newMessages, { role: 'assistant', content: parsed.response }]);

      // 检查是否完成
      if (!parsed.continue || parsed.skipped) {
        setCompleted(true);

        // 更新数据库
        await agentBridge.updateDebugSession(debugSessionId, {
          reset_insight: parsed.insight_note,
          resolved: true,
          resolved_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Debug Reset Phase 2 error:', error);
      setMessages([...newMessages, {
        role: 'assistant',
        content: "No worries! Your new game is ready to play! 🎮"
      }]);
      setCompleted(true);
    } finally {
      setLoading(false);
    }
  }

  /**
   * 处理 Debug Verify 响应
   */
  async function handleDebugVerifyResponse(resolved) {
    if (resolved) {
      // 修好了
      await agentBridge.updateDebugSession(debugSessionId, {
        resolved: true,
        resolved_at: new Date().toISOString(),
      });

      setMessages([...messages, {
        role: 'assistant',
        content: "Awesome! You fixed it! 🎉"
      }]);
      setCompleted(true);
    } else {
      // 没修好
      const session = await agentBridge.getDebugSession(debugSessionId);
      const attempts = (session?.execution_attempts || 0) + 1;

      await agentBridge.updateDebugSession(debugSessionId, {
        execution_attempts: attempts,
      });

      if (attempts >= 2) {
        // 修了2次还没解决 → 需要 TA 帮助
        await agentBridge.updateDebugSession(debugSessionId, {
          needs_ta_help: true,
        });

        setMessages([...messages, {
          role: 'assistant',
          content: "Let's try a fresh start! Sometimes that's the fastest way."
        }]);

        // 路由到 Reset
        setTimeout(() => {
          agentBridge.routeDebug('reset_tool', 'Multiple fix attempts unsuccessful', null, debugSessionId);
        }, 1500);
      } else if (type === 'code_fix') {
        // Code Fix 失败一次 → 直接路由 Reset
        setMessages([...messages, {
          role: 'assistant',
          content: "This bug is tricky. Let's try starting fresh!"
        }]);

        setTimeout(() => {
          agentBridge.routeDebug('reset_tool', 'Code fix unsuccessful', null, debugSessionId);
        }, 1500);
      } else {
        // Prompt Fix 失败 → 重新路由 Orchestrator
        setMessages([...messages, {
          role: 'assistant',
          content: "Let's take another look at what's going wrong..."
        }]);

        setTimeout(() => {
          agentBridge.triggerDebug();
        }, 1500);
      }
    }
  }

  /**
   * 发送消息（Gate 1）
   * V17 Phase B: 使用 RoundCounter + preCheckInput
   * @param {string} userInput - 用户输入
   * @param {boolean} skipPreCheck - 跳过预检（用于填空模板提交）
   */
  async function sendGate1Message(userInput, skipPreCheck = false) {
    // V17 Phase B: 使用 RoundCounter 获取当前轮次
    const currentGateRound = gate1RoundCounter.current.get();

    // V17 Phase B: 代码层预检（在调用 API 之前）
    // 跳过填空模板提交的预检，因为填空答案通常较短但是有效的结构化输入
    if (!skipPreCheck) {
      const modeKey = `gate1_${upgrade?.level || 'easy'}`;
      const preCheck = preCheckInput(userInput, modeKey, currentGateRound, language);

      if (!preCheck.shouldCallModel) {
        // 代码层拦截：不调用 API，直接返回模板响应
        if (preCheck.forceRelease) {
          // 超过最大轮次，强制放行
          const msgs = getAgentMessages(language);
          setMessages(prev => [...prev,
            { role: 'user', content: userInput },
            { role: 'assistant', content: msgs.preCheckResponse }
          ]);
          handleGate1Finish(rounds, false, bestQuote, undefined, undefined, undefined);
          return;
        }
        // 无效输入（ok/yes/太短），追问
        setMessages(prev => [...prev,
          { role: 'user', content: userInput },
          { role: 'assistant', content: preCheck.directResponse }
        ]);
        return;
      }
    }

    setLoading(true);

    const newMessages = [...messages, { role: 'user', content: userInput }];
    setMessages(newMessages);

    try {
      // 构建 API 消息
      const systemPrompt = buildGate1SystemPrompt(upgrade, lesson || LESSON, language);
      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...newMessages.map(m => ({ role: m.role, content: m.content })),
      ];

      // 调用 API
      const aiResponse = await callDeepSeek(apiMessages);
      const parsed = parseAIResponse(aiResponse, currentGateRound);

      // 记录本轮数据
      const roundData = {
        input: userInput,
        mode: currentMode,
        scores: parsed.scores,
        param_coverage: parsed.param_coverage, // Medium 专用
      };
      const newRounds = [...rounds, roundData];
      setRounds(newRounds);

      // 更新 best_quote
      if (parsed.best_quote) {
        setBestQuote(parsed.best_quote);
      }

      // Medium Own Idea: 跟踪动态 params 和 template
      if (upgrade?.dynamicParams) {
        if (parsed.params_so_far?.length > 0) {
          setDynamicParams(parsed.params_so_far);
        }
        if (parsed.prompt_template_so_far) {
          setPromptTemplate(parsed.prompt_template_so_far);
        }
      }

      // 添加 AI 回复
      setMessages(prev => [...prev, { role: 'assistant', content: parsed.response }]);

      // 判断是否继续（Medium 使用 all_covered，其他使用 continue）
      const shouldContinue = upgrade?.level === 'medium'
        ? !parsed.all_covered && currentGateRound < 3
        : parsed.continue && currentGateRound < 3;

      const isEarlyRelease = upgrade?.level === 'medium'
        ? parsed.all_covered === true
        : parsed.early_release === true;

      if (!shouldContinue || currentGateRound >= 3) {
        // 完成 Gate 1 (Hard upgrades include draft_prompt)
        // V17 Phase B: 完成后重置 RoundCounter
        gate1RoundCounter.current.reset();
        // Pass parsed params/template directly to avoid stale React state closure
        handleGate1Finish(
          newRounds, isEarlyRelease, parsed.best_quote, parsed.draft_prompt,
          parsed.params_so_far, parsed.prompt_template_so_far
        );
      } else {
        // 进入下一轮
        // V17 Phase B: 使用 RoundCounter 递增（代码层控制，不受模型返回值影响）
        gate1RoundCounter.current.increment();
        setCurrentRound(currentGateRound + 1); // 同步到 state（用于 UI 显示）
        setCurrentMode(parsed.mode || 'open');
        setChoices(parsed.choices || []);
        setFillTemplate(parsed.fill_template || '');
      }
    } catch (error) {
      console.error('Gate 1 API error:', error);

      // Round 3 或以上：即使 API 失败也应该结束 Gate 1（Round 3 无条件结束）
      if (currentGateRound >= 3) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Great job thinking through your idea! You\'re ready to write it out.'
        }]);
        // 使用已有的 rounds 数据完成 Gate 1 (API错误时无 draft_prompt)
        gate1RoundCounter.current.reset();
        handleGate1Finish(rounds, false, bestQuote, undefined, undefined, undefined);
      } else {
        // Round 1-2：显示错误消息，重置为开放输入模式让用户继续
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Oops, I ran into a small issue. Let\'s continue! How would you describe this feature?'
        }]);
        // 重置为开放输入模式，让用户可以继续输入
        setCurrentMode('open');
        setChoices([]);
        setFillTemplate('');
      }
    } finally {
      setLoading(false);
    }
  }

  /**
   * 发送消息（Gate 2）
   * V17 Phase B: Gate 2 是验证流程，yes/no 是有效回答，只检查空输入
   */
  async function sendGate2Message(userInput) {
    // V17 Phase B: 轻量级验证（Gate 2 允许 yes/no 回答）
    if (!userInput || !userInput.trim()) {
      const msgs = getAgentMessages(language);
      setMessages(prev => [...prev,
        { role: 'user', content: userInput || '' },
        { role: 'assistant', content: msgs.gate2FallbackQuestion }
      ]);
      return;
    }

    setLoading(true);

    const newMessages = [...messages, { role: 'user', content: userInput }];
    setMessages(newMessages);

    try {
      // 构建 API 消息
      const systemPrompt = buildGate2SystemPrompt(agenda, gate2Mode, language);
      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...newMessages.map(m => ({ role: m.role, content: m.content })),
      ];

      // 调用 API
      const aiResponse = await callDeepSeek(apiMessages);
      const parsed = parseAIResponse(aiResponse, currentRound);

      // 添加 AI 回复
      setMessages(prev => [...prev, { role: 'assistant', content: parsed.response }]);

      // 处理验证结果
      if (parsed.verified_upgrades && parsed.verified_upgrades.length > 0) {
        // 批量更新数据库
        const updates = parsed.verified_upgrades.map(v => {
          // 查找对应的 agenda item 获取难度
          const agendaItem = agenda.find(a => a.target_upgrade_id === v.upgrade_id);
          const isHard = agendaItem?.upgrade_difficulty === 'hard';

          return {
            type: 'verify',
            sessionId: agendaItem?.id,
            // Hard: 使用 matched（appeared 默认为 true）
            // Easy/Medium: 使用 appeared
            upgrade_appeared: isHard ? (v.appeared !== false) : v.appeared,
            upgrade_matched: isHard ? v.matched : null, // Hard 专用字段
            attributed: v.attributed,
            failure_type: v.failure_type,
            mismatch_detail: v.mismatch_detail, // Hard 专用：不匹配的具体描述
            gate2Mode,
            input: userInput,
            diagnosed: gate2Mode === 'diagnose',
          };
        });

        await agentBridge.onGate2Complete(updates);
      }

      // ===== Gate 2 失败 → 切换到 Debug 模式 =====
      if (parsed.switch_to_debug && parsed.debug_context) {
        // 1. 构建对话历史（包含 Gate 2 部分）
        const conversationHistory = [
          ...newMessages.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: new Date().toISOString(),
          })),
          {
            role: 'assistant',
            content: parsed.response,
            timestamp: new Date().toISOString(),
          },
        ];

        // 2. 创建 debug_sessions 记录
        const { data: debugRecord, error: debugError } = await supabase
          .from('debug_sessions')
          .insert({
            student_id: agenda?.[0]?.student_id || null,
            session_id: agenda?.[0]?.session_id || null,
            bug_type: 'pending',
            current_mode: 'debug_orchestrator',
            chat_title: `${parsed.debug_context.failed_upgrade} not working`,
            conversation_history: conversationHistory,
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (debugError) {
          console.error('Failed to create debug session:', debugError);
        } else {
          console.log('Created debug session from Gate 2:', debugRecord.id);

          // 3. 更新 agent_sessions 记录失败信息
          if (parsed.verified_upgrades?.[0]) {
            const agendaItem = agenda.find(a => a.target_upgrade_id === parsed.debug_context.failed_upgrade_id);
            if (agendaItem?.id) {
              await supabase.from('agent_sessions').update({
                gate2_failure_context: parsed.debug_context,
              }).eq('id', agendaItem.id);
            }
          }

          // 4. 切换到 Debug Orchestrator 模式
          setActiveMode('debug_orchestrator');
          setActiveDebugSessionId(debugRecord.id);
          setDebugPreKnown({
            failedUpgrade: parsed.debug_context.failed_upgrade,
            studentSaid: parsed.debug_context.student_said,
            preKnown: `Student confirmed ${parsed.debug_context.failed_upgrade} did not appear in the game.`,
          });
          setActiveBugSummary(`${parsed.debug_context.failed_upgrade} not working`);
          setActiveRelatedUpgrade(parsed.debug_context.failed_upgrade);

          // 5. 重置 Debug 相关状态
          setDebugStep(1);
          setDebugAttemptCount(0);
          setDebugFinalOutput(null);
          setCompleted(false);
        }

        setLoading(false);
        return; // 不执行后续的 done/choice 逻辑
      }

      // 判断下一步
      if (parsed.next_action === 'done') {
        setCompleted(true);
      } else if (parsed.next_action === 'choice' && parsed.choices) {
        setChoices(parsed.choices);
        setCurrentMode('choice');
      }
    } catch (error) {
      console.error('Gate 2 API error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Got it! You can continue making your game now!'
      }]);
      setCompleted(true);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Gate 1 完成处理
   */
  async function handleGate1Finish(roundsData, earlyRelease, quote, generatedDraftPrompt, lastDynamicParams, lastPromptTemplate) {
    // Medium upgrade：生成参数推荐
    let recommendations = null;
    if (upgrade?.level === 'medium' && upgrade.params?.length > 0) {
      setLoading(true);
      try {
        recommendations = await buildParamRecommendation(upgrade, messages);
        setParamRecommendations(recommendations);
      } catch (e) {
        console.error('Failed to get param recommendations:', e);
      }
      setLoading(false);
    }

    // Hard upgrade: 存储 draft_prompt
    if (upgrade?.level === 'hard' && generatedDraftPrompt) {
      setDraftPrompt(generatedDraftPrompt);
    }

    setCompleted(true);

    // 调用 AgentBridge 更新数据库
    await agentBridge.onGate1Complete(sessionRecordId, {
      roundNum: roundsData.length,
      rounds: roundsData,
      earlyRelease,
      bestQuote: quote || bestQuote,
      draftPrompt: generatedDraftPrompt || '', // 存入数据库
      languageGrowth: roundsData.length === 1 && earlyRelease ? '一轮通过' : `${roundsData.length}轮完成`,
    });

    // Medium Own Idea: 动态生成的 params 和 template
    // Use lastDynamicParams/lastPromptTemplate (fresh from parsed response) to avoid stale React state
    const finalDynamicParams = upgrade?.dynamicParams ? (lastDynamicParams || dynamicParams) : undefined;
    const finalPromptTemplate = upgrade?.dynamicParams ? (lastPromptTemplate || promptTemplate) : undefined;

    // 存储完成数据，等用户点击 "Continue Making Game" 再触发回调
    // 不立刻调用 onGate1Complete，否则 Panel 会立刻关闭，用户看不到 AI 的最后回复
    setGate1CompletionData({
      upgradeId: upgrade?.id,
      upgradeLevel: upgrade?.level,
      recommendations,           // Medium 用
      bestQuote: quote || bestQuote,  // Hard 用
      draftPrompt: generatedDraftPrompt || '',  // Hard 用：Agent 生成的初始 prompt
      dynamicParams: finalDynamicParams,
      promptTemplate: finalPromptTemplate,
    });
  }

  /**
   * 处理发送
   * 注意：使用 activeMode 而非 mode，因为 Gate 2 可能切换到 Debug
   */
  function handleSend() {
    if (!inputValue.trim() || loading) return;

    const input = inputValue.trim();
    setInputValue('');

    // 使用 activeMode（可动态切换）而非 mode（prop，不变）
    if (activeMode === 'gate1') {
      sendGate1Message(input);
    } else if (activeMode === 'gate2') {
      sendGate2Message(input);
    } else if (activeMode === 'debug_orchestrator') {
      sendDebugOrchestratorMessage(input);
    } else if (activeMode === 'debug_prompt') {
      sendDebugPromptMessage(input);
    } else if (activeMode === 'debug_code') {
      sendDebugCodeMessage(input);
    } else if (activeMode === 'debug_reset_phase1') {
      sendDebugResetPhase1Message(input);
    } else if (activeMode === 'debug_reset_phase2') {
      sendDebugResetPhase2Message(input);
    }
  }

  /**
   * 处理选择
   */
  function handleChoiceSelect(choice) {
    setChoices([]);
    // 使用 activeMode 而非 mode
    if (activeMode === 'gate1') {
      // 选择题后追问
      const choiceInput = `I choose: ${choice}`;
      sendGate1Message(choiceInput);
    } else if (activeMode === 'gate2') {
      sendGate2Message(choice);
    }
  }

  /**
   * 处理填空提交
   * V17 修复: 填空提交跳过 preCheckInput，因为这是结构化输入
   */
  function handleFillSubmit(value) {
    setFillTemplate('');
    sendGate1Message(value, true); // skipPreCheck = true
  }

  /**
   * 处理关闭
   */
  function handleClose() {
    // 如果有 Gate 1 完成数据，触发回调
    if (gate1CompletionData && onGate1Complete) {
      onGate1Complete(gate1CompletionData);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white w-full max-w-md h-[80vh] max-h-[600px] rounded-3xl shadow-2xl flex flex-col overflow-hidden mx-4">
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b text-white ${
          activeMode.startsWith('debug') ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'
        }`}>
          <div className="flex items-center gap-2">
            <MessageCircle size={20} />
            <span className="font-bold">
              {activeMode === 'gate1' && `About "${upgrade?.title}"`}
              {activeMode === 'gate2' && 'Verify Your Upgrades'}
              {activeMode === 'debug_orchestrator' && '🔧 Debug Helper'}
              {activeMode === 'debug_prompt' && '📝 Fix Your Description'}
              {activeMode === 'debug_code' && '🐛 Fix the Bug'}
              {activeMode === 'debug_reset_phase1' && '🔄 Fresh Start'}
              {activeMode === 'debug_reset_phase2' && '💭 Reflection'}
              {activeMode === 'debug_verify' && '✅ Did it work?'}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.map((msg, i) => (
            <ChatMessage key={i} message={msg.content} isUser={msg.role === 'user'} />
          ))}

          {/* 选择按钮 */}
          {choices.length > 0 && !loading && (
            <ChoiceButtons
              choices={choices}
              onSelect={handleChoiceSelect}
              disabled={loading}
            />
          )}

          {/* 填空模板 */}
          {fillTemplate && !loading && (
            <FillTemplate
              template={fillTemplate}
              onSubmit={handleFillSubmit}
            />
          )}

          {/* 加载中 */}
          {loading && (
            <div className="flex justify-start mb-3">
              <div className="bg-gray-100 px-4 py-2.5 rounded-2xl rounded-bl-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {/* Debug Prompt Tool 执行层 UI */}
          {activeMode === 'debug_prompt' && completed && debugFinalOutput && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 my-4">
              <p className="text-sm font-bold text-green-800 mb-2">✅ Add this to your prompt, then regenerate:</p>
              <div className="bg-white border rounded-lg p-3 text-sm font-mono whitespace-pre-wrap">
                {debugFinalOutput}
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => navigator.clipboard.writeText(debugFinalOutput)}
                  className="flex-1 py-2 bg-green-100 text-green-700 rounded-lg font-bold hover:bg-green-200 transition-colors"
                >
                  📋 Copy
                </button>
                <button
                  onClick={() => {
                    onDebugToolComplete?.('prompt_fix', activeDebugSessionId || debugSessionId);
                    onClose();
                  }}
                  className="flex-1 py-2 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-colors"
                >
                  Go Generate →
                </button>
              </div>
            </div>
          )}

          {/* Debug Code Tool 执行层 UI */}
          {activeMode === 'debug_code' && completed && debugFinalOutput && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 my-4">
              <p className="text-sm font-bold text-blue-800 mb-2">✅ Send this to Claude to fix the bug:</p>
              <div className="bg-white border rounded-lg p-3 text-sm font-mono whitespace-pre-wrap">
                {debugFinalOutput}
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => navigator.clipboard.writeText(debugFinalOutput)}
                  className="flex-1 py-2 bg-blue-100 text-blue-700 rounded-lg font-bold hover:bg-blue-200 transition-colors"
                >
                  📋 Copy
                </button>
                <button
                  onClick={() => {
                    onDebugToolComplete?.('code_fix', activeDebugSessionId || debugSessionId);
                    onClose();
                  }}
                  className="flex-1 py-2 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors"
                >
                  Go Send →
                </button>
              </div>
            </div>
          )}

          {/* Debug Reset Phase 1 执行层 UI */}
          {activeMode === 'debug_reset_phase1' && completed && debugFinalOutput && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 my-4">
              <p className="text-sm font-bold text-purple-800 mb-2">✅ Your new prompt is ready!</p>
              <div className="bg-white border rounded-lg p-3 text-sm font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                {debugFinalOutput}
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => navigator.clipboard.writeText(debugFinalOutput)}
                  className="flex-1 py-2 bg-purple-100 text-purple-700 rounded-lg font-bold hover:bg-purple-200 transition-colors"
                >
                  📋 Copy
                </button>
                <button
                  onClick={() => {
                    onDebugToolComplete?.('reset', activeDebugSessionId || debugSessionId);
                    onClose();
                  }}
                  className="flex-1 py-2 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 transition-colors"
                >
                  Go Regenerate →
                </button>
              </div>
            </div>
          )}

          {/* Debug Reset Phase 1 Step 2: Upgrade 选择器 */}
          {activeMode === 'debug_reset_phase1' && debugStep === 2 && !completed && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 my-4">
              <p className="text-sm font-bold text-purple-800 mb-3">Select features to keep:</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {(studentContext?.successfulUpgrades || []).map((u, i) => (
                  <label key={i} className="flex items-center gap-2 p-2 bg-white rounded-lg cursor-pointer hover:bg-purple-100">
                    <input
                      type="checkbox"
                      checked={selectedUpgrades.includes(u.target_upgrade_label)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUpgrades([...selectedUpgrades, u.target_upgrade_label]);
                        } else {
                          setSelectedUpgrades(selectedUpgrades.filter(x => x !== u.target_upgrade_label));
                        }
                      }}
                      className="w-4 h-4 text-purple-500"
                    />
                    <span className="text-sm">{u.target_upgrade_label}</span>
                  </label>
                ))}
              </div>
              <button
                onClick={() => {
                  setDebugStep(3);
                  const selected = selectedUpgrades.length > 0
                    ? `I want to keep: ${selectedUpgrades.join(', ')}`
                    : 'I want to start completely fresh';
                  sendDebugResetPhase1Message(selected);
                }}
                className="w-full mt-3 py-2 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 transition-colors"
              >
                Continue →
              </button>
            </div>
          )}

          {/* Debug Verify UI */}
          {activeMode === 'debug_verify' && !completed && (
            <div className="flex gap-3 my-4">
              <button
                onClick={() => handleDebugVerifyResponse(true)}
                className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors"
              >
                ✓ Yes, it's fixed!
              </button>
              <button
                onClick={() => handleDebugVerifyResponse(false)}
                className="flex-1 py-3 bg-red-100 text-red-700 rounded-xl font-bold hover:bg-red-200 transition-colors"
              >
                ✗ Still broken
              </button>
            </div>
          )}

          {/* 完成状态 */}
          {completed && !debugFinalOutput && activeMode !== 'debug_verify' && (
            <div className="flex justify-center my-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full">
                <CheckCircle size={18} />
                <span className="text-sm font-medium">Chat Complete</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {!completed && currentMode === 'open' && choices.length === 0 && !fillTemplate &&
         activeMode !== 'debug_verify' && !(activeMode === 'debug_reset_phase1' && debugStep === 2) && (
          <div className="p-4 border-t bg-gray-50">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={
                  activeMode.startsWith('debug')
                    ? getAgentMessages(language).placeholderDebug
                    : getAgentMessages(language).placeholderIdeas
                }
                disabled={loading}
                className={`flex-1 px-4 py-2.5 border-2 rounded-full focus:outline-none text-sm disabled:opacity-50 ${
                  activeMode.startsWith('debug')
                    ? 'border-orange-200 focus:border-orange-400'
                    : 'border-gray-200 focus:border-indigo-400'
                }`}
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || loading}
                className={`px-4 py-2.5 text-white rounded-full disabled:opacity-50 transition-colors ${
                  activeMode.startsWith('debug')
                    ? 'bg-orange-500 hover:bg-orange-600'
                    : 'bg-indigo-500 hover:bg-indigo-600'
                }`}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        )}

        {/* 完成后的关闭按钮（非 debug 执行层） */}
        {completed && !debugFinalOutput && activeMode !== 'debug_verify' && (
          <div className="p-4 border-t bg-gray-50">
            <button
              onClick={handleClose}
              className={`w-full py-3 text-white rounded-full font-bold transition-colors ${
                activeMode.startsWith('debug')
                  ? 'bg-orange-500 hover:bg-orange-600'
                  : 'bg-indigo-500 hover:bg-indigo-600'
              }`}
            >
              {activeMode.startsWith('debug') ? 'Back to Game' : 'Continue Making Game'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
