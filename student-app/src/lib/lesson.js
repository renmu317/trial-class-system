// V17: 语言维度库 - 扩展端口3
export const DIMENSION_LIBRARY = {
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

// Phase 1 原版 LESSON 配置 + V17 Agent 扩展
export const LESSON = {
  id: "catch-falling-v1",
  title: "Catch Falling Game",
  emoji: "🎮",

  // V17: Agent 配置 - 扩展端口1
  agent: {
    demo_description: "一个接落物游戏，玩家左右移动接住下落的星星，躲避炸弹，有3条命",
  },

  steps: [
    {
      id: "catchItem",
      label: "What do you catch?",
      options: [
        { value: "stars", label: "Stars", emoji: "⭐" },
        { value: "fruits", label: "Fruits", emoji: "🍎" },
        { value: "coins", label: "Coins", emoji: "🪙" },
        { value: "snowflakes", label: "Snowflakes", emoji: "❄️" },
        { value: "pizza", label: "Pizza", emoji: "🍕" },
        { value: "diamonds", label: "Diamonds", emoji: "💎" },
        { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "avoidItem",
      label: "What do you avoid?",
      options: [
        { value: "bombs", label: "Bombs", emoji: "💣" },
        { value: "fire", label: "Fire", emoji: "🔥" },
        { value: "rocks", label: "Rocks", emoji: "🪨" },
        { value: "lightning", label: "Lightning", emoji: "⚡" },
        { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "background",
      label: "Background color?",
      options: [
        { value: "dark blue", label: "Dark Blue", emoji: "🟦" },
        { value: "black", label: "Black", emoji: "⬛" },
        { value: "purple", label: "Purple", emoji: "🟪" },
        { value: "green", label: "Green", emoji: "🟩" },
        { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "difficulty",
      label: "How hard?",
      options: [
        { value: "easy", label: "Easy", emoji: "🐢", meta: { speed: 100, lives: 5 } },
        { value: "medium", label: "Medium", emoji: "🚶", meta: { speed: 200, lives: 3 } },
        { value: "hard", label: "Hard", emoji: "🏃", meta: { speed: 300, lives: 3 } },
        { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
      ],
    },
  ],
  ownIdeaMaxLength: 60,
  gameNameMaxLength: 30,
  defaultGameName: (choices, ownInputs) => {
    const catchVal = choices.catchItem;
    if (!catchVal) return "My Game";
    const resolved =
      catchVal === "__own__"
        ? (ownInputs.catchItem || "").trim()
        : LESSON.steps[0].options.find((o) => o.value === catchVal)?.label;
    if (!resolved) return "My Game";
    const cap = resolved.charAt(0).toUpperCase() + resolved.slice(1);
    return `My ${cap} Catcher`;
  },
  buildPrompt: (choices, ownInputs = {}, gameName = "") => {
    const resolve = (id) => {
      const val = choices[id];
      if (val === "__own__") return (ownInputs[id] || "").trim();
      return val;
    };
    const diff = LESSON.steps[3].options.find(o => o.value === choices.difficulty);
    const speed = diff?.meta?.speed || 200;
    const lives = diff?.meta?.lives || 3;
    const catchItem = resolve("catchItem") || "stars";
    const avoidItem = resolve("avoidItem") || "bombs";
    const background = resolve("background") || "dark blue";
    const title = (gameName || "").trim() || LESSON.defaultGameName(choices, ownInputs);

    return `Create a playable catch-falling-objects game called "${title}" in an Artifact panel.

Rules: Catch falling ${catchItem} (+1 point), avoid ${avoidItem} (-1 life). ${lives} lives total.
Visuals: ${background} background, objects fall at ${speed}px/s, show score and lives at top.
Controls: Arrow keys + mouse/touch to move paddle. Show Game Over with score and Play Again button.

Make it a fully working interactive game.`;
  },
  upgrades: [
    // Easy upgrades - V17 重设计: fillParam 直接数字输入，无 Gate 1
    {
      id: "lives",
      level: "easy",
      title: "Lives Counter",
      emoji: "❤️",
      fillParam: {
        key: "lives",
        label: "Starting lives",
        default: 3,
        min: 1,
        max: 9,
        hint: "1 = one mistake = game over · 3 = standard · 9 = very forgiving"
      },
      buildPrompt: (p) =>
        `Add a lives counter at the top that starts at ${p.lives} and shows hearts. Game over when all hearts are gone.`,
      agent_context: "显示剩余生命数的计数器",
      language_dimensions: [], // Easy 不触发 Gate 1
    },
    {
      id: "highscore",
      level: "easy",
      title: "High Score",
      emoji: "🏆",
      fillParam: {
        key: "records",
        label: "Save top ___ scores",
        default: 1,
        min: 1,
        max: 5,
        hint: "1 = only the best · 3 = top 3 hall of fame · 5 = leaderboard"
      },
      buildPrompt: (p) =>
        `Save the top ${p.records} high score${p.records > 1 ? 's' : ''} so ${p.records > 1 ? 'they show' : 'it shows'} even after Game Over. Display ${p.records > 1 ? 'them as a leaderboard' : 'it next to the current score'}.`,
      agent_context: "保存并显示最高分记录",
      language_dimensions: [],
    },
    {
      id: "speedup",
      level: "easy",
      title: "Speed Boost",
      emoji: "💨",
      fillParam: {
        key: "every",
        label: "Speed up every ___ points",
        default: 10,
        min: 3,
        max: 30,
        hint: "3 = gets hard very fast · 10 = standard · 30 = slow build-up"
      },
      buildPrompt: (p) =>
        `Make the objects fall faster every ${p.every} points scored. Show a 'SPEED UP!' message when it happens.`,
      agent_context: "游戏加速机制",
      language_dimensions: [],
    },
    {
      id: "twotypes",
      level: "easy",
      title: "Two Object Types",
      emoji: "✨",
      fillParam: {
        key: "bonus",
        label: "Special item worth ___ points",
        default: 5,
        min: 2,
        max: 10,
        hint: "2 = slight bonus · 5 = standard · 10 = super rare jackpot"
      },
      buildPrompt: (p) =>
        `Add a second special object worth ${p.bonus} points instead of 1. Make it appear less often than the regular ones (about 1 in 5 chance).`,
      agent_context: "高分值的特殊物品",
      language_dimensions: [],
    },
    {
      id: "colorchange",
      level: "easy",
      title: "Color Change",
      emoji: "🎨",
      fillParam: {
        key: "every",
        label: "Change color every ___ points",
        default: 10,
        min: 5,
        max: 30,
        hint: "5 = rapid color shifts · 10 = standard · 30 = rare change"
      },
      buildPrompt: (p) =>
        `Change the background color every ${p.every} points. Cycle through 4 different colors.`,
      agent_context: "背景颜色变化",
      language_dimensions: [],
    },
    {
      id: "powerup",
      level: "easy",
      title: "Power-Up",
      emoji: "⚡",
      fillParam: {
        key: "duration",
        label: "Power-up lasts ___ seconds",
        default: 5,
        min: 2,
        max: 15,
        hint: "2 = blink and it's gone · 5 = standard · 15 = long advantage"
      },
      buildPrompt: (p) =>
        `Add a rare power-up object that makes the paddle wider for ${p.duration} seconds when caught.`,
      agent_context: "道具效果",
      language_dimensions: [],
    },
    {
      id: "__own__",
      level: "easy",
      title: "My Own Idea",
      emoji: "✏️",
      isOwn: true,
      buildPrompt: (text) =>
        `Please add this to my game: ${text.trim()}. Make it work well with the existing gameplay and keep the game playable.`,
      agent_context: "自定义想法",
      language_dimensions: [],
    },
    // Medium upgrades - V17: language_dimensions 是意图层面，不是数字
    {
      id: "boss",
      level: "medium",
      title: "Boss Battle",
      emoji: "👹",
      think: "When should the boss appear — early for quick action, or late as a reward for skilled players? Should defeating it be quick or an epic battle?",
      params: [
        {
          key: "score",
          label: "Boss appears at score",
          default: 20,
          min: 5,
          max: 100,
          hint: "Low (5-15) = quick boss fight · High (50+) = boss is late-game reward"
        },
        {
          key: "hits",
          label: "Hits to defeat boss",
          default: 3,
          min: 1,
          max: 10,
          hint: "1 = easy win · 3 = fair challenge · 10 = epic battle"
        },
      ],
      buildPrompt: (p) => `When the player reaches ${p.score} points, make a big "Boss" character appear at the top of the screen. The player has to hit the boss ${p.hits} times by catching special items to defeat it. Show a "BOSS APPEARED!" message when it shows up, and "VICTORY!" when defeated. After defeating the boss, let the game continue with normal falling objects.`,
      agent_context: "Boss战斗系统",
      // V17: 意图层面的语言维度
      language_dimensions: [
        "出现时机意图（想让 Boss 早点出现还是玩很久才见到）",
        "战斗难度意图（想让 Boss 战很快结束还是持久战）",
      ],
    },
    {
      id: "levels",
      level: "medium",
      title: "Multiple Levels",
      emoji: "🗺️",
      think: "How many levels feels right? Should players level up quickly or work hard for each one?",
      params: [
        {
          key: "levels",
          label: "Number of levels",
          default: 3,
          min: 2,
          max: 5,
          hint: "Recommended 2-5. More than 5 may feel repetitive."
        },
        {
          key: "pointsPerLevel",
          label: "Points needed per level",
          default: 15,
          min: 5,
          max: 50,
          hint: "5 = quick levels · 15 = balanced · 50 = grinding required"
        },
      ],
      buildPrompt: (p) => `Split the game into ${p.levels} levels. The player advances to the next level every ${p.pointsPerLevel} points. Each level has a different background color and the objects fall faster. Show "LEVEL 1", "LEVEL 2", etc. as big titles when each starts. Display the current level number at the top of the screen during play.`,
      agent_context: "多关卡系统",
      // V17: 意图层面的语言维度
      language_dimensions: [
        "规模意图（想要关卡多一点还是少一点）",
        "节奏意图（想让玩家快速升级还是需要努力积累）",
      ],
    },
    {
      id: "sounds",
      level: "medium",
      title: "Sound Effects",
      emoji: "🔊",
      think: "Should sounds be subtle background feedback, or loud and exciting to celebrate every action?",
      params: [
        {
          key: "volume",
          label: "Volume (0-100)",
          default: 50,
          min: 10,
          max: 100,
          hint: "10 = subtle background · 50 = balanced · 100 = loud and exciting"
        },
      ],
      buildPrompt: (p) => `Add sound effects using the Web Audio API at ${p.volume}% volume. Play a happy 'ding' when catching the good object, a 'thud' when hitting the bad object, and a short 'game over' sound when losing. Keep all sounds under 0.5 seconds and not annoying.`,
      agent_context: "音效系统",
      // V17: 意图层面的语言维度
      language_dimensions: [
        "氛围意图（想让音效低调配合还是明显强调游戏事件）",
        "反馈感意图（想让玩家通过声音感知成功/失败的程度）",
      ],
    },
    {
      id: "talkingchar",
      level: "medium",
      title: "Talking Character",
      emoji: "💬",
      think: "Should your character be a chatty companion or a quiet helper who only speaks at important moments?",
      params: [
        {
          key: "every",
          label: "Speak after every N catches",
          default: 5,
          min: 1,
          max: 20,
          hint: "1 = chatty companion · 5 = occasional comments · 20 = rare reactions"
        },
      ],
      buildPrompt: (p) => `Add a small character in the corner of the screen that shows speech bubbles. It says "Let's go!" at the start, says something encouraging every ${p.every} points (like "Nice catch!" or "Keep going!"), warns "Watch out!" when a bad object is close to the paddle, and says "Game over..." at the end. Keep all messages short and fun.`,
      agent_context: "会说话的角色",
      // V17: 意图层面的语言维度
      language_dimensions: [
        "互动频率意图（想让角色话多还是话少）",
        "性格意图（想让角色感觉像朋友还是安静的助手）",
      ],
    },
    // Hard upgrades
    {
      id: "difficulty-curve",
      level: "hard",
      title: "Balance Designer",
      emoji: "⚖️",
      hint: "What makes a game start easy, then get hard? Speed? Object size? Object count? Multiple things at once? Think first, THEN tell Claude.",
      prompt: null,
      agent_context: "难度平衡设计",
      language_dimensions: [DIMENSION_LIBRARY.speed, DIMENSION_LIBRARY.quantity, DIMENSION_LIBRARY.trigger, DIMENSION_LIBRARY.result],
    },
    {
      id: "storyteller",
      level: "hard",
      title: "Storyteller",
      emoji: "📖",
      hint: "Every great game has a reason to play. Why is your player catching these things? What happens if they succeed? Tell Claude the story you want.",
      prompt: null,
      agent_context: "游戏故事设计",
      language_dimensions: [DIMENSION_LIBRARY.trigger, DIMENSION_LIBRARY.result, DIMENSION_LIBRARY.condition],
    },
    {
      id: "signature",
      level: "hard",
      title: "Signature Move",
      emoji: "🌟",
      hint: "Add ONE thing nobody else will think of. Something only your game has. What makes a game uniquely yours? Tell Claude exactly what you want.",
      prompt: null,
      agent_context: "独特功能设计",
      language_dimensions: [DIMENSION_LIBRARY.trigger, DIMENSION_LIBRARY.result, DIMENSION_LIBRARY.appearance],
    },
  ],
};

// Phase 1 原版 RECOVERY - 不要修改
export const RECOVERY = [
  { id: "no-game", icon: "👻", title: "Claude only showed text, no game", fix: "Type this in the chat: \"Please show this as a playable game in an Artifact panel.\"" },
  { id: "broken", icon: "🐛", title: "Game showed up but doesn't work", fix: "Tell Claude exactly what's wrong. Example: \"The paddle doesn't move when I press arrow keys.\" The more specific, the better the fix." },
  { id: "copy-fail", icon: "📋", title: "Copy button didn't work", fix: "Select the prompt text with your mouse, then press Ctrl+C (Windows) or Cmd+C (Mac)." },
  { id: "where-paste", icon: "❓", title: "Where do I paste the prompt?", fix: "Go to claude.ai. The big text box at the bottom is where you paste. Then press Enter." },
  { id: "limit", icon: "🛑", title: "Claude says \"message limit reached\"", fix: "Raise your hand. The teacher will switch you to a backup account." },
  { id: "ugly", icon: "🎨", title: "Game looks wrong (colors / size)", fix: "In the same chat, type what you want changed. Example: \"Make the background purple instead.\" Claude will update the game." },
];

// Phase 1 原版 LEVEL_CONFIG - 不要修改
export const LEVEL_CONFIG = {
  easy: { label: "Easy", emoji: "🟢", color: "border-green-300 bg-green-50", accent: "text-green-700", desc: "Quick changes — pick one and copy" },
  medium: { label: "Medium", emoji: "🔵", color: "border-blue-300 bg-blue-50", accent: "text-blue-700", desc: "Bigger changes — read the hint, then copy" },
  hard: { label: "Hard", emoji: "🟣", color: "border-purple-300 bg-purple-50", accent: "text-purple-700", desc: "Designer challenges — YOU write the prompt" },
};

// Phase 1 原版 TABS - 不要修改
import { Sparkles, Copy, AlertCircle, Rocket } from "lucide-react";
export const TABS = [
  { id: "design", label: "Build", icon: Sparkles },
  { id: "prompt", label: "Prompt", icon: Copy },
  { id: "help", label: "Help", icon: AlertCircle },
  { id: "upgrade", label: "Upgrade", icon: Rocket },
];
