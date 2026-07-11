import { describe, it, expect } from 'vitest';
import { getLessonConfig, getAvailableLessons } from './lessonConfig';

const en = getLessonConfig('lesson3', 'en');
const zh = getLessonConfig('lesson3', 'zh');
const langs = [['en', en], ['zh', zh]];

describe('lesson3 registration', () => {
  // getLessonConfig() falls back to lesson1 for unknown keys, so a lesson missing
  // from either registry serves the wrong game instead of failing loudly.
  it.each(langs)('%s registry resolves to lesson3, not the fallback', (_lang, config) => {
    expect(config.id).toBe('lesson3');
    expect(config.lesson.id).toBe('zombie-runner-v1');
  });

  it('titles are localized', () => {
    expect(en.lesson.title).toBe('Zombie Survival Runner');
    expect(zh.lesson.title).toBe('僵尸生存跑酷');
  });

  it('TA-facing name carries the curriculum class number', () => {
    expect(en.name).toContain('Class 1');
  });

  it('is offered to TAs with its own emoji', () => {
    expect(getAvailableLessons()).toContainEqual(
      expect.objectContaining({ id: 'lesson3', emoji: '🧟' }),
    );
  });
});

describe('lesson3 structure matches lesson2', () => {
  it.each(langs)('%s has the six-tab layout including rules and debug', (_lang, config) => {
    expect(config.tabs.map((t) => t.id)).toEqual(
      expect.arrayContaining(['design', 'rules', 'prompt', 'debug', 'help', 'upgrade']),
    );
  });

  // App.jsx gates these tabs on hasRuleDesign()/hasDebugLog() reading these flags.
  it.each(langs)('%s enables the rule design and debug log tabs', (_lang, config) => {
    expect(config.lesson.ruleDesign.enabled).toBe(true);
    expect(config.lesson.ruleDesign.fields).toHaveLength(4);
    expect(config.lesson.debugLog.enabled).toBe(true);
    expect(config.lesson.debugLog.breakTypes).toHaveLength(6);
  });

  it.each(langs)('%s has five build steps and a full recovery list', (_lang, config) => {
    expect(config.lesson.steps).toHaveLength(5);
    expect(config.recovery.length).toBeGreaterThanOrEqual(8);
    expect(Object.keys(config.levelConfig)).toEqual(['easy', 'medium', 'hard']);
  });
});

describe('lesson3 upgrades', () => {
  it.each(langs)('%s has four upgrades at each level', (_lang, config) => {
    const { upgrades } = config.lesson;
    expect(upgrades).toHaveLength(12);
    for (const level of ['easy', 'medium', 'hard']) {
      expect(upgrades.filter((u) => u.level === level)).toHaveLength(4);
    }
  });

  it.each(langs)('%s upgrade ids are unique', (_lang, config) => {
    const ids = config.lesson.upgrades.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // AgentBridge reads agent_context and language_dimensions off every upgrade.
  it.each(langs)('%s every upgrade carries agent context and well-formed dimensions', (_lang, config) => {
    for (const u of config.lesson.upgrades) {
      expect(u.agent_context, u.id).toBeTruthy();
      for (const dim of u.language_dimensions ?? []) {
        expect(dim, u.id).toEqual(expect.any(String));
        expect(dim.length, u.id).toBeGreaterThan(0);
      }
    }
  });

  it.each(langs)('%s easy upgrades take a number, no Gate 1', (_lang, config) => {
    const easy = config.lesson.upgrades.filter((u) => u.level === 'easy' && !u.isOwn);
    for (const u of easy) expect(u.fillParam?.key, u.id).toBeTruthy();
  });

  it.each(langs)('%s medium upgrades drill intent, not numbers', (_lang, config) => {
    const medium = config.lesson.upgrades.filter((u) => u.level === 'medium' && !u.isOwn);
    for (const u of medium) {
      expect(u.params, u.id).toHaveLength(1);
      expect(u.language_dimensions, u.id).toHaveLength(2);
      expect(u.think, u.id).toBeTruthy();
    }
  });

  it.each(langs)('%s hard upgrades leave the prompt to the student', (_lang, config) => {
    const hard = config.lesson.upgrades.filter((u) => u.level === 'hard' && !u.isOwn);
    for (const u of hard) {
      expect(u.prompt, u.id).toBeNull();
      expect(u.hint, u.id).toBeTruthy();
    }
  });

  // The curriculum's sample coaching line ("twice as fast, or three times?") is an
  // intent question, so zombie speed must sit at medium where Gate 1 can drill it.
  it.each(langs)('%s puts zombie speed at medium tier', (_lang, config) => {
    const speed = config.lesson.upgrades.find((u) => u.id === 'zombie-speed');
    expect(speed?.level).toBe('medium');
  });
});

describe('lesson3 buildPrompt', () => {
  const choices = {
    theme: 'school',
    zombieType: 'fast-runners',
    obstacle: 'dumpsters',
    supply: 'medkits',
    background: 'foggy',
  };
  // RuleDesign.jsx stores option labels, not values — see handleSelect(opt.label).
  const rules = {
    collision: 'Lose 1 life',
    win: 'Reach the safehouse',
    lose: '3 lives',
    difficulty: 'Zombies speed up',
  };

  it('renders every design choice and rule', () => {
    const prompt = en.lesson.buildPrompt(choices, {}, '', rules);
    for (const word of ['school', 'fast runners', 'dumpsters', 'medkits', 'foggy']) {
      expect(prompt).toContain(word);
    }
    for (const rule of Object.values(rules)) expect(prompt).toContain(rule);
  });

  it('never leaks undefined into the student-visible prompt', () => {
    const prompt = en.lesson.buildPrompt({}, {}, '', {});
    expect(prompt).not.toMatch(/undefined|\[object|NaN/);
  });

  it('derives a game name from the theme when none is given', () => {
    expect(en.lesson.buildPrompt(choices, {}, '', rules)).toContain('School Runner');
    expect(zh.lesson.buildPrompt(choices, {}, '', rules)).toContain('学校跑酷');
  });

  it('honours a custom theme and a custom game name', () => {
    const prompt = en.lesson.buildPrompt(
      { ...choices, theme: '__own__' },
      { theme: 'abandoned subway' },
      'Deep Dark',
      rules,
    );
    expect(prompt).toContain('abandoned subway');
    expect(prompt).toContain('Deep Dark');
  });

  it('zh prompt is written in Chinese', () => {
    const prompt = zh.lesson.buildPrompt(choices, {}, '', rules);
    expect(prompt).toContain('僵尸');
    expect(prompt).toContain('学校');
  });
});

describe('lesson3 upgrade prompt builders', () => {
  const upgrade = (id) => en.lesson.upgrades.find((u) => u.id === id);

  it('easy builder takes the raw number', () => {
    expect(upgrade('lives-counter').buildPrompt(5)).toContain('5 lives');
  });

  it('medium builder takes a params object', () => {
    expect(upgrade('zombie-speed').buildPrompt({ speed_multiplier: 3 })).toContain('3× the player');
  });

  it('own-idea builder fills a Gate 1 generated template', () => {
    expect(upgrade('__own_medium__').buildPrompt({ n: '7' }, 'Add {n} drones')).toBe('Add 7 drones');
  });

  it('own-idea builder returns empty without a template', () => {
    expect(upgrade('__own_medium__').buildPrompt({}, null)).toBe('');
  });
});

describe('existing lessons still resolve', () => {
  it('lesson1 and lesson2 are untouched', () => {
    expect(getLessonConfig('lesson1', 'en').lesson.id).toBe('catch-falling-v1');
    expect(getLessonConfig('lesson2', 'en').lesson.id).toBe('maze-game-v1');
  });

  it('an unknown lesson key still falls back to lesson1', () => {
    expect(getLessonConfig('lesson99', 'en').id).toBe('lesson1');
  });
});
