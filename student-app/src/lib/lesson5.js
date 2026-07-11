// Lesson 5: Racing Game Design (Curriculum Class 3)
// V17: Language Dimension Library - Extension Port 5
import { DIMENSION_LIBRARY } from './lesson';

export const LESSON_5 = {
  id: "racing-game-design-v1",
  title: "Racing Game Design (Claude)",
  emoji: "🏎️",

  agent: {
    demo_description: "A racing game where the player drives a vehicle around a track, avoids hazards, collects boosts, and tries to finish laps as fast as possible",
  },

  steps: [
    {
      id: "track",
      label: "Track theme?",
      options: [
        { value: "city-night", label: "City Night", emoji: "🌃" },
        { value: "desert-rally", label: "Desert Rally", emoji: "🏜️" },
        { value: "snow-track", label: "Snow Track", emoji: "❄️" },
        { value: "space-circuit", label: "Space Circuit", emoji: "🪐" },
        { value: "neon-highway", label: "Neon Highway", emoji: "💡" },
        { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "vehicle",
      label: "What do you drive?",
      options: [
        { value: "race-car", label: "Race Car", emoji: "🏎️" },
        { value: "kart", label: "Kart", emoji: "🛞" },
        { value: "hover-car", label: "Hover Car", emoji: "🚀" },
        { value: "motorbike", label: "Motorbike", emoji: "🏍️" },
        { value: "monster-truck", label: "Monster Truck", emoji: "🚙" },
        { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "hazard",
      label: "What obstacles are on the track?",
      options: [
        { value: "traffic-cones", label: "Traffic Cones", emoji: "🚧" },
        { value: "oil-slicks", label: "Oil Slicks", emoji: "🛢️" },
        { value: "road-blocks", label: "Road Blocks", emoji: "⛔" },
        { value: "potholes", label: "Potholes", emoji: "🕳️" },
        { value: "laser-gates", label: "Laser Gates", emoji: "🔴" },
        { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "powerup",
      label: "What boost can players collect?",
      options: [
        { value: "speed-boost", label: "Speed Boost", emoji: "⚡" },
        { value: "shield", label: "Shield", emoji: "🛡️" },
        { value: "coin-magnet", label: "Coin Magnet", emoji: "🧲" },
        { value: "time-freeze", label: "Time Freeze", emoji: "⏱️" },
        { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "camera",
      label: "Camera view?",
      options: [
        { value: "top-down", label: "Top Down", emoji: "⬇️" },
        { value: "behind-car", label: "Behind Car", emoji: "🎥" },
        { value: "side-scroll", label: "Side Scroll", emoji: "➡️" },
        { value: "isometric", label: "Isometric", emoji: "🔷" },
        { value: "__own__", label: "My Idea", emoji: "✏️", isOwn: true },
      ],
    },
  ],

  ruleDesign: {
    enabled: true,
    fields: [
      {
        id: "controls",
        label: "Control Rule",
        question: "How does the player control the vehicle?",
        emoji: "🎮",
        options: [
          { value: "arrow-keys", label: "Arrow keys steer and accelerate" },
          { value: "wasd", label: "WASD controls" },
          { value: "mouse-drag", label: "Mouse or touch drag to steer" },
        ],
        allowCustom: true,
        placeholder: "e.g. 'left/right to steer, spacebar to boost'",
      },
      {
        id: "lapGoal",
        label: "Goal Rule",
        question: "How does the player win the race?",
        emoji: "🏁",
        options: [
          { value: "three-laps", label: "Finish 3 laps" },
          { value: "beat-the-clock", label: "Beat the timer" },
          { value: "reach-finish-line", label: "Reach the finish line" },
        ],
        allowCustom: true,
        placeholder: "e.g. 'finish 5 checkpoints before time runs out'",
      },
      {
        id: "collision",
        label: "Crash Rule",
        question: "What happens when the vehicle hits an obstacle?",
        emoji: "💥",
        options: [
          { value: "slow-down", label: "Slow down for 2 seconds" },
          { value: "lose-time", label: "Lose 5 seconds" },
          { value: "lose-health", label: "Lose vehicle health" },
        ],
        allowCustom: true,
        placeholder: "e.g. 'spin out and return to the middle of the lane'",
      },
      {
        id: "scoring",
        label: "Score Rule",
        question: "What should the game track?",
        emoji: "📊",
        options: [
          { value: "best-time", label: "Best lap time" },
          { value: "coins-and-time", label: "Coins plus finish time" },
          { value: "checkpoint-score", label: "Checkpoint score" },
        ],
        allowCustom: true,
        placeholder: "e.g. 'score equals speed bonus minus crash penalties'",
      },
    ],
  },

  debugLog: {
    enabled: true,
    breakTypes: [
      {
        id: "controls",
        label: "Control Problem",
        emoji: "🎮",
        description: "The vehicle does not steer, accelerate, or brake correctly",
        fixPrompt: "Fix the vehicle controls so the player can steer, accelerate, and brake smoothly. Make the controls responsive on keyboard and touch if possible.",
      },
      {
        id: "track-boundaries",
        label: "Track Problem",
        emoji: "🛣️",
        description: "The vehicle leaves the track or gets stuck at the edge",
        fixPrompt: "Fix the track boundaries so the vehicle stays on the track or slows down when off-road. The player should not get permanently stuck.",
      },
      {
        id: "collision",
        label: "Crash Problem",
        emoji: "💥",
        description: "Obstacles do not affect the vehicle",
        fixPrompt: "Fix obstacle collision so hitting a hazard clearly affects the vehicle according to the crash rule. Show a visual effect when the crash happens.",
      },
      {
        id: "laps",
        label: "Lap Problem",
        emoji: "🏁",
        description: "Laps, checkpoints, or finish line do not count correctly",
        fixPrompt: "Fix the lap and checkpoint system so laps only count when the vehicle crosses the finish line after following the track in order.",
      },
      {
        id: "boost",
        label: "Boost Problem",
        emoji: "⚡",
        description: "Boosts do not appear, collect, or activate",
        fixPrompt: "Fix the boost power-up so it appears on the track, can be collected, and creates a clear temporary speed increase with a visual effect.",
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
    const trackVal = choices.track;
    if (!trackVal) return "My Racing Game";
    const resolved =
      trackVal === "__own__"
        ? (ownInputs.track || "").trim()
        : LESSON_5.steps[0].options.find((o) => o.value === trackVal)?.label;
    if (!resolved) return "My Racing Game";
    return `${resolved} Racing`;
  },

  buildPrompt: (choices, ownInputs = {}, gameName = "", rules = {}) => {
    const resolve = (id) => {
      const val = choices[id];
      if (val === "__own__") return (ownInputs[id] || "").trim();
      return val?.replace(/-/g, " ") || "";
    };

    const track = resolve("track") || "city night";
    const vehicle = resolve("vehicle") || "race car";
    const hazard = resolve("hazard") || "traffic cones";
    const powerup = resolve("powerup") || "speed boost";
    const camera = resolve("camera") || "top down";
    const title = (gameName || "").trim() || LESSON_5.defaultGameName(choices, ownInputs);

    const controlsRule = rules.controls || "arrow keys steer and accelerate";
    const lapGoalRule = rules.lapGoal || "finish 3 laps";
    const collisionRule = rules.collision || "slow down for 2 seconds";
    const scoringRule = rules.scoring || "best lap time";

    return `Build a playable racing game called "${title}" as an Artifact.

MY GAME DESIGN:
- Track theme: ${track}
- Vehicle: ${vehicle}
- Obstacles: ${hazard}
- Boost power-up: ${powerup}
- Camera view: ${camera}

MY GAME RULES:
- Controls: ${controlsRule}
- Race goal: ${lapGoalRule}
- When the vehicle hits an obstacle: ${collisionRule}
- Score tracking: ${scoringRule}

MAKE SURE:
- The vehicle can steer, accelerate, and slow down smoothly
- The track has clear boundaries and a visible finish line or checkpoints
- ${hazard} appear on the track and affect the vehicle when hit
- ${powerup} can be collected and gives a clear temporary benefit
- Show lap count, timer, speed, and score at the top of the screen
- Add a victory screen when the race goal is completed

Make it playable in an Artifact panel.`;
  },

  upgrades: [
    {
      id: "lap-count",
      level: "easy",
      title: "Lap Count",
      emoji: "🏁",
      fillParam: {
        key: "laps",
        label: "Race for",
        suffix: "laps",
        default: 3,
        min: 1,
        max: 10,
        hint: "1 = quick race · 5+ = longer challenge",
      },
      buildPrompt: (laps) => `Make the race last ${laps} laps. Show the current lap and total laps at the top. Show a victory screen after the final lap is finished.`,
      agent_context: "Number of laps required to win the race",
      language_dimensions: [DIMENSION_LIBRARY.quantity, DIMENSION_LIBRARY.condition, DIMENSION_LIBRARY.result],
    },
    {
      id: "boost-duration",
      level: "easy",
      title: "Boost Duration",
      emoji: "⚡",
      fillParam: {
        key: "seconds",
        label: "Boost lasts",
        suffix: "seconds",
        default: 4,
        min: 1,
        max: 15,
        hint: "2s = quick burst · 8s+ = long advantage",
      },
      buildPrompt: (seconds) => `Make each speed boost last ${seconds} seconds. During boost, the vehicle moves faster and leaves a visible trail effect.`,
      agent_context: "How long the speed boost remains active",
      language_dimensions: [DIMENSION_LIBRARY.duration, DIMENSION_LIBRARY.speed, DIMENSION_LIBRARY.appearance],
    },
    {
      id: "hazard-count",
      level: "easy",
      title: "Hazard Count",
      emoji: "🚧",
      fillParam: {
        key: "hazards",
        label: "Place",
        suffix: "hazards around the track",
        default: 12,
        min: 1,
        max: 40,
        hint: "5 = open road · 20+ = tricky track",
      },
      buildPrompt: (hazards) => `Place about ${hazards} hazards around the track. Space them out so the player always has a fair path through.`,
      agent_context: "How crowded the track is with hazards",
      language_dimensions: [DIMENSION_LIBRARY.quantity, DIMENSION_LIBRARY.position, DIMENSION_LIBRARY.frequency],
    },
    {
      id: "__own__",
      level: "easy",
      title: "My Own Idea",
      emoji: "✏️",
      isOwn: true,
      buildPrompt: (text) =>
        `Please add this to my racing game: ${text.trim()}. Make it work well with the existing gameplay and keep the game playable.`,
      agent_context: "Custom idea from the student",
      language_dimensions: [],
    },

    {
      id: "top-speed",
      level: "medium",
      title: "Top Speed",
      emoji: "🏎️",
      think: "A very fast vehicle feels exciting, but too much speed can make steering impossible. What speed makes the game feel fun and controllable?",
      params: [
        {
          key: "speed_multiplier",
          label: "Top speed is ___ × normal speed",
          default: 2,
          min: 1,
          max: 5,
          hint: "1x = controlled · 3x+ = intense",
        },
      ],
      buildPrompt: (p) => `Set the vehicle's top speed to ${p.speed_multiplier}× normal speed. Keep steering controllable at high speed and show a speed meter at the top.`,
      agent_context: "How fast the vehicle can move at maximum speed",
      language_dimensions: [
        "速度意图（想让赛车很快还是容易控制）",
        "操控意图（想让转弯稳定还是更刺激）",
      ],
    },
    {
      id: "drift-meter",
      level: "medium",
      title: "Drift Meter",
      emoji: "💨",
      think: "Drifting can reward skill. Should drifting fill a boost meter quickly, slowly, or only when the player turns at the right time?",
      params: [
        {
          key: "boost_gain",
          label: "Drifting fills boost by ___ points",
          default: 10,
          min: 1,
          max: 50,
          hint: "5 = slow charge · 25+ = frequent boosts",
        },
      ],
      buildPrompt: (p) => `Add a drift meter. When the player turns sharply while moving, fill the boost meter by ${p.boost_gain} points. When the meter reaches 100, the player can activate a speed boost.`,
      agent_context: "A skill-based drifting system that charges boosts",
      language_dimensions: [
        "奖励意图（漂移应该给多少好处）",
        "技巧意图（想让玩家练习转弯还是轻松获得加速）",
      ],
    },
    {
      id: "rival-cars",
      level: "medium",
      title: "Rival Cars",
      emoji: "🚗",
      think: "Rivals can make the race feel alive. Should they block the player, chase the player, or simply race toward the finish?",
      params: [
        {
          key: "rivals",
          label: "Add ___ rival cars",
          default: 3,
          min: 1,
          max: 8,
          hint: "1 = duel · 5+ = crowded race",
        },
      ],
      buildPrompt: (p) => `Add ${p.rivals} rival cars that drive around the track and try to finish the race. They should avoid getting stuck and should not make the player instantly lose on contact.`,
      agent_context: "Computer-controlled rival vehicles on the track",
      language_dimensions: [
        "竞争意图（想要单挑还是多人竞速）",
        "难度意图（对手应该干扰玩家还是只是增加气氛）",
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
      think: "What feature do you want to add? Think about what would make your racing game more exciting or more strategic.",
      buildPrompt: (paramValues, template) => {
        if (!template) return '';
        return template.replace(/\{(\w+)\}/g, (_, key) => paramValues[key] || `[${key}]`);
      },
      agent_context: "学生自己想的赛车功能，具体内容未知",
      language_dimensions: [],
    },

    {
      id: "track-shortcuts",
      level: "hard",
      title: "Track Shortcuts",
      emoji: "🛣️",
      hint: "Design shortcut routes. Where are they? Are they risky? What makes them faster, and what can go wrong?",
      prompt: null,
      agent_context: "Alternate racing routes that create strategic choices",
      language_dimensions: [DIMENSION_LIBRARY.position, DIMENSION_LIBRARY.condition, DIMENSION_LIBRARY.result, DIMENSION_LIBRARY.appearance],
    },
    {
      id: "upgrade-garage",
      level: "hard",
      title: "Upgrade Garage",
      emoji: "🔧",
      hint: "Design a garage where players improve their vehicle. What can they upgrade? Speed, handling, boost, armor, or something else?",
      prompt: null,
      agent_context: "A vehicle upgrade system between or during races",
      language_dimensions: [DIMENSION_LIBRARY.condition, DIMENSION_LIBRARY.result, DIMENSION_LIBRARY.quantity, DIMENSION_LIBRARY.appearance],
    },
    {
      id: "signature-track-rule",
      level: "hard",
      title: "Signature Track Rule",
      emoji: "🌟",
      hint: "Create one rule that makes your race unique. A changing track? Reverse controls zone? Boost-only bridge? Design it clearly.",
      prompt: null,
      agent_context: "A unique racing mechanic that defines the game",
      language_dimensions: [DIMENSION_LIBRARY.trigger, DIMENSION_LIBRARY.result, DIMENSION_LIBRARY.appearance],
    },
    {
      id: "__own_hard__",
      level: "hard",
      title: "My Own Idea",
      emoji: "✏️",
      isOwn: true,
      prompt: null,
      hint: "What's your unique idea? Think of something no other racing game has.",
      agent_context: "学生完全原创的游戏功能，没有任何方向限制",
      language_dimensions: [
        "触发条件（什么情况下发生）",
        "结果描述（发生了会怎样）",
        "外观描述（看起来怎样）",
      ],
    },
  ],
};

export const RECOVERY_5 = [
  {
    id: "no-game",
    icon: "👻",
    title: "Claude only showed text, no game",
    fix: 'Type this in the chat: "Please show this as a playable racing game in an Artifact panel."',
  },
  {
    id: "controls-broken",
    icon: "🎮",
    title: "Vehicle controls do not work",
    fix: 'Type: "Fix the controls so I can steer, accelerate, and brake the vehicle smoothly."',
  },
  {
    id: "leaves-track",
    icon: "🛣️",
    title: "Vehicle leaves the track",
    fix: 'Type: "Add track boundaries so the vehicle stays on the track or slows down off-road."',
  },
  {
    id: "laps-broken",
    icon: "🏁",
    title: "Laps do not count correctly",
    fix: 'Type: "Fix the lap counter so a lap only counts after crossing the finish line in the correct direction."',
  },
  {
    id: "boost-broken",
    icon: "⚡",
    title: "Boost does not work",
    fix: 'Type: "Fix the speed boost so it can be collected and makes the vehicle faster for a few seconds."',
  },
  {
    id: "too-hard",
    icon: "💥",
    title: "The race is too hard",
    fix: 'Tell Claude exactly what to tune. Example: "Make the vehicle slower, make turns easier, and reduce the number of obstacles."',
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
    fix: 'In the same chat, type what you want changed. Example: "Make the track wider and the car easier to see." Claude will update the game.',
  },
];

export const LEVEL_CONFIG_5 = {
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

export const TABS_5 = [
  { id: "design", label: "Build", icon: Sparkles },
  { id: "rules", label: "Rules", icon: Settings },
  { id: "prompt", label: "Prompt", icon: Copy },
  { id: "debug", label: "Debug", icon: Bug },
  { id: "help", label: "Help", icon: AlertCircle },
  { id: "upgrade", label: "Upgrade", icon: Rocket },
];
