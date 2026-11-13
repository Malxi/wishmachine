// Namecard (cast) generation: deterministic names, archetypes and portraits.
import { DECKS, DEFAULT_DECK, ROLE_NAMES } from '../decks/index.js';
import { pick, pickMany } from '../util.js';
import { addWarning, buildCastPromptMeta, findCard, resultId, truncatePrompt } from './shared.js';

function archetypesForRole(deck, role) {
  const pool = deck.archetypes || [];
  const named = deck.roleArchetypes?.[role];
  if (Array.isArray(named) && named.length > 0) {
    const resolved = named.map((name) => findCard(pool, 'name', name)).filter(Boolean);
    if (resolved.length > 0) return resolved;
  }
  return pool.filter((item) => (item.roles || []).includes(role));
}

function namecards({
  rng, seed, count, roles = [], deckName = 'default', promptChars = 160, warnings = null,
}) {
  const deck = DECKS[deckName] || DEFAULT_DECK;
  const pool = deck.archetypes || [];
  const surnames = pickMany(rng, DEFAULT_DECK.surnames || [], Math.min(count, 20));
  const given = pickMany(rng, DEFAULT_DECK.givenNames || [], Math.min(count, 20));
  const used = new Set();
  const usedArchetypes = new Set();
  const results = [];
  for (let i = 0; i < count; i += 1) {
    let surname = surnames[i % (surnames.length || 1)] || '孟';
    let givenName = given[i % (given.length || 1)] || '启明';
    let name = `${surname}${givenName}`;
    let attempt = 0;
    while (used.has(name) && attempt < 40) {
      surname = pick(rng, DEFAULT_DECK.surnames || ['孟']);
      givenName = pick(rng, DEFAULT_DECK.givenNames || ['启明']);
      name = `${surname}${givenName}`;
      attempt += 1;
    }
    used.add(name);
    const role = roles[i] || ROLE_NAMES[i % ROLE_NAMES.length];
    const roleArchetypes = archetypesForRole(deck, role);
    const availableForRole = roleArchetypes.filter((item) => !usedArchetypes.has(item.name));
    let archetype = availableForRole.length > 0 ? pick(rng, availableForRole) : null;
    if (!archetype) {
      const available = pool.filter((item) => !usedArchetypes.has(item.name));
      const fallback = available.length > 0 ? available : pool;
      archetype = pick(rng, fallback.length > 0 ? fallback : [{
        name: '无名者', personality: [], contradiction: '尚未确定。', want: '尚未确定。', fear: '尚未确定。',
        mask: '尚未确定。', speech: '尚未确定。', body: '尚未确定。', backstory: '尚未确定。',
      }]);
      if (warnings) {
        addWarning(warnings, {
          code: 'cast.role_archetype_mismatch',
          severity: 'warning',
          message: `no unused ${role} archetype left in the ${deck.name} deck; ${archetype.name} is cast as ${role}`,
          requested_role: role,
          archetype: archetype.name,
        });
      }
    }
    usedArchetypes.add(archetype.name);
    const id = resultId('name', seed, i);
    const rawCharacterPrompt = [
      deck.portraitStyle || DEFAULT_DECK.portraitStyle || '',
      name,
      archetype.name,
      ...(archetype.personality || []),
      archetype.body,
      archetype.want,
    ].filter(Boolean).join('，');
    results.push({
      id,
      name,
      surname,
      given_name: givenName,
      naming_style: pick(rng, ['hard', 'literary', 'plain']),
      role_tags: [role],
      archetype: archetype.name,
      prompt: truncatePrompt(rawCharacterPrompt, promptChars),
      prompt_meta: buildCastPromptMeta(rawCharacterPrompt, promptChars),
      negative_prompt: deck.portraitNegative || DEFAULT_DECK.portraitNegative || '',
      personality: archetype.personality,
      contradiction: archetype.contradiction,
      want: archetype.want,
      fear: archetype.fear,
      social_mask: archetype.mask,
      speech_style: archetype.speech,
      body_language: archetype.body,
      backstory_hook: archetype.backstory,
      naming_logic: `先定原型“${archetype.name}”，再选音感；姓氏“${surname}”与名字“${givenName}”组合为“${name}”。`,
      derivation: ['archetype', 'personality', 'contradiction', 'naming_style', 'surname', 'given_name'],
    });
  }
  return results;
}

export { namecards };
