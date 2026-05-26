// Lesson 2: AI Maze Game
// V17: Language Dimension Library - Extension Port 3
import { DIMENSION_LIBRARY } from './lesson';

// Lesson 2 specific LESSON configuration
export const LESSON_2 = {
  id: "maze-game-v1",
  title: "AI Maze Game",
  emoji: "🧩",

  // V17: Agent configuration - Extension Port 1
  agent: {
    demo_description: "A maze with 10 pathways where the player navigates from top-left to bottom-right, avoiding traps and collecting rewards",
  },

  // Build Tab: Design choices (same structure as Lesson 1)
  steps: [
    {
      id: "theme",
      label: "Maze theme?",
      options: [
        { value: "ice-cave", label: "Ice Cave", emoji: "🧊" },
        { value: "volcano", label: "Volcano", emoji: "🌋" },
        { value: "space-station", label: "Space Station", emoji: "🚀" },
        { value: "underwater", label: "Underwater", emoji: "🌊" },
        { value: "dark-castle", label: "Dark Castle", emoji: "🏰" },
        { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "obstacle",
      label: "Dangerous thing to avoid?",
      options: [
        { value: "bombs", label: "Bombs", emoji: "💣" },
        { value: "monsters", label: "Monsters", emoji: "👾" },
        { value: "fire-traps", label: "Fire Traps", emoji: "🔥" },
        { value: "electric-walls", label: "Electric Walls", emoji: "⚡" },
        { value: "rolling-rocks", label: "Rolling Rocks", emoji: "🪨" },
        { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "reward",
      label: "Reward at the end?",
      options: [
        { value: "gold", label: "Gold", emoji: "🪙" },
        { value: "diamond", label: "Diamond", emoji: "💎" },
        { value: "magic-key", label: "Magic Key", emoji: "🗝️" },
        { value: "star-portal", label: "Star Portal", emoji: "⭐" },
        { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "size",
      label: "Maze size?",
      options: [
        { value: "small", label: "Small (10×10)", emoji: "🔲", meta: { width: 10, height: 10 } },
        { value: "medium", label: "Medium (15×15)", emoji: "🔳", meta: { width: 15, height: 15 } },
        { value: "large", label: "Large (20×20)", emoji: "⬛", meta: { width: 20, height: 20 } },
      ],
    },
    {
      id: "background",
      label: "Background color?",
      options: [
        { value: "dark blue", label: "Dark Blue", emoji: "🟦" },
        { value: "black", label: "Black", emoji: "⬛" },
        { value: "dark green", label: "Dark Green", emoji: "🟩" },
        { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
      ],
    },
  ],

  // Rule Design Tab: Lesson 2 exclusive
  ruleDesign: {
    enabled: true,
    fields: [
      {
        id: "collision",
        label: "Collision Rule",
        question: "What happens when player touches trap?",
        emoji: "💥",
        options: [
          { value: "lose-1-life", label: "Lose 1 life" },
          { value: "game-over", label: "Game over immediately" },
          { value: "pushed-back", label: "Pushed back to start" },
        ],
        allowCustom: true,
        placeholder: "e.g. 'freeze for 2 seconds'",
      },
      {
        id: "win",
        label: "Win Rule",
        question: "How does the player win?",
        emoji: "🏆",
        options: [
          { value: "reach-exit", label: "Reach the exit" },
          { value: "collect-key-exit", label: "Collect key then exit" },
          { value: "defeat-boss", label: "Defeat boss at end" },
        ],
        allowCustom: true,
        placeholder: "e.g. 'collect all coins and reach exit'",
      },
      {
        id: "lose",
        label: "Lose Rule",
        question: "How many mistakes before game over?",
        emoji: "💀",
        options: [
          { value: "1-mistake", label: "1 mistake" },
          { value: "3-lives", label: "3 lives" },
          { value: "5-lives", label: "5 lives" },
          { value: "time-limit", label: "Time limit" },
        ],
        allowCustom: true,
        placeholder: "e.g. 'lose after 10 mistakes'",
      },
      {
        id: "difficulty",
        label: "Difficulty",
        question: "How hard should it be?",
        emoji: "⚡",
        options: [
          { value: "slow-player", label: "Slow player" },
          { value: "medium-speed", label: "Medium speed" },
          { value: "fast-player", label: "Fast player" },
          { value: "lots-of-traps", label: "Lots of traps" },
        ],
        allowCustom: true,
        placeholder: "e.g. 'start easy, get harder each level'",
      },
    ],
  },

  // Debug Log Tab: Lesson 2 exclusive
  debugLog: {
    enabled: true,
    breakTypes: [
      {
        id: "wall",
        label: "Wall Problem",
        emoji: "🧱",
        description: "Player walks through walls or walls misaligned",
        fixPrompt: "Fix the walls so the player cannot walk through them. Make sure all walls are properly aligned on the grid.",
      },
      {
        id: "path",
        label: "No Valid Path",
        emoji: "🚫",
        description: "Cannot reach the exit - all paths blocked",
        fixPrompt: "Make sure the maze always has a valid path from the starting position to the exit. Use recursive backtracking maze generation if needed.",
      },
      {
        id: "spawn",
        label: "Spawn Problem",
        emoji: "📍",
        description: "Player spawns inside a wall or wrong position",
        fixPrompt: "Fix the player spawn position so they appear in an open space at the maze entrance, not inside any walls.",
      },
      {
        id: "reward",
        label: "Reward Problem",
        emoji: "🎁",
        description: "Reward doesn't appear or can't be collected",
        fixPrompt: "Fix the reward so it appears at the exit and triggers properly when the player reaches it.",
      },
      {
        id: "collision",
        label: "Collision Problem",
        emoji: "💥",
        description: "Trap collision doesn't work as expected",
        fixPrompt: "Fix the trap collision detection so it properly triggers when the player touches a trap.",
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
    if (!themeVal) return "My Maze";
    const resolved =
      themeVal === "__own__"
        ? (ownInputs.theme || "").trim()
        : LESSON_2.steps[0].options.find((o) => o.value === themeVal)?.label;
    if (!resolved) return "My Maze";
    const cap = resolved.charAt(0).toUpperCase() + resolved.slice(1);
    return `${cap} Maze`;
  },

  buildPrompt: (choices, ownInputs = {}, gameName = "", rules = {}) => {
    const resolve = (id) => {
      const val = choices[id];
      if (val === "__own__") return (ownInputs[id] || "").trim();
      return val?.replace(/-/g, " ") || "";
    };

    const sizeOption = LESSON_2.steps[3].options.find((o) => o.value === choices.size);
    const width = sizeOption?.meta?.width || 15;
    const height = sizeOption?.meta?.height || 15;

    const theme = resolve("theme") || "dark castle";
    const obstacle = resolve("obstacle") || "traps";
    const reward = resolve("reward") || "treasure";
    const background = resolve("background") || "dark blue";
    const title = (gameName || "").trim() || LESSON_2.defaultGameName(choices, ownInputs);

    // Rule Design values
    const collisionRule = rules.collision || "lose 1 life";
    const winRule = rules.win || "reach the exit";
    const loseRule = rules.lose || "3 lives";
    const difficultyRule = rules.difficulty || "medium speed";

    return `Build a playable maze game called "${title}" as an Artifact.

MY MAZE DESIGN:
- Theme: ${theme}
- Size: ${width} × ${height}
- Background color: ${background}
- Dangerous thing to avoid: ${obstacle}
- Reward at the end: ${reward}

MY GAME RULES:
- When the player touches ${obstacle}: ${collisionRule}
- How to win: ${winRule}
- Lives: ${loseRule}
- Speed: ${difficultyRule}

MAKE SURE:
- The maze always has a clear path from start to finish (player can always reach the exit)
- Player starts at the top-left corner, exit is at the bottom-right
- Arrow keys move the player
- Show lives and score at the top of the screen

Make it playable in an Artifact panel.`;
  },

  // Upgrade configurations for Lesson 2
  upgrades: [
    // Easy upgrades - V17 Lesson 2: fillParam for direct number input, no Gate 1
    {
      id: "timer",
      level: "easy",
      title: "Time Limit",
      emoji: "⏱️",
      // V17 Lesson 2: fillParam replaces fixed prompt
      fillParam: {
        key: "seconds",
        label: "Add a",
        suffix: "second timer",
        default: 60,
        min: 10,
        max: 300,
        hint: "30s = fast game · 120s = relaxed pace"
      },
      buildPrompt: (seconds) => `Add a ${seconds}-second countdown timer. Game over if the player doesn't reach the exit in time. Show the timer prominently at the top.`,
      agent_context: "A countdown timer that limits how long the player has to complete the maze",
      language_dimensions: [DIMENSION_LIBRARY.duration, DIMENSION_LIBRARY.position, DIMENSION_LIBRARY.result],
    },
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
        hint: "1 = hardcore · 5+ = forgiving"
      },
      buildPrompt: (lives) => `Add ${lives} lives shown as hearts at the top. Lose one heart each time you hit a trap. Game over when all hearts are gone.`,
      agent_context: "A visual lives counter showing remaining attempts",
      language_dimensions: [DIMENSION_LIBRARY.quantity, DIMENSION_LIBRARY.position, DIMENSION_LIBRARY.appearance],
    },
    {
      id: "collectibles",
      level: "easy",
      title: "Collectibles",
      emoji: "⭐",
      fillParam: {
        key: "count",
        label: "Scatter",
        suffix: "coins in the maze",
        default: 10,
        min: 3,
        max: 50,
        hint: "5 = quick find · 20+ = treasure hunt"
      },
      buildPrompt: (count) => `Scatter ${count} coins throughout the maze. Show a score counter at the top. Each coin is worth 1 point.`,
      agent_context: "Collectible items scattered through the maze for bonus points",
      language_dimensions: [DIMENSION_LIBRARY.quantity, DIMENSION_LIBRARY.position, DIMENSION_LIBRARY.result],
    },
    {
      id: "__own__",
      level: "easy",
      title: "My Own Idea",
      emoji: "✏️",
      isOwn: true,
      buildPrompt: (text) =>
        `Please add this to my maze: ${text.trim()}. Make it work well with the existing gameplay and keep the game playable.`,
      agent_context: "Custom idea from the student",
      language_dimensions: [],
    },

    // Medium upgrades - V17: language_dimensions 是意图层面，不是数字
    {
      id: "moving-obstacle",
      level: "medium",
      title: "Moving Obstacle",
      emoji: "🏃",
      think: "A trap that moves can be very dangerous! Should it be easy to dodge or nearly impossible? Think about how the player will feel.",
      params: [
        {
          key: "patrol_seconds",
          label: "Trap patrols every ___ seconds",
          default: 3,
          min: 1,
          max: 10,
          hint: "1s = very fast (hard), 10s = very slow (easy)"
        },
      ],
      buildPrompt: (p) => `Add moving traps that patrol back and forth in the maze, moving every ${p.patrol_seconds} seconds. They should move along straight paths (horizontal or vertical). When the player touches a moving trap, they lose a life.`,
      agent_context: "Traps that move back and forth in a pattern",
      // V17: 意图层面的语言维度，不是数字
      language_dimensions: [
        "难度意图（想让陷阱很难躲还是容易躲）",
        "移动节奏意图（想让陷阱快速来回还是缓慢移动）",
      ],
    },
    {
      id: "chasing-enemy",
      level: "medium",
      title: "Chasing Enemy",
      emoji: "👾",
      think: "An enemy that chases you is scary! Should players feel nervous the whole time, or just have to be careful sometimes?",
      params: [
        {
          key: "speed",
          label: "Enemy speed",
          default: 3,
          min: 1,
          max: 10,
          hint: "1 = slow, easy to escape · 5 = need to run · 10 = nearly impossible to outrun"
        },
      ],
      buildPrompt: (p) => `Add a monster enemy that chases the player through the maze at speed level ${p.speed} (1=very slow, 10=very fast). The monster should follow the player but can't go through walls. If the monster catches the player, they lose a life.`,
      agent_context: "An enemy that actively chases the player",
      // V17: 意图层面的语言维度
      language_dimensions: [
        "难度意图（想让敌人很难甩掉还是可以轻松逃脱）",
        "威胁感意图（想让玩家感到紧张还是有掌控感）",
      ],
    },
    {
      id: "multiple-levels",
      level: "medium",
      title: "Multiple Levels",
      emoji: "🗺️",
      think: "More levels means more challenge! How many levels feels right? How should each level get harder?",
      params: [
        {
          key: "levels",
          label: "Total levels",
          default: 3,
          min: 2,
          max: 5,
          hint: "Recommended 2–5. More than 5 may cause AI to generate incomplete levels."
        },
      ],
      buildPrompt: (p) => `Create ${p.levels} different maze levels. When the player reaches the exit, they advance to the next level. Each level should be slightly harder (more traps or more complex maze). Show "LEVEL 1", "LEVEL 2", etc. when each level starts. After completing all levels, show "YOU WIN!" with a celebration.`,
      agent_context: "Multiple maze levels with increasing difficulty",
      // V17: 意图层面的语言维度
      language_dimensions: [
        "规模意图（想要关卡多一点还是少一点）",
        "进阶方式意图（每关想要怎么变难——更多陷阱？更复杂路径？）",
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
      think: "What feature do you want to add? Think about what would make your maze more interesting.",
      buildPrompt: (paramValues, template) => {
        if (!template) return '';
        return template.replace(/\{(\w+)\}/g, (_, key) => paramValues[key] || `[${key}]`);
      },
      agent_context: "学生自己想的游戏功能，具体内容未知",
      language_dimensions: [],  // 动态生成，不预设
    },

    // Hard upgrades
    {
      id: "hidden-passage",
      level: "hard",
      title: "Hidden Passage",
      emoji: "🕵️",
      hint: "A secret shortcut that only you know about! Where should it be? What does it look like? How does the player find it? Think of a clever design.",
      prompt: null,
      agent_context: "A secret invisible shortcut through the maze",
      language_dimensions: [DIMENSION_LIBRARY.position, DIMENSION_LIBRARY.appearance, DIMENSION_LIBRARY.condition, DIMENSION_LIBRARY.result],
    },
    {
      id: "difficulty-curve",
      level: "hard",
      title: "Difficulty Curve",
      emoji: "⚖️",
      hint: "How should your maze get harder as the player progresses? More traps? Faster enemies? Less time? Design the difficulty progression yourself.",
      prompt: null,
      agent_context: "A designed progression of increasing difficulty",
      language_dimensions: [DIMENSION_LIBRARY.speed, DIMENSION_LIBRARY.quantity, DIMENSION_LIBRARY.trigger, DIMENSION_LIBRARY.condition],
    },
    {
      id: "signature-rule",
      level: "hard",
      title: "Signature Rule",
      emoji: "🌟",
      hint: "One rule that makes YOUR maze unique! Something no other maze has. What special mechanic will define your game?",
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
      hint: "What's your unique idea? Think of something no other maze has.",
      agent_context: "学生完全原创的游戏功能，没有任何方向限制",
      language_dimensions: [
        "触发条件（什么情况下发生）",
        "结果描述（发生了会怎样）",
        "外观描述（看起来怎样）",
      ],
    },
  ],
};

// Recovery items for Lesson 2
export const RECOVERY_2 = [
  {
    id: "no-maze",
    icon: "👻",
    title: "Claude only showed text, no maze",
    fix: 'Type this in the chat: "Please show this as a playable maze game in an Artifact panel."',
  },
  {
    id: "no-path",
    icon: "🚫",
    title: "No valid path to exit",
    fix: 'Type: "Make sure the maze always has a valid path from start to exit. Use recursive backtracking maze generation."',
  },
  {
    id: "stuck-in-wall",
    icon: "🧱",
    title: "Player spawns inside a wall",
    fix: 'Type: "Fix the player spawn position so they start in an open space at the entrance."',
  },
  {
    id: "collision-broken",
    icon: "💥",
    title: "Traps don't hurt the player",
    fix: 'Tell Claude exactly what\'s wrong. Example: "When I touch the fire trap, nothing happens. It should make me lose a life."',
  },
  {
    id: "controls-broken",
    icon: "🎮",
    title: "Arrow keys don't work",
    fix: 'Type: "Make the arrow keys work to move the player around the maze."',
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
    title: "Maze looks wrong (colors / size)",
    fix: 'In the same chat, type what you want changed. Example: "Make the walls look like ice blocks." Claude will update the game.',
  },
];

// Level configuration (same structure as Lesson 1)
export const LEVEL_CONFIG_2 = {
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

// Tabs for Lesson 2 (includes Rule Design and Debug Log)
import { Sparkles, Copy, AlertCircle, Rocket, Settings, Bug } from "lucide-react";

export const TABS_2 = [
  { id: "design", label: "Build", icon: Sparkles },
  { id: "rules", label: "Rules", icon: Settings },     // New in L2
  { id: "prompt", label: "Prompt", icon: Copy },
  { id: "debug", label: "Debug", icon: Bug },          // New in L2
  { id: "help", label: "Help", icon: AlertCircle },
  { id: "upgrade", label: "Upgrade", icon: Rocket },
];
