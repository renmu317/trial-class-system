/**
 * DeepSeek Report Generation Prompt
 *
 * Builds the API request for generating student reports
 * based on trial class performance data.
 */

// Default 20-lesson course outline (placeholder - replace with actual content)
const DEFAULT_COURSE_OUTLINE = `
20节课学习路径概览：

阶段一：游戏设计基础（1-5课）
- 第1课：认识游戏设计 - 创建第一个小游戏
- 第2课：角色与动作 - 设计游戏主角
- 第3课：场景搭建 - 创建游戏世界
- 第4课：互动机制 - 添加游戏规则
- 第5课：综合项目 - 完成首个完整游戏

阶段二：编程思维培养（6-10课）
- 第6课：循环与条件 - 让游戏更智能
- 第7课：变量与计分 - 添加得分系统
- 第8课：事件驱动 - 响应玩家操作
- 第9课：调试技巧 - 发现和修复问题
- 第10课：中期项目 - 带积分的完整游戏

阶段三：创意表达（11-15课）
- 第11课：美术设计 - 创建原创角色
- 第12课：音效设计 - 添加游戏音乐
- 第13课：故事叙述 - 设计游戏剧情
- 第14课：用户体验 - 优化游戏流程
- 第15课：创意项目 - 个人风格游戏

阶段四：高级技能（16-20课）
- 第16课：多关卡设计 - 扩展游戏内容
- 第17课：AI基础 - 创建智能敌人
- 第18课：多人游戏 - 添加联机功能
- 第19课：作品展示 - 准备最终项目
- 第20课：毕业典礼 - 展示和分享作品
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
  "pathway_zh": "推荐学习路径描述（中文，100字以内）",
  "pathway_en": "推荐学习路径描述（英文，100字以内）",
  "cta_tier": "enrolled|hot|warm|cold"
}

写作指南：
1. 语气：温暖、鼓励、专业，避免夸大或过度推销
2. 内容：基于具体观察数据，提及孩子的真实表现
3. 叙述结构：
   - 开头：今天的亮点（1-2句）
   - 中间：具体观察到的能力表现（2-3句）
   - 结尾：发展潜力与建议（1-2句）
4. 学习路径：根据孩子表现，推荐从20课大纲中的起点和方向

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
