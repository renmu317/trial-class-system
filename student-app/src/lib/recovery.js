// RECOVERY 帮助项目 - 从 Phase 1 迁移
// 6 条帮助内容，保持原样

export const RECOVERY = [
  {
    id: 'stuck',
    title: "I'm stuck and don't know what to do",
    content: `Don't worry! Here's what you can do:
1. Read the error message carefully
2. Try clicking the green flag again
3. Check if all your blocks are connected
4. Ask your teacher or TA for help

Remember: Making mistakes is part of learning!`
  },
  {
    id: 'sprites',
    title: "How do I add sprites?",
    content: `To add a sprite:
1. Click the cat icon with a + sign (bottom right)
2. Choose from:
   - Library: Pre-made sprites
   - Paint: Draw your own
   - Upload: Use your own image
3. Click on a sprite to add it to your game`
  },
  {
    id: 'movement',
    title: "How do I make things move?",
    content: `To make sprites move:
1. Go to the "Motion" blocks (blue)
2. Use "move 10 steps" to go forward
3. Use "glide to x y" for smooth movement
4. Put blocks in a "forever" loop to keep moving

Tip: Use arrow keys with "when key pressed" events!`
  },
  {
    id: 'collision',
    title: "How do I detect when things touch?",
    content: `To detect collisions:
1. Go to "Sensing" blocks (light blue)
2. Use "touching [sprite]?" in an if-block
3. Example:
   - forever
     - if touching [Enemy] then
       - say "Ouch!" for 1 second

This checks if your sprite touches another one.`
  },
  {
    id: 'score',
    title: "How do I add a score?",
    content: `To add scoring:
1. Go to "Variables" (orange)
2. Click "Make a Variable"
3. Name it "Score"
4. Use "change Score by 1" when collecting items
5. Use "set Score to 0" at game start

The score will show on your stage automatically!`
  },
  {
    id: 'sound',
    title: "How do I add sounds?",
    content: `To add sounds:
1. Select your sprite
2. Click the "Sounds" tab at the top
3. Click the speaker icon with + to add sounds
4. In code, use "Sound" blocks (pink/magenta)
5. Use "play sound [pop] until done"

Tip: "start sound" plays without waiting!`
  }
]
