// Lesson 3: Zombie Survival Runner - Chinese Version
import { DIMENSION_LIBRARY_ZH } from './lessonZh';

export const LESSON_3_ZH = {
  id: "zombie-runner-v1",
  title: "僵尸生存跑酷",
  emoji: "🧟",

  agent: {
    demo_description: "一个无尽跑酷游戏，玩家自动向右奔跑，僵尸从身后追赶，躲避障碍物并收集补给——活得越久，分数越高",
  },

  steps: [
    {
      id: "theme",
      label: "地图主题？",
      options: [
        { value: "city-street", label: "城市街道", emoji: "🏙️" },
        { value: "forest", label: "森林", emoji: "🌲" },
        { value: "school", label: "学校", emoji: "🏫" },
        { value: "shopping-mall", label: "商场", emoji: "🛒" },
        { value: "hospital", label: "医院", emoji: "🏥" },
        { value: "__own__", label: "我的想法", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "zombieType",
      label: "什么样的僵尸？",
      options: [
        { value: "slow-walkers", label: "慢速行尸", emoji: "🧟" },
        { value: "fast-runners", label: "疾速追猎者", emoji: "🏃" },
        { value: "crawlers", label: "爬行僵尸", emoji: "🦴" },
        { value: "giant-boss", label: "巨型Boss", emoji: "👹" },
        { value: "__own__", label: "我的想法", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "obstacle",
      label: "要躲避什么？",
      options: [
        { value: "cars", label: "汽车", emoji: "🚗" },
        { value: "trees", label: "树木", emoji: "🌳" },
        { value: "barriers", label: "路障", emoji: "🚧" },
        { value: "dumpsters", label: "垃圾箱", emoji: "🗑️" },
        { value: "broken-fences", label: "断裂的栅栏", emoji: "🪵" },
        { value: "__own__", label: "我的想法", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "supply",
      label: "要收集什么？",
      options: [
        { value: "ammo", label: "弹药", emoji: "🔫" },
        { value: "medkits", label: "医疗包", emoji: "💊" },
        { value: "energy-drinks", label: "能量饮料", emoji: "🥤" },
        { value: "coins", label: "金币", emoji: "🪙" },
        { value: "__own__", label: "我的想法", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "background",
      label: "什么时间？",
      options: [
        { value: "night", label: "夜晚", emoji: "🌙" },
        { value: "sunset", label: "黄昏", emoji: "🌇" },
        { value: "foggy", label: "浓雾", emoji: "🌫️" },
        { value: "daylight", label: "白天", emoji: "☀️" },
        { value: "__own__", label: "我的想法", emoji: "✏️", isOwn: true },
      ],
    },
  ],

  ruleDesign: {
    enabled: true,
    fields: [
      {
        id: "collision",
        label: "碰撞规则",
        question: "僵尸抓到玩家会怎样？",
        emoji: "💥",
        options: [
          { value: "lose-1-life", label: "失去1条命" },
          { value: "game-over", label: "立即游戏结束" },
          { value: "slowed-down", label: "减速一小段时间" },
        ],
        allowCustom: true,
        placeholder: "例如：失去一半补给",
      },
      {
        id: "win",
        label: "胜利规则",
        question: "玩家怎样获胜？",
        emoji: "🏆",
        options: [
          { value: "survive-60-seconds", label: "生存60秒" },
          { value: "reach-safehouse", label: "到达安全屋" },
          { value: "endless-high-score", label: "无尽模式——刷新最高分" },
        ],
        allowCustom: true,
        placeholder: "例如：收集20个医疗包并登上救援直升机",
      },
      {
        id: "lose",
        label: "失败规则",
        question: "被撞几次后游戏结束？",
        emoji: "💀",
        options: [
          { value: "1-hit", label: "1次" },
          { value: "3-lives", label: "3条命" },
          { value: "5-lives", label: "5条命" },
          { value: "caught-by-horde", label: "只有被僵尸群追上才结束" },
        ],
        allowCustom: true,
        placeholder: "例如：连续两次被僵尸碰到就结束",
      },
      {
        id: "difficulty",
        label: "难度",
        question: "僵尸随时间怎样变难？",
        emoji: "⚡",
        options: [
          { value: "zombies-speed-up", label: "僵尸越来越快" },
          { value: "more-zombies", label: "僵尸越来越多" },
          { value: "more-obstacles", label: "障碍物越来越多" },
          { value: "stays-the-same", label: "保持不变" },
        ],
        allowCustom: true,
        placeholder: "例如：每30秒多一只僵尸加入追逐",
      },
    ],
  },

  debugLog: {
    enabled: true,
    breakTypes: [
      {
        id: "zombie-catch",
        label: "僵尸问题",
        emoji: "🧟",
        description: "僵尸穿过玩家或者不会伤害玩家",
        fixPrompt: "修复僵尸碰撞检测，让僵尸碰到玩家时玩家受到伤害。僵尸不应该穿过玩家。",
      },
      {
        id: "obstacle",
        label: "障碍物问题",
        emoji: "🚧",
        description: "玩家穿过障碍物而不是撞上",
        fixPrompt: "修复障碍物碰撞检测，让玩家无法穿过障碍物。撞到障碍物应该让玩家减速或失去一条命。",
      },
      {
        id: "scroll",
        label: "滚动问题",
        emoji: "🏃",
        description: "画面不滚动，或者玩家卡住了",
        fixPrompt: "修复滚动效果，让玩家持续向右奔跑，背景随之滚动。玩家不应该卡住。",
      },
      {
        id: "spawn",
        label: "出生点问题",
        emoji: "📍",
        description: "僵尸或障碍物直接出现在玩家身上",
        fixPrompt: "修复出生位置，让僵尸始终出现在玩家身后，障碍物出现在前方且留有足够反应空间。任何东西都不应该直接出现在玩家身上。",
      },
      {
        id: "supply",
        label: "补给问题",
        emoji: "📦",
        description: "补给没出现或无法拾取",
        fixPrompt: "修复补给，让它们出现在路径上，玩家跑过时能够拾取。拾取后更新分数或补给计数器。",
      },
      {
        id: "other",
        label: "其他问题",
        emoji: "❓",
        description: "其他问题——自己描述",
        fixPrompt: null,
      },
    ],
  },

  ownIdeaMaxLength: 60,
  gameNameMaxLength: 30,

  defaultGameName: (choices, ownInputs) => {
    const themeVal = choices.theme;
    if (!themeVal) return "我的僵尸跑酷";
    const resolved =
      themeVal === "__own__"
        ? (ownInputs.theme || "").trim()
        : LESSON_3_ZH.steps[0].options.find((o) => o.value === themeVal)?.label;
    if (!resolved) return "我的僵尸跑酷";
    return `${resolved}跑酷`;
  },

  buildPrompt: (choices, ownInputs = {}, gameName = "", rules = {}) => {
    const resolve = (id) => {
      const val = choices[id];
      if (val === "__own__") return (ownInputs[id] || "").trim();
      return val?.replace(/-/g, " ") || "";
    };

    const theme = resolve("theme") || "城市街道";
    const zombieType = resolve("zombieType") || "慢速行尸";
    const obstacle = resolve("obstacle") || "汽车";
    const supply = resolve("supply") || "医疗包";
    const background = resolve("background") || "夜晚";
    const title = (gameName || "").trim() || LESSON_3_ZH.defaultGameName(choices, ownInputs);

    const collisionRule = rules.collision || "失去1条命";
    const winRule = rules.win || "生存60秒";
    const loseRule = rules.lose || "3条命";
    const difficultyRule = rules.difficulty || "僵尸越来越快";

    return `构建一个名为"${title}"的可玩僵尸生存跑酷游戏作为 Artifact。

我的游戏设计：
- 地图主题：${theme}
- 僵尸类型：${zombieType}
- 要躲避的障碍物：${obstacle}
- 要收集的补给：${supply}
- 时间：${background}

我的游戏规则：
- 僵尸抓到玩家时：${collisionRule}
- 获胜方式：${winRule}
- 生命：${loseRule}
- 难度递增方式：${difficultyRule}

确保：
- 玩家自动向右奔跑，背景随之滚动
- 僵尸从身后（屏幕左侧）追赶
- 上下方向键控制玩家躲避${obstacle}
- 屏幕顶部显示分数、生命和已生存距离
- 玩家活得越久，分数越高

请将其制作成 Artifact 面板中的可玩游戏。`;
  },

  upgrades: [
    // Easy upgrades
    {
      id: "lives-counter",
      level: "easy",
      title: "生命计数器",
      emoji: "❤️",
      fillParam: {
        key: "lives",
        label: "添加",
        suffix: "条命显示为心形",
        default: 3,
        min: 1,
        max: 10,
        hint: "1 = 硬核 · 5+ = 宽容",
      },
      buildPrompt: (lives) => `在顶部添加 ${lives} 条命，显示为心形。每次被僵尸抓到失去一颗心。所有心消失后游戏结束。`,
      agent_context: "显示剩余尝试次数的视觉生命计数器",
      language_dimensions: [DIMENSION_LIBRARY_ZH.quantity, DIMENSION_LIBRARY_ZH.position, DIMENSION_LIBRARY_ZH.appearance],
    },
    {
      id: "supply-drops",
      level: "easy",
      title: "补给空投",
      emoji: "📦",
      fillParam: {
        key: "count",
        label: "沿路投放",
        suffix: "个补给箱",
        default: 10,
        min: 3,
        max: 50,
        hint: "5 = 稀有珍贵 · 20+ = 到处都是补给",
      },
      buildPrompt: (count) => `沿路投放 ${count} 个补给箱。跑过补给箱即可拾取，每个加1分。在顶部显示补给计数器。`,
      agent_context: "散落在跑道上的可收集补给箱",
      language_dimensions: [DIMENSION_LIBRARY_ZH.quantity, DIMENSION_LIBRARY_ZH.position, DIMENSION_LIBRARY_ZH.result],
    },
    {
      id: "obstacle-density",
      level: "easy",
      title: "障碍物密度",
      emoji: "🚧",
      fillParam: {
        key: "obstacles",
        label: "每屏放置",
        suffix: "个障碍物",
        default: 10,
        min: 1,
        max: 30,
        hint: "3 = 宽阔大道 · 20+ = 障碍赛道",
      },
      buildPrompt: (obstacles) => `玩家每跑过一屏，大约放置 ${obstacles} 个障碍物。把它们分散开，始终留出可以通过的路径——玩家绝不应该被完全堵死。`,
      agent_context: "跑道上障碍物的拥挤程度",
      language_dimensions: [DIMENSION_LIBRARY_ZH.quantity, DIMENSION_LIBRARY_ZH.position, DIMENSION_LIBRARY_ZH.frequency],
    },
    {
      id: "__own__",
      level: "easy",
      title: "我的想法",
      emoji: "✏️",
      isOwn: true,
      buildPrompt: (text) =>
        `请在我的僵尸跑酷中添加：${text.trim()}。让它与现有玩法配合良好，保持游戏可玩性。`,
      agent_context: "学生自定义想法",
      language_dimensions: [],
    },

    // Medium upgrades
    {
      id: "zombie-speed",
      level: "medium",
      title: "僵尸速度",
      emoji: "🧟",
      think: "你说僵尸要快——是玩家的两倍快，还是三倍快？如果太快了，还有人能活下来吗？想想游戏是不是还好玩。",
      params: [
        {
          key: "speed_multiplier",
          label: "僵尸速度是玩家的___倍",
          default: 2,
          min: 1,
          max: 5,
          hint: "1倍 = 可以跑赢 · 2倍 = 缓缓逼近 · 4倍以上 = 几乎逃不掉",
        },
      ],
      buildPrompt: (p) => `让僵尸以玩家奔跑速度的 ${p.speed_multiplier} 倍追赶玩家。它们从玩家身后（左侧）出发。如果僵尸追上玩家，玩家失去一条命。确保玩家能看到僵尸逐渐逼近，知道自己有多危险。`,
      agent_context: "僵尸群追赶玩家的速度",
      language_dimensions: [
        "难度意图（想让僵尸紧追不舍还是可以甩掉）",
        "紧张感意图（想让玩家一直逃命还是偶尔能喘口气）",
      ],
    },
    {
      id: "horde-waves",
      level: "medium",
      title: "僵尸浪潮",
      emoji: "👥",
      think: "一整群僵尸比一只可怕多了！一次应该有多少只追你？每一波应该是僵尸更多，还是僵尸更快？",
      params: [
        {
          key: "zombies_per_wave",
          label: "每波僵尸数量",
          default: 5,
          min: 1,
          max: 20,
          hint: "2 = 一小队 · 10+ = 身后一堵僵尸墙",
        },
      ],
      buildPrompt: (p) => `让僵尸以每波 ${p.zombies_per_wave} 只的方式出现。每20秒来一波新的，每一波都要比上一波稍微难一点。新一波开始时在屏幕上显示「第1波」「第2波」等。`,
      agent_context: "僵尸以递增的浪潮形式出现，而不是一次全部涌出",
      language_dimensions: [
        "规模意图（想要僵尸多一点还是少一点）",
        "进阶方式意图（每一波想要怎么变难——更多僵尸？更快的僵尸？）",
      ],
    },
    {
      id: "power-up",
      level: "medium",
      title: "强化道具",
      emoji: "⚡",
      think: "强化道具能在最后一刻救你一命！它应该是一次大救援，还是只是小小的帮助？玩家应该经常捡到，还是几乎遇不到？",
      params: [
        {
          key: "duration_seconds",
          label: "道具持续___秒",
          default: 5,
          min: 1,
          max: 15,
          hint: "2秒 = 快速脱身 · 10秒以上 = 感觉无敌",
        },
      ],
      buildPrompt: (p) => `添加一个玩家可以在奔跑中拾取的强化道具。拾取后，玩家跑得更快，并且在 ${p.duration_seconds} 秒内免疫僵尸伤害。显示计时器或发光效果，让玩家知道道具正在生效以及什么时候快要结束。`,
      agent_context: "让玩家暂时更快更安全的强化道具",
      language_dimensions: [
        "强度意图（想让加速非常强力还是只是小帮助）",
        "稀有度意图（想让道具经常出现还是很难遇到）",
      ],
    },
    {
      id: "__own_medium__",
      level: "medium",
      title: "我的想法",
      emoji: "✏️",
      isOwn: true,
      dynamicParams: true,
      params: [],
      think: "你想添加什么功能？想想什么能让你的僵尸跑酷更刺激。",
      buildPrompt: (paramValues, template) => {
        if (!template) return '';
        return template.replace(/\{(\w+)\}/g, (_, key) => paramValues[key] || `[${key}]`);
      },
      agent_context: "学生自己想的游戏功能，具体内容未知",
      language_dimensions: [],
    },

    // Hard upgrades
    {
      id: "safehouse-ending",
      level: "hard",
      title: "安全屋结局",
      emoji: "🏠",
      hint: "你的幸存者最后怎样逃脱？安全屋在哪里？玩家要先做到什么才能进去？进去后会看到什么？自己设计这个结局。",
      prompt: null,
      agent_context: "设计好的胜利条件与结局画面",
      language_dimensions: [DIMENSION_LIBRARY_ZH.condition, DIMENSION_LIBRARY_ZH.trigger, DIMENSION_LIBRARY_ZH.result, DIMENSION_LIBRARY_ZH.appearance],
    },
    {
      id: "difficulty-curve",
      level: "hard",
      title: "难度曲线",
      emoji: "⚖️",
      hint: "玩家活得越久，游戏应该怎样变难？僵尸更快？障碍更多？补给更少？自己设计难度递进。",
      prompt: null,
      agent_context: "设计好的难度递增系统",
      language_dimensions: [DIMENSION_LIBRARY_ZH.speed, DIMENSION_LIBRARY_ZH.quantity, DIMENSION_LIBRARY_ZH.trigger, DIMENSION_LIBRARY_ZH.condition],
    },
    {
      id: "signature-rule",
      level: "hard",
      title: "独特规则",
      emoji: "🌟",
      hint: "让你的僵尸跑酷独一无二的规则！别的跑酷游戏都没有的东西。什么特殊机制能定义你的游戏？",
      prompt: null,
      agent_context: "独一无二的游戏机制",
      language_dimensions: [DIMENSION_LIBRARY_ZH.trigger, DIMENSION_LIBRARY_ZH.result, DIMENSION_LIBRARY_ZH.appearance],
    },
    {
      id: "__own_hard__",
      level: "hard",
      title: "我的想法",
      emoji: "✏️",
      isOwn: true,
      prompt: null,
      hint: "你的独特想法是什么？想一个别的僵尸游戏都没有的东西。",
      agent_context: "学生完全原创的游戏功能，没有任何方向限制",
      language_dimensions: [
        "触发条件（什么情况下发生）",
        "结果描述（发生了会怎样）",
        "外观描述（看起来怎样）",
      ],
    },
  ],
};

// Recovery items for Lesson 3 - Chinese
export const RECOVERY_3_ZH = [
  {
    id: "no-game",
    icon: "👻",
    title: "Claude只显示文字，没有游戏",
    fix: '在聊天中输入：「请把这个作为可玩的跑酷游戏显示在 Artifact 面板中。」',
  },
  {
    id: "controls-broken",
    icon: "🎮",
    title: "方向键不管用",
    fix: '输入：「让上下方向键能移动玩家躲避障碍物。」',
  },
  {
    id: "zombies-too-fast",
    icon: "🧟",
    title: "僵尸快得根本躲不掉",
    fix: '告诉 Claude 你到底想要多快。例如：「让僵尸只比玩家稍微快一点，这样我躲得好就能逃掉。」',
  },
  {
    id: "no-damage",
    icon: "💥",
    title: "僵尸碰到我但什么都没发生",
    fix: '准确告诉 Claude 哪里有问题。例如：「僵尸碰到我时什么都没发生。应该让我失去一条命。」',
  },
  {
    id: "instant-game-over",
    icon: "💀",
    title: "游戏一开始就结束了",
    fix: '输入：「修复出生位置。僵尸应该从玩家身后很远的地方开始，而不是直接出现在玩家身上。」',
  },
  {
    id: "no-scroll",
    icon: "🏃",
    title: "画面不滚动",
    fix: '输入：「让玩家持续向右奔跑，背景随之滚动。」',
  },
  {
    id: "where-paste",
    icon: "❓",
    title: "在哪里粘贴提示词？",
    fix: "打开 claude.ai。底部的大文本框就是粘贴的地方，然后按回车。",
  },
  {
    id: "limit",
    icon: "🛑",
    title: 'Claude说「消息限制已达上限」',
    fix: "举手。老师会给你切换到备用账号。",
  },
  {
    id: "ugly",
    icon: "🎨",
    title: "游戏看起来不对（颜色/大小）",
    fix: '在同一个聊天中，输入你想改的内容。例如：「让街道看起来又黑又有雾。」Claude会更新游戏。',
  },
];

// Level configuration - Chinese
export const LEVEL_CONFIG_3_ZH = {
  easy: {
    label: "简单",
    emoji: "🟢",
    color: "border-green-300 bg-green-50",
    accent: "text-green-700",
    desc: "快速更改 — 选一个然后复制",
  },
  medium: {
    label: "中等",
    emoji: "🔵",
    color: "border-blue-300 bg-blue-50",
    accent: "text-blue-700",
    desc: "较大更改 — 先想好，再填数字",
  },
  hard: {
    label: "困难",
    emoji: "🟣",
    color: "border-purple-300 bg-purple-50",
    accent: "text-purple-700",
    desc: "设计挑战 — 你来写提示词",
  },
};

// Tabs for Lesson 3 - Chinese
import { Sparkles, Copy, AlertCircle, Rocket, Settings, Bug } from "lucide-react";

export const TABS_3_ZH = [
  { id: "design", label: "设计", icon: Sparkles },
  { id: "rules", label: "规则", icon: Settings },
  { id: "prompt", label: "提示词", icon: Copy },
  { id: "debug", label: "调试", icon: Bug },
  { id: "help", label: "帮助", icon: AlertCircle },
  { id: "upgrade", label: "升级", icon: Rocket },
];
