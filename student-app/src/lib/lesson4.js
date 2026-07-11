// Lesson 4: Tower Defense - Protect Your Base (Curriculum Class 2)
// V17: Language Dimension Library - Extension Port 4
import { DIMENSION_LIBRARY } from './lesson';

export const LESSON_4 = {
  id: "tower-defense-base-v1",
  title: "Tower Defense: Protect Your Base (Claude)",
  emoji: "🏰",

  agent: {
    demo_description: "A tower defense game where enemies march along a path toward the player's base while defensive towers attack them automatically; the player wins by surviving waves and protecting the base",
  },

  steps: [
    {
      id: "map",
      label: "Map theme?",
      options: [
        { value: "castle-road", label: "Castle Road", emoji: "🏰" },
        { value: "space-station", label: "Space Station", emoji: "🚀" },
        { value: "jungle-path", label: "Jungle Path", emoji: "🌴" },
        { value: "city-block", label: "City Block", emoji: "🏙️" },
        { value: "ice-canyon", label: "Ice Canyon", emoji: "🧊" },
        { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "enemy",
      label: "Who attacks your base?",
      options: [
        { value: "raiders", label: "Raiders", emoji: "⚔️" },
        { value: "robots", label: "Robots", emoji: "🤖" },
        { value: "aliens", label: "Aliens", emoji: "👽" },
        { value: "slimes", label: "Slimes", emoji: "🟢" },
        { value: "shadow-knights", label: "Shadow Knights", emoji: "🛡️" },
        { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "tower",
      label: "Main tower type?",
      options: [
        { value: "arrow-tower", label: "Arrow Tower", emoji: "🏹" },
        { value: "laser-tower", label: "Laser Tower", emoji: "🔦" },
        { value: "cannon-tower", label: "Cannon Tower", emoji: "💣" },
        { value: "ice-tower", label: "Ice Tower", emoji: "❄️" },
        { value: "magic-tower", label: "Magic Tower", emoji: "✨" },
        { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "base",
      label: "What are you protecting?",
      options: [
        { value: "crystal-core", label: "Crystal Core", emoji: "💎" },
        { value: "castle-gate", label: "Castle Gate", emoji: "🚪" },
        { value: "command-center", label: "Command Center", emoji: "📡" },
        { value: "treasure-vault", label: "Treasure Vault", emoji: "🪙" },
        { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "style",
      label: "Visual style?",
      options: [
        { value: "bright-cartoon", label: "Bright Cartoon", emoji: "🎨" },
        { value: "dark-fantasy", label: "Dark Fantasy", emoji: "🌙" },
        { value: "neon-sci-fi", label: "Neon Sci-Fi", emoji: "💡" },
        { value: "cute-mini", label: "Cute Mini", emoji: "🧸" },
        { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
      ],
    },
  ],

  ruleDesign: {
    enabled: true,
    fields: [
      {
        id: "path",
        label: "Enemy Path Rule",
        question: "How do enemies move toward your base?",
        emoji: "🛣️",
        options: [
          { value: "single-winding-path", label: "One winding path" },
          { value: "two-lanes", label: "Two attack lanes" },
          { value: "zigzag-path", label: "A zigzag path" },
        ],
        allowCustom: true,
        placeholder: "e.g. 'enemies split into three paths and meet near the base'",
      },
      {
        id: "towerPlacement",
        label: "Tower Placement Rule",
        question: "Where can players place towers?",
        emoji: "📍",
        options: [
          { value: "fixed-spots", label: "Only on fixed build spots" },
          { value: "beside-path", label: "Anywhere beside the path" },
          { value: "drag-and-drop", label: "Drag towers onto open ground" },
        ],
        allowCustom: true,
        placeholder: "e.g. 'only on glowing circles next to the path'",
      },
      {
        id: "baseHealth",
        label: "Base Health Rule",
        question: "How many enemies can reach the base before game over?",
        emoji: "❤️",
        options: [
          { value: "10-health", label: "Base has 10 health" },
          { value: "20-health", label: "Base has 20 health" },
          { value: "3-leaks", label: "Only 3 enemies can get through" },
        ],
        allowCustom: true,
        placeholder: "e.g. 'boss enemies remove 3 health, normal enemies remove 1'",
      },
      {
        id: "economy",
        label: "Money Rule",
        question: "How does the player earn money for towers?",
        emoji: "💰",
        options: [
          { value: "coins-per-enemy", label: "Earn coins for every defeated enemy" },
          { value: "wave-bonus", label: "Earn bonus coins after each wave" },
          { value: "slow-income", label: "Gain coins slowly over time" },
        ],
        allowCustom: true,
        placeholder: "e.g. 'combo bonuses give extra coins when no enemies reach the base'",
      },
    ],
  },

  debugLog: {
    enabled: true,
    breakTypes: [
      {
        id: "enemy-path",
        label: "Path Problem",
        emoji: "🛣️",
        description: "Enemies do not follow the path or get stuck",
        fixPrompt: "Fix the enemy pathing so enemies follow the visible path from the entrance to the base without getting stuck or walking off the path.",
      },
      {
        id: "tower-attack",
        label: "Tower Problem",
        emoji: "🏹",
        description: "Towers do not attack enemies",
        fixPrompt: "Fix the towers so they automatically detect nearby enemies, aim at them, and attack until the enemies are defeated.",
      },
      {
        id: "base-damage",
        label: "Base Damage Problem",
        emoji: "❤️",
        description: "Enemies reach the base but nothing happens",
        fixPrompt: "Fix base damage so when an enemy reaches the base, the base loses health and the enemy disappears. Show base health clearly on screen.",
      },
      {
        id: "money",
        label: "Money Problem",
        emoji: "💰",
        description: "Coins do not update or towers cannot be bought",
        fixPrompt: "Fix the money system so defeating enemies gives coins and buying a tower subtracts the correct cost. Disable buying if the player cannot afford it.",
      },
      {
        id: "waves",
        label: "Wave Problem",
        emoji: "🌊",
        description: "Waves do not start, end, or get harder",
        fixPrompt: "Fix the wave system so enemies spawn in clear waves. Show the current wave number and make later waves harder.",
      },
      {
        id: "other",
        label: "Something Else",
        emoji: "❓",
        description: "Other problem - describe it yourself",
        fixPrompt: null,
      },
    ],
  },

  ownIdeaMaxLength: 60,
  gameNameMaxLength: 30,

  defaultGameName: (choices, ownInputs) => {
    const baseVal = choices.base;
    if (!baseVal) return "My Tower Defense";
    const resolved =
      baseVal === "__own__"
        ? (ownInputs.base || "").trim()
        : LESSON_4.steps[3].options.find((o) => o.value === baseVal)?.label;
    if (!resolved) return "My Tower Defense";
    return `Protect the ${resolved}`;
  },

  buildPrompt: (choices, ownInputs = {}, gameName = "", rules = {}) => {
    const resolve = (id) => {
      const val = choices[id];
      if (val === "__own__") return (ownInputs[id] || "").trim();
      return val?.replace(/-/g, " ") || "";
    };

    const map = resolve("map") || "castle road";
    const enemy = resolve("enemy") || "raiders";
    const tower = resolve("tower") || "arrow tower";
    const base = resolve("base") || "crystal core";
    const style = resolve("style") || "bright cartoon";
    const title = (gameName || "").trim() || LESSON_4.defaultGameName(choices, ownInputs);

    const pathRule = rules.path || "one winding path";
    const towerPlacementRule = rules.towerPlacement || "fixed build spots";
    const baseHealthRule = rules.baseHealth || "base has 10 health";
    const economyRule = rules.economy || "earn coins for every defeated enemy";

    return `Build a playable tower defense game called "${title}" as an Artifact.

MY GAME DESIGN:
- Map theme: ${map}
- Enemies: ${enemy}
- Main tower type: ${tower}
- Base to protect: ${base}
- Visual style: ${style}

MY GAME RULES:
- Enemy path: ${pathRule}
- Tower placement: ${towerPlacementRule}
- Base health: ${baseHealthRule}
- Money system: ${economyRule}

MAKE SURE:
- Enemies spawn at the start of the path and move toward the base
- The player can place or buy ${tower}s near the path
- Towers automatically attack enemies in range
- Show base health, coins, wave number, and score at the top of the screen
- Later waves should have more enemies or stronger enemies
- The player wins by surviving all waves and loses if the base health reaches 0

Make it playable in an Artifact panel.`;
  },

  upgrades: [
    {
      id: "starting-coins",
      level: "easy",
      title: "Starting Coins",
      emoji: "💰",
      fillParam: {
        key: "coins",
        label: "Start with",
        suffix: "coins",
        default: 100,
        min: 20,
        max: 500,
        hint: "50 = careful choices · 200+ = build fast",
      },
      buildPrompt: (coins) => `Start the player with ${coins} coins. Show the coin amount at the top. Buying towers costs coins, and the player cannot buy a tower if they do not have enough coins.`,
      agent_context: "Starting money for buying defensive towers",
      language_dimensions: [DIMENSION_LIBRARY.quantity, DIMENSION_LIBRARY.condition, DIMENSION_LIBRARY.result],
    },
    {
      id: "base-health",
      level: "easy",
      title: "Base Health",
      emoji: "❤️",
      fillParam: {
        key: "health",
        label: "Give the base",
        suffix: "health",
        default: 10,
        min: 1,
        max: 50,
        hint: "3 = very hard · 20+ = forgiving",
      },
      buildPrompt: (health) => `Give the base ${health} health. Each normal enemy that reaches the base removes 1 health. Show the base health clearly as hearts or a health bar.`,
      agent_context: "How many enemies the base can survive",
      language_dimensions: [DIMENSION_LIBRARY.quantity, DIMENSION_LIBRARY.result, DIMENSION_LIBRARY.appearance],
    },
    {
      id: "wave-count",
      level: "easy",
      title: "Wave Count",
      emoji: "🌊",
      fillParam: {
        key: "waves",
        label: "Make",
        suffix: "enemy waves",
        default: 5,
        min: 1,
        max: 20,
        hint: "3 = short game · 10+ = longer defense",
      },
      buildPrompt: (waves) => `Make the game have ${waves} enemy waves. Show the current wave number. After the final wave is defeated, show a victory screen.`,
      agent_context: "Number of enemy waves before victory",
      language_dimensions: [DIMENSION_LIBRARY.quantity, DIMENSION_LIBRARY.condition, DIMENSION_LIBRARY.result],
    },
    {
      id: "__own__",
      level: "easy",
      title: "My Own Idea",
      emoji: "✏️",
      isOwn: true,
      buildPrompt: (text) =>
        `Please add this to my tower defense game: ${text.trim()}. Make it work well with the existing gameplay and keep the game playable.`,
      agent_context: "Custom idea from the student",
      language_dimensions: [],
    },

    {
      id: "tower-range",
      level: "medium",
      title: "Tower Range",
      emoji: "🎯",
      think: "A tower with a huge range can hit everything, but a tiny range might feel useless. How far should each tower reach so the game is fair?",
      params: [
        {
          key: "range_tiles",
          label: "Towers can hit enemies within ___ tiles",
          default: 3,
          min: 1,
          max: 8,
          hint: "2 = close range · 5+ = covers a big area",
        },
      ],
      buildPrompt: (p) => `Make each tower attack enemies within ${p.range_tiles} tiles of the tower. Draw a faint circle around the tower when selected so the player can see its range.`,
      agent_context: "How far towers can reach when targeting enemies",
      language_dimensions: [
        "范围意图（想让塔覆盖很大区域还是只防守附近）",
        "公平性意图（想让玩家需要思考摆放位置还是轻松覆盖全图）",
      ],
    },
    {
      id: "enemy-speed",
      level: "medium",
      title: "Enemy Speed",
      emoji: "🏃",
      think: "Fast enemies create pressure, but if they are too fast the towers cannot stop them. What speed makes your defense exciting but possible?",
      params: [
        {
          key: "speed_multiplier",
          label: "Enemies move ___ × normal speed",
          default: 1,
          min: 1,
          max: 5,
          hint: "1x = normal · 3x+ = dangerous rush",
        },
      ],
      buildPrompt: (p) => `Make enemies move at ${p.speed_multiplier}× normal speed. Keep the path readable and make sure towers still have a fair chance to attack before enemies reach the base.`,
      agent_context: "How quickly enemies travel along the path",
      language_dimensions: [
        "难度意图（想让敌人压迫感强还是容易拦住）",
        "节奏意图（想让游戏紧张快速还是慢慢思考）",
      ],
    },
    {
      id: "boss-wave",
      level: "medium",
      title: "Boss Wave",
      emoji: "👑",
      think: "A boss should feel special. Should it have lots of health, move slowly, summon helpers, or damage the base more?",
      params: [
        {
          key: "boss_health",
          label: "Boss has ___ health",
          default: 20,
          min: 5,
          max: 100,
          hint: "10 = mini boss · 50+ = serious challenge",
        },
      ],
      buildPrompt: (p) => `Add a boss enemy on the final wave with ${p.boss_health} health. The boss should be bigger than normal enemies, move slower, and remove 3 base health if it reaches the base.`,
      agent_context: "A stronger final enemy that changes the end of the game",
      language_dimensions: [
        "强度意图（想让Boss只是小挑战还是最终大考验）",
        "表现意图（Boss如何看起来和普通敌人不同）",
      ],
    },
    {
      id: "__own_medium__",
      level: "medium",
      title: "My Own Idea",
      emoji: "✏️",
      isOwn: true,
      dynamicParams: true,
      params: [],
      think: "What feature do you want to add? Think about what would make your tower defense game more strategic.",
      buildPrompt: (paramValues, template) => {
        if (!template) return '';
        return template.replace(/\{(\w+)\}/g, (_, key) => paramValues[key] || `[${key}]`);
      },
      agent_context: "学生自己想的塔防功能，具体内容未知",
      language_dimensions: [],
    },

    {
      id: "tower-upgrades",
      level: "hard",
      title: "Tower Upgrades",
      emoji: "⬆️",
      hint: "How can a tower improve? More damage, faster shooting, bigger range, special effects? Design the upgrade system yourself.",
      prompt: null,
      agent_context: "A designed system for improving towers during the game",
      language_dimensions: [DIMENSION_LIBRARY.condition, DIMENSION_LIBRARY.result, DIMENSION_LIBRARY.quantity, DIMENSION_LIBRARY.appearance],
    },
    {
      id: "enemy-abilities",
      level: "hard",
      title: "Enemy Abilities",
      emoji: "🧠",
      hint: "What special enemies force the player to change strategy? Shielded enemies, fast enemies, flying enemies, or enemies that split?",
      prompt: null,
      agent_context: "Different enemy types with special behaviors",
      language_dimensions: [DIMENSION_LIBRARY.condition, DIMENSION_LIBRARY.trigger, DIMENSION_LIBRARY.result, DIMENSION_LIBRARY.appearance],
    },
    {
      id: "signature-tower",
      level: "hard",
      title: "Signature Tower",
      emoji: "🌟",
      hint: "Create one tower only your game has. What does it do? When does it fire? What does it look like?",
      prompt: null,
      agent_context: "A unique tower mechanic that defines the game",
      language_dimensions: [DIMENSION_LIBRARY.trigger, DIMENSION_LIBRARY.result, DIMENSION_LIBRARY.appearance],
    },
    {
      id: "__own_hard__",
      level: "hard",
      title: "My Own Idea",
      emoji: "✏️",
      isOwn: true,
      prompt: null,
      hint: "What's your unique idea? Think of something no other tower defense game has.",
      agent_context: "学生完全原创的游戏功能，没有任何方向限制",
      language_dimensions: [
        "触发条件（什么情况下发生）",
        "结果描述（发生了会怎样）",
        "外观描述（看起来怎样）",
      ],
    },
  ],
};

export const RECOVERY_4 = [
  {
    id: "no-game",
    icon: "👻",
    title: "Claude only showed text, no game",
    fix: 'Type this in the chat: "Please show this as a playable tower defense game in an Artifact panel."',
  },
  {
    id: "cant-place",
    icon: "📍",
    title: "I cannot place towers",
    fix: 'Type: "Make it possible to place towers on open build spots beside the path by clicking or dragging."',
  },
  {
    id: "towers-dont-shoot",
    icon: "🏹",
    title: "Towers do not shoot",
    fix: 'Type: "Fix the towers so they automatically attack enemies that come within range."',
  },
  {
    id: "enemies-stuck",
    icon: "🛣️",
    title: "Enemies get stuck or leave the path",
    fix: 'Type: "Fix enemy movement so they follow the visible path all the way to the base."',
  },
  {
    id: "no-base-damage",
    icon: "❤️",
    title: "Enemies reach the base but nothing happens",
    fix: 'Tell Claude exactly what is wrong. Example: "When an enemy reaches the base, it should remove 1 base health and disappear."',
  },
  {
    id: "money-broken",
    icon: "💰",
    title: "Coins are not working",
    fix: 'Type: "Fix the coin system so defeating enemies gives coins and buying towers costs coins."',
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
    fix: 'In the same chat, type what you want changed. Example: "Make the towers bigger and the path easier to see." Claude will update the game.',
  },
];

export const LEVEL_CONFIG_4 = {
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

import { Sparkles, Copy, AlertCircle, Rocket, Settings, Bug } from "lucide-react";

export const TABS_4 = [
  { id: "design", label: "Build", icon: Sparkles },
  { id: "rules", label: "Rules", icon: Settings },
  { id: "prompt", label: "Prompt", icon: Copy },
  { id: "debug", label: "Debug", icon: Bug },
  { id: "help", label: "Help", icon: AlertCircle },
  { id: "upgrade", label: "Upgrade", icon: Rocket },
];
