// Idea deck contract: worldpack/plotpack/outlinepack composition, genre decks,
// cast assembly and deterministic output. Pure functions, no project on disk.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateIdeaDraw } from '../scripts/ideas.js';
import { drawCached, outlinepack, plotpack } from './fixtures.js';

test('worldpack bundles premise, resources and scenarios', () => {
  const pack = drawCached({ type: 'worldpack', genre: '科幻', count: 1, seed: 42 });
  assert.equal(pack.count, 1);
  assert.ok(pack.results[0].premise.title);
  assert.ok(pack.results[0].resources.length >= 1);
  assert.ok(pack.results[0].scenarios.length >= 1);
  assert.ok(pack.results[0].storylines.length >= 1);
  assert.ok(pack.results[0].engine.artifact);
  assert.ok(pack.results[0].location.name);
  assert.ok(pack.results[0].faction.name);
  assert.ok(pack.results[0].equipment.name);
  assert.equal(pack.results[0].cast[0].role_tags[0], 'protagonist');
  assert.equal(pack.results[0].cast[1].role_tags[0], 'antagonist');
  assert.equal(pack.results[0].cast[2].role_tags[0], 'support');
  assert.equal(pack.results[0].cast[3].role_tags[0], 'support');
  assert.ok(pack.results[0].cast_relations.length >= 4);
  assert.ok(pack.results[0].cast_relations.some((relation) => relation.type === 'drives'));
  assert.ok(pack.results[0].cast_relations.some((relation) => relation.type === 'blocks'));
  assert.ok(pack.results[0].cast_relations.some((relation) => relation.type === 'supports'));
  assert.ok(pack.results[0].cast_relations.some((relation) => relation.type === 'counters'));
  assert.ok(pack.results[0].cast_relations.every((relation) => relation.stake));
  assert.ok(pack.results[0].cast.length >= 1);
  assert.ok(pack.results[0].graph.entities.find((entity) => entity.type === 'character').prompt);
});

test('plotpack combines worldpack, cast relations and chapter beats', () => {
  const draw = drawCached({ type: 'plotpack', genre: '悬疑', count: 1, seed: 42 });
  assert.equal(draw.meta.deck, 'suspense');
  const plot = draw.results[0];
  assert.ok(plot.worldpack_id);
  assert.equal(plot.beats.length, 6);
  assert.deepEqual(plot.beats.map((beat) => beat.function), ['setup', 'inciting', 'midpoint', 'crisis', 'climax', 'resolution']);
  assert.ok(plot.cast.length >= 4);
  assert.ok(plot.cast_relations.length >= 4);
  assert.ok(plot.storyline.payoff);
  assert.ok(plot.prompt_pack.positive);
  assert.equal('events' in plot, false);
});

test('worldpack cast uses genre-aware archetypes', () => {
  const expected = {
    修仙: ['抄册执事', '剑冢散修', '掌册长老', '香火祠祝', '洗墨人', '巡册使'],
    悬疑: ['现场刑警', '记忆鉴定师', '承办检察官', '职业证人', '档案员', '辩护律师'],
    都市: ['被合同锁住的主播', '被竞业协议困住的员工', '平台经理', '家族委员会主席', '租客互助会组织者', '财经记者'],
    历史: ['边镇书吏', '海商', '户部主事', '边军主将', '官匠', '史官'],
    言情: ['联姻继承人', '旧信收件人', '替身演员', '家族董事', '经纪人', '合租室友', '婚约律师', '旧友', '制片人', '房东', '恋综导演', '家族秘书'],
  };
  for (const [genre, names] of Object.entries(expected)) {
    const pack = drawCached({ type: 'worldpack', genre, count: 1, seed: 42 });
    assert.ok(pack.results[0].cast.every((character) => names.includes(character.archetype)));
    assert.ok(pack.results[0].cast.every((character) => character.prompt));
    assert.ok(pack.results[0].cast.every((character) => character.negative_prompt));
    const archetypes = pack.results[0].cast.map((character) => character.archetype);
    assert.equal(new Set(archetypes).size, archetypes.length);
  }
  const weighted = drawCached({
    type: 'worldpack', genre: '悬疑', count: 1, seed: 42,
    castRoles: 'protagonist,antagonist,antagonist,support',
  });
  assert.deepEqual(weighted.results[0].cast.map((character) => character.role_tags[0]), ['protagonist', 'antagonist', 'antagonist', 'support']);
  const weightedRelations = weighted.results[0].cast_relations;
  assert.equal(weightedRelations.filter((relation) => relation.type === 'suspects').length, 2);
  assert.equal(weightedRelations.filter((relation) => relation.type === 'corroborates').length, 1);
});

test('worldpacks include motifs and positive/negative prompt packs', () => {
  const pack = drawCached({ type: 'worldpack', genre: '修仙', count: 4, seed: 42 });
  const paper = pack.results.find((item) => item.theme === 'paper');
  assert.ok(paper);
  assert.equal(paper.motif.title, '画皮：借来的脸');
  assert.ok(paper.prompt_pack.positive.includes('画皮'));
  assert.ok(paper.prompt_pack.negative.includes('spaceships'));
  assert.ok(paper.prompt_pack.style.includes('东方玄幻'));
  assert.ok(paper.graph.entities.some((entity) => entity.type === 'motif'));
  assert.ok(paper.graph.relations.some((relation) => relation.type === 'inspired_by'));
});

test('genre decks cover suspense, urban, history and romance', () => {
  for (const [genre, deck, relationType] of [
    ['悬疑', 'suspense', 'suspects'],
    ['都市', 'urban', 'competes_with'],
    ['历史', 'history', 'contends_with'],
    ['言情', 'romance', 'rivals_with'],
  ]) {
    const premise = drawCached({ type: 'premise', genre, count: 1, seed: 42 });
    assert.equal(premise.meta.deck, deck);
    assert.ok(premise.results[0].title);
    const pack = drawCached({ type: 'worldpack', genre, count: 1, seed: 42 });
    assert.equal(pack.meta.deck, deck);
    assert.ok(pack.results[0].engine);
    assert.ok(pack.results[0].location);
    assert.ok(pack.results[0].cast_relations.some((relation) => relation.type === relationType));
  }
});

test('romance plot and outline packs use the romance deck', () => {
  const plot = drawCached({ type: 'plotpack', genre: '言情', count: 1, seed: 42 });
  assert.equal(plot.meta.deck, 'romance');
  assert.equal(plot.results[0].beats.length, 6);
  assert.ok(plot.results[0].cast.some((character) => ['联姻继承人', '旧信收件人', '替身演员'].includes(character.archetype)));
  assert.ok(plot.results[0].prompt_pack.negative.includes('spaceships'));
  assert.ok(plot.results[0].cast_relations.some((relation) => relation.type === 'rivals_with'));
  assert.ok(plot.results[0].cast_relations.some((relation) => relation.type === 'confides_in'));
  assert.ok(plot.results[0].prompt_pack.positive.includes('rivals_with'));
  assert.ok(plot.results[0].cast.every((character) => character.prompt.includes('爱情片')));
  const outline = drawCached({ type: 'outlinepack', genre: '言情', count: 1, seed: 42, chapters: 10, scenes: 3 });
  assert.equal(outline.meta.deck, 'romance');
  assert.equal(outline.results[0].chapters.length, 10);
  assert.ok(outline.results[0].mystery_registry.length > 0);
  const ancient = drawCached({ type: 'premise', genre: '古言', count: 1, seed: 42 });
  assert.equal(ancient.meta.deck, 'romance');
  const largerCast = drawCached({ type: 'worldpack', genre: '言情', count: 1, seed: 42, castCount: 8 });
  assert.equal(largerCast.results[0].cast.length, 8);
  assert.equal(new Set(largerCast.results[0].cast.map((character) => character.archetype)).size, 8);
  const noLead = drawCached({ type: 'worldpack', genre: '言情', count: 1, seed: 42, castRoles: 'antagonist,support' });
  assert.deepEqual(noLead.results[0].cast.map((character) => character.role_tags[0]), ['protagonist', 'support']);
  assert.ok(noLead.meta.warnings.some((warning) => warning.includes('no protagonist')));
  assert.equal(noLead.meta.warning_details[0].code, 'cast.protagonist_autofix');
  assert.equal(noLead.meta.warning_details[0].severity, 'warning');
  const exhausted = drawCached({ type: 'worldpack', genre: '悬疑', count: 1, seed: 42, castCount: 8 });
  const poolWarning = exhausted.meta.warning_details.find((warning) => warning.code === 'cast.pool_exhausted');
  assert.ok(poolWarning);
  assert.equal(poolWarning.pool_size, 6);
  assert.equal(poolWarning.recommended_cast_count, 6);
  const autoCast = drawCached({ type: 'worldpack', genre: '悬疑', count: 1, seed: 42, castCount: 0 });
  assert.equal(autoCast.results[0].cast.length, 6);
  assert.ok(!autoCast.meta.warning_details.some((warning) => warning.code === 'cast.pool_exhausted'));
  const autoRomance = drawCached({ type: 'worldpack', genre: '言情', count: 1, seed: 42, castCount: 0 });
  const autoRoleCounts = autoRomance.results[0].cast.reduce((counts, character) => {
    counts[character.role_tags[0]] = (counts[character.role_tags[0]] || 0) + 1;
    return counts;
  }, {});
  assert.equal(autoRoleCounts.protagonist, 3);
  assert.equal(autoRoleCounts.antagonist, 4);
  assert.equal(autoRoleCounts.support, 5);
  assert.equal(autoRomance.meta.cast.count, 12);
  assert.equal(autoRomance.meta.cast.pool_size, 12);
  assert.deepEqual(autoRomance.meta.cast.role_counts, { protagonist: 3, antagonist: 4, support: 5 });
  assert.equal(autoRomance.meta.cast.archetypes.length, 12);
  assert.equal(autoRomance.meta.cast.archetype_roles['联姻继承人'], 'protagonist');
  const shortPrompt = drawCached({ type: 'worldpack', genre: '言情', count: 1, seed: 42, castCount: 12, promptChars: 120 });
  assert.ok(shortPrompt.results[0].prompt_pack.positive.length <= 120);
  assert.ok(shortPrompt.results[0].prompt_pack.positive.endsWith('…'));
  assert.equal(shortPrompt.results[0].prompt_pack.truncated, true);
  assert.ok(shortPrompt.results[0].prompt_pack.raw_chars > 120);
  const shortCharacter = drawCached({ type: 'worldpack', genre: '言情', count: 1, seed: 42, characterPromptChars: 40 });
  assert.ok(shortCharacter.results[0].cast.every((character) => character.prompt.length <= 40));
  assert.ok(shortCharacter.results[0].cast.some((character) => character.prompt_meta.truncated));
});

test('cast validation catches missing protagonist and duplicate archetypes', () => {
  const pack = drawCached({ type: 'worldpack', genre: '言情', count: 1, seed: 42 });
  assert.equal(validateIdeaDraw({ results: [pack.results[0]] }).findings.length, 0);
  const missing = JSON.parse(JSON.stringify(pack.results[0]));
  missing.cast.forEach((character) => { character.role_tags = ['support']; });
  assert.ok(validateIdeaDraw({ results: [missing] }).findings.some((finding) => finding.rule_id === 'idea.cast.missing_protagonist'));
  const duplicate = JSON.parse(JSON.stringify(pack.results[0]));
  duplicate.cast[1].archetype = duplicate.cast[0].archetype;
  assert.ok(validateIdeaDraw({ results: [duplicate] }).findings.some((finding) => finding.rule_id === 'idea.cast.duplicate_archetype'));
  const badRelation = JSON.parse(JSON.stringify(pack.results[0]));
  badRelation.cast_relations[0].from = 'missing-entity';
  assert.ok(validateIdeaDraw({ results: [badRelation] }).findings.some((finding) => finding.rule_id === 'idea.cast_relation.unknown_entity'));
  const duplicateRelation = JSON.parse(JSON.stringify(pack.results[0]));
  duplicateRelation.cast_relations.push(JSON.parse(JSON.stringify(duplicateRelation.cast_relations[0])));
  assert.ok(validateIdeaDraw({ results: [duplicateRelation] }).findings.some((finding) => finding.rule_id === 'idea.cast_relation.duplicate'));
  const twiceDuplicate = JSON.parse(JSON.stringify(duplicateRelation));
  twiceDuplicate.cast_relations.push(JSON.parse(JSON.stringify(twiceDuplicate.cast_relations[0])));
  assert.equal(validateIdeaDraw({ results: [twiceDuplicate] }).findings.filter((finding) => finding.rule_id === 'idea.cast_relation.duplicate').length, 1);
  const unknownType = JSON.parse(JSON.stringify(pack.results[0]));
  unknownType.cast_relations[0].type = 'nonsense_relation';
  assert.ok(validateIdeaDraw({ results: [unknownType] }).findings.some((finding) => finding.rule_id === 'idea.cast_relation.unknown_type'));
  const highOnly = validateIdeaDraw({ results: [duplicateRelation] }, { minSeverity: 'high' });
  assert.ok(!highOnly.findings.some((finding) => finding.rule_id === 'idea.cast_relation.duplicate'));
  const ignored = validateIdeaDraw({ results: [duplicateRelation] }, { ignoreRules: ['idea.cast_relation.duplicate'] });
  assert.ok(!ignored.findings.some((finding) => finding.rule_id === 'idea.cast_relation.duplicate'));
  assert.ok(ignored.ignored_findings > 0);
  assert.ok(ignored.ignored_rules['idea.cast_relation.duplicate'] > 0);
  const sortedFindings = validateIdeaDraw({ results: [missing] }).findings;
  assert.equal(sortedFindings[0].severity, 'high');
  assert.ok(sortedFindings[0].id.startsWith('finding-'));
  assert.equal(sortedFindings[0].id, validateIdeaDraw({ results: [missing] }).findings[0].id);
});

test('genre-aware ideas use the xianxia deck', () => {
  const xianxia = drawCached({ type: 'premise', genre: '修仙', count: 2, seed: 42 });
  assert.equal(xianxia.meta.deck, 'xianxia');
  assert.ok(xianxia.results.some((item) => /命册|剑冢|香火|清册|渡劫|纸人/.test(item.title)));
  const scifi = drawCached({ type: 'premise', genre: '科幻', count: 2, seed: 42 });
  assert.equal(scifi.meta.deck, 'default');
});

test('provocation, law, event, engine, storyline, location, faction, equipment and motif draws are available', () => {
  for (const type of ['provocation', 'law', 'event', 'engine', 'storyline', 'location', 'faction', 'equipment', 'motif']) {
    const draw = drawCached({ type, count: 2, seed: 9 });
    assert.equal(draw.count, 2);
    assert.ok(draw.results.every((item) => item.title || item.name));
  }
  assert.ok(drawCached({ type: 'engine', count: 1, seed: 9 }).results[0].artifact);
  assert.ok(drawCached({ type: 'motif', count: 1, seed: 9 }).results[0].source);
});

test('ideas are deterministic', () => {
  const a = drawCached({ type: 'namecard', genre: '科幻', count: 5, seed: 42 });
  const b = drawCached({ type: 'namecard', genre: '科幻', count: 5, seed: 42 });
  assert.deepEqual(a.results.map((result) => result.name), b.results.map((result) => result.name));
  assert.equal(a.count, 5);
  assert.equal(a.meta.seed, 42);
});

test('memoized fixtures return independent copies', () => {
  const first = outlinepack();
  const second = outlinepack();
  assert.notEqual(first, second);
  first.chapters[0].id = 'mutated-in-test';
  assert.notEqual(outlinepack().chapters[0].id, 'mutated-in-test');
  const plot = plotpack();
  plot.beats[0].function = 'mutated';
  assert.notEqual(plotpack().beats[0].function, 'mutated');
  const seeded = outlinepack(7, { chapters: 3 });
  assert.equal(seeded.chapters.length, 3);
  assert.equal(drawCached({ type: 'outlinepack', genre: '悬疑', seed: 7, count: 1, chapters: 3 }).results[0].id, seeded.id);
});
