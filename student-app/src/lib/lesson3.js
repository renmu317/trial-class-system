// Lesson 3: Zombie Survival Runner (Curriculum Class 1)
// V17: Language Dimension Library - Extension Port 3
import { DIMENSION_LIBRARY } from './lesson';

// Lesson 3 specific LESSON configuration
export const LESSON_3 = {
  id: "zombie-runner-v1",
  title: "Zombie Survival Runner",
  emoji: "🧟",

  // V17: Agent configuration - Extension Port 1
  agent: {
    demo_description: "An endless runner where the player automatically runs right while zombies chase from behind, dodging obstacles and collecting supplies — the longer you survive, the higher your score",
  },

  // Build Tab: Design choices (same structure as Lesson 2)
  steps: [
    {
      id: "theme",
      label: "Map theme?",
      options: [
        { value: "city-street", label: "City Street", emoji: "🏙️" },
        { value: "forest", label: "Forest", emoji: "🌲" },
        { value: "school", label: "School", emoji: "🏫" },
        { value: "shopping-mall", label: "Shopping Mall", emoji: "🛒" },
        { value: "hospital", label: "Hospital", emoji: "🏥" },
        { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "zombieType",
      label: "What kind of zombies?",
      options: [
        { value: "slow-walkers", label: "Slow Walkers", emoji: "🧟" },
        { value: "fast-runners", label: "Fast Runners", emoji: "🏃" },
        { value: "crawlers", label: "Crawlers", emoji: "🦴" },
        { value: "giant-boss", label: "Giant Boss", emoji: "👹" },
        { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "obstacle",
      label: "What do you dodge?",
      options: [
        { value: "cars", label: "Cars", emoji: "🚗" },
        { value: "trees", label: "Trees", emoji: "🌳" },
        { value: "barriers", label: "Barriers", emoji: "🚧" },
        { value: "dumpsters", label: "Dumpsters", emoji: "🗑️" },
        { value: "broken-fences", label: "Broken Fences", emoji: "🪵" },
        { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "supply",
      label: "What do you collect?",
      options: [
        { value: "ammo", label: "Ammo", emoji: "🔫" },
        { value: "medkits", label: "Medkits", emoji: "💊" },
        { value: "energy-drinks", label: "Energy Drinks", emoji: "🥤" },
        { value: "coins", label: "Coins", emoji: "🪙" },
        { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "background",
      label: "Time of day?",
      options: [
        { value: "night", label: "Night", emoji: "🌙" },
        { value: "sunset", label: "Sunset", emoji: "🌇" },
        { value: "foggy", label: "Foggy", emoji: "🌫️" },
        { value: "daylight", label: "Daylight", emoji: "☀️" },
        { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
      ],
    },
  ],

  // Rule Design Tab
  ruleDesign: {
    enabled: true,
    fields: [
      {
        id: "collision",
        label: "Collision Rule",
        question: "What happens when a zombie catches the player?",
        emoji: "💥",
        options: [
          { value: "lose-1-life", label: "Lose 1 life" },
          { value: "game-over", label: "Game over immediately" },
          { value: "slowed-down", label: "Slowed down for a moment" },
        ],
        allowCustom: true,
        placeholder: "e.g. 'lose half your supplies'",
      },
      {
        id: "win",
        label: "Win Rule",
        question: "How does the player win?",
        emoji: "🏆",
        options: [
          { value: "survive-60-seconds", label: "Survive 60 seconds" },
          { value: "reach-safehouse", label: "Reach the safehouse" },
          { value: "endless-high-score", label: "Endless — beat your high score" },
        ],
        allowCustom: true,
        placeholder: "e.g. 'collect 20 medkits and reach the rescue helicopter'",
      },
      {
        id: "lose",
        label: "Lose Rule",
        question: "How many hits before game over?",
        emoji: "💀",
        options: [
          { value: "1-hit", label: "1 hit" },
          { value: "3-lives", label: "3 lives" },
          { value: "5-lives", label: "5 lives" },
          { value: "caught-by-horde", label: "Only when the horde catches up" },
        ],
        allowCustom: true,
        placeholder: "e.g. 'game over if zombies touch you twice in a row'",
      },
      {
        id: "difficulty",
        label: "Difficulty",
        question: "How do zombies get harder over time?",
        emoji: "⚡",
        options: [
          { value: "zombies-speed-up", label: "Zombies speed up" },
          { value: "more-zombies", label: "More zombies appear" },
          { value: "more-obstacles", label: "More obstacles appear" },
          { value: "stays-the-same", label: "Stays the same" },
        ],
        allowCustom: true,
        placeholder: "e.g. 'every 30 seconds one more zombie joins the chase'",
      },
    ],
  },

  // Debug Log Tab
  debugLog: {
    enabled: true,
    breakTypes: [
      {
        id: "zombie-catch",
        label: "Zombie Problem",
        emoji: "🧟",
        description: "Zombies pass through the player or don't hurt them",
        fixPrompt: "Fix the zombie collision so that when a zombie touches the player, the player takes damage. Zombies should not pass through the player.",
      },
      {
        id: "obstacle",
        label: "Obstacle Problem",
        emoji: "🚧",
        description: "Player runs through obstacles instead of crashing",
        fixPrompt: "Fix the obstacle collision so the player cannot run through obstacles. Hitting an obstacle should slow the player down or cost a life.",
      },
      {
        id: "scroll",
        label: "Scrolling Problem",
        emoji: "🏃",
        description: "The screen doesn't scroll or the player is stuck",
        fixPrompt: "Fix the scrolling so the player runs continuously to the right and the background scrolls with them. The player should never get stuck.",
      },
      {
        id: "spawn",
        label: "Spawn Problem",
        emoji: "📍",
        description: "Zombies or obstacles spawn on top of the player",
        fixPrompt: "Fix the spawn positions so zombies always appear behind the player and obstacles appear ahead with enough space to react. Nothing should spawn directly on top of the player.",
      },
      {
        id: "supply",
        label: "Supply Problem",
        emoji: "📦",
        description: "Supplies don't appear or can't be picked up",
        fixPrompt: "Fix the supplies so they appear along the path and are collected when the player runs into them. Update the score or supply counter when collected.",
      },
      {
        id: "other",
        label: "Something Else",
        emoji: "❓",
        description: "Other problem - describe it yourself",
        fixPrompt: null, // Student describes the problem
      },
    ],
  },

  ownIdeaMaxLength: 60,
  gameNameMaxLength: 30,

  defaultGameName: (choices, ownInputs) => {
    const themeVal = choices.theme;
    if (!themeVal) return "My Zombie Runner";
    const resolved =
      themeVal === "__own__"
        ? (ownInputs.theme || "").trim()
        : LESSON_3.steps[0].options.find((o) => o.value === themeVal)?.label;
    if (!resolved) return "My Zombie Runner";
    const cap = resolved.charAt(0).toUpperCase() + resolved.slice(1);
    return `${cap} Runner`;
  },

  buildPrompt: (choices, ownInputs = {}, gameName = "", rules = {}) => {
    const resolve = (id) => {
      const val = choices[id];
      if (val === "__own__") return (ownInputs[id] || "").trim();
      return val?.replace(/-/g, " ") || "";
    };

    const theme = resolve("theme") || "city street";
    const zombieType = resolve("zombieType") || "slow walkers";
    const obstacle = resolve("obstacle") || "cars";
    const supply = resolve("supply") || "medkits";
    const background = resolve("background") || "night";
    const title = (gameName || "").trim() || LESSON_3.defaultGameName(choices, ownInputs);

    // Rule Design values
    const collisionRule = rules.collision || "lose 1 life";
    const winRule = rules.win || "survive 60 seconds";
    const loseRule = rules.lose || "3 lives";
    const difficultyRule = rules.difficulty || "zombies speed up";

    return `Build a playable zombie survival runner game called "${title}" as an Artifact.

MY GAME DESIGN:
- Map theme: ${theme}
- Zombie type: ${zombieType}
- Obstacles to dodge: ${obstacle}
- Supplies to collect: ${supply}
- Time of day: ${background}

MY GAME RULES:
- When a zombie catches the player: ${collisionRule}
- How to win: ${winRule}
- Lives: ${loseRule}
- How it gets harder: ${difficultyRule}

MAKE SURE:
- The player runs automatically to the right and the background scrolls with them
- Zombies chase from behind, on the left side of the screen
- Up and Down arrow keys move the player to dodge ${obstacle}
- Show score, lives, and distance survived at the top of the screen
- The longer the player survives, the higher the score

Make it playable in an Artifact panel.`;
  },

  // Upgrade configurations for Lesson 3
  upgrades: [
    // Easy upgrades - fillParam for direct number input, no Gate 1
    {
      id: "lives-counter",
      level: "easy",
      title: "Lives Counter",
      emoji: "❤️",
      fillParam: {
        key: "lives",
        label: "Add",
        suffix: "lives as hearts",
        default: 3,
        min: 1,
        max: 10,
        hint: "1 = hardcore · 5+ = forgiving",
      },
      buildPrompt: (lives) => `Add ${lives} lives shown as hearts at the top. Lose one heart each time a zombie catches you. Game over when all hearts are gone.`,
      agent_context: "A visual lives counter showing remaining attempts",
      language_dimensions: [DIMENSION_LIBRARY.quantity, DIMENSION_LIBRARY.position, DIMENSION_LIBRARY.appearance],
    },
    {
      id: "supply-drops",
      level: "easy",
      title: "Supply Drops",
      emoji: "📦",
      fillParam: {
        key: "count",
        label: "Drop",
        suffix: "supply crates along the road",
        default: 10,
        min: 3,
        max: 50,
        hint: "5 = rare and precious · 20+ = supplies everywhere",
      },
      buildPrompt: (count) => `Drop ${count} supply crates along the road. Running into a crate collects it and adds 1 point. Show a supply counter at the top.`,
      agent_context: "Collectible supply crates scattered along the running path",
      language_dimensions: [DIMENSION_LIBRARY.quantity, DIMENSION_LIBRARY.position, DIMENSION_LIBRARY.result],
    },
    {
      id: "obstacle-density",
      level: "easy",
      title: "Obstacle Density",
      emoji: "🚧",
      fillParam: {
        key: "obstacles",
        label: "Put",
        suffix: "obstacles on each screen",
        default: 10,
        min: 1,
        max: 30,
        hint: "3 = wide open road · 20+ = obstacle course",
      },
      buildPrompt: (obstacles) => `Put about ${obstacles} obstacles on each screen the player runs past. Space them out so there is always a way through — the player should never be completely blocked.`,
      agent_context: "How crowded the road is with obstacles the player must dodge",
      language_dimensions: [DIMENSION_LIBRARY.quantity, DIMENSION_LIBRARY.position, DIMENSION_LIBRARY.frequency],
    },
    {
      id: "__own__",
      level: "easy",
      title: "My Own Idea",
      emoji: "✏️",
      isOwn: true,
      buildPrompt: (text) =>
        `Please add this to my zombie runner: ${text.trim()}. Make it work well with the existing gameplay and keep the game playable.`,
      agent_context: "Custom idea from the student",
      language_dimensions: [],
    },

    // Medium upgrades - V17: language_dimensions 是意图层面，不是数字
    {
      id: "zombie-speed",
      level: "medium",
      title: "Zombie Speed",
      emoji: "🧟",
      think: "You said the zombies should be fast — twice as fast as the player, or three times? If they're too fast, can anyone survive? Think about whether the game is still fun.",
      params: [
        {
          key: "speed_multiplier",
          label: "Zombies run ___ × the player's speed",
          default: 2,
          min: 1,
          max: 5,
          hint: "1× = you can outrun them · 2× = they close in slowly · 4×+ = almost impossible to escape",
        },
      ],
      buildPrompt: (p) => `Make the zombies chase the player at ${p.speed_multiplier}× the player's running speed. They start behind the player on the left. If a zombie reaches the player, the player loses a life. Make sure the player can still see the zombies closing in so they know how much danger they're in.`,
      agent_context: "How fast the zombie horde chases the player",
      // V17: 意图层面的语言维度，不是数字
      language_dimensions: [
        "难度意图（想让僵尸紧追不舍还是可以甩掉）",
        "紧张感意图（想让玩家一直逃命还是偶尔能喘口气）",
      ],
    },
    {
      id: "horde-waves",
      level: "medium",
      title: "Horde Waves",
      emoji: "👥",
      think: "A whole horde is scarier than one zombie! How many should chase at once? Should each wave bring more zombies, or faster ones?",
      params: [
        {
          key: "zombies_per_wave",
          label: "Zombies per wave",
          default: 5,
          min: 1,
          max: 20,
          hint: "2 = a small pack · 10+ = a wall of zombies behind you",
        },
      ],
      buildPrompt: (p) => `Send zombies in waves of ${p.zombies_per_wave}. A new wave arrives every 20 seconds, and each wave should be a little harder than the last. Show "WAVE 1", "WAVE 2", etc. on screen when a new wave starts.`,
      agent_context: "Zombies arriving in escalating waves rather than all at once",
      // V17: 意图层面的语言维度
      language_dimensions: [
        "规模意图（想要僵尸多一点还是少一点）",
        "进阶方式意图（每一波想要怎么变难——更多僵尸？更快的僵尸？）",
      ],
    },
    {
      id: "power-up",
      level: "medium",
      title: "Power-Up",
      emoji: "⚡",
      think: "A power-up can save you at the last second! Should it be a huge rescue or just a small help? Should players find one often, or almost never?",
      params: [
        {
          key: "duration_seconds",
          label: "Power-up lasts ___ seconds",
          default: 5,
          min: 1,
          max: 15,
          hint: "2s = a quick escape · 10s+ = you feel unstoppable",
        },
      ],
      buildPrompt: (p) => `Add a power-up the player can pick up while running. When collected, the player runs much faster and is immune to zombies for ${p.duration_seconds} seconds. Show a timer or glow effect so the player knows the power-up is active and when it is about to run out.`,
      agent_context: "A temporary boost that makes the player faster and safer",
      // V17: 意图层面的语言维度
      language_dimensions: [
        "强度意图（想让加速非常强力还是只是小帮助）",
        "稀有度意图（想让道具经常出现还是很难遇到）",
      ],
    },
    // Medium Own Idea - 动态生成params
    {
      id: "__own_medium__",
      level: "medium",
      title: "My Own Idea",
      emoji: "✏️",
      isOwn: true,
      dynamicParams: true,  // 标记为动态params模式
      params: [],  // 由Gate 1动态生成
      think: "What feature do you want to add? Think about what would make your zombie runner more exciting.",
      buildPrompt: (paramValues, template) => {
        if (!template) return '';
        return template.replace(/\{(\w+)\}/g, (_, key) => paramValues[key] || `[${key}]`);
      },
      agent_context: "学生自己想的游戏功能，具体内容未知",
      language_dimensions: [],  // 动态生成，不预设
    },

    // Hard upgrades
    {
      id: "safehouse-ending",
      level: "hard",
      title: "Safehouse Ending",
      emoji: "🏠",
      hint: "How does your survivor finally escape? Where is the safehouse? What has to happen before the player can get in? What do they see when they make it? Design the ending yourself.",
      prompt: null,
      agent_context: "A designed win condition and ending sequence",
      language_dimensions: [DIMENSION_LIBRARY.condition, DIMENSION_LIBRARY.trigger, DIMENSION_LIBRARY.result, DIMENSION_LIBRARY.appearance],
    },
    {
      id: "difficulty-curve",
      level: "hard",
      title: "Difficulty Curve",
      emoji: "⚖️",
      hint: "How should your game get harder the longer the player survives? Faster zombies? More obstacles? Fewer supplies? Design the difficulty progression yourself.",
      prompt: null,
      agent_context: "A designed progression of increasing difficulty",
      language_dimensions: [DIMENSION_LIBRARY.speed, DIMENSION_LIBRARY.quantity, DIMENSION_LIBRARY.trigger, DIMENSION_LIBRARY.condition],
    },
    {
      id: "signature-rule",
      level: "hard",
      title: "Signature Rule",
      emoji: "🌟",
      hint: "One rule that makes YOUR zombie runner unique! Something no other runner has. What special mechanic will define your game?",
      prompt: null,
      agent_context: "A unique game mechanic that no one else has",
      language_dimensions: [DIMENSION_LIBRARY.trigger, DIMENSION_LIBRARY.result, DIMENSION_LIBRARY.appearance],
    },
    // Hard Own Idea - 完全开放式
    {
      id: "__own_hard__",
      level: "hard",
      title: "My Own Idea",
      emoji: "✏️",
      isOwn: true,
      prompt: null,  // Hard标准结构：学生自己写
      hint: "What's your unique idea? Think of something no other zombie game has.",
      agent_context: "学生完全原创的游戏功能，没有任何方向限制",
      language_dimensions: [
        "触发条件（什么情况下发生）",
        "结果描述（发生了会怎样）",
        "外观描述（看起来怎样）",
      ],
    },
  ],
};

// Recovery items for Lesson 3
export const RECOVERY_3 = [
  {
    id: "no-game",
    icon: "👻",
    title: "Claude only showed text, no game",
    fix: 'Type this in the chat: "Please show this as a playable running game in an Artifact panel."',
  },
  {
    id: "controls-broken",
    icon: "🎮",
    title: "Arrow keys don't work",
    fix: 'Type: "Make the up and down arrow keys move the player to dodge obstacles."',
  },
  {
    id: "zombies-too-fast",
    icon: "🧟",
    title: "Zombies are impossibly fast",
    fix: 'Tell Claude how fast you actually want them. Example: "Make the zombies run only slightly faster than the player, so I can escape if I dodge well."',
  },
  {
    id: "no-damage",
    icon: "💥",
    title: "Zombies touch me but nothing happens",
    fix: 'Tell Claude exactly what\'s wrong. Example: "When a zombie touches me, nothing happens. It should make me lose a life."',
  },
  {
    id: "instant-game-over",
    icon: "💀",
    title: "Game over the moment it starts",
    fix: 'Type: "Fix the spawn positions. Zombies should start far behind the player, not on top of them."',
  },
  {
    id: "no-scroll",
    icon: "🏃",
    title: "The screen doesn't scroll",
    fix: 'Type: "Make the player run continuously to the right and scroll the background with them."',
  },
  {
    id: "where-paste",
    icon: "❓",
    title: "Where do I paste the prompt?",
    fix: "Go to claude.ai. The big text box at the bottom is where you paste. Then press Enter.",
  },
  {
    id: "limit",
    icon: "🛑",
    title: 'Claude says "message limit reached"',
    fix: "Raise your hand. The teacher will switch you to a backup account.",
  },
  {
    id: "ugly",
    icon: "🎨",
    title: "Game looks wrong (colors / size)",
    fix: 'In the same chat, type what you want changed. Example: "Make the street look dark and foggy." Claude will update the game.',
  },
];

// Level configuration (same structure as Lesson 2)
export const LEVEL_CONFIG_3 = {
  easy: {
    label: "Easy",
    emoji: "🟢",
    color: "border-green-300 bg-green-50",
    accent: "text-green-700",
    desc: "Quick changes — pick one and copy",
  },
  medium: {
    label: "Medium",
    emoji: "🔵",
    color: "border-blue-300 bg-blue-50",
    accent: "text-blue-700",
    desc: "Bigger changes — think first, then fill the numbers",
  },
  hard: {
    label: "Hard",
    emoji: "🟣",
    color: "border-purple-300 bg-purple-50",
    accent: "text-purple-700",
    desc: "Designer challenges — YOU write the prompt",
  },
};

// Tabs for Lesson 3 (includes Rule Design and Debug Log)
import { Sparkles, Copy, AlertCircle, Rocket, Settings, Bug } from "lucide-react";

export const TABS_3 = [
  { id: "design", label: "Build", icon: Sparkles },
  { id: "rules", label: "Rules", icon: Settings },
  { id: "prompt", label: "Prompt", icon: Copy },
  { id: "debug", label: "Debug", icon: Bug },
  { id: "help", label: "Help", icon: AlertCircle },
  { id: "upgrade", label: "Upgrade", icon: Rocket },
];
