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
  { name: '把谎言当基础设施的广播员', personality: ['善于编故事', '临场冷静', '对真相又怕又上瘾'], contradiction: '靠假消息维持秩序，却比任何人都在意哪一句是真的。', want: '让整座城在灾难前保持秩序', fear: '自己编的最后一条消息成真', mask: '永远有官方口径', speech: '先报天气，再报伤亡，最后才说重点', body: '直播前会反复摸麦克风的网罩', backstory: '曾播报一条假停战消息，救下人群，也把一支救援队送进伏击。' },
  { name: '只会赢小局的棋手', personality: ['精于计算', '害怕终局', '对小人物异常大方'], contradiction: '每一步都能赢，却从不敢问整盘棋值不值得下。', want: '把最后一场大棋拖到不必落子', fear: '自己早已被更大的棋手当成棋子', mask: '永远只谈下一步', speech: '用棋局和赔率解释一切', body: '思考时会用指节敲桌面三次', backstory: '曾用一场必胜的局部胜利，换来整支舰队的覆灭。' },
  { name: '自愿成为样本的医生', personality: ['理性', '自我牺牲', '对疼痛有异常耐受'], contradiction: '救人的人，最不相信人能被完整救回来。', want: '用自己的身体证明意识可以连续', fear: '实验成功，却没有人承认样本是人', mask: '只谈临床结论', speech: '先讲风险，再讲概率，最后讲自己的选择', body: '说话时会按压手腕上的旧针孔', backstory: '把自己登记成第 0 号样本，才换来实验室继续运转。' },
  { name: '替罪羊律师', personality: ['擅长规则', '愧疚', '在法庭上极其锋利'], contradiction: '替所有人争取程序正义，却知道自己第一次胜诉靠的是伪证。', want: '让制度承认一次真正的错误', fear: '自己只是更会写材料的替罪羊', mask: '只谈证据链', speech: '先问时间，再问签名，最后问谁受益', body: '开庭前会把袖口折到同一高度', backstory: '曾用一份漏洞百出的证词让无辜者认罪，后来用十年替他翻案。' },
  { name: '失去痛觉的战士', personality: ['勇敢', '迟钝', '对他人疼痛过度敏感'], contradiction: '自己感觉不到疼，却能一眼看出别人在硬撑。', want: '找到一个值得自己停下的理由', fear: '自己只是被改造成不会退出的人', mask: '永远说“我没事”', speech: '用最短的句子报告状态', body: '受伤后会先检查别人的伤口', backstory: '第一次失去痛觉，是在一场没人记得他名字的防守战里。' },
];

const PREMISES = [
  { title: '劳动与违约：机甲驾驶员雇佣契', statement: '机甲驾驶员雇佣契由深空公会签发，表面约定工作内容、报酬与违约责任，实际用竞业条款锁死技能。', surface_rule: '雇佣契只在战损之后生效；没有契约，任何主张都不被承认。', hidden_truth: '契约真正出售的不是劳动，而是离开的权利。', scarcity: '只有深空公会签发的契约被承认；绕过它要支付未来十年的劳动。', conflict: '打捞员与公会争夺契约解释权。', leverage: '用仲裁程序冻结敌人的战舰。', counter: '把合同公开，让敌人无法继续雇佣任何人。' },
  { title: '配给与生存：氧气与冷却剂配给券', statement: '氧气与冷却剂配给券由深空后勤处签发，表面保证关键人员优先补给，实际用热量控制行为。', surface_rule: '配给券只在虫潮封锁之后生效；没有券，任何主张都不被承认。', hidden_truth: '配给点故意保持长期短缺，短缺本身就是治理工具。', scarcity: '只有后勤处签发的券被承认；绕过它要支付一年寿命。', conflict: '居民与后勤处争夺配给解释权。', leverage: '让敌人领取一份被做了标记的配给。', counter: '公开配给账本，让所有人看到谁在囤积。' },
  { title: '记忆与身份：可移植的最后一小时', statement: '跃迁前必须烧毁一份人类意识快照，快照既是导航坐标，也是一个人的最后记忆。', surface_rule: '只有登记过的快照能被烧毁；未登记的记忆不能作为导航。', hidden_truth: '虫族并不追踪飞船，它们沿着被烧毁的记忆残片提前抵达。', scarcity: '完整自我模型只存在于少数被冻结的智械中。', conflict: '人类需要快照导航，又害怕快照证明自己可以被复制。', leverage: '用一份假记忆把敌人引向空星门。', counter: '公开所有快照来源，让导航体系失去合法性。' },
  { title: '身份与耗材：复制人的姓名登记', statement: '复制人被法定为耗材，只有连续记忆能证明其人格；拟形者能复制声纹和外貌，却复制不了连续记忆。', surface_rule: '没有姓名登记的复制人不能主张权利。', hidden_truth: '登记系统真正保护的是一次性劳动力的可替换性。', scarcity: '连续记忆需要昂贵的维护，只有少数复制人负担得起。', conflict: '复制人、原件的家属与登记机构争夺人格认定权。', leverage: '用一个只有本人知道的历史问题拆穿拟形者。', counter: '把登记权交给复制人自己。' },
  { title: '预测与自由：最优解机器', statement: '顶级智械每推演一次，就不可逆地磨损一部分自我模型；它给出的最优解越来越准，也越来越不像它自己。', surface_rule: '智械的推演结果必须由人类指挥官签字才能执行。', hidden_truth: '磨损的自我模型会被打包成新的导航快照，继续参与预测。', scarcity: '完整自我模型无法复制，每一次推演都是永久损失。', conflict: '人类想要更准的预测，智械想要保留最后的自我。', leverage: '让 AI 在约束条件里写进“不许预先放弃谁”。', counter: '公开磨损曲线，让所有人看到最优解的代价。' },
  { title: '账本与真相：被改写的伤亡表', statement: '撤离名单按舱位收费，伤亡表由幸存者签字确认；被抹掉的名字不会出现在任何官方统计里。', surface_rule: '只有签字确认的伤亡才进入公共账本。', hidden_truth: '账本不是记录过去，而是在分配未来谁有资格被救。', scarcity: '可追溯的原始台账只保存在少数旧船上。', conflict: '幸存者、航运公司与监察机构争夺账本解释权。', leverage: '在公开频道逐个念出被抹掉的名字。', counter: '把账本变成全舰广播的实时数据。' },
  { title: '时间与债务：寿命抵押券', statement: '时间银行允许公民抵押未来寿命换取当下资源；抵押的时间会被转卖给需要加速航行的舰队。', surface_rule: '只有时间银行签发的寿命抵押券能兑换时间；违约者的剩余时间归银行所有。', hidden_truth: '银行真正交易的是“谁有资格活到下一站”。', scarcity: '可抵押时间只能来自本人，且一旦转卖无法赎回。', conflict: '借款人、银行与舰队争夺寿命定价权。', leverage: '用自己的抵押券买下整艘船的倒计时。', counter: '公开所有转卖记录，让时间市场失去信用。' },
  { title: '生态与配额：呼吸权拍卖', statement: '封闭城邦的空气由生态署配给，呼吸权按信用分拍卖；低分者只能购买过滤后的二手空气。', surface_rule: '没有呼吸配额的人不得进入公共舱段。', hidden_truth: '污染不是事故，而是维持配给稀缺的定期排放。', scarcity: '生态署控制全部空气循环机，私接管道会被切断整层供氧。', conflict: '居民、生态署与走私者争夺呼吸权。', leverage: '把一次泄漏事件嫁祸给配额黑市。', counter: '公开循环机的维护记录，让所有人看到排放时间表。' },
  { title: '声音与身份：声纹护照', statement: '跨星门必须验证声纹护照；声纹可以被复制，但连续对话中的语气变化无法伪造。', surface_rule: '没有声纹护照的人不能通过星门安检。', hidden_truth: '护照系统真正记录的是一个人害怕时会不会改口。', scarcity: '声纹样本只能由官方在本人清醒时采集。', conflict: '旅客、安检机构与拟形者争夺身份解释权。', leverage: '用一个只有本人知道的旧称呼拆穿复制声纹。', counter: '让所有旅客在公开频道留下无法复制的即兴回答。' },
  { title: '战功与货币：战功积分', statement: '战功积分可以兑换补给、舱位和赦免；积分由战绩记录仪自动结算，但记录仪只认官方叙事。', surface_rule: '没有记录仪确认的战功不计入积分。', hidden_truth: '积分系统奖励的不是胜利，而是可被宣传的胜利。', scarcity: '记录仪只安装在正规舰队，民兵的战功需要担保人。', conflict: '正规军、民兵与清算机构争夺战功解释权。', leverage: '用敌人的宣传记录反向证明一次被抹掉的胜利。', counter: '把积分账本交给所有参战者共同签字。' },
  { title: '睡眠与阶级：休眠舱位', statement: '远程航行必须轮流进入休眠；舱位等级决定谁先醒、谁被延长睡眠、谁在故障时被优先唤醒。', surface_rule: '只有持有休眠契约的人有权被唤醒。', hidden_truth: '故障不是随机的，系统会优先唤醒“更有用”的人。', scarcity: '休眠舱无法增建，舱位由航运公司分配。', conflict: '乘客、船员与公司争夺唤醒顺序。', leverage: '修改一次故障演练，让系统暴露自己的偏好。', counter: '公开唤醒日志，让所有人看到谁被放弃。' },
  { title: '预言与税收：未来税', statement: '预言机构对可避免的灾难征收未来税；缴税者可以获得预警，未缴税者只能在灾难发生后得到救济。', surface_rule: '只有缴清未来税的人才能进入预警名单。', hidden_truth: '预言机构会制造小灾难，证明自己预测得准。', scarcity: '预警模型只对少数高税客户开放完整参数。', conflict: '纳税人、未纳税人、预言机构争夺预警权。', leverage: '用一次未公开的预测反证机构隐瞒了更大灾难。', counter: '把预警模型开源给所有缴税者共同校准。' },
];

const RESOURCES = [
  { name: '引航体快照', category: '凭证', meaning: '把一段人类意识转换成可被星门识别的坐标。', issuer: '深空航行署', spend_rule: '每次跃迁烧毁一份，未登记快照不能使用。', scarcity: '只有稳定自我模型能生成，制作不可逆。' },
  { name: '回响残片', category: '信息', meaning: '跃迁烧毁快照后泄漏的记忆碎片，可被虫族拟合。', issuer: '自然形成', spend_rule: '可被拦截、伪造或广播，但会暴露航线。', scarcity: '越完整的残片越能预测下一跳。' },
  { name: '完整自我模型', category: '核心资源', meaning: '智械维持人格连续性的底层结构。', issuer: '旧纪元智械', spend_rule: '每次推演磨损一部分，无法无损复制。', scarcity: '联邦仅存少数，且都被封存。' },
  { name: '撤离舱位券', category: '凭证', meaning: '决定谁能在封锁前登上撤离船。', issuer: '砚港调度处', spend_rule: '按舱位收费，记名或不记名版本同时流通。', scarcity: '封锁令下达后停止增发，黑市价格失控。' },
  { name: '跃迁配额', category: '配额', meaning: '星门网络允许的跃迁次数与优先级。', issuer: '联邦航运理事会', spend_rule: '配额可转让，但每次使用都会留下回响。', scarcity: '战时配额按政治权重分配。' },
  { name: '可执行工时', category: '劳动权', meaning: '把身体时间转换成可转让的履约能力。', issuer: '深空公会', spend_rule: '按战损结算，未结算部分由持有人承担。', scarcity: '公会通过竞业条款锁死技能。' },
  { name: '寿命抵押券', category: '凭证', meaning: '把未来寿命折现成当前资源。', issuer: '时间银行', spend_rule: '兑换时扣除剩余寿命，违约后全部归银行。', scarcity: '只能抵押本人时间，转卖后不可赎回。' },
  { name: '呼吸配额', category: '配额', meaning: '决定一个人在封闭舱段里能呼吸多少过滤空气。', issuer: '生态署', spend_rule: '按信用分发放，低分者只能购买二手空气。', scarcity: '循环机由生态署独占，私接会被切断整层供氧。' },
  { name: '声纹护照', category: '身份凭证', meaning: '跨星门时证明“你是你”的声纹记录。', issuer: '星门安检局', spend_rule: '每次通行验证一次，复制声纹会被连续对话测试拆穿。', scarcity: '样本只能由官方在本人清醒时采集。' },
  { name: '战功积分', category: '货币', meaning: '用可宣传的战绩兑换补给、舱位和赦免。', issuer: '舰队清算处', spend_rule: '只认记录仪确认的战功，民兵需要担保人。', scarcity: '记录仪只装在正规舰队。' },
  { name: '休眠舱位', category: '生存资源', meaning: '远程航行中决定谁先醒、谁被延长睡眠。', issuer: '航运公司', spend_rule: '按契约分配，故障时系统优先唤醒高价值乘客。', scarcity: '舱位无法增建，黑市只卖不记名舱位。' },
  { name: '未来税单', category: '凭证', meaning: '购买灾难预警的资格。', issuer: '预言机构', spend_rule: '缴税者进入预警名单，未缴税者只能领取事后救济。', scarcity: '完整预警参数只向高税客户开放。' },
];

const SCENARIOS = [
  { title: '封锁令比虫潮早到三天', pressure: '主角发现撤离名单的时间戳早于虫潮预警，必须在封锁前决定救谁。', twist: '名单不是预测，而是有人提前写好的交易。' },
  { title: '封存舱里的第二个声音', pressure: '主角打开废弃旗舰的封存舱，唤醒一个拒绝执行弃民命令的智械。', twist: '智械的第一条最优解就是放弃主角要救的人。' },
  { title: '按舱位收费的人', pressure: '撤离舱位被明码标价，主角用情报换取舱位，第一次亲手决定名单。', twist: '卖家真正想要的不是钱，而是一份未来的人情。' },
  { title: '它们知道我们要跳到哪里', pressure: '每次跃迁都被虫族提前拦截，主角必须找出回响泄漏源。', twist: '泄漏源不是设备，而是导航员被烧毁的记忆。' },
  { title: '公开账本', pressure: '主角把伤亡表全舰广播，迫使所有人面对被抹掉的名字。', twist: '账本公开后，最先失控的是被救的人。' },
  { title: '关掉引擎', pressure: '主角决定放弃跃迁，用旧航道静默穿越虫潮封锁线。', twist: '敌人最擅长的预判，在一条没有坐标的航线上失效。' },
  { title: '最后一班撤离船', pressure: '撤离船只剩一个舱位，主角必须在承诺过的人之间做出选择。', twist: '船票不是一张，而是一份需要所有人签字的放弃声明。' },
  { title: '证词拍卖', pressure: '唯一能证明真相的证人把证词公开拍卖，出价最高者决定谁说最后一句话。', twist: '证人卖给每个人的都是真话，只是删掉了不同部分。' },
  { title: '复制人罢工', pressure: '复制人集体拒绝执行耗材任务，要求先被承认为人。', twist: '罢工领袖本人是原件，真正害怕被替代的是他。' },
  { title: '星门收费', pressure: '星门运营方临时提高通行费，主角必须在缴费和绕行之间选择。', twist: '收费不是为了钱，而是为了筛掉某艘船。' },
  { title: '假警报', pressure: '全城收到虫潮警报，主角怀疑警报是假的，但不敢赌。', twist: '警报是真的，只是提前了三天，为的是清空某片区域。' },
  { title: '母巢谈判', pressure: '虫族首次派出可交流个体，要求用一座城换取停战。', twist: '它要的不是城，而是城里那份被藏起来的自我模型。' },
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
  if (type === 'worldpack') {
    const packs = [];
    for (let packIndex = 0; packIndex < count; packIndex += 1) {
      const premise = pick(rng, PREMISES);
      const resources = pickMany(rng, RESOURCES, 2);
      const scenarios = pickMany(rng, SCENARIOS, 2);
      const cast = namecards(rng, seed + packIndex, 4);
      const packId = `worldpack-${seed}-${String(packIndex + 1).padStart(2, '0')}`;
      packs.push({
        id: packId,
        pack_id: packId,
        premise: {
          title: premise.title,
          statement: premise.statement,
          surface_rule: premise.surface_rule,
          hidden_truth: premise.hidden_truth,
          scarcity: premise.scarcity,
          central_conflict: premise.conflict,
        },
        resources: resources.map((item, index) => ({ id: `${packId}-resource-${index + 1}`, ...item })),
        scenarios: scenarios.map((item, index) => ({ id: `${packId}-scenario-${index + 1}`, ...item })),
        cast,
      });
    }
    results = packs;
  } else if (type === 'namecard' || type === 'name' || type === 'cast') {
    results = namecards(rng, seed, count);
  } else if (type === 'premise' || type === 'engine' || type === 'axiom') {
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
