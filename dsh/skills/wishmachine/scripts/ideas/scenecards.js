// Scene card draws: one concrete goal, one real obstacle, one paid cost per scene.
// Same shape as namecards/stylecards — pooled cards, de-dup sets per chapter, seeded rng.
// Slots are filled from the plot so a drawn card still points at this story's people and things.
import { pick } from '../util.js';
import { GOALS, OBSTACLES, COSTS } from '../decks/scenes.js';
import { addWarning } from './shared.js';

const OBJECT_POOL = ['登记页', '回执', '证物袋', '原始记录', '鉴定报告', '名单', '钥匙', '存根'];
const PLACE_POOL = ['封存间', '冷柜', '档案室', '鉴定室', '值班台'];

function fill(text, slots) {
  return String(text)
    .replace(/\{obj\}/g, slots.obj)
    .replace(/\{who\}/g, slots.who)
    .replace(/\{place\}/g, slots.place)
    .replace(/\{case\}/g, slots.caseName);
}

function drawFrom(rng, pool, used, slots) {
  const fresh = pool.filter((card) => !used.has(card.id));
  const card = pick(rng, fresh.length > 0 ? fresh : pool);
  used.add(card.id);
  return { id: card.id, text: fill(card.text, slots) };
}

function scenecards({
  rng, count, cast = [], location = '', caseName = '', warnings = null, avoid = null,
}) {
  if (!Array.isArray(GOALS) || GOALS.length === 0) {
    addWarning(warnings, { code: 'scenecard.empty', severity: 'info', message: 'no scene cards in deck' });
    return [];
  }
  // 跨章也去重：同一卷里两次抽到同一张目标牌，等于又回到"每场都一样"。
  const usedGoals = avoid?.goals || new Set();
  const usedObstacles = avoid?.obstacles || new Set();
  const usedCosts = avoid?.costs || new Set();
  const results = [];
  for (let i = 0; i < count; i += 1) {
    const slots = {
      obj: pick(rng, OBJECT_POOL),
      who: cast.length > 0 ? cast[i % cast.length] : '对方',
      place: location || pick(rng, PLACE_POOL),
      caseName: String(caseName || '').split(/[：:，,]/u)[0].trim() || '这起案子',
    };
    const goal = drawFrom(rng, GOALS, usedGoals, slots);
    const obstacle = drawFrom(rng, OBSTACLES, usedObstacles, slots);
    const cost = drawFrom(rng, COSTS, usedCosts, slots);
    results.push({
      order: i + 1,
      goal: goal.text,
      goal_card: goal.id,
      obstacle: obstacle.text,
      obstacle_card: obstacle.id,
      cost: cost.text,
      cost_card: cost.id,
    });
  }
  if (results.length < count) {
    addWarning(warnings, {
      code: 'count.reduced',
      severity: 'info',
      message: `count ${count} exceeded available scene cards; returning ${results.length}`,
    });
  }
  return results;
}

export { scenecards };
