// Lessons 6-10: Roblox Tycoon Course (Curriculum Classes 4-8)
// V17: Language Dimension Library - Extension Port 6
import { DIMENSION_LIBRARY } from './lesson';
import { Sparkles, Copy, AlertCircle, Rocket, Settings, Bug } from "lucide-react";

const baseSteps = [
  {
    id: "theme",
    label: "Tycoon theme?",
    options: [
      { value: "restaurant", label: "Restaurant", emoji: "🍽️" },
      { value: "space-base", label: "Space Base", emoji: "🚀" },
      { value: "theme-park", label: "Theme Park", emoji: "🎢" },
      { value: "factory", label: "Factory", emoji: "🏭" },
      { value: "city-business", label: "City Business", emoji: "🏙️" },
      { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
    ],
  },
  {
    id: "incomeSource",
    label: "How does it earn cash?",
    options: [
      { value: "droppers", label: "Droppers", emoji: "📦" },
      { value: "machines", label: "Machines", emoji: "⚙️" },
      { value: "customers", label: "Customers", emoji: "🧍" },
      { value: "resource-mining", label: "Resource Mining", emoji: "⛏️" },
      { value: "delivery-orders", label: "Delivery Orders", emoji: "🚚" },
      { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
    ],
  },
  {
    id: "upgradePath",
    label: "Main upgrade path?",
    options: [
      { value: "more-income", label: "More Income", emoji: "💰" },
      { value: "bigger-building", label: "Bigger Building", emoji: "🏢" },
      { value: "new-areas", label: "New Areas", emoji: "🗺️" },
      { value: "special-features", label: "Special Features", emoji: "🌟" },
      { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
    ],
  },
  {
    id: "playerGoal",
    label: "What is the player working toward?",
    options: [
      { value: "complete-base", label: "Complete Base", emoji: "🏁" },
      { value: "richest-player", label: "Richest Player", emoji: "👑" },
      { value: "unlock-final-area", label: "Unlock Final Area", emoji: "🔓" },
      { value: "publish-and-share", label: "Publish and Share", emoji: "🌐" },
      { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
    ],
  },
  {
    id: "style",
    label: "Visual style?",
    options: [
      { value: "bright-cartoon", label: "Bright Cartoon", emoji: "🎨" },
      { value: "realistic", label: "Realistic", emoji: "🏗️" },
      { value: "neon", label: "Neon", emoji: "💡" },
      { value: "cute-mini", label: "Cute Mini", emoji: "🧸" },
      { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
    ],
  },
];

const ruleDesign = {
  enabled: true,
  fields: [
    {
      id: "cashRule",
      label: "Cash Rule",
      question: "How should the player earn Cash?",
      emoji: "💰",
      options: [
        { value: "income-every-second", label: "Income every second" },
        { value: "collect-from-machine", label: "Collect from machines" },
        { value: "cash-from-customers", label: "Cash from customers" },
      ],
      allowCustom: true,
      placeholder: "e.g. 'each machine adds Cash every 3 seconds'",
    },
    {
      id: "purchaseRule",
      label: "Purchase Rule",
      question: "What happens when a player buys an upgrade?",
      emoji: "🛒",
      options: [
        { value: "button-disappears", label: "Button disappears and object appears" },
        { value: "next-button-unlocks", label: "Next button unlocks" },
        { value: "cost-increases", label: "Cost increases each time" },
      ],
      allowCustom: true,
      placeholder: "e.g. 'buying a wall reveals the roof button'",
    },
    {
      id: "progressionRule",
      label: "Progression Rule",
      question: "How should the tycoon grow over time?",
      emoji: "📈",
      options: [
        { value: "linear-upgrade-path", label: "One clear upgrade path" },
        { value: "multiple-branches", label: "Multiple upgrade branches" },
        { value: "area-unlocks", label: "Unlock new areas" },
      ],
      allowCustom: true,
      placeholder: "e.g. 'machines first, then decorations, then VIP area'",
    },
    {
      id: "testRule",
      label: "Testing Rule",
      question: "What should be tested before the class ends?",
      emoji: "🧪",
      options: [
        { value: "cash-and-one-button", label: "Cash counter and one button" },
        { value: "full-upgrade-loop", label: "Full upgrade loop" },
        { value: "published-game", label: "Published game link works" },
      ],
      allowCustom: true,
      placeholder: "e.g. 'a new player can earn Cash and buy 3 upgrades with no help'",
    },
  ],
};

const debugLog = {
  enabled: true,
  breakTypes: [
    {
      id: "leaderstats",
      label: "Cash Counter Problem",
      emoji: "💰",
      description: "Cash does not show or does not save in leaderstats",
      fixPrompt: "Fix the Roblox leaderstats script so each player gets a Cash IntValue when they join. Tell me exactly where to put the Script in ServerScriptService.",
    },
    {
      id: "button",
      label: "Buy Button Problem",
      emoji: "🛒",
      description: "The purchase button does not work or does not subtract Cash",
      fixPrompt: "Fix the buy button script so touching or clicking the button checks the player's Cash, subtracts the cost, unlocks the object, and prevents buying twice.",
    },
    {
      id: "income",
      label: "Income Problem",
      emoji: "⚙️",
      description: "Machines do not generate money",
      fixPrompt: "Fix the income system so the machine adds Cash to the correct player on a timer. Include a simple Roblox Lua script and setup steps.",
    },
    {
      id: "unlock",
      label: "Unlock Problem",
      emoji: "🔓",
      description: "New objects or areas do not appear after purchase",
      fixPrompt: "Fix the unlock system so purchased objects become visible and usable only after the player buys the correct button.",
    },
    {
      id: "publish",
      label: "Publishing Problem",
      emoji: "🌐",
      description: "The game cannot be published or other people cannot play it",
      fixPrompt: "Walk me through publishing this Roblox experience, making it public, testing the live version, and updating it after a fix.",
    },
    {
      id: "other",
      label: "Something Else",
      emoji: "❓",
      description: "Other problem - describe it yourself",
      fixPrompt: null,
    },
  ],
};

const recovery = [
  {
    id: "where-script",
    icon: "📜",
    title: "I do not know where the script goes",
    fix: 'Ask Claude: "Tell me exactly which Roblox Studio object this Script or LocalScript goes inside."',
  },
  {
    id: "cash-missing",
    icon: "💰",
    title: "Cash does not show",
    fix: 'Ask Claude: "Fix my leaderstats Cash script and explain where to put it in ServerScriptService."',
  },
  {
    id: "button-broken",
    icon: "🛒",
    title: "Buy button does not work",
    fix: 'Ask Claude: "Fix my purchase button so it checks Cash, subtracts the cost, and unlocks the object only once."',
  },
  {
    id: "script-error",
    icon: "🐛",
    title: "There is a red error in Output",
    fix: 'Copy the exact red error from Roblox Studio Output and ask Claude: "What does this error mean and how do I fix it?"',
  },
  {
    id: "too-complicated",
    icon: "🧩",
    title: "Claude gave too many steps",
    fix: 'Ask Claude: "Give me only the next 3 steps, one at a time, for Roblox Studio."',
  },
  {
    id: "publish-help",
    icon: "🌐",
    title: "I cannot publish",
    fix: 'Ask Claude: "Walk me through publishing my Roblox game and making it public, step by step."',
  },
  {
    id: "limit",
    icon: "🛑",
    title: 'Claude says "message limit reached"',
    fix: "Raise your hand. The teacher will switch you to a backup account.",
  },
  {
    id: "looks-plain",
    icon: "🎨",
    title: "My tycoon looks too plain",
    fix: 'Ask Claude: "Suggest 5 visual polish ideas for my Roblox tycoon and give me simple build steps."',
  },
];

const levelConfig = {
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

const tabs = [
  { id: "design", label: "Build", icon: Sparkles },
  { id: "rules", label: "Rules", icon: Settings },
  { id: "prompt", label: "Prompt", icon: Copy },
  { id: "debug", label: "Debug", icon: Bug },
  { id: "help", label: "Help", icon: AlertCircle },
  { id: "upgrade", label: "Upgrade", icon: Rocket },
];

const commonEasyOwnIdea = {
  id: "__own__",
  level: "easy",
  title: "My Own Idea",
  emoji: "✏️",
  isOwn: true,
  buildPrompt: (text) =>
    `Please add this to my Roblox tycoon project: ${text.trim()}. Give me Roblox Studio steps and Lua code if needed.`,
  agent_context: "Custom idea from the student",
  language_dimensions: [],
};

const commonMediumOwnIdea = {
  id: "__own_medium__",
  level: "medium",
  title: "My Own Idea",
  emoji: "✏️",
  isOwn: true,
  dynamicParams: true,
  params: [],
  think: "What feature do you want to add? Think about what makes your tycoon more fun, clearer, or more complete.",
  buildPrompt: (paramValues, template) => {
    if (!template) return '';
    return template.replace(/\{(\w+)\}/g, (_, key) => paramValues[key] || `[${key}]`);
  },
  agent_context: "学生自己想的Roblox tycoon功能，具体内容未知",
  language_dimensions: [],
};

function createTycoonLesson({
  id,
  title,
  classLabel,
  classGoal,
  topics,
  endGoal,
  easyUpgrades,
  mediumUpgrades,
  hardUpgrades,
}) {
  const lesson = {
    id,
    title,
    emoji: "🧱",
    agent: {
      demo_description: `A Roblox Studio tycoon project: ${classGoal}`,
    },
    steps: baseSteps,
    ruleDesign,
    debugLog,
    ownIdeaMaxLength: 60,
    gameNameMaxLength: 30,
    defaultGameName: (choices, ownInputs) => {
      const themeVal = choices.theme;
      if (!themeVal) return "My Roblox Tycoon";
      const resolved =
        themeVal === "__own__"
          ? (ownInputs.theme || "").trim()
          : baseSteps[0].options.find((o) => o.value === themeVal)?.label;
      if (!resolved) return "My Roblox Tycoon";
      return `${resolved} Tycoon`;
    },
    buildPrompt: (choices, ownInputs = {}, gameName = "", rules = {}) => {
      const resolve = (key) => {
        const val = choices[key];
        if (val === "__own__") return (ownInputs[key] || "").trim();
        return val?.replace(/-/g, " ") || "";
      };

      const theme = resolve("theme") || "restaurant";
      const incomeSource = resolve("incomeSource") || "droppers";
      const upgradePath = resolve("upgradePath") || "more income";
      const playerGoal = resolve("playerGoal") || "complete base";
      const style = resolve("style") || "bright cartoon";
      const titleText = (gameName || "").trim() || lesson.defaultGameName(choices, ownInputs);

      const cashRule = rules.cashRule || "income every second";
      const purchaseRule = rules.purchaseRule || "button disappears and object appears";
      const progressionRule = rules.progressionRule || "one clear upgrade path";
      const testRule = rules.testRule || "cash counter and one button";

      return `Help me build ${classLabel} of my Roblox Studio tycoon game called "${titleText}".

COURSE GOAL:
By the end of the course, I should have a complete, tested, and published Roblox tycoon game that other people can play.

THIS CLASS FOCUS:
${classGoal}

MY TYCOON DESIGN:
- Theme: ${theme}
- Income source: ${incomeSource}
- Main upgrade path: ${upgradePath}
- Player goal: ${playerGoal}
- Visual style: ${style}

MY GAME RULES:
- Cash rule: ${cashRule}
- Purchase rule: ${purchaseRule}
- Progression rule: ${progressionRule}
- Testing rule: ${testRule}

TOPICS TO INCLUDE:
${topics.map((topic) => `- ${topic}`).join("\n")}

END-OF-CLASS GOAL:
${endGoal}

Please give me:
1. A simple Roblox Studio build checklist
2. The exact Scripts or LocalScripts I need
3. Where each script goes in Roblox Studio
4. What objects, parts, buttons, and folders I need to create
5. A quick test checklist so I know it works`;
    },
    upgrades: [
      ...easyUpgrades,
      commonEasyOwnIdea,
      ...mediumUpgrades,
      commonMediumOwnIdea,
      ...hardUpgrades,
      {
        id: "__own_hard__",
        level: "hard",
        title: "My Own Idea",
        emoji: "✏️",
        isOwn: true,
        prompt: null,
        hint: "What's your unique Roblox tycoon idea? Describe what triggers it, what happens, and how players see it.",
        agent_context: "学生完全原创的Roblox tycoon功能，没有任何方向限制",
        language_dimensions: [
          "触发条件（什么情况下发生）",
          "结果描述（发生了会怎样）",
          "外观描述（看起来怎样）",
        ],
      },
    ],
  };

  return lesson;
}

export const LESSON_6 = createTycoonLesson({
  id: "roblox-tycoon-planning-core-v1",
  title: "Roblox Tycoon Class 4: Planning and Core Systems",
  classLabel: "Class 4: Planning and Core Systems",
  classGoal: "Plan the tycoon theme and progression, create leaderstats Cash, make a buy button, and build the first income object.",
  topics: [
    "Introduction to Roblox Studio",
    "What makes a good tycoon game",
    "Game planning and brainstorming",
    "Creating leaderstats Cash",
    "Making buy buttons",
    "Creating a basic income system",
  ],
  endGoal: "The game should have a functioning Cash system and at least one purchasable upgrade.",
  easyUpgrades: [
    {
      id: "starting-cash",
      level: "easy",
      title: "Starting Cash",
      emoji: "💰",
      fillParam: { key: "cash", label: "Start players with", suffix: "Cash", default: 0, min: 0, max: 500, hint: "0 = classic tycoon · 100+ = faster start" },
      buildPrompt: (cash) => `Set up leaderstats so each player starts with ${cash} Cash. Give me the exact Script for ServerScriptService.`,
      agent_context: "Starting Cash value in leaderstats",
      language_dimensions: [DIMENSION_LIBRARY.quantity, DIMENSION_LIBRARY.condition, DIMENSION_LIBRARY.result],
    },
    {
      id: "first-button-cost",
      level: "easy",
      title: "First Button Cost",
      emoji: "🛒",
      fillParam: { key: "cost", label: "First upgrade costs", suffix: "Cash", default: 50, min: 0, max: 1000, hint: "25 = quick · 200+ = slower start" },
      buildPrompt: (cost) => `Make my first buy button cost ${cost} Cash. The button should subtract Cash, unlock one object, and disappear after purchase.`,
      agent_context: "Cost and behavior of the first purchase button",
      language_dimensions: [DIMENSION_LIBRARY.quantity, DIMENSION_LIBRARY.trigger, DIMENSION_LIBRARY.result],
    },
  ],
  mediumUpgrades: [
    {
      id: "income-rate",
      level: "medium",
      title: "Income Rate",
      emoji: "⚙️",
      think: "If income is too fast, upgrades feel free. If it is too slow, players get bored. What pace fits your tycoon?",
      params: [{ key: "cash_per_second", label: "Machine earns ___ Cash per second", default: 5, min: 1, max: 100, hint: "2 = slow · 20+ = fast" }],
      buildPrompt: (p) => `Make the first machine earn ${p.cash_per_second} Cash per second for its owner. Include the Roblox Lua script and setup steps.`,
      agent_context: "Cash earned per second by the first machine",
      language_dimensions: ["节奏意图（想让玩家等待还是快速购买）", "平衡意图（想让第一个机器强还是弱）"],
    },
  ],
  hardUpgrades: [
    {
      id: "progression-plan",
      level: "hard",
      title: "Progression Plan",
      emoji: "📋",
      hint: "Design the full upgrade path: what the player buys first, what unlocks next, and why each purchase feels exciting.",
      prompt: null,
      agent_context: "A complete purchase and progression plan for the tycoon",
      language_dimensions: [DIMENSION_LIBRARY.condition, DIMENSION_LIBRARY.result, DIMENSION_LIBRARY.quantity],
    },
  ],
});

export const LESSON_7 = createTycoonLesson({
  id: "roblox-tycoon-expanding-v1",
  title: "Roblox Tycoon Class 5: Expanding the Tycoon",
  classLabel: "Class 5: Expanding the Tycoon",
  classGoal: "Add more purchasable upgrades, money-generating machines, new areas, map improvements, and balanced costs.",
  topics: [
    "Building additional purchase buttons",
    "Unlocking new areas",
    "Organizing models and scripts",
    "Improving the map",
    "Balancing upgrade costs",
  ],
  endGoal: "Players should be able to start the game, earn money, and continuously expand their tycoon.",
  easyUpgrades: [
    {
      id: "upgrade-buttons",
      level: "easy",
      title: "More Buttons",
      emoji: "🛒",
      fillParam: { key: "buttons", label: "Add", suffix: "new buy buttons", default: 5, min: 1, max: 20, hint: "3 = small expansion · 10+ = big class build" },
      buildPrompt: (buttons) => `Add ${buttons} new Roblox tycoon buy buttons. Each button should have a cost, unlock one object, and disappear after purchase.`,
      agent_context: "Number of new purchasable upgrades",
      language_dimensions: [DIMENSION_LIBRARY.quantity, DIMENSION_LIBRARY.condition, DIMENSION_LIBRARY.result],
    },
    {
      id: "machine-count",
      level: "easy",
      title: "More Machines",
      emoji: "⚙️",
      fillParam: { key: "machines", label: "Add", suffix: "money machines", default: 3, min: 1, max: 12, hint: "2 = simple · 6+ = strong economy" },
      buildPrompt: (machines) => `Add ${machines} more money-generating machines to my Roblox tycoon. Make each one cost more and earn more than the previous one.`,
      agent_context: "Number of additional income machines",
      language_dimensions: [DIMENSION_LIBRARY.quantity, DIMENSION_LIBRARY.result, DIMENSION_LIBRARY.condition],
    },
  ],
  mediumUpgrades: [
    {
      id: "cost-scaling",
      level: "medium",
      title: "Cost Scaling",
      emoji: "📈",
      think: "Costs should rise enough to feel like progress, but not so much that players stop. How steep should the economy be?",
      params: [{ key: "multiplier", label: "Each upgrade costs ___ × more", default: 2, min: 1, max: 5, hint: "1 = flat · 3+ = steep growth" }],
      buildPrompt: (p) => `Balance my tycoon so each new upgrade costs about ${p.multiplier}× more than the previous one, and income also improves enough to keep progress fun.`,
      agent_context: "Economy balancing across multiple upgrades",
      language_dimensions: ["平衡意图（想让价格轻松还是有挑战）", "成长意图（每次升级应该强多少）"],
    },
  ],
  hardUpgrades: [
    {
      id: "area-unlock-system",
      level: "hard",
      title: "Area Unlock System",
      emoji: "🗺️",
      hint: "Design a new area that only appears after enough progress. What unlocks it? What new machines or decorations are inside?",
      prompt: null,
      agent_context: "A multi-area progression system for the tycoon",
      language_dimensions: [DIMENSION_LIBRARY.condition, DIMENSION_LIBRARY.position, DIMENSION_LIBRARY.result],
    },
  ],
});

export const LESSON_8 = createTycoonLesson({
  id: "roblox-tycoon-completing-v1",
  title: "Roblox Tycoon Class 6: Completing the Game",
  classLabel: "Class 6: Completing the Game",
  classGoal: "Finish all major gameplay features, playtest, fix bugs, improve the player experience, and complete the upgrade path.",
  topics: [
    "Finishing remaining upgrades",
    "Bug fixing",
    "Playtesting",
    "Receiving feedback",
    "Making gameplay smoother",
  ],
  endGoal: "Students should have a fully playable tycoon game with a complete upgrade path, finished map, and balanced economy.",
  easyUpgrades: [
    {
      id: "test-players",
      level: "easy",
      title: "Playtest Plan",
      emoji: "🧪",
      fillParam: { key: "testers", label: "Test with", suffix: "players", default: 3, min: 1, max: 12, hint: "2 = quick check · 6+ = better feedback" },
      buildPrompt: (testers) => `Create a Roblox playtest checklist for ${testers} testers. Include fun factor, difficulty, bugs, visual appearance, and improvement ideas.`,
      agent_context: "Number of playtesters and feedback process",
      language_dimensions: [DIMENSION_LIBRARY.quantity, DIMENSION_LIBRARY.condition, DIMENSION_LIBRARY.result],
    },
    {
      id: "bug-list",
      level: "easy",
      title: "Bug Fix List",
      emoji: "🐛",
      fillParam: { key: "bugs", label: "Track", suffix: "bugs to fix", default: 5, min: 1, max: 20, hint: "3 = focused · 10+ = detailed cleanup" },
      buildPrompt: (bugs) => `Make me a bug-fix tracker for my Roblox tycoon with ${bugs} slots. Include what broke, where it happens, how to reproduce it, and whether it is fixed.`,
      agent_context: "Bug tracking and debugging workflow",
      language_dimensions: [DIMENSION_LIBRARY.quantity, DIMENSION_LIBRARY.condition, DIMENSION_LIBRARY.result],
    },
  ],
  mediumUpgrades: [
    {
      id: "economy-balance",
      level: "medium",
      title: "Economy Balance",
      emoji: "⚖️",
      think: "A completed tycoon needs a smooth economy. How long should it take to buy the next upgrade?",
      params: [{ key: "minutes", label: "Full tycoon should take about ___ minutes", default: 10, min: 3, max: 45, hint: "5 = short demo · 20+ = longer session" }],
      buildPrompt: (p) => `Help me balance my Roblox tycoon so a new player can complete the main upgrade path in about ${p.minutes} minutes. Suggest costs and income rates.`,
      agent_context: "Target time to complete the tycoon",
      language_dimensions: ["节奏意图（想让完整流程多长）", "难度意图（想让玩家轻松完成还是需要努力）"],
    },
  ],
  hardUpgrades: [
    {
      id: "feedback-revision",
      level: "hard",
      title: "Feedback Revision",
      emoji: "💬",
      hint: "Use feedback from another player. What did they find confusing, boring, too easy, too hard, or exciting?",
      prompt: null,
      agent_context: "A revision plan based on peer playtest feedback",
      language_dimensions: [DIMENSION_LIBRARY.condition, DIMENSION_LIBRARY.result, DIMENSION_LIBRARY.appearance],
    },
  ],
});

export const LESSON_9 = createTycoonLesson({
  id: "roblox-tycoon-creativity-polish-v1",
  title: "Roblox Tycoon Class 7: Creativity and Polish",
  classLabel: "Class 7: Creativity and Polish",
  classGoal: "Make the game feel polished, unique, and fun by adding visual effects, sounds, animations, UI improvements, and original mechanics.",
  topics: [
    "Visual effects",
    "Sounds and music",
    "Animations",
    "User Interface improvements",
    "Particle effects",
    "Lighting",
    "Decorative models",
    "Custom game mechanics",
  ],
  endGoal: "Each game should feel polished, unique, and fun to play.",
  easyUpgrades: [
    {
      id: "polish-effects",
      level: "easy",
      title: "Polish Effects",
      emoji: "✨",
      fillParam: { key: "effects", label: "Add", suffix: "visual effects", default: 5, min: 1, max: 20, hint: "3 = clean polish · 10+ = flashy" },
      buildPrompt: (effects) => `Suggest and help me add ${effects} visual effects to my Roblox tycoon, such as particles, lighting, button feedback, and unlock effects.`,
      agent_context: "Number of visual polish effects",
      language_dimensions: [DIMENSION_LIBRARY.quantity, DIMENSION_LIBRARY.appearance, DIMENSION_LIBRARY.trigger],
    },
    {
      id: "achievement-count",
      level: "easy",
      title: "Achievements",
      emoji: "🏆",
      fillParam: { key: "achievements", label: "Create", suffix: "achievements", default: 4, min: 1, max: 12, hint: "3 = simple goals · 8+ = more replay" },
      buildPrompt: (achievements) => `Design ${achievements} achievements for my Roblox tycoon and explain how to show them in the UI when the player earns them.`,
      agent_context: "Number of achievement goals",
      language_dimensions: [DIMENSION_LIBRARY.quantity, DIMENSION_LIBRARY.trigger, DIMENSION_LIBRARY.result],
    },
  ],
  mediumUpgrades: [
    {
      id: "speed-pad",
      level: "medium",
      title: "Speed Pad",
      emoji: "💨",
      think: "A speed pad can make moving around the tycoon more fun. How fast should it be, and how long should it last?",
      params: [{ key: "seconds", label: "Speed boost lasts ___ seconds", default: 8, min: 1, max: 30, hint: "5 = quick · 15+ = long boost" }],
      buildPrompt: (p) => `Add a speed pad to my Roblox tycoon. When a player touches it, their WalkSpeed increases for ${p.seconds} seconds, then returns to normal. Include the script and setup steps.`,
      agent_context: "Temporary movement boost pad",
      language_dimensions: ["持续时间意图（速度效果持续多久）", "体验意图（让移动更方便还是更刺激）"],
    },
  ],
  hardUpgrades: [
    {
      id: "unique-twist",
      level: "hard",
      title: "Unique Twist",
      emoji: "🌟",
      hint: "Design the feature that makes your tycoon different: rebirths, VIP area, weather, pets, special buttons, or a mechanic no one else has.",
      prompt: null,
      agent_context: "A signature feature that makes the tycoon original",
      language_dimensions: [DIMENSION_LIBRARY.trigger, DIMENSION_LIBRARY.result, DIMENSION_LIBRARY.appearance],
    },
  ],
});

export const LESSON_10 = createTycoonLesson({
  id: "roblox-tycoon-publishing-sharing-v1",
  title: "Roblox Tycoon Class 8: Publishing and Sharing",
  classLabel: "Class 8: Publishing and Sharing",
  classGoal: "Publish the Roblox experience, configure public settings, create game presentation materials, test online, and present the final project.",
  topics: [
    "Publishing to Roblox",
    "Making the experience public",
    "Editing the game icon and thumbnail",
    "Writing a game description",
    "Setting permissions",
    "Testing online",
    "Updating a published game",
  ],
  endGoal: "Students publish their game, configure it so others can play, test the live version, and present their design choices.",
  easyUpgrades: [
    {
      id: "description-length",
      level: "easy",
      title: "Game Description",
      emoji: "📝",
      fillParam: { key: "sentences", label: "Write", suffix: "description sentences", default: 3, min: 1, max: 8, hint: "2 = short · 5+ = detailed" },
      buildPrompt: (sentences) => `Write a Roblox game description for my tycoon in ${sentences} sentences. Include what players do, the main theme, and why it is fun.`,
      agent_context: "Length and content of Roblox game description",
      language_dimensions: [DIMENSION_LIBRARY.quantity, DIMENSION_LIBRARY.appearance, DIMENSION_LIBRARY.result],
    },
    {
      id: "presentation-points",
      level: "easy",
      title: "Presentation Points",
      emoji: "🎤",
      fillParam: { key: "points", label: "Prepare", suffix: "talking points", default: 4, min: 2, max: 10, hint: "3 = simple · 6+ = stronger presentation" },
      buildPrompt: (points) => `Create ${points} final presentation talking points for my Roblox tycoon: design choices, favorite feature, challenge I solved, and what I would improve next.`,
      agent_context: "Number of final presentation points",
      language_dimensions: [DIMENSION_LIBRARY.quantity, DIMENSION_LIBRARY.result, DIMENSION_LIBRARY.condition],
    },
  ],
  mediumUpgrades: [
    {
      id: "online-test",
      level: "medium",
      title: "Online Test",
      emoji: "🌐",
      think: "A published Roblox game can behave differently online. What should you test after publishing?",
      params: [{ key: "test_steps", label: "Run ___ online test steps", default: 6, min: 3, max: 15, hint: "5 = basic check · 10+ = careful QA" }],
      buildPrompt: (p) => `Make a ${p.test_steps}-step online testing checklist for my published Roblox tycoon. Include public access, joining from another account, Cash, buttons, progress, and updates.`,
      agent_context: "Number of live publishing QA steps",
      language_dimensions: ["测试完整度意图（简单确认还是详细检查）", "发布风险意图（最怕哪些线上问题）"],
    },
  ],
  hardUpgrades: [
    {
      id: "launch-plan",
      level: "hard",
      title: "Launch Plan",
      emoji: "🚀",
      hint: "Plan the full launch: icon, thumbnail, description, public settings, update process, live test, and final demo.",
      prompt: null,
      agent_context: "A complete launch and presentation plan for a published Roblox game",
      language_dimensions: [DIMENSION_LIBRARY.condition, DIMENSION_LIBRARY.result, DIMENSION_LIBRARY.appearance],
    },
  ],
});

export const RECOVERY_6 = recovery;
export const RECOVERY_7 = recovery;
export const RECOVERY_8 = recovery;
export const RECOVERY_9 = recovery;
export const RECOVERY_10 = recovery;

export const LEVEL_CONFIG_6 = levelConfig;
export const LEVEL_CONFIG_7 = levelConfig;
export const LEVEL_CONFIG_8 = levelConfig;
export const LEVEL_CONFIG_9 = levelConfig;
export const LEVEL_CONFIG_10 = levelConfig;

export const TABS_6 = tabs;
export const TABS_7 = tabs;
export const TABS_8 = tabs;
export const TABS_9 = tabs;
export const TABS_10 = tabs;
