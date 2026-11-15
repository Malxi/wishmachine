// Narrative voice deck ("stylepack"): book-level prose voices drawn like name cards.
// Each card carries a whole register — voice distance, wording, rhythm, imagery and how a
// scene advances — plus a *measurable* rhythm target and an imagery lexicon, so a drawn card
// can be verified against the finished chapter instead of merely asked for in a prompt.
// `family` keeps two neighbouring voices out of the same book; `fits` keeps a voice out of a
// genre it would wreck (an oral-record narrator in a forensic procedural).
const VOICES = [
  {
    id: 'cold-ledger',
    label: '冷账本',
    family: 'procedural',
    voice: '极近第三人称，只贴主角的眼和手，判断让位给手续和数字',
    register: '实务口径：术语用，但第一次出现必须落到动作上',
    rhythm: '长句走手续，短句砸动作；段落偏长',
    imagery: '器物、纸、编号、冷气与水汽',
    advance: '物证流：每一场推进一件可核验的东西',
    fits: ['悬疑', '犯罪', '科幻'],
    samples: ['zh-luxun-yao-01', 'zh-zhu-ziqing-beiying-01'],
    rhythm_target: {
      paragraph_sentences: [2.8, 4.2],
      sentence_mean_chars: [14, 19],
    },
    imagery_lexicon: {
      allow: ['器械', '证件', '纸页', '编号', '冷气', '水汽', '手套', '印章'],
      ban: ['门', '走廊', '灯'],
    },
  },
  {
    id: 'oral-record',
    label: '笔录口述',
    family: 'oral',
    voice: '第一人称转述，时态混杂，叙述者会记错、会替自己辩解',
    register: '口述腔：短句、俗语、几乎没有术语',
    rhythm: '靠逗号滚，一句能拖很长，忽然收住',
    imagery: '农事、家什、气味、天气',
    advance: '问讯流：全章靠问答推进，答非所问也算推进',
    fits: ['悬疑', '乡土', '年代'],
    samples: ['zh-luxun-guxiang-01', 'zh-luxun-guxiang-02'],
    rhythm_target: {
      paragraph_sentences: [1.5, 2.3],
      sentence_mean_chars: [18, 26],
    },
    imagery_lexicon: {
      allow: ['灶', '柴', '竹篮', '雨鞋', '秤', '腌菜', '烟', '田地'],
      ban: ['鉴定', '编号', '冷柜', '封条'],
    },
  },
  {
    id: 'side-observer',
    label: '旁观者之眼',
    family: 'distant',
    voice: '外部视角，叙述者跟主角保持一臂距离，不写主角心里想什么',
    register: '克制书面语，不带行话',
    rhythm: '中长句，句子之间靠动作承接，少形容',
    imagery: '人群、门窗、光线的移动',
    advance: '旁观流：只写看得见的行为差异，让读者自己推断',
    fits: ['悬疑', '群像', '现实'],
    samples: ['zh-luxun-kongyiji-01', 'zh-luxun-kongyiji-02'],
    rhythm_target: {
      paragraph_sentences: [2.2, 3.0],
      sentence_mean_chars: [12, 16],
    },
    imagery_lexicon: {
      allow: ['柜台', '杯子', '门槛', '影子', '袖子', '板凳', '窗棂', '街面'],
      ban: ['封条', '鉴定', '尸'],
    },
  },
  {
    id: 'gusty-long-sentence',
    label: '长句沉郁',
    family: 'lyric',
    voice: '第三人称偏近，情绪压在景物和身体感受里',
    register: '书面语偏旧，允许一个长定语',
    rhythm: '长句为主，段落整块推进，收在物象上',
    imagery: '风、雨、光、旧物与身体冷热',
    advance: '情绪流：每场改变一次人物对处境的态度',
    fits: ['年代', '乡土', '爱情'],
    samples: ['zh-yu-dafu-chunfeng-01', 'zh-luxun-yao-01'],
    rhythm_target: {
      paragraph_sentences: [2.6, 3.6],
      sentence_mean_chars: [20, 28],
    },
    imagery_lexicon: {
      allow: ['风', '雨', '檐水', '炭火', '旧被', '井台', '潮气', '暮色'],
      ban: ['编号', '报告', '电极'],
    },
  },
  {
    id: 'dry-comic',
    label: '干冷讽刺',
    family: 'ironic',
    voice: '第三人称，叙述者比人物懂得多，但不说破',
    register: '口语书面混合，好用具体的荒唐细节',
    rhythm: '短句为主，靠次序制造笑点，禁解释笑点',
    imagery: '排场、账目、称谓、吃食',
    advance: '讽刺流：每场让一个人自陈其是，读者自己看见反讽',
    fits: ['现实', '群像', '悬疑'],
    samples: ['zh-lao-she-laozhang-01', 'zh-luxun-kongyiji-01'],
    rhythm_target: {
      paragraph_sentences: [1.6, 2.4],
      sentence_mean_chars: [8, 12],
    },
    imagery_lexicon: {
      allow: ['账本', '名片', '茶碗', '轿子', '酒席', '铺面', '酬金', '匾'],
      ban: ['封条', '解剖', '冷柜'],
    },
  },
  {
    id: 'spare-lyric',
    label: '素淡素描',
    family: 'lyric',
    voice: '第一人称温近，语句极简，情绪只在物件上',
    register: '日常口语，不用大词',
    rhythm: '短句连缀，几乎不用形容词，段与段之间跳跃',
    imagery: '日常器皿、光线、季节、手上动作',
    advance: '素描流：一场写完一个完整动作链，不解释意义',
    fits: ['年代', '乡土', '生活'],
    samples: ['zh-fei-ming-changri-01', 'zh-zhu-ziqing-beiying-01'],
    rhythm_target: {
      paragraph_sentences: [1.2, 1.9],
      sentence_mean_chars: [6, 10],
    },
    imagery_lexicon: {
      allow: ['碗', '针线', '门槛', '炭', '井', '窗纸', '布鞋', '菜畦'],
      ban: ['鉴定', '电极', '编号', '封条'],
    },
  },
  {
    id: 'user-climb',
    label: '上行冷叙',
    family: 'procedural',
    voice: '第三人称近身，主角在压力下做判断，判断写短，压力写长',
    register: '现代白话，术语按需，不用网络词',
    rhythm: '长短交错，重要处故意断句',
    imagery: '台阶、闸门、器械、身体损耗',
    advance: '进步流：每场付出一次代价，换来一次可核验的进展',
    fits: ['悬疑', '科幻', '升级'],
    samples: ['zh-user-upward-eight-01', 'zh-luxun-yao-01'],
    rhythm_target: {
      paragraph_sentences: [2.0, 2.8],
      sentence_mean_chars: [10, 14],
    },
    imagery_lexicon: {
      allow: ['闸门', '台阶', '符纹', '骨节', '血痂', '铜牌', '石槽', '绳索'],
      ban: ['报告', '走廊', '解剖'],
    },
  },
  {
    id: 'dossier-flat',
    label: '卷宗干语',
    family: 'document',
    voice: '以卷宗、记录、回执为本体的拼贴叙述，人称在引文里切换',
    register: '公文与笔录引文并置，叙述句极短',
    rhythm: '条列与短句交替，引文块与动作块交替',
    imagery: '表格、印章、编号、日期、签名',
    advance: '档案流：每场多出一份材料，材料的缺口就是下一场的问题',
    fits: ['悬疑', '犯罪', '科幻'],
    samples: ['zh-luxun-kongyiji-02', 'zh-zhu-ziqing-beiying-01'],
    rhythm_target: {
      paragraph_sentences: [1.4, 2.1],
      sentence_mean_chars: [7, 11],
    },
    imagery_lexicon: {
      allow: ['回执', '表格', '印章', '日期', '签名', '编号', '附页', '存根'],
      ban: ['门', '走廊', '冷气'],
    },
  },
];

export { VOICES };
