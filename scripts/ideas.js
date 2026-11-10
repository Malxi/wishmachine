import { hashSeed, mulberry32, pickMany, pick } from './util.js';

const TYPES = [
  'provocation', 'axiom', 'event', 'law', 'scenario', 'engine',
  'worldpack', 'premise', 'storyline', 'cast', 'namecard',
  'resource', 'itemcard', 'reference', 'name',
];

const SURNAMES = ['孟', '沈', '程', '韩', '钟', '江', '谢', '许', '方', '周', '罗', '顾', '陆', '宋', '闻', '裴', '秦', '唐', '温', '叶'];
const GIVEN = ['启明', '观衡', '怀瑾', '星野', '绍安', '景和', '夜航', '闻声', '知临', '思衡', '闻衡', '青梧', '砚秋', '照川', '停云', '既白', '长庚', '临渊', '无咎', '见山'];
const ARCHETYPES = [
  { name: '过度理性的救援者', personality: ['冷静', '责任心过重', '不擅长接受感谢'], contradiction: '能精确计算所有人的生存概率，却会为救一个人破坏自己的最优方案。', want: '把伤亡数字压到最低', fear: '发现自己已经把某个人当成可接受损失', mask: '永远准备了三套撤离方案', speech: '边操作边解释，避免直视情绪问题', body: '焦虑时会反复检查已经锁好的卡扣', backstory: '第一次救援失败后，把所有遇难者姓名写进了私人航行日志。' },
  { name: '只看证据的审讯者', personality: ['敏锐', '不近人情', '对自己的记忆缺乏信任'], contradiction: '要求所有证词都有物证，却一直隐瞒自己亲眼看见的那一幕。', want: '建立一条无法被权势修改的证据链', fear: '最关键的物证其实出自自己的误读', mask: '不会相信任何人的冷静审问者', speech: '不断追问时间、地点和签名', body: '听人陈述时会逐字敲击记录器', backstory: '曾用一段真实但缺少上下文的记录让无辜者认罪。' },
  { name: '温柔的控制者', personality: ['耐心', '共情力强', '控制欲极强'], contradiction: '真心希望别人过得好，却无法接受别人不按自己的方案活。', want: '让所有人安全地接受自己的安排', fear: '自己的判断被证明造成了不可逆伤害', mask: '永远愿意倾听的前辈', speech: '先替对方说出顾虑，再替对方做决定', body: '会替别人整理衣领、工具和未说完的话', backstory: '曾隐瞒一次系统故障，让整支队伍逃过灾难，也让另一队成为替罪者。' },
  { name: '被规则养大的叛徒', personality: ['守序', '隐忍', '在关键时刻越界'], contradiction: '比任何人都熟悉规则，也比任何人都清楚规则救不了人。', want: '在制度内部撬开一个例外', fear: '例外最终只救了自己', mask: '最可靠的执行者', speech: '先引用条款，再提出一个无法拒绝的条件', body: '签字前会把笔帽扣得很紧', backstory: '曾按流程放弃一艘救生艇，后来发现艇上是他自己的家人。' },
  { name: '把失败当样本的工程师', personality: ['好奇', '固执', '对疼痛反应迟钝'], contradiction: '相信一切都能修，唯独不接受人无法被修好。', want: '造出一台不会再犯同样错误的机器', fear: '机器学会了人的选择', mask: '只谈参数不谈感受', speech: '用故障树解释生活', body: '说话时手里总在拆装一个小零件', backstory: '第一台原型机在测试中救了她，也杀了她的搭档。' },
  { name: '靠记忆活着的复制人', personality: ['温和', '警惕', '渴望被承认'], contradiction: '拥有别人的全部记忆，却没有一个人承认那是自己的人生。', want: '证明连续的记忆足以构成一个人', fear: '自己只是原件的可替换零件', mask: '从不主动谈身份', speech: '会准确复述别人多年前说过的话', body: '听到原名时会短暂停顿', backstory: '第一次被登记为耗材时，编号比名字更早被记住。' },
  { name: '把账本当武器的会计', personality: ['精确', '记仇', '不轻易站队'], contradiction: '替所有人算账，却从不敢算自己失去了什么。', want: '让每一笔被抹掉的代价重新出现', fear: '真相公开后最先被清算的是自己', mask: '只负责数字的中立者', speech: '先报数字，再说人名', body: '紧张时会反复核对同一行', backstory: '曾把一份伪造的伤亡表改回去，救了三个人，也害死了两个。' },
  { name: '相信预言的飞行员', personality: ['直觉敏锐', '冒险', '迷信自己的梦'], contradiction: '靠预判活下来，却越来越分不清预判和愿望。', want: '改变一条已经被写好的航线', fear: '所谓预言只是自己不敢承认的选择', mask: '从不看后视镜', speech: '用天气和航线打比方', body: '起飞前会摸一下舱门上的旧划痕', backstory: '她梦见的那场坠毁，最后以另一个人的名字发生。' },
  { name: '失去名字的守门人', personality: ['沉默', '忠诚', '对身份极度敏感'], contradiction: '守着一扇必须核对姓名的门，却早已忘记自己的名字。', want: '让一个没有名字的人也能被放行', fear: '门后的人根本不值得守', mask: '只认制度不认人', speech: '只问三个固定问题', body: '从不摘下左手手套', backstory: '上一次放行没有登记，整座城因此多了一个不存在的人。' },
  { name: '把敌人当读者的说客', personality: ['擅长共情', '危险地诚实', '享受博弈'], contradiction: '能说服任何人，却无法说服自己停下来。', want: '让对手亲口说出真正的条件', fear: '自己其实只是在替强者包装借口', mask: '永远站在对方立场', speech: '先复述对方最不愿承认的动机', body: '谈判时会慢慢把杯子推到桌角', backstory: '曾用一段真话让一座城投降，也让自己失去了回去的路。' },
];

const PREMISES = [
  { title: '劳动与违约：机甲驾驶员雇佣契', statement: '机甲驾驶员雇佣契由深空公会签发，表面约定工作内容、报酬与违约责任，实际用竞业条款锁死技能。', surface_rule: '雇佣契只在战损之后生效；没有契约，任何主张都不被承认。', hidden_truth: '契约真正出售的不是劳动，而是离开的权利。', scarcity: '只有深空公会签发的契约被承认；绕过它要支付未来十年的劳动。', conflict: '打捞员与公会争夺契约解释权。', leverage: '用仲裁程序冻结敌人的战舰。', counter: '把合同公开，让敌人无法继续雇佣任何人。' },
  { title: '配给与生存：氧气与冷却剂配给券', statement: '氧气与冷却剂配给券由深空后勤处签发，表面保证关键人员优先补给，实际用热量控制行为。', surface_rule: '配给券只在虫潮封锁之后生效；没有券，任何主张都不被承认。', hidden_truth: '配给点故意保持长期短缺，短缺本身就是治理工具。', scarcity: '只有后勤处签发的券被承认；绕过它要支付一年寿命。', conflict: '居民与后勤处争夺配给解释权。', leverage: '让敌人领取一份被做了标记的配给。', counter: '公开配给账本，让所有人看到谁在囤积。' },
  { title: '记忆与身份：可移植的最后一小时', statement: '跃迁前必须烧毁一份人类意识快照，快照既是导航坐标，也是一个人的最后记忆。', surface_rule: '只有登记过的快照能被烧毁；未登记的记忆不能作为导航。', hidden_truth: '虫族并不追踪飞船，它们沿着被烧毁的记忆残片提前抵达。', scarcity: '完整自我模型只存在于少数被冻结的智械中。', conflict: '人类需要快照导航，又害怕快照证明自己可以被复制。', leverage: '用一份假记忆把敌人引向空星门。', counter: '公开所有快照来源，让导航体系失去合法性。' },
  { title: '身份与耗材：复制人的姓名登记', statement: '复制人被法定为耗材，只有连续记忆能证明其人格；拟形者能复制声纹和外貌，却复制不了连续记忆。', surface_rule: '没有姓名登记的复制人不能主张权利。', hidden_truth: '登记系统真正保护的是一次性劳动力的可替换性。', scarcity: '连续记忆需要昂贵的维护，只有少数复制人负担得起。', conflict: '复制人、原件的家属与登记机构争夺人格认定权。', leverage: '用一个只有本人知道的历史问题拆穿拟形者。', counter: '把登记权交给复制人自己。' },
  { title: '预测与自由：最优解机器', statement: '顶级智械每推演一次，就不可逆地磨损一部分自我模型；它给出的最优解越来越准，也越来越不像它自己。', surface_rule: '智械的推演结果必须由人类指挥官签字才能执行。', hidden_truth: '磨损的自我模型会被打包成新的导航快照，继续参与预测。', scarcity: '完整自我模型无法复制，每一次推演都是永久损失。', conflict: '人类想要更准的预测，智械想要保留最后的自我。', leverage: '让 AI 在约束条件里写进“不许预先放弃谁”。', counter: '公开磨损曲线，让所有人看到最优解的代价。' },
  { title: '账本与真相：被改写的伤亡表', statement: '撤离名单按舱位收费，伤亡表由幸存者签字确认；被抹掉的名字不会出现在任何官方统计里。', surface_rule: '只有签字确认的伤亡才进入公共账本。', hidden_truth: '账本不是记录过去，而是在分配未来谁有资格被救。', scarcity: '可追溯的原始台账只保存在少数旧船上。', conflict: '幸存者、航运公司与监察机构争夺账本解释权。', leverage: '在公开频道逐个念出被抹掉的名字。', counter: '把账本变成全舰广播的实时数据。' },
];

const RESOURCES = [
  { name: '引航体快照', category: '凭证', meaning: '把一段人类意识转换成可被星门识别的坐标。', issuer: '深空航行署', spend_rule: '每次跃迁烧毁一份，未登记快照不能使用。', scarcity: '只有稳定自我模型能生成，制作不可逆。' },
  { name: '回响残片', category: '信息', meaning: '跃迁烧毁快照后泄漏的记忆碎片，可被虫族拟合。', issuer: '自然形成', spend_rule: '可被拦截、伪造或广播，但会暴露航线。', scarcity: '越完整的残片越能预测下一跳。' },
  { name: '完整自我模型', category: '核心资源', meaning: '智械维持人格连续性的底层结构。', issuer: '旧纪元智械', spend_rule: '每次推演磨损一部分，无法无损复制。', scarcity: '联邦仅存少数，且都被封存。' },
  { name: '撤离舱位券', category: '凭证', meaning: '决定谁能在封锁前登上撤离船。', issuer: '砚港调度处', spend_rule: '按舱位收费，记名或不记名版本同时流通。', scarcity: '封锁令下达后停止增发，黑市价格失控。' },
  { name: '跃迁配额', category: '配额', meaning: '星门网络允许的跃迁次数与优先级。', issuer: '联邦航运理事会', spend_rule: '配额可转让，但每次使用都会留下回响。', scarcity: '战时配额按政治权重分配。' },
  { name: '可执行工时', category: '劳动权', meaning: '把身体时间转换成可转让的履约能力。', issuer: '深空公会', spend_rule: '按战损结算，未结算部分由持有人承担。', scarcity: '公会通过竞业条款锁死技能。' },
];

const SCENARIOS = [
  { title: '封锁令比虫潮早到三天', pressure: '主角发现撤离名单的时间戳早于虫潮预警，必须在封锁前决定救谁。', twist: '名单不是预测，而是有人提前写好的交易。' },
  { title: '封存舱里的第二个声音', pressure: '主角打开废弃旗舰的封存舱，唤醒一个拒绝执行弃民命令的智械。', twist: '智械的第一条最优解就是放弃主角要救的人。' },
  { title: '按舱位收费的人', pressure: '撤离舱位被明码标价，主角用情报换取舱位，第一次亲手决定名单。', twist: '卖家真正想要的不是钱，而是一份未来的人情。' },
  { title: '它们知道我们要跳到哪里', pressure: '每次跃迁都被虫族提前拦截，主角必须找出回响泄漏源。', twist: '泄漏源不是设备，而是导航员被烧毁的记忆。' },
  { title: '公开账本', pressure: '主角把伤亡表全舰广播，迫使所有人面对被抹掉的名字。', twist: '账本公开后，最先失控的是被救的人。' },
  { title: '关掉引擎', pressure: '主角决定放弃跃迁，用旧航道静默穿越虫潮封锁线。', twist: '敌人最擅长的预判，在一条没有坐标的航线上失效。' },
];

function resultId(prefix, seed, index) {
  return `${prefix}-${seed}-${String(index + 1).padStart(2, '0')}`;
}

function namecards(rng, seed, count) {
  const surnames = pickMany(rng, SURNAMES, Math.min(count, SURNAMES.length));
  const given = pickMany(rng, GIVEN, Math.min(count, GIVEN.length));
  const results = [];
  const used = new Set();
  for (let i = 0; i < count; i += 1) {
    let surname = surnames[i % surnames.length];
    let givenName = given[i % given.length];
    let name = `${surname}${givenName}`;
    let attempt = 0;
    while (used.has(name) && attempt < 40) {
      surname = SURNAMES[Math.floor(rng() * SURNAMES.length)];
      givenName = GIVEN[Math.floor(rng() * GIVEN.length)];
      name = `${surname}${givenName}`;
      attempt += 1;
    }
    used.add(name);
    const archetype = ARCHETYPES[Math.floor(rng() * ARCHETYPES.length)];
    const id = resultId('name', seed, i);
    results.push({
      id,
      name,
      surname,
      given_name: givenName,
      naming_style: pick(rng, ['hard', 'literary', 'plain']),
      archetype: archetype.name,
      personality: archetype.personality,
      contradiction: archetype.contradiction,
      want: archetype.want,
      fear: archetype.fear,
      social_mask: archetype.mask,
      speech_style: archetype.speech,
      body_language: archetype.body,
      backstory_hook: archetype.backstory,
      naming_logic: `先定原型“${archetype.name}”，再选音感；姓氏“${surname}”与名字“${givenName}”组合为“${name}”。`,
      role_tags: [i === 0 ? 'protagonist' : 'support'],
      derivation: ['archetype', 'personality', 'contradiction', 'naming_style', 'surname', 'given_name'],
    });
  }
  return results;
}

export function ideasTypes() {
  return TYPES.map((name) => ({ name }));
}

export function drawIdeas(options = {}) {
  const type = String(options.type || 'namecard').toLowerCase();
  const requestedCount = Number(options.count || 5);
  const count = Math.max(1, Math.min(20, Number.isFinite(requestedCount) ? requestedCount : 5));
  let seed = Number(options.seed || 0);
  if (!Number.isFinite(seed) || seed === 0) {
    seed = Math.floor(Math.random() * 2147483646) + 1;
  }
  const rng = mulberry32(hashSeed(`${seed}:${type}:${options.genre || ''}`));
  let results;
  if (type === 'namecard' || type === 'name' || type === 'cast') {
    results = namecards(rng, seed, count);
  } else if (type === 'premise' || type === 'engine' || type === 'worldpack' || type === 'axiom') {
    results = pickMany(rng, PREMISES, Math.min(count, PREMISES.length)).map((item, index) => ({
      id: resultId('premise', seed, index),
      title: item.title,
      statement: item.statement,
      surface_rule: item.surface_rule,
      hidden_truth: item.hidden_truth,
      scarcity: item.scarcity,
      central_conflict: item.conflict,
      protagonist_leverage: item.leverage,
      counter_expectation: item.counter,
      reference_id: options.source || 'wishmachine',
    }));
  } else if (type === 'resource' || type === 'itemcard') {
    results = pickMany(rng, RESOURCES, Math.min(count, RESOURCES.length)).map((item, index) => ({
      id: resultId('resource', seed, index),
      ...item,
    }));
  } else if (type === 'scenario' || type === 'storyline' || type === 'event' || type === 'law' || type === 'provocation' || type === 'reference') {
    results = pickMany(rng, SCENARIOS, Math.min(count, SCENARIOS.length)).map((item, index) => ({
      id: resultId(type, seed, index),
      ...item,
    }));
  } else {
    throw new Error(`unsupported ideas type: ${type}; use one of ${TYPES.join(', ')}`);
  }
  return {
    ok: true,
    section: 'ideas',
    query: {
      type,
      genre: options.genre || '',
      count,
      seed,
      source: options.source || '',
      category: options.category || '',
      level: options.level || 'axiom',
      mode: options.mode || 'balanced',
    },
    count: results.length,
    results,
    meta: {
      genre: options.genre || '',
      mode: type,
      seed,
      replay_command: `wishmachine ideas draw --type ${type}${options.genre ? ` --genre ${options.genre}` : ''} --seed ${seed} --count ${count}`,
      usage: [
        'Use names and traits as reference, not as fixed canon.',
        'Keep the seed to reproduce the draw.',
        'Do not write draw results into novel.json directly; turn them into setup/outline artifacts.',
      ],
    },
  };
}
