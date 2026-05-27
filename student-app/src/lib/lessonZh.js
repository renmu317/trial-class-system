// Lesson 1: Catch Falling Game - Chinese Version
// V17: Language Dimension Library - Extension Port 3
export const DIMENSION_LIBRARY_ZH = {
  trigger:   "触发条件（什么情况下发生）",
  result:    "结果描述（发生了会怎样）",
  quantity:  "数量或大小（多少个/多大）",
  position:  "位置（在哪里出现）",
  speed:     "速度（快/慢/变速）",
  direction: "方向（哪个方向移动）",
  duration:  "持续时间（持续多久）",
  condition: "触发条件（满足什么才激活）",
  timing:    "时机（什么时候出现）",
  frequency: "频率（多久出现一次）",
  appearance: "外观（长什么样）",
};

// Phase 1 LESSON Configuration - Chinese Version
export const LESSON_ZH = {
  id: "catch-falling-v1",
  title: "接落物游戏",
  emoji: "🎮",

  // V17: Agent configuration
  agent: {
    demo_description: "一个接落物游戏，玩家左右移动接住下落的星星，躲避炸弹，有3条命",
  },

  steps: [
    {
      id: "catchItem",
      label: "你要接什么？",
      options: [
        { value: "stars", label: "星星", emoji: "⭐" },
        { value: "fruits", label: "水果", emoji: "🍎" },
        { value: "coins", label: "金币", emoji: "🪙" },
        { value: "snowflakes", label: "雪花", emoji: "❄️" },
        { value: "pizza", label: "披萨", emoji: "🍕" },
        { value: "diamonds", label: "钻石", emoji: "💎" },
        { value: "__own__", label: "我的想法", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "avoidItem",
      label: "你要躲避什么？",
      options: [
        { value: "bombs", label: "炸弹", emoji: "💣" },
        { value: "fire", label: "火焰", emoji: "🔥" },
        { value: "rocks", label: "石头", emoji: "🪨" },
        { value: "lightning", label: "闪电", emoji: "⚡" },
        { value: "__own__", label: "我的想法", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "background",
      label: "背景颜色？",
      options: [
        { value: "dark blue", label: "深蓝色", emoji: "🟦" },
        { value: "black", label: "黑色", emoji: "⬛" },
        { value: "purple", label: "紫色", emoji: "🟪" },
        { value: "green", label: "绿色", emoji: "🟩" },
        { value: "__own__", label: "我的想法", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "difficulty",
      label: "难度？",
      options: [
        { value: "easy", label: "简单", emoji: "🐢", meta: { speed: 100, lives: 5 } },
        { value: "medium", label: "中等", emoji: "🚶", meta: { speed: 200, lives: 3 } },
        { value: "hard", label: "困难", emoji: "🏃", meta: { speed: 300, lives: 3 } },
        { value: "__own__", label: "我的想法", emoji: "✏️", isOwn: true },
      ],
    },
  ],
  ownIdeaMaxLength: 60,
  gameNameMaxLength: 30,
  defaultGameName: (choices, ownInputs) => {
    const catchVal = choices.catchItem;
    if (!catchVal) return "我的游戏";
    const resolved =
      catchVal === "__own__"
        ? (ownInputs.catchItem || "").trim()
        : LESSON_ZH.steps[0].options.find((o) => o.value === catchVal)?.label;
    if (!resolved) return "我的游戏";
    return `${resolved}接接乐`;
  },
  buildPrompt: (choices, ownInputs = {}, gameName = "") => {
    const resolve = (id) => {
      const val = choices[id];
      if (val === "__own__") return (ownInputs[id] || "").trim();
      return val;
    };
    const diff = LESSON_ZH.steps[3].options.find((o) => o.value === choices.difficulty);
    const speed = diff?.meta?.speed || 200;
    const lives = diff?.meta?.lives || 3;
    const catchItem = resolve("catchItem") || "stars";
    const avoidItem = resolve("avoidItem") || "bombs";
    const background = resolve("background") || "dark blue";
    const title = (gameName || "").trim() || LESSON_ZH.defaultGameName(choices, ownInputs);
    const speedLine =
      choices.difficulty === "__own__"
        ? `难度: ${resolve("difficulty") || "中等"}`
        : `初始下落速度: 每秒 ${speed} 像素`;
    return `你是一个专业游戏开发者。请构建一个名为"${title}"的接落物游戏作为可玩的 Artifact。

游戏规则：
- 玩家左右移动挡板来接住下落的${catchItem}
- 玩家必须躲避下落的${avoidItem}
- 接住${catchItem} = +1分
- 碰到${avoidItem} = 失去一条命

视觉效果：
- 背景颜色：${background}
- 物品使用清晰的表情符号或彩色形状
- 顶部显示大的分数和生命计数器

游戏玩法：
- ${speedLine}
- 失去 ${lives} 条命后游戏结束
- 显示"游戏结束"屏幕，包含最终分数和"再玩一次"按钮
- 支持方向键和鼠标/触控操作

请将其制作成 Artifact 面板中的可玩游戏。让它有趣且响应灵敏。`;
  },
  upgrades: [
    // Easy upgrades
    {
      id: "lives",
      level: "easy",
      title: "生命计数器",
      emoji: "❤️",
      fillParam: {
        key: "lives",
        label: "初始生命数",
        default: 3,
        min: 1,
        max: 9,
        hint: "1 = 一次失误就结束 · 3 = 标准 · 9 = 很宽容"
      },
      buildPrompt: (p) =>
        `在顶部添加一个生命计数器，初始为 ${p.lives} 条命，用心形显示。所有心都消失后游戏结束。`,
      agent_context: "显示剩余生命数的计数器",
      language_dimensions: [],
    },
    {
      id: "highscore",
      level: "easy",
      title: "最高分",
      emoji: "🏆",
      fillParam: {
        key: "records",
        label: "保存前___名记录",
        default: 1,
        min: 1,
        max: 5,
        hint: "1 = 只保存最高分 · 3 = 前三名 · 5 = 排行榜"
      },
      buildPrompt: (p) =>
        `保存前 ${p.records} 名最高分，游戏结束后也能显示。${p.records > 1 ? '以排行榜形式展示' : '在当前分数旁边显示'}。`,
      agent_context: "保存并显示最高分记录",
      language_dimensions: [],
    },
    {
      id: "speedup",
      level: "easy",
      title: "加速",
      emoji: "💨",
      fillParam: {
        key: "every",
        label: "每___分加速",
        default: 10,
        min: 3,
        max: 30,
        hint: "3 = 很快变难 · 10 = 标准 · 30 = 缓慢递增"
      },
      buildPrompt: (p) =>
        `每得 ${p.every} 分，物品下落速度加快。加速时显示"加速！"提示。`,
      agent_context: "游戏加速机制",
      language_dimensions: [],
    },
    {
      id: "twotypes",
      level: "easy",
      title: "两种物品",
      emoji: "✨",
      fillParam: {
        key: "bonus",
        label: "特殊物品值___分",
        default: 5,
        min: 2,
        max: 10,
        hint: "2 = 小奖励 · 5 = 标准 · 10 = 超级稀有大奖"
      },
      buildPrompt: (p) =>
        `添加第二种特殊物品，值 ${p.bonus} 分。它出现的概率较低（大约五分之一）。`,
      agent_context: "高分值的特殊物品",
      language_dimensions: [],
    },
    {
      id: "colorchange",
      level: "easy",
      title: "变色",
      emoji: "🎨",
      fillParam: {
        key: "every",
        label: "每___分变色",
        default: 10,
        min: 5,
        max: 30,
        hint: "5 = 频繁变色 · 10 = 标准 · 30 = 偶尔变化"
      },
      buildPrompt: (p) =>
        `每得 ${p.every} 分更换背景颜色。循环使用4种不同的颜色。`,
      agent_context: "背景颜色变化",
      language_dimensions: [],
    },
    {
      id: "powerup",
      level: "easy",
      title: "道具",
      emoji: "⚡",
      fillParam: {
        key: "duration",
        label: "道具持续___秒",
        default: 5,
        min: 2,
        max: 15,
        hint: "2 = 一闪而过 · 5 = 标准 · 15 = 长时间优势"
      },
      buildPrompt: (p) =>
        `添加一个稀有道具，接到后挡板变宽，持续 ${p.duration} 秒。`,
      agent_context: "道具效果",
      language_dimensions: [],
    },
    {
      id: "__own__",
      level: "easy",
      title: "我的想法",
      emoji: "✏️",
      isOwn: true,
      buildPrompt: (text) =>
        `请在我的游戏中添加：${text.trim()}。让它与现有玩法配合良好，保持游戏可玩性。`,
      agent_context: "自定义想法",
      language_dimensions: [],
    },
    // Medium upgrades
    {
      id: "boss",
      level: "medium",
      title: "Boss战",
      emoji: "👹",
      think: "Boss什么时候出现——早点出现让游戏快速升温，还是晚点出现作为技术好的玩家的奖励？打败它应该很快还是一场史诗级战斗？",
      params: [
        {
          key: "score",
          label: "Boss在___分时出现",
          default: 20,
          min: 5,
          max: 100,
          hint: "低(5-15) = 快速Boss战 · 高(50+) = Boss是后期奖励"
        },
        {
          key: "hits",
          label: "击败Boss需要___次",
          default: 3,
          min: 1,
          max: 10,
          hint: "1 = 轻松获胜 · 3 = 公平挑战 · 10 = 史诗战斗"
        },
      ],
      buildPrompt: (p) => `当玩家达到 ${p.score} 分时，屏幕顶部出现一个大"Boss"角色。玩家需要接住特殊物品来攻击Boss，击中 ${p.hits} 次才能打败它。Boss出现时显示"Boss来了！"，打败后显示"胜利！"。打败Boss后继续正常游戏。`,
      agent_context: "Boss战斗系统",
      language_dimensions: [
        "出现时机意图（想让 Boss 早点出现还是玩很久才见到）",
        "战斗难度意图（想让 Boss 战很快结束还是持久战）",
      ],
    },
    {
      id: "levels",
      level: "medium",
      title: "多关卡",
      emoji: "🗺️",
      think: "多少关卡感觉合适？玩家应该快速升级还是努力争取每一关？",
      params: [
        {
          key: "levels",
          label: "关卡数量",
          default: 3,
          min: 2,
          max: 5,
          hint: "建议2-5关。超过5关可能感觉重复。"
        },
        {
          key: "pointsPerLevel",
          label: "每关需要___分",
          default: 15,
          min: 5,
          max: 50,
          hint: "5 = 快速升级 · 15 = 平衡 · 50 = 需要努力"
        },
      ],
      buildPrompt: (p) => `将游戏分成 ${p.levels} 个关卡。每 ${p.pointsPerLevel} 分进入下一关。每关有不同的背景颜色，物品下落更快。每关开始时显示大标题"第1关"、"第2关"等。屏幕顶部显示当前关卡数。`,
      agent_context: "多关卡系统",
      language_dimensions: [
        "规模意图（想要关卡多一点还是少一点）",
        "节奏意图（想让玩家快速升级还是需要努力积累）",
      ],
    },
    {
      id: "sounds",
      level: "medium",
      title: "音效",
      emoji: "🔊",
      think: "音效应该是低调的背景反馈，还是响亮刺激地庆祝每个动作？",
      params: [
        {
          key: "volume",
          label: "音量 (0-100)",
          default: 50,
          min: 10,
          max: 100,
          hint: "10 = 低调背景 · 50 = 平衡 · 100 = 响亮刺激"
        },
      ],
      buildPrompt: (p) => `使用 Web Audio API 添加音效，音量 ${p.volume}%。接到好物品时播放"叮"声，碰到坏物品时播放"咚"声，游戏结束时播放短促的结束音效。所有音效保持在0.5秒以内，不要太吵。`,
      agent_context: "音效系统",
      language_dimensions: [
        "氛围意图（想让音效低调配合还是明显强调游戏事件）",
        "反馈感意图（想让玩家通过声音感知成功/失败的程度）",
      ],
    },
    {
      id: "talkingchar",
      level: "medium",
      title: "会说话的角色",
      emoji: "💬",
      think: "你的角色应该是话多的伙伴，还是只在重要时刻说话的安静助手？",
      params: [
        {
          key: "every",
          label: "每接___个物品说话",
          default: 5,
          min: 1,
          max: 20,
          hint: "1 = 话多的伙伴 · 5 = 偶尔评论 · 20 = 很少反应"
        },
      ],
      buildPrompt: (p) => `在屏幕角落添加一个小角色，显示对话气泡。开始时说"加油！"，每接 ${p.every} 分说鼓励的话（如"接得好！"或"继续加油！"），坏物品靠近挡板时说"小心！"，结束时说"游戏结束..."。保持所有消息简短有趣。`,
      agent_context: "会说话的角色",
      language_dimensions: [
        "互动频率意图（想让角色话多还是话少）",
        "性格意图（想让角色感觉像朋友还是安静的助手）",
      ],
    },
    // Hard upgrades
    {
      id: "difficulty-curve",
      level: "hard",
      title: "难度设计师",
      emoji: "⚖️",
      hint: "什么让游戏从简单变难？速度？物品大小？物品数量？多个因素同时变化？先想好，再告诉 Claude。",
      prompt: null,
      agent_context: "难度平衡设计",
      language_dimensions: [DIMENSION_LIBRARY_ZH.speed, DIMENSION_LIBRARY_ZH.quantity, DIMENSION_LIBRARY_ZH.trigger, DIMENSION_LIBRARY_ZH.result],
    },
    {
      id: "storyteller",
      level: "hard",
      title: "故事讲述者",
      emoji: "📖",
      hint: "每个好游戏都有玩的理由。为什么你的玩家要接这些东西？成功了会怎样？告诉 Claude 你想要的故事。",
      prompt: null,
      agent_context: "游戏故事设计",
      language_dimensions: [DIMENSION_LIBRARY_ZH.trigger, DIMENSION_LIBRARY_ZH.result, DIMENSION_LIBRARY_ZH.condition],
    },
    {
      id: "signature",
      level: "hard",
      title: "独特招牌",
      emoji: "🌟",
      hint: "添加一个别人想不到的东西。只有你的游戏才有的东西。什么让游戏独一无二？准确告诉 Claude 你想要什么。",
      prompt: null,
      agent_context: "独特功能设计",
      language_dimensions: [DIMENSION_LIBRARY_ZH.trigger, DIMENSION_LIBRARY_ZH.result, DIMENSION_LIBRARY_ZH.appearance],
    },
  ],
};

// Recovery items - Chinese
export const RECOVERY_ZH = [
  { id: "no-game", icon: "👻", title: "Claude只显示文字，没有游戏", fix: "在聊天中输入：「请把这个作为可玩的游戏显示在 Artifact 面板中。」" },
  { id: "broken", icon: "🐛", title: "游戏显示了但不能玩", fix: "准确告诉 Claude 哪里有问题。例如：「按方向键挡板不动。」描述越具体，修复越好。" },
  { id: "copy-fail", icon: "📋", title: "复制按钮不管用", fix: "用鼠标选中提示词文字，然后按 Ctrl+C（Windows）或 Cmd+C（Mac）。" },
  { id: "where-paste", icon: "❓", title: "在哪里粘贴提示词？", fix: "打开 claude.ai。底部的大文本框就是粘贴的地方，然后按回车。" },
  { id: "limit", icon: "🛑", title: "Claude说「消息限制已达上限」", fix: "举手。老师会给你切换到备用账号。" },
  { id: "ugly", icon: "🎨", title: "游戏看起来不对（颜色/大小）", fix: "在同一个聊天中，输入你想改的内容。例如：「把背景改成紫色。」Claude会更新游戏。" },
];

// Level configuration - Chinese
export const LEVEL_CONFIG_ZH = {
  easy: { label: "简单", emoji: "🟢", color: "border-green-300 bg-green-50", accent: "text-green-700", desc: "快速更改 — 选一个然后复制" },
  medium: { label: "中等", emoji: "🔵", color: "border-blue-300 bg-blue-50", accent: "text-blue-700", desc: "较大更改 — 先看提示，再复制" },
  hard: { label: "困难", emoji: "🟣", color: "border-purple-300 bg-purple-50", accent: "text-purple-700", desc: "设计挑战 — 你来写提示词" },
};

// Tabs - Chinese
import { Sparkles, Copy, AlertCircle, Rocket } from "lucide-react";
export const TABS_ZH = [
  { id: "design", label: "设计", icon: Sparkles },
  { id: "prompt", label: "提示词", icon: Copy },
  { id: "help", label: "帮助", icon: AlertCircle },
  { id: "upgrade", label: "升级", icon: Rocket },
];
