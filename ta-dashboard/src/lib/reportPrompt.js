/**
 * DeepSeek Report Generation Prompt
 *
 * Builds the API request for generating student reports
 * based on trial class performance data.
 *
 * V17: Added buildAgentSection for language precision training data
 */

import { supabase } from './supabase';

// Default course outline - Game Development to Robotics pathway
const DEFAULT_COURSE_OUTLINE = `
【从游戏设计到机器人开发 - 完整学习路径】

=== 第一阶段：游戏设计基础（第1-8课）===
通过 AI 辅助游戏创作，建立编程思维基础

第1-2课：AI 游戏创作入门
- 使用 AI 工具（Claude）创建第一个小游戏
- 学习如何与 AI 沟通，精确描述想法
- 核心技能：逻辑思维、指令表达

第3-4课：游戏机制设计
- 添加角色、碰撞检测、计分系统
- 理解条件判断（if/else）和循环
- 核心技能：算法思维、调试能力

第5-6课：复杂游戏开发
- 多关卡设计、难度曲线
- 变量管理、状态机概念
- 核心技能：系统设计、项目管理

第7-8课：游戏优化与发布
- 用户体验优化
- 完成个人游戏作品集
- 核心技能：产品思维、展示能力

=== 第二阶段：硬件编程入门（第9-14课）===
从虚拟世界走向真实硬件

第9-10课：Arduino 基础
- 认识电路板、LED、传感器
- 编写第一个硬件程序（点亮LED）
- 游戏技能迁移：条件判断 → 传感器响应

第11-12课：传感器与执行器
- 光敏、温度、超声波传感器
- 电机、舵机控制
- 游戏技能迁移：游戏规则 → 机器人行为规则

第13-14课：硬件游戏化项目
- 制作体感游戏控制器
- 创建真实世界的互动装置
- 融合项目：游戏设计 + 硬件实现

=== 第三阶段：机器人开发（第15-20课）===
整合所有技能，创造智能机器人

第15-16课：机器人结构与运动
- 搭建机器人底盘
- 轮式运动控制、转向算法
- 技能迁移：游戏角色移动 → 机器人运动控制

第17-18课：智能感知与决策
- 视觉识别（颜色、形状）
- 避障、寻线、目标追踪
- 技能迁移：游戏 AI → 机器人 AI

第19-20课：综合机器人项目
- 自主导航机器人
- 物品抓取与搬运
- 毕业项目展示

=== 技能对照表 ===
| 游戏设计技能 | → | 机器人开发技能 |
|-------------|---|---------------|
| 游戏角色移动 | → | 机器人运动控制 |
| 碰撞检测    | → | 避障算法      |
| 计分系统    | → | 传感器数据处理 |
| 游戏AI敌人  | → | 自主决策系统   |
| 关卡设计    | → | 任务规划      |
| Debug调试   | → | 硬件故障排查   |

=== 学习价值 ===
1. 渐进式学习：从软件到硬件，从虚拟到真实
2. 技能复用：游戏编程技能直接应用于机器人
3. 动手能力：从屏幕创作走向实体制作
4. 未来竞争力：AI + 机器人是未来核心技能
`;

/**
 * Build the DeepSeek API request payload
 *
 * @param {Object} studentData - Student information (name, game_name, current_step)
 * @param {Object} signalData - student_signals data (cl_*, ow_*, ps_*, cs_*, pr_*)
 * @param {Object} conversionData - conversion_signals data
 * @param {string} [courseOutline] - Optional custom course outline
 * @returns {Object} DeepSeek API request payload
 */
export function buildReportPrompt(studentData, signalData, conversionData, courseOutline = DEFAULT_COURSE_OUTLINE) {
  return {
    model: 'deepseek-chat',
    temperature: 0.4,
    max_tokens: 1500,
    messages: [
      {
        role: 'system',
        content: `你是一位专业的教育顾问，擅长撰写温暖、专业的试课报告。

任务：根据学生今日试课表现数据，生成双语（中英文）个性化报告。

输出格式要求 - 必须返回有效的 JSON：
{
  "narrative_zh": "中文报告叙述（150-200字）",
  "narrative_en": "英文报告叙述（150-200字）",
  "pathway_zh": "推荐学习路径描述（中文，150字以内）",
  "pathway_en": "推荐学习路径描述（英文，150字以内）",
  "cta_tier": "enrolled|hot|warm|cold"
}

写作指南：
1. 语气：温暖、鼓励、专业，避免夸大或过度推销
2. 内容：基于具体观察数据，提及孩子的真实表现
3. 叙述结构：
   - 开头：今天的亮点（1-2句）
   - 中间：具体观察到的能力表现（2-3句）
   - 结尾：发展潜力与建议（1-2句）

4. 【重要】学习路径必须包含：
   a) 当前阶段：孩子在游戏设计阶段展现的能力
   b) 技能迁移：这些能力如何为机器人开发打基础
   c) 下一步：具体说明如何从游戏过渡到硬件/机器人

   示例结构：
   "孩子在游戏设计中展现了[具体能力]，这与机器人开发中的[对应技能]一脉相承。
   建议从第X课开始，先巩固[游戏技能]，然后在第Y课进入Arduino硬件编程，
   最终在第Z课实现[具体机器人项目]。"

5. 技能对照强调：
   - 游戏角色移动逻辑 → 机器人运动控制
   - 游戏碰撞检测 → 机器人避障算法
   - 游戏计分系统 → 传感器数据处理
   - 游戏AI敌人 → 机器人自主决策
   - Debug调试能力 → 硬件故障排查

CTA 层级判断标准：
- enrolled: 已报名或明确表示要报名
- hot: 家长询问价格 + 孩子表达想继续，或家长全程陪同且惊喜
- warm: 孩子主动展示作品给家长，或家长拍照
- cold: 基本完成试课但无明显购买信号

信号字段解读：
- cl_* (Competence Loop): 完成能力 - game_made/game_played/game_modified
- ow_* (Ownership): 归属感 - named/custom_name/showed/explained
- ps_* (Persistence): 坚持力 - got_stuck/recovered/asked_help
- cs_* (Challenge Seed): 挑战欲 - used_hard/used_medium/own_idea/verbal_want/kept_working
- pr_* (Parent Signal): 家长信号 - took_photo/asked_price/stayed_long/looked_screen
- pa_* (Conversion): 家长行为 - stayed/photo/asked_price/leaned_in/surprised
- ch_* (Conversion): 孩子表达 - showed_parent/wants_continue/explained_parent`
      },
      {
        role: 'user',
        content: `请为这位学生生成试课报告。

学生基本信息：
${JSON.stringify(studentData, null, 2)}

学习表现信号（student_signals）：
${JSON.stringify(signalData, null, 2)}

转化信号（conversion_signals）：
${JSON.stringify(conversionData, null, 2)}

20节课学习大纲参考：
${courseOutline}

请返回 JSON 格式的报告。`
      }
    ]
  };
}

/**
 * Call DeepSeek API to generate report
 *
 * @param {string} apiKey - DeepSeek API key
 * @param {Object} studentData - Student information
 * @param {Object} signalData - student_signals data
 * @param {Object} conversionData - conversion_signals data
 * @param {string} [courseOutline] - Optional custom course outline
 * @returns {Promise<Object>} Parsed report data
 */
export async function generateReport(apiKey, studentData, signalData, conversionData, courseOutline) {
  const payload = buildReportPrompt(studentData, signalData, conversionData, courseOutline);

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No content in DeepSeek response');
  }

  // Parse JSON from response (handle potential markdown code blocks)
  let jsonStr = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Failed to parse DeepSeek response as JSON: ${content}`);
  }
}

/**
 * Validate report data structure
 *
 * @param {Object} report - Report data to validate
 * @returns {boolean} True if valid
 */
export function validateReportData(report) {
  const requiredFields = ['narrative_zh', 'narrative_en', 'pathway_zh', 'pathway_en', 'cta_tier'];
  const validCtaTiers = ['enrolled', 'hot', 'warm', 'cold'];

  for (const field of requiredFields) {
    if (!report[field]) {
      console.error(`Missing required field: ${field}`);
      return false;
    }
  }

  if (!validCtaTiers.includes(report.cta_tier)) {
    console.error(`Invalid cta_tier: ${report.cta_tier}`);
    return false;
  }

  return true;
}

/**
 * Calculate discount tier based on session end time and deposit status
 *
 * Discount rules:
 * - $200: Deposit paid on spot (during trial class)
 * - $100: Within 24h after trial ends
 * - $50: 24-48h after trial ends
 * - none: After 48h
 *
 * @param {string} sessionEndTime - ISO timestamp of when session/trial ended (or report created_at as proxy)
 * @param {boolean} depositTakenOnSpot - Whether deposit was paid during the trial
 * @returns {string} '200' | '100' | '50' | 'none'
 */
export function calculateDiscountTier(sessionEndTime, depositTakenOnSpot = false) {
  // $200 only if deposit was paid on spot
  if (depositTakenOnSpot) return '200';

  if (!sessionEndTime) return 'none';

  const endTime = new Date(sessionEndTime);
  const now = new Date();
  const hoursDiff = (now - endTime) / (1000 * 60 * 60);

  if (hoursDiff < 24) return '100';
  if (hoursDiff < 48) return '50';
  return 'none';
}

/**
 * Get discount display text
 *
 * @param {string} discountTier - '200' | '100' | '50' | 'none'
 * @param {string} sessionEndTime - ISO timestamp of when session ended
 * @returns {Object} { amount, label, hoursLeft }
 */
export function getDiscountDisplay(discountTier, sessionEndTime) {
  if (!sessionEndTime && discountTier !== '200') {
    return { amount: null, label: null, hoursLeft: 0 };
  }

  const endTime = new Date(sessionEndTime);
  const now = new Date();
  const hoursDiff = (now - endTime) / (1000 * 60 * 60);

  switch (discountTier) {
    case '200':
      return { amount: '$200', label: 'On-Spot Deposit', hoursLeft: null };
    case '100':
      return { amount: '$100', label: '24h Window', hoursLeft: Math.max(0, Math.floor(24 - hoursDiff)) };
    case '50':
      return { amount: '$50', label: 'Last Chance', hoursLeft: Math.max(0, Math.floor(48 - hoursDiff)) };
    default:
      return { amount: null, label: null, hoursLeft: 0 };
  }
}

/**
 * Build the DeepSeek API request payload for follow-up message
 *
 * @param {Object} reportData - Original report data (content_zh/en, pathway_zh/en)
 * @param {Object} behaviorData - Parent behavior (rep_opened, rep_read_depth, rep_shared)
 * @param {Object} conversionData - Conversion signals (sale_intent_tier)
 * @param {string} discountTier - Current discount tier
 * @returns {Object} DeepSeek API request payload
 */
export function buildFollowUpPrompt(reportData, behaviorData, conversionData, discountTier) {
  const { content_zh, content_en, pathway_zh, pathway_en } = reportData;
  const { rep_opened, rep_read_depth, rep_shared } = behaviorData;
  const { sale_intent_tier } = conversionData || {};

  // Build behavior description
  const behaviorDesc = [];
  if (!rep_opened) behaviorDesc.push('Parent has NOT opened the report');
  else if (!rep_read_depth) behaviorDesc.push('Parent opened but did NOT finish reading');
  else behaviorDesc.push('Parent finished reading the report');
  if (rep_shared) behaviorDesc.push('Parent shared the report (family discussion)');

  // Build discount description
  const discountDesc = {
    '200': '-$200 (expires today)',
    '100': '-$100 (expires in 24h)',
    '50': '-$50 (last chance, expires in 48h)',
    'none': 'No discount available'
  }[discountTier] || 'No discount';

  return {
    model: 'deepseek-chat',
    temperature: 0.5,
    max_tokens: 800,
    messages: [
      {
        role: 'system',
        content: `You are a professional education consultant. Generate a follow-up message for parents 24-48 hours after the trial class report was sent.

CONTEXT:
- First report already sent
- Parent behavior: ${behaviorDesc.join('; ')}
- Current discount: ${discountDesc}
- Sales intent: ${sale_intent_tier || 'Unknown'}

OUTPUT FORMAT - Return valid JSON only:
{
  "followup_zh": "Chinese follow-up message (100-150 chars, warm but concise)",
  "followup_en": "English follow-up message (100-150 chars)"
}

STRATEGY RULES:
- If NOT opened: Proactive tone, "I wanted to make sure you received..."
- If opened but NOT finished: Re-highlight child's strengths to reignite interest
- If finished reading: Focus on next steps, "When would be convenient to..."
- If shared: Mention family benefits, sibling discounts
- If Hot intent: Be direct about scheduling
- If Cold intent: Softer tone, re-emphasize child's potential

IMPORTANT:
- Do NOT repeat content from the first report
- Make it feel like a natural follow-up, not a sales pitch
- Keep it warm and personal`
      },
      {
        role: 'user',
        content: `FIRST REPORT CONTENT:

Chinese:
${content_zh}

English:
${content_en}

Learning Pathway:
Chinese: ${pathway_zh}
English: ${pathway_en}

Please generate the follow-up message.`
      }
    ]
  };
}

/**
 * Call DeepSeek API to generate follow-up message
 *
 * @param {string} apiKey - DeepSeek API key
 * @param {Object} reportData - Original report data
 * @param {Object} behaviorData - Parent behavior data
 * @param {Object} conversionData - Conversion signals
 * @param {string} discountTier - Current discount tier
 * @returns {Promise<Object>} Parsed follow-up data { followup_zh, followup_en }
 */
export async function generateFollowUp(apiKey, reportData, behaviorData, conversionData, discountTier) {
  const payload = buildFollowUpPrompt(reportData, behaviorData, conversionData, discountTier);

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No content in DeepSeek response');
  }

  // Parse JSON from response (handle potential markdown code blocks)
  let jsonStr = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  // Also try to extract JSON object directly
  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    jsonStr = objectMatch[0];
  }

  try {
    const result = JSON.parse(jsonStr);
    if (!result.followup_zh || !result.followup_en) {
      throw new Error('Missing followup_zh or followup_en in response');
    }
    return result;
  } catch (e) {
    throw new Error(`Failed to parse follow-up response: ${content.slice(0, 200)}`);
  }
}

/**
 * V17: Build agent section for report
 *
 * Generates language precision training summary from agent_sessions data
 *
 * @param {string} studentId - Student UUID
 * @returns {Promise<string>} Report section text
 */
export async function buildAgentSection(studentId) {
  const { data, error } = await supabase
    .from('agent_sessions')
    .select('*')
    .eq('student_id', studentId);

  if (error || !data || data.length === 0) {
    return '';
  }

  // 统计
  const earlyReleaseCount = data.filter(s => s.early_release).length;
  const round1Count = data.filter(s => s.actual_rounds === 1 && !s.early_release).length;
  const round2Count = data.filter(s => s.actual_rounds === 2).length;
  const round3Count = data.filter(s => s.actual_rounds === 3).length;
  const diagnosedCount = data.filter(s => s.student_diagnosed).length;

  // 收集所有 best_student_quote
  const bestQuotes = data
    .filter(s => s.best_student_quote)
    .map(s => ({
      upgrade: s.target_upgrade_label,
      quote: s.best_student_quote,
    }));

  // 生成报告语言
  let section = `\n\n### 语言精确度训练\n`;

  if (earlyReleaseCount > 0) {
    section += `- ${earlyReleaseCount} 次一轮通过（语言表达清晰）\n`;
  }
  if (round2Count > 0) {
    section += `- ${round2Count} 次两轮完成（需要适度引导）\n`;
  }
  if (round3Count > 0) {
    section += `- ${round3Count} 次三轮完成（需要结构化辅助）\n`;
  }
  if (diagnosedCount > 0) {
    section += `- 孩子能够识别自己的 prompt 中缺失的内容（发现问题的能力）\n`;
  }

  // 引用学生原话（报告亮点）
  if (bestQuotes.length > 0) {
    section += `\n**孩子的精彩表达**:\n`;
    bestQuotes.forEach(q => {
      section += `- 关于「${q.upgrade}」：「${q.quote}」\n`;
    });
  }

  return section;
}

/**
 * V17: Get agent session summary for a student
 *
 * @param {string} studentId - Student UUID
 * @returns {Promise<Object>} Summary object with counts
 */
export async function getAgentSessionSummary(studentId) {
  const { data, error } = await supabase
    .from('agent_sessions')
    .select('*')
    .eq('student_id', studentId);

  if (error || !data) {
    return {
      total: 0,
      earlyRelease: 0,
      round2: 0,
      round3: 0,
      diagnosed: 0,
      pendingVerify: 0,
    };
  }

  return {
    total: data.length,
    earlyRelease: data.filter(s => s.early_release).length,
    round2: data.filter(s => s.actual_rounds === 2).length,
    round3: data.filter(s => s.actual_rounds === 3).length,
    diagnosed: data.filter(s => s.student_diagnosed).length,
    pendingVerify: data.filter(s => s.gate1_completed && s.upgrade_appeared === null).length,
    gate2Retry: data.filter(s => s.gate2_mode === 'retry').length,
    gate2Diagnose: data.filter(s => s.gate2_mode === 'diagnose').length,
  };
}

/**
 * P7: Get cognitive behavior data from session_timeline
 *
 * Fetches:
 * - Prediction accuracy (prediction_validated events)
 * - Iteration ideas (iteration_idea events)
 * - Recovery insights (recovery_insight events)
 * - Validation reflections (validation_reflection events)
 * - Session reflection (from students.session_reflection)
 *
 * @param {string} studentId - Student UUID
 * @param {string} sessionId - Session UUID
 * @returns {Promise<Object>} Cognitive behavior data
 */
export async function getCognitiveBehaviorData(studentId, sessionId) {
  // Fetch timeline events
  const { data: events, error: eventsError } = await supabase
    .from('session_timeline')
    .select('*')
    .eq('student_id', studentId)
    .eq('session_id', sessionId)
    .in('event_type', [
      'prediction_made',
      'prediction_validated',
      'validation_reflection',
      'iteration_idea',
      'recovery_insight',
      'identity_reflection',
    ])
    .order('created_at', { ascending: true });

  // Fetch student's session reflection
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('session_reflection')
    .eq('id', studentId)
    .single();

  if (eventsError) {
    console.error('Failed to get cognitive behavior events:', eventsError);
  }

  const timeline = events || [];

  // Process predictions
  const predictions = timeline.filter(e => e.event_type === 'prediction_made');
  const validations = timeline.filter(e => e.event_type === 'prediction_validated');

  const predictionResults = validations.map(v => ({
    upgradeId: v.upgrade_id,
    prediction: v.metadata?.original_prediction,
    matched: v.metadata?.matched,
    validatedAt: v.metadata?.validated_at,
  }));

  const predictionAccuracy = validations.length > 0
    ? validations.filter(v => v.metadata?.matched === true).length / validations.length
    : null;

  // Process reflections
  const validationReflections = timeline
    .filter(e => e.event_type === 'validation_reflection')
    .map(e => ({
      content: e.content,
      matched: e.metadata?.matched,
      upgradeId: e.upgrade_id,
    }));

  // Process iteration ideas
  const iterationIdeas = timeline
    .filter(e => e.event_type === 'iteration_idea')
    .map(e => ({
      content: e.content,
      upgradeId: e.upgrade_id,
    }));

  // Process recovery insights
  const recoveryInsights = timeline
    .filter(e => e.event_type === 'recovery_insight')
    .map(e => ({
      content: e.content,
      keptCount: e.metadata?.kept_count,
      removedCount: e.metadata?.removed_count,
    }));

  // Identity reflection (end of class)
  const identityReflection = timeline
    .filter(e => e.event_type === 'identity_reflection')
    .map(e => e.content)[0] || null;

  return {
    // Validation Training
    predictions: {
      total: predictions.length,
      validated: validations.length,
      accuracy: predictionAccuracy,
      results: predictionResults,
    },
    validationReflections,

    // Iteration Training
    iterationIdeas,

    // Recovery Training
    recoveryInsights,

    // Identity Reinforcement
    identityReflection,
    sessionReflection: student?.session_reflection || null,

    // Summary
    hasCognitiveBehaviorData: predictions.length > 0 ||
      iterationIdeas.length > 0 ||
      recoveryInsights.length > 0 ||
      identityReflection ||
      student?.session_reflection,
  };
}

/**
 * P7: Build cognitive behavior section for report
 *
 * @param {Object} data - Cognitive behavior data from getCognitiveBehaviorData
 * @param {string} studentName - Student's name
 * @param {string} language - 'zh' | 'en'
 * @returns {string} HTML section for report
 */
export function buildCognitiveBehaviorSection(data, studentName, language = 'zh') {
  if (!data.hasCognitiveBehaviorData) {
    return '';
  }

  const isZh = language === 'zh';
  let section = '';

  // Section header
  section += isZh
    ? `\n\n### 🧠 思维训练表现\n`
    : `\n\n### 🧠 Cognitive Training Performance\n`;

  // Prediction accuracy
  if (data.predictions.validated > 0) {
    const accuracyPercent = Math.round((data.predictions.accuracy || 0) * 100);
    const accuracyLabel = accuracyPercent >= 70
      ? (isZh ? '优秀' : 'excellent')
      : accuracyPercent >= 40
        ? (isZh ? '良好' : 'good')
        : (isZh ? '成长中' : 'developing');

    section += isZh
      ? `- **预测准确度**: ${accuracyPercent}% (${accuracyLabel}) — 在发送 AI 指令前预测了 ${data.predictions.total} 次，${data.predictions.validated} 次有效对比\n`
      : `- **Prediction Accuracy**: ${accuracyPercent}% (${accuracyLabel}) — Made ${data.predictions.total} predictions, ${data.predictions.validated} verified\n`;
  }

  // Iteration ideas
  if (data.iterationIdeas.length > 0) {
    section += isZh
      ? `- **迭代创意**: 提出了 ${data.iterationIdeas.length} 个改进想法\n`
      : `- **Iteration Ideas**: Proposed ${data.iterationIdeas.length} improvement ideas\n`;

    // Show best iteration idea (first one or longest)
    const bestIdea = data.iterationIdeas.reduce((a, b) =>
      (b.content?.length || 0) > (a.content?.length || 0) ? b : a
    , data.iterationIdeas[0]);

    if (bestIdea?.content) {
      section += isZh
        ? `  - 「${bestIdea.content.slice(0, 50)}${bestIdea.content.length > 50 ? '...' : ''}」\n`
        : `  - "${bestIdea.content.slice(0, 50)}${bestIdea.content.length > 50 ? '...' : ''}"\n`;
    }
  }

  // Recovery insights
  if (data.recoveryInsights.length > 0) {
    section += isZh
      ? `- **问题诊断能力**: 成功完成 ${data.recoveryInsights.length} 次问题恢复\n`
      : `- **Problem-Solving**: Successfully recovered from ${data.recoveryInsights.length} issues\n`;
  }

  // Validation reflections (why things matched/differed)
  const meaningfulReflections = data.validationReflections.filter(
    r => r.content && r.content.length > 10
  );
  if (meaningfulReflections.length > 0) {
    section += isZh
      ? `- **反思能力**: 对 ${meaningfulReflections.length} 次结果进行了深入思考\n`
      : `- **Reflection Ability**: Reflected deeply on ${meaningfulReflections.length} outcomes\n`;
  }

  // Identity reflection / Session reflection
  const reflection = data.identityReflection || data.sessionReflection;
  if (reflection) {
    section += isZh
      ? `\n**${studentName} 的课后感想**:\n`
      : `\n**${studentName}'s Class Reflection**:\n`;
    section += `> "${reflection.slice(0, 150)}${reflection.length > 150 ? '...' : ''}"\n`;
  }

  return section;
}
