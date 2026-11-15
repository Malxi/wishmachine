// Scene cards: concrete goals, real obstacles and paid costs, drawn one per scene.
// The pack used to copy a handful of premise strings into every scene's goal/turn/consequence,
// which left the prose writer with nothing to dramatise — so chapters came out as procedure
// checklists. These pools give each scene something to want, something blocking it, and a price.
// Slots: {obj} 物证/材料, {who} 人物, {place} 地点, {case} 案件。
const GOALS = [
  { id: 'obtain-record', text: '拿到{obj}的原件，不接受复印件' },
  { id: 'hold-person', text: '把{who}拖到天亮，不让他离开这栋楼' },
  { id: 'swap-evidence', text: '把{obj}换掉，换成一个能被追查的假货' },
  { id: 'force-appearance', text: '逼{who}自己现身，不动用任何手续' },
  { id: 'beat-to-place', text: '在对手之前赶到{place}，只差一步也算输' },
  { id: 'make-retract', text: '让{who}把说过的那句话收回去' },
  { id: 'destroy-trace', text: '消掉{obj}上的痕迹，只消一处' },
  { id: 'test-hypothesis', text: '验证一个假设：{obj}是伪造的' },
  { id: 'trade-leverage', text: '用一条把柄从{who}手里换一句话' },
  { id: 'bait-a-trap', text: '放出一个假消息，看谁先动' },
  { id: 'keep-case', text: '把{case}留在自己手里，别被转走' },
  { id: 'find-witness', text: '在名单烧掉之前找到{who}' },
];

const OBSTACLES = [
  { id: 'permission', text: '程序挡着：没有批文就碰不了{obj}' },
  { id: 'window', text: '时间窗在关：天亮或上级到场，就没有下一次' },
  { id: 'one-step-ahead', text: '对方先一步，{obj}已经被调走' },
  { id: 'evidence-refuses', text: '物证自己不配合：{obj}对不上，而且太干净' },
  { id: 'watched', text: '现场有人看着，动手就等于签字' },
  { id: 'old-debt', text: '主角的旧债被翻出来，{who}拿它当筹码' },
  { id: 'colleague', text: '{who}不配合，还把话说到了明处' },
  { id: 'family', text: '当事人不肯开口，只肯谈条件' },
  { id: 'environment', text: '环境把痕迹毁了：雨、断电或冷气停了' },
  { id: 'loophole', text: '规则有漏洞，但用一次就会留下用过的痕迹' },
  { id: 'lie', text: '{who}给的是实话，只是省掉了最关键的一段' },
  { id: 'identity', text: '死者身份本身对不上，{case}的前提松了' },
];

const COSTS = [
  { id: 'window-closed', text: '时间窗关上了，下一次要等很久' },
  { id: 'evidence-lost', text: '{obj}被销毁或被调走，只剩一句记忆' },
  { id: 'informant', text: '线人暴露了，{who}从此不会再给第二次消息' },
  { id: 'leverage', text: '把柄落到对方手里，主角从此多一个人能牵着他' },
  { id: 'internal', text: '被上级立了案，查案的人开始被查' },
  { id: 'injury', text: '有人受伤，是因为主角算漏了一步' },
  { id: 'ally-lost', text: '一个盟友退出了，退出时没有解释' },
  { id: 'own-record', text: '主角自己的一条记录进了别人的卷宗' },
  { id: 'case-moved', text: '{case}被转走，主角只剩旁听的位置' },
  { id: 'reputation', text: '职业前途受损，往后每一步都要留退路' },
  { id: 'promise', text: '欠下一个承诺，对方迟早会来收' },
  { id: 'truth-too-late', text: '真相拿到了，但要用它救的人已经救不回来' },
];

export { GOALS, OBSTACLES, COSTS };
