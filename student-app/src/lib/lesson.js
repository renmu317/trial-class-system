// Phase 1 原版 LESSON 配置 - 不要修改
export const LESSON = {
  id: "catch-falling-v1",
  title: "Catch Falling Game",
  emoji: "🎮",
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
    const diff = LESSON.steps[3].options.find((o) => o.value === choices.difficulty);
    const speed = diff?.meta?.speed || 200;
    const lives = diff?.meta?.lives || 3;
    const catchItem = resolve("catchItem") || "stars";
    const avoidItem = resolve("avoidItem") || "bombs";
    const background = resolve("background") || "dark blue";
    const title = (gameName || "").trim() || LESSON.defaultGameName(choices, ownInputs);
    const speedLine =
      choices.difficulty === "__own__"
        ? `Difficulty: ${resolve("difficulty") || "medium"}`
        : `Starting fall speed: ${speed} pixels per second`;
    return `You are a professional game developer. Build a "catch falling objects" game called "${title}" as a playable Artifact.

GAME RULES:
- Player moves a paddle left and right to catch falling ${catchItem}
- Player must avoid falling ${avoidItem}
- Catching ${catchItem} = +1 point
- Hitting ${avoidItem} = lose a life

VISUALS:
- Background color: ${background}
- Use clear emoji or colored shapes for the objects
- Big visible score and lives counter at the top

GAMEPLAY:
- ${speedLine}
- Game over after losing ${lives} lives
- Show a "Game Over" screen with final score and a "Play Again" button
- Works with arrow keys AND mouse/touch

Make it a playable game in an Artifact panel. Make it fun and responsive.`;
  },
  upgrades: [
    { id: "lives", level: "easy", title: "Lives Counter", emoji: "❤️", prompt: "Add a lives counter at the top that starts at 3 and shows hearts." },
    { id: "highscore", level: "easy", title: "High Score", emoji: "🏆", prompt: "Save the high score so it shows even after Game Over. Display it next to the current score." },
    { id: "speedup", level: "easy", title: "Speed Boost", emoji: "💨", prompt: "Make the objects fall faster every 10 points scored. Show a 'SPEED UP!' message when it happens." },
    { id: "twotypes", level: "easy", title: "Two Object Types", emoji: "✨", prompt: "Add a second special object worth 5 points instead of 1. Make it appear less often than the regular ones." },
    { id: "colorchange", level: "easy", title: "Color Change", emoji: "🎨", prompt: "Change the background color every 10 points. Cycle through 4 different colors." },
    { id: "powerup", level: "easy", title: "Power-Up", emoji: "⚡", prompt: "Add a rare power-up object that makes the paddle wider for 5 seconds when caught." },
    {
      id: "__own__",
      level: "easy",
      title: "My Own Idea",
      emoji: "✏️",
      isOwn: true,
      buildPrompt: (text) =>
        `Please add this to my game: ${text.trim()}. Make it work well with the existing gameplay and keep the game playable.`,
    },
    {
      id: "boss",
      level: "medium",
      title: "Boss Battle",
      emoji: "👹",
      think: "How long should players play before the boss appears? Too soon = boring. Too late = they give up. How many hits to defeat = challenging but possible?",
      params: [
        { key: "score", label: "Boss appears at score", default: 20, min: 5, max: 100 },
        { key: "hits", label: "Hits to defeat boss", default: 3, min: 1, max: 10 },
      ],
      buildPrompt: (p) => `When the player reaches ${p.score} points, make a big "Boss" character appear at the top of the screen. The player has to hit the boss ${p.hits} times by catching special items to defeat it. Show a "BOSS APPEARED!" message when it shows up, and "VICTORY!" when defeated. After defeating the boss, let the game continue with normal falling objects.`,
    },
    {
      id: "levels",
      level: "medium",
      title: "Multiple Levels",
      emoji: "🗺️",
      think: "How many levels feels right? How many points between levels? Too few points = too easy. Too many = boring.",
      params: [
        { key: "levels", label: "Number of levels", default: 3, min: 2, max: 5 },
        { key: "pointsPerLevel", label: "Points needed per level", default: 15, min: 5, max: 50 },
      ],
      buildPrompt: (p) => `Split the game into ${p.levels} levels. The player advances to the next level every ${p.pointsPerLevel} points. Each level has a different background color and the objects fall faster. Show "LEVEL 1", "LEVEL 2", etc. as big titles when each starts. Display the current level number at the top of the screen during play.`,
    },
    {
      id: "sounds",
      level: "medium",
      title: "Sound Effects",
      emoji: "🔊",
      think: "How loud? How long should each sound be? Different sounds for different events — what makes sense?",
      params: [
        { key: "volume", label: "Volume (0-100)", default: 50, min: 10, max: 100 },
      ],
      buildPrompt: (p) => `Add sound effects using the Web Audio API at ${p.volume}% volume. Play a happy 'ding' when catching the good object, a 'thud' when hitting the bad object, and a short 'game over' sound when losing. Keep all sounds under 0.5 seconds and not annoying.`,
    },
    {
      id: "talkingchar",
      level: "medium",
      title: "Talking Character",
      emoji: "💬",
      think: "What should your character say at the start? After a catch? When in danger? What kind of personality?",
      params: [
        { key: "every", label: "Speak after every N catches", default: 5, min: 1, max: 20 },
      ],
      buildPrompt: (p) => `Add a small character in the corner of the screen that shows speech bubbles. It says "Let's go!" at the start, says something encouraging every ${p.every} points (like "Nice catch!" or "Keep going!"), warns "Watch out!" when a bad object is close to the paddle, and says "Game over..." at the end. Keep all messages short and fun.`,
    },
    {
      id: "difficulty-curve",
      level: "hard",
      title: "Balance Designer",
      emoji: "⚖️",
      hint: "What makes a game start easy, then get hard? Speed? Object size? Object count? Multiple things at once? Think first, THEN tell Claude.",
      prompt: null,
    },
    {
      id: "storyteller",
      level: "hard",
      title: "Storyteller",
      emoji: "📖",
      hint: "Every great game has a reason to play. Why is your player catching these things? What happens if they succeed? Tell Claude the story you want.",
      prompt: null,
    },
    {
      id: "signature",
      level: "hard",
      title: "Signature Move",
      emoji: "🌟",
      hint: "Add ONE thing nobody else will think of. Something only your game has. What makes a game uniquely yours? Tell Claude exactly what you want.",
      prompt: null,
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
