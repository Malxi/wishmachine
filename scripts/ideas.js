import { hashSeed, mulberry32, pickMany, pick } from './util.js';
import { SUSPENSE, URBAN, HISTORY, ROMANCE } from './ideas-genres.js';
import { XIANXIA_ARCHETYPES, SUSPENSE_ARCHETYPES, URBAN_ARCHETYPES, HISTORY_ARCHETYPES, ROMANCE_ARCHETYPES } from './ideas-archetypes.js';

const GENRE_ARCHETYPE_POOLS = {
  xianxia: XIANXIA_ARCHETYPES,
  suspense: SUSPENSE_ARCHETYPES,
  urban: URBAN_ARCHETYPES,
  history: HISTORY_ARCHETYPES,
  romance: ROMANCE_ARCHETYPES,
};

const GENRE_ARCHETYPE_COUNTS = {
  xianxia: XIANXIA_ARCHETYPES.length,
  suspense: SUSPENSE_ARCHETYPES.length,
  urban: URBAN_ARCHETYPES.length,
  history: HISTORY_ARCHETYPES.length,
  romance: ROMANCE_ARCHETYPES.length,
};

const TYPES = [
  'provocation', 'axiom', 'event', 'law', 'scenario', 'engine',
  'worldpack', 'plotpack', 'outlinepack', 'premise', 'storyline', 'cast', 'namecard',
  'resource', 'equipment', 'itemcard', 'location', 'faction', 'motif', 'reference', 'name',
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
  { name: '把灾难当项目的管理者', personality: ['高效', '冷静', '对数字之外的东西反应迟钝'], contradiction: '能把灾难拆成可执行的清单，却无法面对清单上每一个名字。', want: '在下一波灾难前把系统修好', fear: '自己已经习惯了用“可接受损失”说话', mask: '永远在更新进度表', speech: '先说里程碑，再说伤亡', body: '开会时会把椅子推得笔直', backstory: '曾用一个漂亮的项目计划救下三千人，也让另外三百人变成计划外。' },
  { name: '替人记住承诺的档案员', personality: ['安静', '可靠', '对遗忘极度恐惧'], contradiction: '替所有人保管承诺，却从不敢要求别人记住自己的。', want: '让每一句承诺都有落点', fear: '自己保存的只是别人不再需要的旧话', mask: '只谈记录，不谈感受', speech: '引用日期、原话和见证人', body: '说话时会摸一摸胸前的旧档案夹', backstory: '曾因为漏记一句承诺，让两个家族打了十年。' },
  { name: '只会翻译坏消息的外交官', personality: ['温和', '精确', '在坏消息前异常冷静'], contradiction: '能把最坏的消息说得让人接受，却无法原谅自己说得太好。', want: '让停战多撑过下一次谈判', fear: '自己只是替强者把暴力包装成礼節', mask: '永远先替对方倒水', speech: '先复述对方立场，再翻译条件', body: '谈判时会反复调整桌上的杯子', backstory: '曾把一份投降书翻译得太体面，签字的人后来全死了。' },
  { name: '靠假死活着的继承人', personality: ['谨慎', '善于表演', '对身份极度敏感'], contradiction: '靠一场假死获得自由，却每天都在证明自己还活着。', want: '拿回被继承法吞掉的名字', fear: '真正的继承人回来时，自己会再次变成不存在的人', mask: '永远用别人的名字说话', speech: '习惯性省略主语', body: '听到真名时会下意识低头', backstory: '第一次假死时，他给自己写了一份无人认领的讣告。' },
  { name: '把救援当生意的船长', personality: ['务实', '讲义气', '对风险有野兽般的直觉'], contradiction: '靠救援赚钱，却总在最后一刻免费多救一个人。', want: '让船和船员都活到下一趟', fear: '自己迟早要为一次免费救援赔上整条船', mask: '只谈价钱，不谈良心', speech: '先报价，再问人数', body: '谈价时会用指节敲舱壁', backstory: '第一次免费救援，救上来的是仇人的女儿。' },
];

const ROLE_ARCHETYPES = {
  protagonist: ['过度理性的救援者', '被规则养大的叛徒', '把账本当武器的会计', '失去名字的守门人', '替罪羊律师', '失去痛觉的战士', '靠假死活着的继承人', '把救援当生意的船长'],
  antagonist: ['温柔的控制者', '把灾难当项目的管理者', '把谎言当基础设施的广播员', '只会赢小局的棋手', '只会翻译坏消息的外交官'],
  support: ['只看证据的审讯者', '把失败当样本的工程师', '靠记忆活着的复制人', '替人记住承诺的档案员', '相信预言的飞行员', '自愿成为样本的医生', '把敌人当读者的说客'],
};

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
  { title: '战争与记忆：阵亡者记忆债券', statement: '战争债券以阵亡者的记忆作抵押，购买者可以获得他们的战斗经验，发行方则获得预测下一场战争的数据。', surface_rule: '只有登记在册的阵亡者记忆可以证券化。', hidden_truth: '债券真正交易的是“谁有资格被记住”。', scarcity: '完整战斗记忆只存在于未受损的神经快照中。', conflict: '阵亡者家属、债券持有者与军方争夺记忆所有权。', leverage: '用一个被抹掉的阵亡者记忆证明债券造假。', counter: '把记忆收益权还给家属。' },
  { title: '语言与契约：翻译即立法', statement: '跨星区条约只能用一门已死的语言签署；翻译者因此拥有对条约的最终解释权。', surface_rule: '只有注册翻译者签署的译本具有法律效力。', hidden_truth: '翻译者可以改变一个时态，让停战变成投降。', scarcity: '能读懂死语言的翻译者只剩个位数。', conflict: '签约方、翻译者与仲裁庭争夺解释权。', leverage: '用一份旧译本证明当前条约从未生效。', counter: '让所有签约方共同学习死语言。' },
  { title: '气候与迁徙：移动城市许可证', statement: '移动城市必须持有停靠许可证才能接入陆地能源；许可证按城市人口和“未来生产力”发放。', surface_rule: '没有许可证的城市不得接入任何公共能源节点。', hidden_truth: '许可证制度真正筛选的是“哪些人值得被一起带走”。', scarcity: '能源节点有限，许可证每年重审。', conflict: '城市、陆地居民与能源公司争夺停靠权。', leverage: '用一次能源事故证明城市没有许可证也能生存。', counter: '把能源节点改为城市共同持有。' },
  { title: '继承与身份：姓名继承权', statement: '姓名可以作为遗产被继承；继承者同时继承姓名附带的债务、契约和社会关系。', surface_rule: '只有登记继承人可以使用死者的姓名。', hidden_truth: '姓名继承真正继承的是别人对死者的期待。', scarcity: '一个姓名只能有一个合法继承人。', conflict: '血亲、复制人与债权人争夺姓名。', leverage: '用死者生前的一封私信证明继承顺序被篡改。', counter: '允许姓名被共同继承。' },
  { title: '救援与优先级：救援税', statement: '救援服务由未来劳动偿付；被救者可以选择用未来十年工资换一次优先救援。', surface_rule: '只有签署救援税单的人才能进入优先序列。', hidden_truth: '救援税真正定价的是“谁的未来更值钱”。', scarcity: '优先序列名额按区域配额分配。', conflict: '被救者、救援公司与税务机构争夺偿付安排。', leverage: '用一份被低估的未来工资单证明救援公司操纵定价。', counter: '把救援改为无条件的公共品。' },
  { title: '真相与娱乐：灾难直播权', statement: '灾难现场的直播权被拍卖给出价最高的媒体；直播收益的一部分用于救援，另一部分成为股东分红。', surface_rule: '只有购买直播权的媒体可以进入灾区。', hidden_truth: '直播权真正购买的是“可以决定观众先看到谁”。', scarcity: '灾区带宽有限，只有一份主信号。', conflict: '灾民、媒体与救援机构争夺信号控制权。', leverage: '把未被剪辑的原始信号公开。', counter: '让灾民自己持有直播权。' },
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
  { name: '阵亡者记忆债券', category: '金融资产', meaning: '以阵亡者战斗记忆为抵押的战争债券。', issuer: '军方债券局', spend_rule: '持有者获得战斗经验，发行方获得预测数据。', scarcity: '完整战斗记忆只存在于未受损快照中。' },
  { name: '翻译晶体', category: '凭证', meaning: '让跨星区条约在死语言中生效的翻译密钥。', issuer: '翻译者行会', spend_rule: '每次签约消耗一枚，译本解释权归持晶者。', scarcity: '能读懂死语言的翻译者只剩个位数。' },
  { name: '迁徙许可证', category: '许可证', meaning: '移动城市接入陆地能源节点的资格。', issuer: '能源节点理事会', spend_rule: '按人口和未来生产力发放，每年重审。', scarcity: '能源节点有限，许可证可被暂停。' },
  { name: '姓名继承权', category: '身份资产', meaning: '继承死者姓名及其债务、契约和社会关系。', issuer: '姓名登记处', spend_rule: '一个姓名只能有一个合法继承人。', scarcity: '血亲、复制人与债权人会争夺同一姓名。' },
  { name: '救援税单', category: '债务凭证', meaning: '用未来劳动换取优先救援资格。', issuer: '救援公司', spend_rule: '签署后进入优先序列，未来十年工资被扣除。', scarcity: '优先名额按区域配额分配。' },
  { name: '灾难直播权', category: '媒体资产', meaning: '灾区主信号的独家播放权。', issuer: '灾区媒体理事会', spend_rule: '收益一部分用于救援，一部分分红。', scarcity: '灾区带宽有限，只有一份主信号。' },
];

const LOCATIONS = [
  { name: '长庚号舰桥', type: '舰船', description: '废弃旗舰的指挥层，舷窗被虫潮磨成毛玻璃。', function: '指挥、谈判、最后的撤离决定。', danger: '结构老化，重力分区随时失效。' },
  { name: '三号休眠舱段', type: '舰船', description: '一排排休眠舱与永远亮着的编号灯。', function: '开场、身份核验、倒计时开始。', danger: '舱位数量与名单永远对不上。' },
  { name: '砚港星门', type: '星门', description: '边境星门，收费口比门本身更大。', function: '跃迁、封锁、筛选谁有资格离开。', danger: '配额与虫潮同时到达。' },
  { name: '候补舱', type: '禁区', description: '节目与航运公司都不承认存在的舱段。', function: '藏匿被划掉的人、保存原始名册。', danger: '没有维生配额，也没有出口。' },
  { name: '母港调度台', type: '港口', description: '全星域最忙的调度中心，屏幕永远不够用。', function: '展示谁在等、谁被排到下一班。', danger: '一个签名可以改掉整支舰队的优先级。' },
  { name: '虫巢边缘', type: '异星', description: '虫群母巢外围，回响在这里凝结成可读的碎片。', function: '揭示虫族如何沿人类航线追踪。', danger: '任何信号都会吸引整群虫潮。' },
];

const FACTIONS = [
  { name: '联邦航运理事会', type: '政府机构', goal: '维持星门秩序与配额分配。', resource: '星门通行配额', method: '用优先级和审查拖住不受欢迎的舰队。', secret: '理事会自己也在黑市买卖配额。' },
  { name: '深空公会', type: '行业组织', goal: '保护签约船员的工作与竞业利益。', resource: '可执行工时', method: '用合同和仲裁冻结不听话的舰船。', secret: '公会高层把救援延迟当成谈判筹码。' },
  { name: '灾区媒体理事会', type: '媒体联盟', goal: '控制灾难直播权与观众注意力。', resource: '灾难直播权', method: '用镜头决定谁先被看见。', secret: '主信号可以延迟十一秒再播出。' },
  { name: '复制人互助会', type: '地下网络', goal: '让复制人获得姓名与人格登记。', resource: '姓名继承权', method: '伪造回收记录、替人签字。', secret: '部分成员是原件安插的线人。' },
  { name: '深空保险公司', type: '企业', goal: '把灾难变成可计算的保费。', resource: '全损保单', method: '用理赔数据预测并提前撤走资产。', secret: '公司会制造小事故来校准模型。' },
  { name: '虫群母巢', type: '异族', goal: '吞噬完整自我模型并繁殖高复杂度神经元。', resource: '回响残片', method: '沿人类跃迁泄漏的航线提前设伏。', secret: '母巢内部存在可交流个体。' },
];

const EQUIPMENT = [
  { name: '腕牌', type: '身份设备', function: '显示倒计时、在册人数与个人配额。', cost: '摘除即失去舱位与维生资格。', limit: '不能转让，不能伪造，但可以借给没有腕牌的人看。' },
  { name: '舱门切割器', type: '工程装备', function: '切开没有爆炸螺栓的舱门。', cost: '使用时会暴露位置与氧气消耗。', limit: '只能切一道门，刀头会烧毁。' },
  { name: '引航快照', type: '导航耗材', function: '让飞船锁定星门坐标。', cost: '烧毁一份人类意识快照。', limit: '未登记快照不能使用。' },
  { name: '记忆读取器', type: '审讯设备', function: '读出神经回响中的残留记忆。', cost: '被读取者会失去对应片段。', limit: '只能读取最近一次跃迁的残片。' },
  { name: '救援信标', type: '求生设备', function: '向最近舰队发送位置与幸存者名单。', cost: '开启后所有势力都会收到信号。', limit: '电池只够发送一次。' },
  { name: '舰载机甲', type: '战斗装备', function: '在舰内与虫潮中执行救援和突破。', cost: '驾驶员的神经负荷会永久累积。', limit: '需要两人协同，单人启动会烧毁接口。' },
];

const MOTIFS = [
  { title: '玛丽·塞莱斯特号的空船', type: '历史事件', period: '1872', region: '大西洋', source: 'Mary Celeste / 玛丽·塞莱斯特号（Wikipedia 可考）', keywords: ['空船', '失踪', '完好货物', '救生艇'], premise: '一艘船被发现时货物与食物完好，救生艇和全员却消失。', conflict: '幸存者、保险公司与海事法庭争夺“失踪”还是“弃船”的解释。', twist: '船上唯一缺失的是一份被替换过的航海日志。', caution: '不要把具体失踪原因写成既定事实；历史上原因未有定论。' },
  { title: '罗阿诺克殖民地的消失', type: '历史事件', period: '1587—1590', region: '北美', source: 'Roanoke Colony / 罗阿诺克殖民地（Wikipedia 可考）', keywords: ['殖民地', 'CROATOAN', '失踪', '补给延迟'], premise: '整座殖民地在补给船返回时消失，只留下一个刻在树上的词。', conflict: '救援者必须在“被原住民接纳”和“被西班牙人摧毁”两种解释之间选择。', twist: '那个词不是地点，而是一个人的名字。', caution: '避免把原住民写成单一敌意力量；历史解释存在争议。' },
  { title: '迪亚特洛夫山口的帐篷', type: '历史事件', period: '1959', region: '乌拉尔山', source: 'Dyatlov Pass incident / 迪亚特洛夫事件（Wikipedia 可考）', keywords: ['雪山', '帐篷', '失温', '夜间撤离'], premise: '九名登山者在夜间从内部割开帐篷，赤脚冲向暴风雪。', conflict: '搜救队必须解释为什么经验丰富的队伍会在极寒中主动离开唯一庇护。', twist: '帐篷里留下的不是恐惧痕迹，而是一份被改过的路线记录。', caution: '不把单一阴谋论当作真相；事件仍有多种解释。' },
  { title: '敦煌藏经洞的封门', type: '历史事件', period: '1900', region: '敦煌', source: 'Dunhuang manuscripts / 敦煌藏经洞（Wikipedia 可考）', keywords: ['藏经洞', '封门', '写本', '守护'], premise: '一个被封存数百年的洞窟在清理流沙时被打开，里面堆满写本。', conflict: '发现者、地方官府与外来探险者争夺写本的归属。', twist: '封门不是为了保护经卷，而是为了封住一份不该被读的名单。', caution: '涉及文物外流时避免把复杂历史简化成单一掠夺叙事。' },
  { title: '山海经式的异兽记录', type: '神话地理', period: '先秦—汉', region: '中国', source: '《山海经》（公共领域古籍）', keywords: ['异兽', '山川', '祭祀', '见则'], premise: '一部古老山川志把异兽写成灾异预兆，而不是怪物图鉴。', conflict: '记录者必须决定：是如实记下异兽，还是替州府删去不祥条目。', twist: '异兽不是预兆，是记录者用动物名字藏起来的人名。', caution: '不要把不同时代的《山海经》版本混成同一套设定。' },
  { title: '画皮：借来的脸', type: '公共领域小说', period: '清', region: '中国', source: '蒲松龄《聊斋志异·画皮》（公共领域）', keywords: ['画皮', '借脸', '识破', '书生'], premise: '一张画出来的脸可以借给另一个人，但借脸的人必须替原主活完未竟之事。', conflict: '主角发现身边最亲近的人已经换过一张脸。', twist: '画皮不是伪装，而是把“别人希望你成为的样子”固定下来。', caution: '改编自公共领域小说，但不要复制原文长段。' },
  { title: '渔夫与魔鬼的契约', type: '公共领域小说', period: '阿拔斯王朝背景', region: '中东', source: '《一千零一夜·渔夫与魔鬼》（公共领域）', keywords: ['封印', '许愿', '反悔', '契约'], premise: '被封印的魔鬼承诺实现愿望，但每一次许愿都在改写封印条件。', conflict: '渔夫必须在“放它出来”和“保住封印”之间反复交易。', twist: '魔鬼真正想要的不是自由，而是让渔夫替它说出真名。', caution: '避免把中东文化做成单一异域奇观；保留具体社会关系。' },
  { title: '特洛伊木马', type: '神话史诗', period: '古希腊', region: '爱琴海', source: 'Trojan Horse / 特洛伊木马（希腊神话，公共领域）', keywords: ['木马', '围城', '献礼', '内应'], premise: '围城十年后，进攻方留下一个巨大的木制献礼，然后撤走。', conflict: '守城者必须在“烧掉它”和“把它拉进城”之间选择。', twist: '木马里没有士兵，只有一份足以让守城者互相指控的名单。', caution: '不要把神话当成单一史实；明确这是神话传统。' },
];

const SCENARIOS = [  { title: '封锁令比虫潮早到三天', pressure: '主角发现撤离名单的时间戳早于虫潮预警，必须在封锁前决定救谁。', twist: '名单不是预测，而是有人提前写好的交易。' },
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
  { title: '最后一份名单', pressure: '撤离名单只剩最后一页，主角必须在广播前决定删掉谁。', twist: '名单上多出来的名字，是主角自己。' },
  { title: '翻译错误', pressure: '停战条约在签字前一刻被发现翻译错了，双方已经撤走一半舰队。', twist: '错误是翻译者故意留下的，为了让条约有一个可以反悔的版本。' },
  { title: '继承审判', pressure: '三个自称继承人的人同时出现在姓名登记处，只有一个能继承死者的债务和姓名。', twist: '死者本人还活着，只是想让所有人先说出自己欠了什么。' },
  { title: '气候难民船', pressure: '一座移动城市申请紧急停靠，陆地居民要求先查验每个人的未来生产力。', twist: '城市真正的能源核心，是船上所有人共同维护的旧反应堆。' },
  { title: '记忆税审计', pressure: '审计员发现战争债券的阵亡者记忆里有大量重复片段。', twist: '重复片段来自同一个还活着的士兵。' },
  { title: '假死', pressure: '主角必须假死才能进入只有死者才能进入的档案区。', twist: '档案区里保存着所有“假死者”的真实名单。' },
];

const PROVOCATIONS = [
  { title: '所有人都说了真话', setup: '同一件事有七个版本，每个人都发誓自己说的是真话。', pressure: '主角必须找出哪一个版本最像谎言。' },
  { title: '救生艇超载一人', setup: '救生艇只能再承载一个人，但名单上有两个名字。', pressure: '两个人都不肯先上，也都不肯让对方留下。' },
  { title: '敌人要求的投降条件很合理', setup: '敌人承诺停火，条件只是交出一个已经死去的人。', pressure: '主角怀疑这份仁慈本身就是下一场战争的开始。' },
  { title: '全城只有一个孩子不会说谎', setup: '一种病毒让成年人无法说出完整真话，只有一个孩子免疫。', pressure: '所有阵营都想控制这个孩子。' },
  { title: '最好的朋友是复制人', setup: '主角发现最信任的朋友已经死了三年，现在的朋友是复制体。', pressure: '复制体拥有全部记忆，也真心认为自己就是那个人。' },
  { title: '最后一次跃迁会杀死所有人', setup: '星门只能再用一次，而它会把船上所有人送到敌人母巢。', pressure: '留下也会死，跳过去可能赢。' },
  { title: '预言说主角会背叛', setup: '全船都相信一条预言：主角将在终点前背叛所有人。', pressure: '主角越是试图证明预言是假的，越像在按预言行动。' },
  { title: '账本上多了一个不该有的名字', setup: '伤亡账本里出现了一个从未登船的人。', pressure: '追查这个名字会牵出整艘船的伪造身份链。' },
];

const LAWS = [
  { title: '记忆不可复制法', law: '任何自我模型只能存在一份，复制即视为谋杀。', loophole: '法律只禁止复制，没有禁止把原件拆成两份。', consequence: '所有复制人都在法律上不算“被谋杀”。' },
  { title: '跃迁配额法', law: '只有持证舰船可以使用星门，配额按战功分配。', loophole: '救援船可以临时征用配额，但必须由幸存者全体签字。', consequence: '一张签字表可以决定一艘船有没有资格逃。' },
  { title: '休眠优先法', law: '故障时优先唤醒对任务最关键的人。', loophole: '“关键”由船长在事故后补写。', consequence: '每次事故后，日志都会多出一份被修改的关键性说明。' },
  { title: '姓名登记法', law: '只有登记姓名的人才能主张人格权。', loophole: '登记可以由他人代签，只要代签人愿意承担连带责任。', consequence: '有人靠替复制人签字赚钱，也有人因此失去自己的姓名。' },
  { title: '公共账本法', law: '所有伤亡必须进入公共账本，否则视为失踪。', loophole: '失踪满七年自动转为死亡，不再计入当前伤亡。', consequence: '只要拖过七年，死人就变成统计口径问题。' },
  { title: '救援优先级法', law: '救援资源按纳税人等级分配。', loophole: '未纳税人可以通过“临时贡献”获得一次救援资格。', consequence: '灾难前的最后一小时，所有人都在补缴税款。' },
  { title: '声纹唯一法', law: '一个人的声纹只能绑定一个身份。', loophole: '同一段声纹可以由不同的人在不同时间使用。', consequence: '身份系统真正保护的是声纹，不是人。' },
  { title: '虫潮隔离法', law: '被虫潮污染的区域必须立即封锁，不得救援。', loophole: '封锁令需要地方行政长官签字才生效。', consequence: '只要没人签字，封锁区就仍然“可以救援”。' },
];

const EVENTS = [  { title: '名单提前泄露', trigger: '撤离名单在广播里被提前念出。', complication: '名单上有 37 个不该存在的人。', choice: '公开完整名单，还是只救自己认识的人。' },
  { title: '星门突然关闭', trigger: '最后一扇星门在舰队抵达前关闭。', complication: '关闭命令来自舰队内部。', choice: '追查内鬼，还是先找另一条航线。' },
  { title: '复制人拒绝编号', trigger: '一批复制人集体撕掉编号牌。', complication: '她们要求先被登记姓名，才肯执行维修任务。', choice: '承认她们，还是让整艘船停摆。' },
  { title: '敌舰请求停火', trigger: '敌方旗舰挂出停火信号。', complication: '舰上只有主角能读取对方的真实身份。', choice: '接受停火，还是趁机摧毁对方。' },
  { title: '氧气只够一半人', trigger: '循环系统故障，剩余氧气只够一半人抵达下一站。', complication: '名单上恰好有一半人是复制人。', choice: '按人数分配，还是按“人格”分配。' },
  { title: '真相直播', trigger: '有人把伤亡账本接入了全舰广播。', complication: '账本公开后，最先失控的是被救的人。', choice: '切断广播，还是让所有人继续看。' },
  { title: '旧舰发来求救', trigger: '一艘失踪十年的旧舰突然发来求救。', complication: '求救声纹属于主角已经死去的朋友。', choice: '前往救援，还是保持航线。' },
  { title: '母巢出现裂缝', trigger: '虫族母巢内部出现一道可穿越的裂缝。', complication: '裂缝只在主角的旧航线图上存在。', choice: '相信旧图，还是相信现在的星图。' },
];

const ENGINES = [  { title: '全损保险引擎', artifact: '虫洞战舰全损保单', issuer: '深空保险公司', holder: '舰队财务官', stated_purpose: '承保战舰损失并在事故后赔付', hidden_function: '用理赔数据预测下一次事故并提前撤走高价值资产', loophole: '只有保险人信标确认的残骸才算全损，而信标在船上', cost: '每次理赔都会把幸存者变成下一份保单的抵押品', protagonist_role: '唯一能签字确认全损的人', counter_expectation: '主角不逃理赔，而是让整支舰队一起理赔' },
  { title: '引航快照许可引擎', artifact: '引航体快照许可证', issuer: '深空航行署', holder: '导航员', stated_purpose: '允许飞船烧毁一份意识快照完成跃迁', hidden_function: '把死刑犯与复制人的意识变成可交易导航耗材', loophole: '许可证只登记快照来源，不登记快照是否仍然活着', cost: '每次跃迁都会泄漏一段无法回收的记忆回响', protagonist_role: '发现快照来源被伪造的技师', counter_expectation: '主角公开所有快照来源，让跃迁体系失去合法性' },
  { title: '救援优先级引擎', artifact: '救援优先级债券', issuer: '联邦救援署', holder: '撤离者', stated_purpose: '用未来劳动换取优先救援资格', hidden_function: '把救援顺序变成对“未来生产力”的定价', loophole: '债券可以转让，但债务永远跟着被救者', cost: '签署者未来十年的工资被自动扣除', protagonist_role: '替别人签下债券的调度员', counter_expectation: '主角让所有人违约，逼救援署承认救援不是商品' },
  { title: '复制人租赁引擎', artifact: '复制人租赁合同', issuer: '耗材管理局', holder: '舰船雇主', stated_purpose: '按任务租用复制人劳动力', hidden_function: '用租赁期限规避复制人的人格登记', loophole: '合同到期后复制人必须被“回收”，但回收记录可以丢失', cost: '每份合同都会制造一个无法登记姓名的人', protagonist_role: '替复制人寻找回收记录漏洞的律师', counter_expectation: '主角让复制人集体拒绝被回收，而不是替她们找新合同' },
  { title: '星门通行配额引擎', artifact: '星门通行配额', issuer: '联邦航运理事会', holder: '舰长', stated_purpose: '按战功分配星门优先权', hidden_function: '用配额把不受欢迎的舰队留在虫潮里', loophole: '救援船可以临时征用配额，但必须由幸存者全体签字', cost: '每次征用都会留下一个可以被追责的签名', protagonist_role: '被迫替全船签字的舰长', counter_expectation: '主角把配额公开拍卖，让理事会无法暗中分配' },
  { title: '记忆抵押引擎', artifact: '记忆抵押凭证', issuer: '时间银行', holder: '借款人', stated_purpose: '用未来记忆换取当前资源', hidden_function: '把抵押的记忆打包成导航快照卖给舰队', loophole: '抵押合同只写记忆时长，不写记忆内容', cost: '违约者会失去一段自己无法选择删除的过去', protagonist_role: '发现自己的记忆被转卖的人', counter_expectation: '主角买回所有被抵押的记忆，而不是只买回自己的' },
  { title: '战功评级引擎', artifact: '战功积分卡', issuer: '舰队清算处', holder: '参战者', stated_purpose: '按可验证战功兑换补给和赦免', hidden_function: '只奖励能被宣传的胜利，抹掉无法公开的代价', loophole: '记录仪只认官方叙事，民兵战功需要担保人', cost: '每一次兑换都会让一个被抹掉的名字更难被追认', protagonist_role: '替民兵担保的清算员', counter_expectation: '主角把积分账本交给所有参战者共同签字' },
  { title: '休眠轮换引擎', artifact: '休眠舱契约', issuer: '航运公司', holder: '乘客', stated_purpose: '远程航行中轮流进入休眠', hidden_function: '故障时优先唤醒对任务最关键的人，并延长“低价值”乘客的睡眠', loophole: '契约只规定唤醒顺序，不规定谁有权修改关键性', cost: '每次故障都会让同一个人多睡几年', protagonist_role: '负责修改关键性说明的船员', counter_expectation: '主角公开唤醒日志，让所有人看到谁被放弃' },
  { title: '气候迁移引擎', artifact: '移动城市停靠许可证', issuer: '能源节点理事会', holder: '城市市长', stated_purpose: '让移动城市接入陆地能源', hidden_function: '按“未来生产力”筛选哪些城市值得被接走', loophole: '许可证可以临时转让，但转让后原城市失去排队资格', cost: '每次停靠都会让一座城市被降级', protagonist_role: '替难民城市谈判的调度员', counter_expectation: '主角让所有城市共同持有能源节点' },
  { title: '语言翻译引擎', artifact: '死语言翻译晶体', issuer: '翻译者行会', holder: '签约方', stated_purpose: '让跨星区条约在死语言中生效', hidden_function: '翻译者可以改变一个时态，让停战变成投降', loophole: '只有注册译本有效，但注册不要求公开原文', cost: '每次签约都会让一门语言少一个活着的使用者', protagonist_role: '发现旧译本被篡改的翻译者', counter_expectation: '主角让所有签约方共同学习死语言' },
  { title: '姓名继承引擎', artifact: '姓名继承证书', issuer: '姓名登记处', holder: '继承人', stated_purpose: '继承死者的姓名、债务和社会关系', hidden_function: '把死者生前积累的信任变成可继承资产', loophole: '一个姓名只能有一个合法继承人，但“合法”可以由登记处解释', cost: '继承者会逐渐活成别人期待的样子', protagonist_role: '同时被三个家族认领的继承人', counter_expectation: '主角把姓名交还给所有被继承者' },
  { title: '灾难直播引擎', artifact: '灾难直播权', issuer: '灾区媒体理事会', holder: '媒体', stated_purpose: '拍卖灾区主信号，收益用于救援', hidden_function: '决定观众先看到谁，从而决定谁先被救', loophole: '直播权只覆盖主信号，灾民自己的记录不算“直播”', cost: '每一次收视都会让救援资源向镜头倾斜', protagonist_role: '拒绝剪辑原始信号的记者', counter_expectation: '主角把直播权交给灾民自己' },
];

const STORYLINES = [
  { title: '逃生与救援', promise: '主角想救下所有人。', escalation: '每救一个人都要放弃另一个。', midpoint: '主角发现名单本身就是交易。', payoff: '主角拒绝在名单上签字。', cost: '拒绝签字会让救援船无法起飞。' },
  { title: '身份与继承', promise: '主角想拿回自己的名字。', escalation: '每证明一次身份，就多一个人失去名字。', midpoint: '主角发现真正的继承人还活着。', payoff: '主角把姓名交还给所有被继承者。', cost: '交还姓名会让主角失去合法身份。' },
  { title: '制度与反叛', promise: '主角想从内部修好制度。', escalation: '每修一条规则，制度就多一个漏洞。', midpoint: '主角发现制度靠漏洞维持。', payoff: '主角公开所有漏洞。', cost: '公开后最先失控的是依赖漏洞的人。' },
  { title: '真相与记忆', promise: '主角想知道自己是谁。', escalation: '每找回一段记忆，就失去一段现在。', midpoint: '主角发现自己曾经主动删除记忆。', payoff: '主角选择保留不完整的自己。', cost: '保留记忆会让导航系统失效。' },
  { title: '资源与配给', promise: '主角想让所有人活到下一站。', escalation: '氧气只够一半人，名单越来越短。', midpoint: '主角发现自己也在名单外。', payoff: '主角把配给权交给全体乘客。', cost: '全体投票会拖到氧气耗尽。' },
  { title: '预言与自由', promise: '主角想打破一条预言。', escalation: '每次反抗都让预言更准确。', midpoint: '主角发现预言记录的是自己的选择。', payoff: '主角做出一件预言没有写的事。', cost: '这件事会牺牲唯一相信他的人。' },
  { title: '复仇与宽恕', promise: '主角想让仇人付出代价。', escalation: '每接近仇人一步，就多一个无辜者被卷进来。', midpoint: '主角发现仇人也在替别人复仇。', payoff: '主角选择公开真相而不是私下处决。', cost: '公开真相会让仇人成为英雄。' },
  { title: '交易与背叛', promise: '主角想用一场交易换回所有人。', escalation: '每个交易对象都要求主角先背叛一个人。', midpoint: '主角发现自己才是交易标的。', payoff: '主角拒绝交易，让所有人重新谈判。', cost: '重新谈判会让最弱的人失去筹码。' },
  { title: '成长与代价', promise: '主角想成为能承担责任的人。', escalation: '每次承担责任都要放弃一个旧身份。', midpoint: '主角发现责任本身是被设计好的陷阱。', payoff: '主角选择承担一个没有回报的责任。', cost: '这个选择会让追随者失望。' },
  { title: '救援与牺牲', promise: '主角想救下不该被放弃的人。', escalation: '每救一个人都要让另一个人多等一小时。', midpoint: '主角发现等待的人里包括自己的家人。', payoff: '主角把救援顺序公开交给全体幸存者。', cost: '公开投票会拖慢救援。' },
  { title: '真相与谎言', promise: '主角想公开一个被掩盖的真相。', escalation: '每公开一部分真相，就制造一个新的谎言。', midpoint: '主角发现自己也依赖那个谎言活着。', payoff: '主角公开自己的部分。', cost: '公开后主角会失去唯一的安全来源。' },
  { title: '归乡与流亡', promise: '主角想回到被封锁的故乡。', escalation: '每靠近一步，故乡就多一条驱逐令。', midpoint: '主角发现故乡已经不需要他。', payoff: '主角选择帮助别人回去，而不是自己留下。', cost: '这个选择会让他再次成为流亡者。' },
];

const XIANXIA = {
  name: 'xianxia',
  premises: [
    { title: '命册与真名', statement: '修士以真名入照命册承道，名不在册则术法无应、亲族不识；每隔一甲子，宗门以清册决定谁的名字被勾去。', surface_rule: '只有登记在册的真名能引动宗门术法。', hidden_truth: '照命册不是记录，是配额；被勾去的人不死，只是再无人能记住。', scarcity: '每甲子可用空位有限，名录只能由掌册者添改。', conflict: '掌册长老、巡册使与无名者争夺谁有资格留下。', leverage: '用纸背留痕读出被勾掉的真名。', counter: '把清册改成人人可自书的公册。' },
    { title: '剑冢与认主', statement: '剑冢每甲子开一次，古剑只认一个真名；被剑认下的人必须替剑主完成未竟之约。', surface_rule: '没有剑契的人不能拔剑，强行拔剑会被剑意反噬。', hidden_truth: '剑认的不是人，是剑主临死前记住的那个名字。', scarcity: '剑冢只开七日，每柄剑只能认一次主。', conflict: '剑冢守人、宗门与散修争夺认主资格。', leverage: '用一段旧剑主记忆篡改认主结果。', counter: '让剑认一个没有名字的人。' },
    { title: '香火与神位', statement: '山神以香火愿力维持神位，香火账由宗门代管；账上少一笔，神就忘掉一个信徒。', surface_rule: '只有登记在香火账上的信徒能献祭。', hidden_truth: '神位可以买卖，香火账上的名字就是可交易资产。', scarcity: '每座山只能供一位正神，副神名额有限。', conflict: '山神、宗门与村落争夺香火分配权。', leverage: '让一个被除名的村落重新献祭。', counter: '把香火账交给所有信徒共同记账。' },
    { title: '渡劫与名额', statement: '渡劫需要宗门发放的渡劫名额；名额不是护身符，而是把天劫引到别人身上的许可。', surface_rule: '没有名额者不得在宗门境内渡劫。', hidden_truth: '每个名额都对应一个被预先选定的替劫者。', scarcity: '名额按宗门功勋发放，十年一评。', conflict: '渡劫者、替劫者与宗门争夺名额解释权。', leverage: '公开一份替劫者名单。', counter: '让所有人共同分担一次天劫。' },
    { title: '纸人与替死', statement: '替身纸人能替人挡一次死劫，但纸人必须继承被替者的名字与因果。', surface_rule: '只有写上真名的纸人才有效。', hidden_truth: '纸人不是替死，是把死劫转给另一个被写进纸里的人。', scarcity: '能写活纸人的符师只剩数人。', conflict: '被替者、纸人与符师争夺名字归属。', leverage: '让纸人开口说出自己被写的名字。', counter: '烧掉所有替身纸人的名册。' },
    { title: '山门与旧榜', statement: '宗门以榜文对外公布弟子功过，榜文只报天时、人数与结论，不报名字；被除名者会从所有人的记忆里淡去。', surface_rule: '只有榜上有名者算宗门弟子。', hidden_truth: '榜文不是公告，是记忆锚点；撕掉一页，就有一批人被忘记。', scarcity: '旧榜每甲子封存一次，只有掌榜者能改。', conflict: '掌榜者、被除名者与外来巡册使争夺榜文。', leverage: '把旧榜上的名字逐个念出来。', counter: '让每个弟子自己写自己的榜。' },
  ],
  resources: [
    { name: '真名玉册', category: '宗门重器', meaning: '记录修士真名与命数的玉册。', issuer: '悬名宗掌册堂', spend_rule: '每次添改需掌册者朱笔与本人本命血。', scarcity: '玉册只有一册，页数不可增。' },
    { name: '本命血墨', category: '书写材料', meaning: '以本人本命血调成的墨，能把名字写进命册。', issuer: '各宗自行调制', spend_rule: '写一次伤一次根本，不可连续使用。', scarcity: '取血过多会伤及道基。' },
    { name: '香火愿力', category: '神力资源', meaning: '信徒香火凝成的愿力，可维持神位与术法。', issuer: '山神与村落', spend_rule: '按香火账分配，账上无名者无法献祭。', scarcity: '每座山的香火总量有限。' },
    { name: '剑契', category: '契约', meaning: '古剑认主后留下的契约，写明剑主未竟之约。', issuer: '剑冢', spend_rule: '持契者可借剑意一次，必须履约。', scarcity: '一柄剑只能有一份剑契。' },
    { name: '渡劫名额', category: '许可', meaning: '允许在宗门境内渡劫的凭证，同时指定替劫者。', issuer: '宗门功勋堂', spend_rule: '使用后替劫者承担天劫。', scarcity: '十年只发数枚。' },
    { name: '替身纸人', category: '消耗品', meaning: '写上真名后可替人挡一次死劫的纸人。', issuer: '符师', spend_rule: '纸人必须继承被替者的名字与因果。', scarcity: '能写活纸人的符师极少。' },
  ],
  scenarios: [
    { title: '第七行空了', pressure: '抄册执事发现命册第七行整行空白，满房人都说本来只有六人。', twist: '纸背浮出的名字，是他自己三十年前被勾掉的真名。' },
    { title: '洗墨池边的无名客', pressure: '一个无名客每天在池边写同一个字，写到第三笔就停。', twist: '他写的不是字，是三十年前替主角补名的那一笔。' },
    { title: '剑冢开冢', pressure: '剑冢提前开启，所有古剑同时指向一个没有名字的散修。', twist: '剑认的不是散修，是散修体内被封印的旧剑主。' },
    { title: '香火账对不上', pressure: '山神发现香火账少了一整页，信徒开始忘记自己的村落。', twist: '少掉的那页被宗门拿去给另一座山买了神位。' },
    { title: '清册之夜', pressure: '宗门提前三年开清册，名单上第一个名字是掌册长老自己。', twist: '多出来的那个空位，是留给主角的。' },
    { title: '渡劫替名', pressure: '主角拿到一枚渡劫名额，却发现替劫者是自己唯一的亲人。', twist: '名额本来就是用亲人的命换来的。' },
    { title: '旧剑主归来', pressure: '剑冢开冢时，一柄古剑自己飞出，指向一个没有剑契的散修。', twist: '散修体内藏着旧剑主最后一缕剑意。' },
    { title: '山神换位', pressure: '山神突然要求换位，把神位让给一个被除名的村落。', twist: '村落里供奉的是一块没有名字的牌位。' },
  ],
  engines: [
    { title: '照命册清册引擎', artifact: '照命册与朱砂判笔', issuer: '悬名宗掌册堂', holder: '掌册长老', stated_purpose: '记录真名、维持宗门术法', hidden_function: '用清册配额决定谁被忘记', loophole: '朱笔只能勾名字，不能勾掉纸背的留痕', cost: '每勾一人，掌册者自己的名字也淡一分', protagonist_role: '能读出纸背旧名的抄册执事', counter_expectation: '主角不把自己写回去，而是让所有人自己写名' },
    { title: '剑冢认主引擎', artifact: '剑契', issuer: '剑冢守人', holder: '古剑', stated_purpose: '为古剑寻找能履约的新剑主', hidden_function: '把旧剑主的未竟之约转给新剑主', loophole: '剑只认名字，不认名字下面的人', cost: '新剑主必须替旧剑主完成一件旧事', protagonist_role: '没有名字却被古剑认下的散修', counter_expectation: '主角让剑认一个无名者，而不是最强的剑修' },
    { title: '香火神位引擎', artifact: '香火账', issuer: '山神祠', holder: '山神', stated_purpose: '按香火分配愿力，维持神位', hidden_function: '把信徒的名字当成可交易的神位资产', loophole: '香火账只记名字，不记名字背后的人', cost: '每卖一个神位，就有一整个村落被忘记', protagonist_role: '替山神查账的记名弟子', counter_expectation: '主角把香火账交给所有信徒共同记' },
    { title: '渡劫名额引擎', artifact: '渡劫名额', issuer: '宗门功勋堂', holder: '渡劫者', stated_purpose: '把天劫引到指定替劫者身上', hidden_function: '用替劫者的命保住宗门天才', loophole: '名额只写替劫者姓名，不写他是否同意', cost: '每次渡劫都会让一个家族失去一个人', protagonist_role: '被选为替劫者的外门弟子', counter_expectation: '主角在渡劫台上公开替劫者名单' },
    { title: '替身纸人引擎', artifact: '替身纸人', issuer: '符师', holder: '被替者', stated_purpose: '替人挡一次死劫', hidden_function: '把死劫转给纸人里被写进名字的另一个人', loophole: '纸人只认名字，不认因果', cost: '每用一次纸人，就有一个人被从记忆里抹去', protagonist_role: '发现纸人名册的符师学徒', counter_expectation: '主角烧掉所有纸人名册，让替死失效' },
    { title: '宗门榜文引擎', artifact: '宗门榜文', issuer: '传功阁', holder: '掌榜者', stated_purpose: '公布弟子功过与宗门大事', hidden_function: '用榜文锚定记忆，撕掉一页就有一批人被忘记', loophole: '榜文只报天时、人数和结论，不报名字', cost: '每改一次榜，掌榜者就少一段自己的记忆', protagonist_role: '替掌榜者抄榜的记名弟子', counter_expectation: '主角把榜文改成所有人自己写的公开榜' },
  ],
  storylines: [
    { title: '空名案', promise: '主角想查清一个不存在的人。', escalation: '每查一层，就多一个被从记忆里抹掉的人。', midpoint: '主角发现自己的名字也在被勾掉的名单上。', payoff: '主角查清清册的配额本质。', cost: '公开真相会让宗门术法失效。' },
    { title: '我是谁的名字', promise: '主角想知道自己是谁。', escalation: '每找回一段旧名，就失去一段现在。', midpoint: '主角发现自己是被补名写回来的。', payoff: '主角拒绝把自己写回去。', cost: '拒绝写回会让他从所有人记忆里消失。' },
    { title: '宗门清册', promise: '主角想阻止下一次清册。', escalation: '每阻止一次，掌册者就提前一次。', midpoint: '主角发现清册已经运行了六十年。', payoff: '主角把清册改成公册。', cost: '公册需要有人永远坐在册页边上记录。' },
    { title: '旧脉归名', promise: '主角想找回被整脉抹掉的旧人。', escalation: '每找回一个名字，就惊动一个还在位的既得利益者。', midpoint: '旧脉不是被魔所灭，是被宗门自己抹掉。', payoff: '旧脉姓名被逐个写回。', cost: '写回名字会让当年的执行者无法再躲。' },
    { title: '香火账', promise: '主角想让一座山神记起被除名的村落。', escalation: '每找回一个信徒，香火账上就多一笔对不上的愿力。', midpoint: '山神自己就是被除名者名单上的一员。', payoff: '主角把香火账改成所有信徒共同记账。', cost: '公开账本会让山神失去神位。' },
  ],
  locations: [
    { name: '悬名宗·录事房', type: '宗门', description: '抄册执事日夜誊写真名的低矮房间，灯永远添到第三盏。', function: '发现空行、抄录旧名、把私账带出去。', danger: '每一页都可能是下一次清册的名单。' },
    { name: '洗墨池', type: '宗门', description: '废弃的洗笔池，水面浮着一层洗不掉的旧墨。', function: '遇见无名客、读出回环。', danger: '池边的人说不出自己的名字。' },
    { name: '沉剑谷', type: '旧战场', description: '照夜一脉被整册清零的谷地，屋舍停在最后一件事的姿态。', function: '揭示六十年前的旧案。', danger: '谷中旧名会一层层压在纸背上。' },
    { name: '藏册阁', type: '禁地', description: '只问三个问题、从不摘左手手套的守门人看守的旧档库。', function: '取得《应名录》残页。', danger: '第三问会让人自己说出要找的名字。' },
    { name: '剑冢', type: '禁地', description: '古剑插满山坡，每柄剑都在等一个真名。', function: '认主、取得剑契。', danger: '没有名字的人会被剑意反噬。' },
    { name: '山门·旧榜墙', type: '宗门', description: '贴满历代榜文的石墙，朱印一层叠一层。', function: '公开真相、改榜。', danger: '撕掉一页，就有一批人被忘记。' },
  ],
  factions: [
    { name: '悬名宗掌册堂', type: '宗门机构', goal: '维持照命册与清册秩序。', resource: '真名玉册', method: '用朱笔勾名、用清册配额筛选。', secret: '掌册长老知道清册真正压住的是什么。' },
    { name: '巡册司', type: '外部监察', goal: '核对各宗清册账目。', resource: '巡册账', method: '逐笔核对，必要时替宗门掩盖。', secret: '巡册使的真实差事是保证清册按时完成。' },
    { name: '藏册阁', type: '守门人', goal: '守住旧档与三个固定问题。', resource: '旧档残页', method: '只让答对第三问的人进入。', secret: '守门人自己也是被抹名的人。' },
    { name: '剑冢守人', type: '中立势力', goal: '让古剑找到能履约的剑主。', resource: '剑契', method: '每甲子开冢一次，只认真名。', secret: '剑认的是旧剑主临终记住的名字。' },
    { name: '香火祠', type: '民间信仰', goal: '按香火账分配愿力与神位。', resource: '香火愿力', method: '用香火账决定谁还能被神记住。', secret: '神位可以买卖。' },
    { name: '符师行会', type: '匠人行会', goal: '垄断替身纸人与本命血墨的制作。', resource: '符纸与血墨', method: '只向登记符师发放制作许可。', secret: '行会替宗门处理不愿公开的替死记录。' },
    { name: '照夜一脉', type: '旧宗门', goal: '拒绝清册，保住整脉姓名。', resource: '旧榜与验状', method: '以整脉清零为代价拒绝一次清册。', secret: '他们不是被魔所灭，是被宗门自己抹掉。' },
  ],
  equipment: [
    { name: '朱砂判笔', type: '宗门法器', function: '在照命册上勾去或补回真名。', cost: '每勾一人，掌册者自己的名字也淡一分。', limit: '只能勾名字，勾不掉纸背留痕。' },
    { name: '本命血墨', type: '书写耗材', function: '把名字写进命册或纸人。', cost: '伤及道基，不可连续使用。', limit: '只能写本人或自愿让出名字的人。' },
    { name: '剑契', type: '契约凭证', function: '借古剑剑意一次。', cost: '必须替旧剑主完成未竟之约。', limit: '一柄剑只有一份剑契。' },
    { name: '替身纸人', type: '消耗品', function: '替人挡一次死劫。', cost: '把死劫转给纸人里被写名的另一个人。', limit: '纸人只认名字，不认因果。' },
    { name: '渡劫名额', type: '许可', function: '允许在宗门境内渡劫，并指定替劫者。', cost: '替劫者承担天劫。', limit: '十年只发数枚。' },
    { name: '照命册残页', type: '文书', function: '保留被勾掉的真名痕迹。', cost: '携带者会被掌册堂追踪。', limit: '离开命册越久，字迹越淡。' },
    { name: '香火灯', type: '祭祀法器', function: '聚拢香火愿力，让一个名字暂时不被忘记。', cost: '每点一次灯，就要烧掉一段自己的记忆。', limit: '灯油只够烧一夜。' },
  ],
};

function selectDeck(genre) {
  const value = String(genre || '');
  if (/仙|修|玄幻|古风|武侠|fantasy|xian/i.test(value)) return XIANXIA;
  if (/悬疑|推理|侦探|犯罪|恐怖|thriller|mystery/i.test(value)) return SUSPENSE;
  if (/都市|现代|职场|娱乐|校园|urban/i.test(value)) return URBAN;
  if (/历史|古代|朝代|民国|战争|history/i.test(value)) return HISTORY;
  if (/言情|爱情|婚恋|古言|现言|古装|现代言情|romance/i.test(value)) return ROMANCE;
  return null;
}

const DEFAULT_PACKS = [
  {
    theme: 'evacuation',
    premise: '账本与真相：被改写的伤亡表',
    motif: '玛丽·塞莱斯特号的空船',
    engine: '全损保险引擎',
    resources: ['撤离舱位券', '引航体快照'],
    scenarios: ['封锁令比虫潮早到三天', '公开账本'],
    storylines: ['逃生与救援', '身份与继承'],
    location: '长庚号舰桥',
    faction: '深空保险公司',
    equipment: '救援信标',
  },
  {
    theme: 'identity',
    premise: '身份与耗材：复制人的姓名登记',
    engine: '复制人租赁引擎',
    resources: ['声纹护照', '可执行工时'],
    scenarios: ['最后一班撤离船', '证词拍卖'],
    storylines: ['身份与继承', '交易与背叛'],
    location: '三号休眠舱段',
    faction: '复制人互助会',
    equipment: '腕牌',
  },
  {
    theme: 'gate',
    premise: '劳动与违约：机甲驾驶员雇佣契',
    motif: '特洛伊木马',
    engine: '星门通行配额引擎',
    resources: ['可执行工时', '跃迁配额'],
    scenarios: ['按舱位收费的人', '星门收费'],
    storylines: ['成长与代价', '救援与牺牲'],
    location: '砚港星门',
    faction: '深空公会',
    equipment: '舱门切割器',
  },
];

const DEFAULT_DECK = {
  name: 'default',
  premises: PREMISES,
  resources: RESOURCES,
  scenarios: SCENARIOS,
  storylines: STORYLINES,
  engines: ENGINES,
  locations: LOCATIONS,
  factions: FACTIONS,
  equipment: EQUIPMENT,
  packs: DEFAULT_PACKS,
};

const XIANXIA_PACKS = [
  {
    theme: 'name',
    premise: '命册与真名',
    motif: '敦煌藏经洞的封门',
    engine: '照命册清册引擎',
    resources: ['真名玉册', '本命血墨'],
    scenarios: ['第七行空了', '清册之夜'],
    storylines: ['空名案', '宗门清册'],
    location: '悬名宗·录事房',
    faction: '悬名宗掌册堂',
    equipment: '朱砂判笔',
  },
  {
    theme: 'sword',
    premise: '剑冢与认主',
    engine: '剑冢认主引擎',
    resources: ['剑契', '本命血墨'],
    scenarios: ['剑冢开冢', '旧剑主归来'],
    storylines: ['旧脉归名', '我是谁的名字'],
    location: '剑冢',
    faction: '剑冢守人',
    equipment: '剑契',
  },
  {
    theme: 'incense',
    premise: '香火与神位',
    engine: '香火神位引擎',
    resources: ['香火愿力', '替身纸人'],
    scenarios: ['香火账对不上', '山神换位'],
    storylines: ['香火账', '旧脉归名'],
    location: '香火祠',
    faction: '香火祠',
    equipment: '香火灯',
  },
  {
    theme: 'paper',
    premise: '纸人与替死',
    motif: '画皮：借来的脸',
    engine: '替身纸人引擎',
    resources: ['替身纸人', '本命血墨'],
    scenarios: ['洗墨池边的无名客', '清册之夜'],
    storylines: ['我是谁的名字', '空名案'],
    location: '洗墨池',
    faction: '符师行会',
    equipment: '替身纸人',
  },
];

XIANXIA.packs = XIANXIA_PACKS;

function truncatePrompt(rawPrompt, maxChars) {
  if (rawPrompt.length <= maxChars) return rawPrompt;
  const head = rawPrompt.slice(0, maxChars - 1);
  const breakAt = Math.max(head.lastIndexOf('，'), head.lastIndexOf(','), head.lastIndexOf(' / '));
  return `${(breakAt > maxChars * 0.5 ? head.slice(0, breakAt) : head).trimEnd()}…`;
}

function buildWorldpack(def, packIndex, seed, cast, sources, options = {}) {
  const find = (list, key, value) => list.find((item) => item[key] === value);
  const premise = find(sources.premises, 'title', def.premise);
  const engine = find(sources.engines, 'title', def.engine);
  const resources = def.resources.map((name) => find(sources.resources, 'name', name)).filter(Boolean);
  const scenarios = def.scenarios.map((title) => find(sources.scenarios, 'title', title)).filter(Boolean);
  const storylines = def.storylines.map((title) => find(sources.storylines, 'title', title)).filter(Boolean);
  const location = find(sources.locations, 'name', def.location);
  const faction = find(sources.factions, 'name', def.faction);
  const equipment = find(sources.equipment, 'name', def.equipment);
  const motif = def.motif ? find(MOTIFS, 'title', def.motif) : null;
  const packId = `worldpack-${seed}-${String(packIndex + 1).padStart(2, '0')}`;
  const entities = [];
  const relations = [];
  const addEntity = (type, key, label, extra = {}) => {
    const id = `${packId}:${key}`;
    entities.push({ id, type, label, ...extra });
    return id;
  };
  const relate = (from, to, type) => relations.push({ from, to, type });
  const premiseId = premise ? addEntity('premise', 'premise', premise.title) : '';
  const engineId = engine ? addEntity('engine', 'engine', engine.title) : '';
  const locationId = location ? addEntity('location', 'location', location.name) : '';
  const factionId = faction ? addEntity('faction', 'faction', faction.name) : '';
  const equipmentId = equipment ? addEntity('equipment', 'equipment', equipment.name) : '';
  const motifId = motif ? addEntity('motif', 'motif', motif.title) : '';
  const resourceIds = resources.map((item, index) => addEntity('resource', `resource-${index + 1}`, item.name));
  const scenarioIds = scenarios.map((item, index) => addEntity('scenario', `scenario-${index + 1}`, item.title));
  const storylineIds = storylines.map((item, index) => addEntity('storyline', `storyline-${index + 1}`, item.title));
  const castIds = cast.map((character, index) => addEntity('character', `character-${index + 1}`, character.name, {
    role: character.role_tags?.[0] || 'support',
    archetype: character.archetype,
    prompt: character.prompt,
    prompt_meta: character.prompt_meta,
    negative_prompt: character.negative_prompt,
    want: character.want,
  }));
  const castRelations = [];
  const relationTypes = {
    default: { opposes: 'counters', supports: 'supports', guards: 'secures', controls: 'controls', allies_with: 'allies_with', drives: 'drives', blocks: 'blocks' },
    romance: { opposes: 'rivals_with', supports: 'confides_in', guards: 'shares_space_with', controls: 'funds', allies_with: 'grows_close_to', drives: 'chooses', blocks: 'withholds', works_for: 'works_for' },
    suspense: { opposes: 'suspects', supports: 'corroborates', guards: 'secures', controls: 'handles', allies_with: 'backs_up', drives: 'investigates', blocks: 'covers_up' },
    history: { opposes: 'contends_with', supports: 'petitions', guards: 'garrisons', controls: 'holds_seal', allies_with: 'allies_with', drives: 'memorializes', blocks: 'obstructs' },
    urban: { opposes: 'competes_with', supports: 'covers_for', guards: 'keeps_keys', controls: 'owns', allies_with: 'networks_with', drives: 'pitches', blocks: 'stalls' },
    xianxia: { opposes: 'sworn_enemy', supports: 'sworn_ally', guards: 'wards', controls: 'commands', allies_with: 'shares_dao', drives: 'seeks', blocks: 'curses' },
  }[sources.name] || {};
  const castRelate = (from, to, type, stake) => {
    if (!from || !to) return;
    const relation = { from, to, type: relationTypes[type] || type, stake };
    castRelations.push(relation);
    relate(from, to, relation.type);
  };
  const leadIndex = Math.max(0, cast.findIndex((character) => (character.role_tags?.[0] || 'support') === 'protagonist'));
  const leadId = castIds[leadIndex] || castIds[0];
  if (premiseId && engineId) relate(engineId, premiseId, 'governs');
  if (factionId && engineId) relate(factionId, engineId, 'issues');
  if (locationId && engineId) relate(locationId, engineId, 'hosts');
  if (equipmentId && premiseId) relate(equipmentId, premiseId, 'enables');
  if (motifId && premiseId) relate(premiseId, motifId, 'inspired_by');
  for (const id of resourceIds) if (premiseId) relate(id, premiseId, 'constrains');
  for (const id of scenarioIds) if (premiseId) relate(id, premiseId, 'tests');
  for (const id of storylineIds) if (premiseId) relate(id, premiseId, 'dramatizes');
  if (leadId && premiseId) relate(leadId, premiseId, 'pursues');
  if (leadId && factionId) relate(leadId, factionId, 'belongs_to');
  if (leadId && locationId) relate(leadId, locationId, 'starts_at');
  if (leadId && equipmentId) relate(leadId, equipmentId, 'uses');
  const castIdsByRole = (role) => cast
    .map((character, index) => ({ character, id: castIds[index] }))
    .filter((entry) => (entry.character.role_tags?.[0] || 'support') === role)
    .map((entry) => entry.id);
  const protagonistIds = castIdsByRole('protagonist');
  const antagonistIds = castIdsByRole('antagonist');
  const supportIds = castIdsByRole('support');
  const leadProtagonists = protagonistIds.slice(1);
  for (const allyId of leadProtagonists) {
    castRelate(allyId, leadId, 'allies_with', '两名主角对同一目标有不同做法');
  }
  for (const villainId of antagonistIds) {
    castRelate(villainId, leadId, 'opposes', '谁来决定谁被留下');
    castRelate(villainId, factionId, 'controls', '反派掌握势力资源');
  }
  for (const supportId of supportIds) {
    castRelate(supportId, leadId, 'supports', '主角的目标需要这名支持者的技能');
    castRelate(supportId, locationId, 'guards', '支持者守着关键地点');
  }
  if (supportIds[0]) castRelate(supportIds[0], factionId, 'works_for', '支持者嵌在势力内部，能拿到外部拿不到的东西');
  if (leadId) castRelate(leadId, storylineIds[0], 'drives', '主角的选择推动第一条剧情线');
  if (antagonistIds[0] && storylineIds[0]) {
    castRelate(antagonistIds[0], storylineIds[0], 'blocks', '反派让第一条剧情线无法顺利完成');
  }
  const keywords = [...new Set([
    def.theme,
    premise?.title,
    motif?.title,
    engine?.artifact,
    location?.name,
    faction?.name,
    equipment?.name,
    ...cast.map((character) => character.name),
    ...new Set(castRelations.map((relation) => relation.type)),
  ].filter(Boolean))];
  const styleByDeck = {
    default: '近未来科幻，制度悬疑，冷峻，低饱和',
    xianxia: '东方玄幻，宗门，清冷，水墨',
    suspense: '犯罪悬疑，冷色，现实主义',
    urban: '都市现实，冷调，职场',
    history: '历史写实，旧纸色，考据',
  };
  const negativeByDeck = {
    default: 'anachronism, genre mismatch, inconsistent rules, generic fantasy, lore dump, overpowered protagonist',
    xianxia: 'guns, spaceships, modern bureaucracy, anachronism, genre mismatch',
    suspense: 'supernatural solution, magic, coincidental evidence, genre mismatch',
    urban: 'fantasy races, spaceships, medieval setting, genre mismatch',
    history: 'modern technology, plastic, neon, anachronistic bureaucracy, genre mismatch',
    romance: 'spaceships, fantasy races, magic systems, battle scenes, genre mismatch',
  };
  const style = styleByDeck[sources.name] || styleByDeck.default;
  const rawPrompt = [
    style,
    `${def.theme} 主题`,
    premise?.title,
    motif?.title,
    engine?.artifact,
    location?.name,
    faction?.name,
    equipment?.name,
    [...new Set(castRelations.map((relation) => relation.type))].join(' / '),
  ].filter(Boolean).join('，');
  const promptChars = Math.max(80, Math.min(2000, Number(options.promptChars) || 800));
  const rawPromptLength = rawPrompt.length;
  const prompt = truncatePrompt(rawPrompt, promptChars);
  const promptPack = {
    positive: prompt,
    negative: negativeByDeck[sources.name] || negativeByDeck.default,
    style,
    keywords,
    max_chars: promptChars,
    raw_chars: rawPromptLength,
    truncated: rawPromptLength > promptChars,
  };
  return {
    id: packId,
    pack_id: packId,
    theme: def.theme,
    prompt,
    prompt_pack: promptPack,
    negative_prompt: promptPack.negative,
    keywords,
    premise: premise ? {
      title: premise.title,
      statement: premise.statement,
      surface_rule: premise.surface_rule,
      hidden_truth: premise.hidden_truth,
      scarcity: premise.scarcity,
      central_conflict: premise.conflict,
    } : null,
    resources: resources.map((item, index) => ({ id: `${packId}-resource-${index + 1}`, ...item })),
    scenarios: scenarios.map((item, index) => ({ id: `${packId}-scenario-${index + 1}`, ...item })),
    storylines: storylines.map((item, index) => ({ id: `${packId}-storyline-${index + 1}`, ...item })),
    engine: engine ? { id: `${packId}-engine`, ...engine } : null,
    location: location ? { id: `${packId}-location`, ...location } : null,
    faction: faction ? { id: `${packId}-faction`, ...faction } : null,
    equipment: equipment ? { id: `${packId}-equipment`, ...equipment } : null,
    motif: motif ? { id: `${packId}-motif`, ...motif } : null,
    entities,
    relations,
    cast_relations: castRelations,
    graph: { entities, relations },
    cast,
  };
}

function buildPlotpack(pack, seed, index) {
  const premise = pack.premise;
  const storyline = pack.storylines?.[0] || null;
  const scenarioA = pack.scenarios?.[0] || null;
  const scenarioB = pack.scenarios?.[1] || null;
  const blocking = (pack.cast_relations || []).find((relation) => relation.type === 'blocks') || null;
  const support = (pack.cast_relations || []).find((relation) => relation.type === 'supports') || null;
  const beats = [
    {
      act: 'Act I',
      chapter: 1,
      function: 'setup',
      beat: premise ? `${premise.title}：先让读者看见${premise.surface_rule}` : '先展示世界规则与主角的日常。',
      source: 'premise',
      source_id: pack.id,
    },
    {
      act: 'Act I',
      chapter: 2,
      function: 'inciting',
      beat: scenarioA ? scenarioA.pressure : '一个事件打破日常，主角被迫做出第一次选择。',
      source: 'scenario',
      source_id: scenarioA?.id || '',
    },
    {
      act: 'Act II',
      chapter: 3,
      function: 'midpoint',
      beat: scenarioB ? scenarioB.twist : storyline?.midpoint || '主角发现规则背后还有一层规则。',
      source: 'scenario',
      source_id: scenarioB?.id || '',
    },
    {
      act: 'Act II',
      chapter: 4,
      function: 'crisis',
      beat: blocking
        ? `${blocking.stake}；反派让主角第一次付出无法回收的代价。`
        : storyline?.payoff || '主角必须在两个都不想要的答案之间选择。',
      source: 'cast_relation',
      source_id: blocking ? `${blocking.from}->${blocking.to}` : '',
    },
    {
      act: 'Act III',
      chapter: 5,
      function: 'climax',
      beat: storyline ? storyline.payoff : '主角用自己的方式改写规则。',
      source: 'storyline',
      source_id: storyline?.title || '',
    },
    {
      act: 'Act III',
      chapter: 6,
      function: 'resolution',
      beat: storyline ? `代价落地：${storyline.cost}` : '胜利留下一个无法撤销的代价。',
      source: 'storyline',
      source_id: storyline?.title || '',
    },
  ];
  if (support) {
    beats[3].support = support.stake;
  }
  const id = `plotpack-${seed}-${String(index + 1).padStart(2, '0')}`;
  return {
    id,
    plot_id: id,
    worldpack_id: pack.id,
    genre: pack.genre || '',
    theme: pack.theme,
    premise,
    location: pack.location,
    faction: pack.faction,
    equipment: pack.equipment,
    engine: pack.engine,
    cast: pack.cast,
    cast_relations: pack.cast_relations,
    resources: pack.resources,
    scenarios: pack.scenarios,
    storyline,
    storylines: pack.storylines,
    events: beats.map((beat) => ({
      act: beat.act,
      chapter: beat.chapter,
      function: beat.function,
      event: beat.beat,
    })),
    beats,
    keywords: pack.keywords,
    motif: pack.motif,
    prompt_pack: pack.prompt_pack,
    graph: {
      entities: [
        ...(pack.entities || []),
        { id: `${id}:plot`, type: 'plot', label: `${premise?.title || 'plot'} 剧情包` },
        ...beats.map((beat) => ({
          id: `${id}:beat-${beat.chapter}`,
          type: 'beat',
          label: `${beat.act} · ${beat.function}`,
        })),
      ],
      relations: [
        ...(pack.relations || []),
        { from: `${id}:plot`, to: `${id}:beat-1`, type: 'starts_with' },
        { from: `${id}:plot`, to: `${id}:beat-6`, type: 'ends_with' },
      ],
    },
  };
}

function sortMysteryLinks(links) {
  const unique = new Map();
  for (const link of links || []) {
    if (link?.id && !unique.has(link.id)) unique.set(link.id, link);
  }
  return [...unique.values()].sort((left, right) => (
    String(left.chapter_id || '').localeCompare(String(right.chapter_id || ''), undefined, { numeric: true })
    || String(left.id || '').localeCompare(String(right.id || ''), undefined, { numeric: true })
  ));
}

function chapterResolvedMysteries(chapter) {
  return [
    ...(chapter.mysteries?.resolved || []),
    ...(chapter.scenes || []).flatMap((scene) => scene.mysteries?.resolved || []),
  ];
}

function collectMysteryRegistry(chapters) {
  const registry = new Map();
  const priority = { open: 0, dropped: 1, resolved: 2 };
  const add = (mystery, chapterId, source) => {
    if (!mystery?.id) return;
    const existing = registry.get(mystery.id);
    if (existing && (priority[existing.status] || 0) >= (priority[mystery.status] || 0)) return;
    registry.set(mystery.id, {
      ...mystery,
      chapter_id: chapterId,
      source,
    });
  };
  for (const chapter of chapters) {
    for (const key of ['carried', 'planted', 'resolved', 'dropped']) {
      for (const mystery of chapter.mysteries?.[key] || []) add(mystery, chapter.id, `chapter.${key}`);
    }
    for (const scene of chapter.scenes || []) {
      for (const key of ['planted', 'resolved']) {
        for (const mystery of scene.mysteries?.[key] || []) add(mystery, chapter.id, `scene.${key}`);
      }
    }
  }
  return [...registry.values()].sort((left, right) => (
    String(left.chapter_id || '').localeCompare(String(right.chapter_id || ''), undefined, { numeric: true })
    || String(left.id || '').localeCompare(String(right.id || ''), undefined, { numeric: true })
  ));
}

function buildOutlinePack(plot, seed, options = {}) {
  const chapters = Math.max(3, Math.min(60, Number(options.chapters) || 10));
  const scenesPerChapter = Math.max(1, Math.min(5, Number(options.scenes) || 3));
  const targetChars = Math.max(500, Math.min(10000, Number(options.targetChars) || 3000));
  const beats = plot.beats || [];
  const castNames = (plot.cast || []).map((character) => character.name);
  const castIds = (plot.cast || []).map((character) => character.id);
  const leadCast = (plot.cast || [])
    .filter((character) => ['protagonist', 'antagonist'].includes(character.role_tags?.[0]))
    .map((character) => character.name);
  const leadCastIds = (plot.cast || [])
    .filter((character) => ['protagonist', 'antagonist'].includes(character.role_tags?.[0]))
    .map((character) => character.id);
  const supportCast = (plot.cast || [])
    .filter((character) => character.role_tags?.[0] === 'support')
    .map((character) => character.name);
  const supportCastIds = (plot.cast || [])
    .filter((character) => character.role_tags?.[0] === 'support')
    .map((character) => character.id);
  const sceneCast = [...new Set([castNames[0], ...supportCast].filter(Boolean))].slice(0, 2);
  const sceneCastIds = [...new Set([castIds[0], ...supportCastIds].filter(Boolean))].slice(0, 2);
  const protagonist = castNames[0] || '主角';
  const threadId = plot.storyline?.id || plot.storyline?.title || '';
  const pacingByFunction = {
    setup: 'slow build',
    inciting: 'rising',
    midpoint: 'turn',
    crisis: 'high pressure',
    climax: 'climax',
    resolution: 'falling',
  };
  const scenarioA = plot.scenarios?.[0] || null;
  const scenarioB = plot.scenarios?.[1] || null;
  const blocking = (plot.cast_relations || []).find((relation) => relation.type === 'blocks') || null;
  const chapterList = [];
  const volumeId = options.volumeId || 'P1-V1';
  const chapterOffset = Number(options.chapterOffset) || 0;
  const totalChapters = Number(options.totalChapters) || chapters;
  let previousChapterConsequence = options.previousConsequence || '';
  let pendingMysteries = Array.isArray(options.carriedMysteries) ? options.carriedMysteries.slice() : [];
  let droppedMysteries = [];
  for (let index = 0; index < chapters; index += 1) {
    const globalIndex = chapterOffset + index;
    const entryFromPrevious = previousChapterConsequence;
    const entrySummary = entryFromPrevious.length > 120
      ? `${entryFromPrevious.slice(0, 120)}…`
      : entryFromPrevious;
    const beat = beats[Math.min(beats.length - 1, Math.floor((globalIndex * beats.length) / totalChapters))] || beats[0] || {
      act: 'Act I', function: 'setup', beat: '主角进入故事。',
    };
    const chapterId = `${volumeId}-C${index + 1}`;
    const obstacleByFunction = {
      setup: scenarioA?.pressure,
      inciting: scenarioA?.twist,
      midpoint: scenarioB?.twist,
      crisis: blocking?.stake,
      climax: plot.storyline?.cost,
      resolution: plot.storyline?.cost,
    };
    const baseObstacle = obstacleByFunction[beat.function]
      || plot.premise?.central_conflict
      || '规则阻止主角推进';
    const chapterObstacle = entryFromPrevious
      ? `上一章后果未解：${entrySummary}；${baseObstacle}`
      : baseObstacle;
    const carriedMysteries = pendingMysteries.slice(0, 3).map((item) => ({
      ...item,
      status: 'open',
    }));
    const mysteries = {
      carried: carriedMysteries,
      planted: [],
      resolved: [],
      dropped: [],
    };
    if (beat.function === 'setup' && plot.premise?.hidden_truth) {
      mysteries.planted.push({
        id: `${chapterId}-mystery-1`,
        question: plot.premise.hidden_truth,
        answer: plot.storyline?.payoff || '',
        payoff: plot.storyline?.cost || '',
        mystery: plot.premise.hidden_truth,
        importance: 10,
        thread: plot.storyline?.title || 'premise',
        thread_id: threadId || 'premise',
        thread_type: 'premise',
        related_cast: leadCast,
        related_cast_ids: leadCastIds,
        planted_in: chapterId,
        status: 'open',
      });
    }
    if (beat.function === 'midpoint' && scenarioB?.twist) {
      mysteries.planted.push({
        id: `${chapterId}-mystery-1`,
        question: scenarioB.twist,
        answer: plot.storyline?.payoff || '',
        payoff: plot.storyline?.cost || '',
        mystery: scenarioB.twist,
        importance: 8,
        thread: plot.storyline?.title || 'storyline',
        thread_id: threadId || 'storyline',
        thread_type: 'storyline',
        related_cast: leadCast,
        related_cast_ids: leadCastIds,
        planted_in: chapterId,
        status: 'open',
      });
    }
    if (beat.function === 'climax' || beat.function === 'resolution') {
      for (const item of pendingMysteries) {
        mysteries.resolved.push({
          ...item,
          answer: item.answer || plot.storyline?.payoff || '答案浮出水面。',
          status: 'resolved',
          resolved_in: chapterId,
        });
      }
      pendingMysteries = [];
      mysteries.resolved.push({
        id: `${chapterId}-mystery-core`,
        question: plot.storyline?.midpoint || plot.premise?.hidden_truth || '核心谜题',
        answer: plot.storyline?.payoff || '答案浮出水面。',
        payoff: plot.storyline?.cost || '',
        mystery: plot.storyline?.midpoint || plot.premise?.hidden_truth || '核心谜题',
        importance: 10,
        thread: plot.storyline?.title || 'climax',
        thread_id: threadId || 'climax',
        thread_type: 'climax',
        related_cast: castNames,
        related_cast_ids: castIds,
        resolved_in: chapterId,
        status: 'resolved',
      });
    }
    const scenes = [];
    let previousConsequence = '';
    for (let sceneIndex = 0; sceneIndex < scenesPerChapter; sceneIndex += 1) {
      const lastScene = sceneIndex === scenesPerChapter - 1;
      const sceneObstacle = sceneIndex === 0
        ? chapterObstacle
        : lastScene
          ? (plot.storyline?.cost || chapterObstacle)
          : (scenarioB?.twist || blocking?.stake || plot.premise?.hidden_truth || chapterObstacle);
      const sceneTurn = sceneIndex === 0 ? 'choice' : lastScene ? 'reversal' : 'complication';
      const turnEvent = sceneIndex === 0
        ? `主角选择进入：${beat.beat}`
        : lastScene
          ? `反转：${plot.storyline?.midpoint || scenarioB?.twist || '原本的理解被推翻'}`
          : `复杂化：${scenarioB?.twist || blocking?.stake || '新的阻力出现'}`;
      const sceneGoal = sceneIndex === 0
        ? (entryFromPrevious ? `承接上一章“${entrySummary}”，进入：${beat.beat}` : beat.beat)
        : lastScene
          ? `处理上一场后果，并承受：${chapterObstacle}`
          : `承接“${previousConsequence}”，验证：${scenarioB?.twist || blocking?.stake || chapterObstacle}`;
      const consequence = lastScene
        ? (plot.storyline?.cost || '本章代价落地，主角带着不可撤回的结果进入下一章。')
        : `因为“${turnEvent}”，${scenarioA?.pressure || '局面被推进，但新的问题被留下。'}`;
      const sceneMysteries = {
        planted: sceneIndex === 0 && plot.premise?.hidden_truth
          ? [{
            id: `${chapterId}-scene-1-mystery`,
            question: plot.premise.hidden_truth,
            answer: plot.storyline?.payoff || '',
            payoff: plot.storyline?.cost || '',
            mystery: plot.premise.hidden_truth,
            importance: 4,
            thread: plot.storyline?.title || 'scene',
            thread_id: threadId || 'scene',
            thread_type: 'scene',
            related_cast: sceneCast,
            related_cast_ids: sceneCastIds,
            status: 'open',
          }]
          : sceneIndex === 1
            ? [{
              id: `${chapterId}-scene-${sceneIndex + 1}-mystery`,
              question: `局部问题：${sceneObstacle}`,
              answer: plot.storyline?.payoff || '',
              payoff: plot.storyline?.cost || '',
              mystery: `局部问题：${sceneObstacle}`,
              importance: 4,
              thread: plot.storyline?.title || 'scene',
              thread_id: threadId || 'scene',
              thread_type: 'scene',
              related_cast: sceneCast,
              related_cast_ids: sceneCastIds,
              status: 'open',
            }]
            : [],
        resolved: lastScene
          ? [{
            id: `${chapterId}-scene-${sceneIndex + 1}-mystery`,
            question: plot.storyline?.midpoint || plot.premise?.hidden_truth || '本章疑问',
            answer: plot.storyline?.payoff || '答案在场景末出现',
            payoff: plot.storyline?.cost || '',
            mystery: plot.storyline?.midpoint || plot.premise?.hidden_truth || '本章疑问',
            importance: 6,
            thread: plot.storyline?.title || 'scene',
            thread_id: threadId || 'scene',
            thread_type: 'scene',
            related_cast: sceneCast,
            related_cast_ids: sceneCastIds,
            status: 'resolved',
          }]
          : [],
      };
      scenes.push({
        order: sceneIndex + 1,
        pov: protagonist,
        goal: sceneGoal,
        obstacle: sceneObstacle,
        turn: sceneTurn,
        turn_event: turnEvent,
        consequence,
        result: consequence,
        stakes: plot.storyline?.cost || '这一章必须付出代价',
        location: plot.location?.name || '关键地点',
        characters: castNames.slice(0, Math.min(3, castNames.length)),
        words: Math.ceil(targetChars / scenesPerChapter),
        tone: beat.act,
        mysteries: sceneMysteries,
        beats: [beat.function, lastScene ? 'turn' : 'pressure'],
      });
      previousConsequence = consequence;
    }
    const events = scenes.map((scene, sceneIndex) => ({
      type: 'plot',
      characters: scene.characters,
      actor: protagonist,
      action: 'advance',
      target: scene.goal,
      target_type: 'scene',
      details: scene.goal,
      order: sceneIndex + 1,
    }));
    chapterList.push({
      id: chapterId,
      thread_id: threadId,
      title: `第${index + 1}章 · ${beat.function}`,
      summary: beat.beat,
      characters: castNames,
      location: plot.location?.name || '关键地点',
      obstacle: chapterObstacle,
      entry_from_previous: entryFromPrevious,
      exit_consequence: scenes[scenes.length - 1]?.consequence || '',
      mysteries,
      events,
      conflict: entryFromPrevious
        ? `承接上一章后果：${entrySummary}；本章冲突：${plot.premise?.central_conflict || plot.premise?.conflict || '主角必须做出选择。'}`
        : (plot.premise?.central_conflict || plot.premise?.conflict || '主角必须做出选择。'),
      pacing: pacingByFunction[beat.function] || 'rising',
      beat_function: beat.function,
      act: beat.act,
      target_chars: targetChars,
      scenes,
      scene_chain: scenes.map((scene) => ({
        scene: scene.order,
        turn: scene.turn_event,
        consequence: scene.consequence,
      })),
      chapter_payoff: {
        desire: plot.storyline?.promise || '主角想改变现状。',
        pressure: entryFromPrevious
          ? `上一章留下的后果：${entrySummary}`
          : (plot.premise?.central_conflict || '规则不允许。'),
        clever_move: beat.beat,
        payoff_moment: plot.storyline?.payoff || '主角完成一次反击。',
        reward: plot.storyline?.cost || '代价被看见。',
        social_proof: '见证者承认主角做到了。',
        hook: globalIndex === totalChapters - 1
          ? '故事结束，代价留下。'
          : `下一章要处理：${scenes[scenes.length - 1]?.consequence || '新的压力'}`,
      },
    });
    previousChapterConsequence = chapterList[chapterList.length - 1].exit_consequence;
    for (const item of mysteries.planted) {
      if (!pendingMysteries.some((pending) => pending.id === item.id)) {
        pendingMysteries.push({
          id: item.id,
          question: item.question,
          answer: item.answer,
          payoff: item.payoff,
          mystery: item.question,
          importance: item.importance,
          thread: item.thread,
          thread_id: item.thread_id,
          thread_type: item.thread_type,
          related_cast: item.related_cast,
          related_cast_ids: item.related_cast_ids,
          from: chapterId,
          status: 'open',
        });
      }
    }
    for (const scene of scenes) {
      if (scene.order !== 2) continue;
      for (const item of scene.mysteries.planted) {
        if (!pendingMysteries.some((pending) => pending.id === item.id)) {
          pendingMysteries.push({
            id: item.id,
            question: item.question,
            answer: item.answer,
            payoff: item.payoff,
            mystery: item.question,
            importance: item.importance,
            thread: item.thread,
            thread_id: item.thread_id,
            thread_type: item.thread_type,
            related_cast: item.related_cast,
            related_cast_ids: item.related_cast_ids,
            from: chapterId,
            source_scene: `${chapterId}-S${scene.order}`,
            status: 'open',
          });
        }
      }
    }
    const sortedMysteries = pendingMysteries
      .sort((left, right) => (right.importance || 0) - (left.importance || 0));
    const keptMysteries = sortedMysteries.slice(0, 5);
    for (const dropped of sortedMysteries.slice(5)) {
      const record = {
        ...dropped,
        status: 'dropped',
        dropped_in: chapterId,
        reason: 'pending_capacity',
        abandoned_thread: {
          thread_id: dropped.thread_id,
          thread: dropped.thread,
          question: dropped.question,
          importance: dropped.importance,
          reason: 'pending_capacity',
        },
      };
      mysteries.dropped.push(record);
      droppedMysteries.push(record);
    }
    pendingMysteries = keptMysteries;
  }
  const volume = {
    id: volumeId || 'P1-V1',
    title: '第一卷',
    summary: plot.storyline?.promise || plot.premise?.title || '故事的第一卷。',
    chapters: chapterList,
    beat_map: chapterList.map((chapter) => ({
      chapter: chapter.id,
      function: chapter.beat_function,
      act: chapter.act,
    })),
  };
  const draftOutline = {
    parts: [{
      id: 'P1',
      title: plot.premise?.title || '未命名故事',
      summary: plot.premise?.statement || '未填写故事前提。',
      volumes: [volume],
    }],
  };
  const id = `outlinepack-${seed}-${String(options.index + 1 || 1).padStart(2, '0')}`;
  const abandonedIds = new Set(droppedMysteries.map((item) => item.thread_id).filter(Boolean));
  const threadRegistry = (plot.storylines || [plot.storyline]).filter(Boolean).map((item, index) => {
    const id = item.id || `thread-${index + 1}`;
    const threadChapters = chapterList.filter((chapter) => chapter.thread_id === id);
    const resolvedChapters = chapterList
      .filter((chapter) => chapterResolvedMysteries(chapter).some((mystery) => mystery.thread_id === id))
      .map((chapter) => chapter.id);
    const lastChapter = threadChapters[threadChapters.length - 1];
    const resolvedIn = resolvedChapters[resolvedChapters.length - 1]
      || (lastChapter && ['climax', 'resolution'].includes(lastChapter.beat_function) ? lastChapter.id : null);
    const abandonedHistory = abandonedIds.has(id);
    const resolvedMysteries = chapterList.flatMap((chapter) => (
      chapterResolvedMysteries(chapter)
        .filter((mystery) => mystery.thread_id === id)
        .map((mystery) => ({ id: mystery.id, chapter_id: chapter.id }))
    ));
    const abandonedMysteries = droppedMysteries
      .filter((mystery) => mystery.thread_id === id)
      .map((mystery) => ({ id: mystery.id, chapter_id: mystery.dropped_in, question: mystery.question }));
    return {
      id,
      name: item.title || `storyline ${index + 1}`,
      type: index === 0 ? 'main' : 'subplot',
      importance: index === 0 ? 10 : 6,
      status: resolvedIn ? 'resolved' : abandonedHistory ? 'abandoned' : 'active',
      resolved_in: resolvedIn,
      resolved_chapters: resolvedChapters,
      resolved_mysteries: sortMysteryLinks(resolvedMysteries),
      abandoned_history: abandonedHistory,
      abandoned_mysteries: sortMysteryLinks(abandonedMysteries),
    };
  });
  const mysteryRegistry = collectMysteryRegistry(chapterList);
  return {
    id,
    outline_id: id,
    plotpack_id: plot.id,
    worldpack_id: plot.worldpack_id,
    genre: plot.genre || '',
    premise: plot.premise,
    cast: plot.cast,
    cast_relations: plot.cast_relations,
    chapters: chapterList,
    mystery_registry: mysteryRegistry,
    mystery_registry_version: 2,
    thread_registry: threadRegistry,
    thread_registry_version: 2,
    draft_outline: draftOutline,
    chapter_config: {
      target_chars: targetChars,
      min_chars: Math.floor(targetChars * 0.6),
      chapters,
      scenes_per_chapter: scenesPerChapter,
    },
    prompt_pack: plot.prompt_pack,
    motif: plot.motif,
    plotpack: plot,
    pending_mysteries: pendingMysteries,
    dropped_mysteries: droppedMysteries,
    abandoned_threads: droppedMysteries.map((item) => item.abandoned_thread).filter(Boolean),
  };
}

function buildMultiVolumeOutlinePack(plot, seed, options = {}) {
  const volumes = Math.max(1, Math.min(10, Number(options.volumes) || 1));
  const chaptersPerVolume = Math.max(3, Math.min(60, Number(options.chaptersPerVolume) || Number(options.chapters) || 10));
  const storylines = (plot.storylines || [plot.storyline]).filter(Boolean);
  const bases = [];
  let previousVolumeConsequence = '';
  let carriedMysteries = [];
  for (let volumeIndex = 0; volumeIndex < volumes; volumeIndex += 1) {
    const volumePlot = {
      ...plot,
      storyline: storylines[volumeIndex % storylines.length] || plot.storyline,
    };
    const base = buildOutlinePack(volumePlot, seed, {
      ...options,
      chapters: chaptersPerVolume,
      index: volumeIndex,
      chapterOffset: volumeIndex * chaptersPerVolume,
      totalChapters: volumes * chaptersPerVolume,
      volumeId: `P1-V${volumeIndex + 1}`,
      previousConsequence: previousVolumeConsequence,
      carriedMysteries,
    });
    const volume = base.draft_outline.parts[0].volumes[0];
    volume.id = `P1-V${volumeIndex + 1}`;
    volume.title = `第${volumeIndex + 1}卷`;
    volume.chapters.forEach((chapter, chapterIndex) => {
      chapter.id = `${volume.id}-C${chapterIndex + 1}`;
    });
    volume.payoff_contract = {
      volume_question: volumePlot.storyline?.promise || '主角能否改变现状？',
      power_promise: volumePlot.storyline?.escalation || '主角获得一次改变规则的能力。',
      main_opponent_misread: plot.premise?.hidden_truth || '对手误读了主角真正的筹码。',
      big_win: volumePlot.storyline?.payoff || '主角完成一次无法撤回的胜利。',
      visible_reward: volumePlot.storyline?.cost || '胜利留下一个可见的代价。',
      reputation_shift: '主角从被规则支配的人变成能改写规则的人。',
      next_bigger_game: volumeIndex === volumes - 1 ? '故事收束，代价留下。' : '更大的对手进入视野。',
    };
    volume.opening_beat = `第${volumeIndex + 1}卷开场：${volumePlot.storyline?.promise || '旧规则仍在运转'}`;
    volume.closing_beat = `第${volumeIndex + 1}卷收束：${volumePlot.storyline?.payoff || '主角付出代价'}`;
    volume.mysteries = {
      planted: [volumePlot.storyline?.midpoint, plot.premise?.hidden_truth].filter(Boolean),
      resolved: [volumePlot.storyline?.cost].filter(Boolean),
    };
    volume.timeline = {
      start: volumeIndex === 0 ? 'before the first rule' : `after volume ${volumeIndex}`,
      end: `end of volume ${volumeIndex + 1}`,
      anchor: volumePlot.storyline?.title || plot.premise?.title || '',
    };
    previousVolumeConsequence = volume.chapters[volume.chapters.length - 1]?.exit_consequence || previousVolumeConsequence;
    carriedMysteries = base.pending_mysteries || [];
    bases.push(base);
  }
  const volumeList = bases.map((base) => base.draft_outline.parts[0].volumes[0]);
  const chapters = volumeList.flatMap((volume) => volume.chapters);
  const mysteryRegistry = collectMysteryRegistry(chapters);
  const id = `outlinepack-${seed}-${String((options.index || 0) + 1).padStart(2, '0')}`;
  const chapterConfig = {
    target_chars: Math.max(500, Math.min(10000, Number(options.targetChars) || 3000)),
    min_chars: Math.floor(Math.max(500, Math.min(10000, Number(options.targetChars) || 3000)) * 0.6),
    volumes,
    chapters_per_volume: chaptersPerVolume,
    chapters: chapters.length,
    scenes_per_chapter: Math.max(1, Math.min(5, Number(options.scenes) || 3)),
  };
  const setupDraft = buildSetupDraft({ ...plot, storylines }, { chapter_config: chapterConfig });
  const allDropped = bases.flatMap((base) => base.dropped_mysteries || []);
  const abandonedIds = new Set(allDropped.map((mystery) => mystery.thread_id));
  const abandonedThreads = allDropped.map((item) => item.abandoned_thread).filter(Boolean);
  setupDraft.abandoned_threads = abandonedThreads;
  setupDraft.dropped_mysteries = allDropped;
  setupDraft.mystery_registry = mysteryRegistry;
  setupDraft.mystery_registry_version = 2;
  setupDraft.thread_registry_version = 2;
  const threadRegistry = storylines.map((item, index) => {
    const id = item.id || `thread-${index + 1}`;
    const threadChapters = chapters.filter((chapter) => chapter.thread_id === id);
    const resolvedChapters = chapters
      .filter((chapter) => chapterResolvedMysteries(chapter).some((mystery) => mystery.thread_id === id))
      .map((chapter) => chapter.id);
    const lastChapter = threadChapters[threadChapters.length - 1];
    const resolvedIn = resolvedChapters[resolvedChapters.length - 1]
      || (lastChapter && ['climax', 'resolution'].includes(lastChapter.beat_function) ? lastChapter.id : null);
    const abandonedHistory = abandonedIds.has(id);
    const resolvedMysteries = chapters.flatMap((chapter) => (
      chapterResolvedMysteries(chapter)
        .filter((mystery) => mystery.thread_id === id)
        .map((mystery) => ({ id: mystery.id, chapter_id: chapter.id }))
    ));
    const abandonedMysteries = allDropped
      .filter((mystery) => mystery.thread_id === id)
      .map((mystery) => ({ id: mystery.id, chapter_id: mystery.dropped_in, question: mystery.question }));
    return {
      id,
      name: item.title || `storyline ${index + 1}`,
      type: index === 0 ? 'main' : 'subplot',
      importance: index === 0 ? 10 : 6,
      status: resolvedIn ? 'resolved' : abandonedHistory ? 'abandoned' : 'active',
      resolved_in: resolvedIn,
      resolved_chapters: resolvedChapters,
      resolved_mysteries: sortMysteryLinks(resolvedMysteries),
      abandoned_history: abandonedHistory,
      abandoned_mysteries: sortMysteryLinks(abandonedMysteries),
    };
  });
  setupDraft.thread_registry = threadRegistry;
  return {
    ...bases[0],
    id,
    outline_id: id,
    volumes: volumeList,
    chapters,
    setup_draft: setupDraft,
    mystery_registry: mysteryRegistry,
    mystery_registry_version: 2,
    thread_registry: threadRegistry,
    thread_registry_version: 2,
    draft_outline: {
      thread_registry: threadRegistry,
      thread_registry_version: 2,
      abandoned_threads: abandonedThreads,
      dropped_mysteries: allDropped,
      mystery_registry: mysteryRegistry,
      mystery_registry_version: 2,
      parts: [{
        id: 'P1',
        title: plot.premise?.title || '未命名故事',
        summary: plot.premise?.statement || '未填写故事前提。',
        volumes: volumeList,
      }],
    },
    chapter_config: chapterConfig,
    pending_mysteries: carriedMysteries,
    dropped_mysteries: allDropped,
    abandoned_threads: abandonedThreads,
  };
}

function buildSetupDraft(plot, outline) {
  const storylineList = (plot.storylines || [plot.storyline]).filter(Boolean);
  const storyline = storylineList[0] || {};
  const allowedCategories = new Set(['能源', '消耗品', '材料', '货币']);
  const categoryMap = {
    凭证: '货币', 配额: '货币', 许可证: '材料', 劳动权: '货币',
    身份资产: '材料', 金融资产: '货币', 核心资源: '材料',
  };
  const cast = (plot.cast || []).map((character, index) => ({
    id: `cast_${index + 1}`,
    name: character.name,
    role: character.role_tags?.[0] || (index === 0 ? 'protagonist' : 'support'),
    importance: index === 0 ? 10 : index === 1 ? 8 : 5,
    story_function: character.archetype || 'story character',
    relationship_to_lead: index === 0 ? 'self' : index === 1 ? 'opposes the lead' : 'supports the lead',
    relationship_arc: `${character.contradiction || 'is changed by the plot'} -> ${character.want || 'gets a choice'}`,
    entry_phase: 'opening',
    payoff: character.want || 'their want is tested',
    storyline_refs: storylineList.map((item, index) => item.id || `thread-${index + 1}`).filter(Boolean),
  }));
  return {
    project_name: plot.premise?.title || '未命名故事',
    genres: [plot.genre || '未分类'],
    premise: [plot.premise?.statement, plot.premise?.surface_rule].filter(Boolean).join(' '),
    theme: plot.premise?.hidden_truth || storyline.promise || '规则与选择',
    rules: [plot.premise?.surface_rule, plot.premise?.scarcity, plot.premise?.central_conflict].filter(Boolean),
    target_audience: 'general',
    tone: plot.prompt_pack?.style || '克制、具体',
    tense: 'past',
    pov_style: 'third_person_limited',
    long_form_plan: {
      target_chapters: outline.chapter_config.chapters,
      target_volumes: outline.chapter_config.volumes,
      main_loop: storyline.promise || '主角在规则压力下做出选择',
      escalation_ladder: [storyline.promise, storyline.escalation, storyline.midpoint, storyline.payoff].filter(Boolean),
      reader_promises: [storyline.promise, storyline.payoff].filter(Boolean),
      payoff_cadence: '每卷一次阶段性回收，每章留下一个具体钩子',
      volume_pattern: ['建立规则', '规则反噬', '改写规则'],
      midpoint_mutation: storyline.midpoint || '主角发现规则背后还有一层规则',
      endgame_promise: storyline.payoff || '主角改写规则并付出代价',
    },
    core_cast: cast,
    storylines: storylineList.map((item, index) => ({
      thread_id: item.id || `thread-${index + 1}`,
      name: item.title || `storyline ${index + 1}`,
      description: item.promise || item.title || '主角试图改变现状',
      type: index === 0 ? 'main' : 'subplot',
      importance: index === 0 ? 10 : 6,
      scope: index === 0 ? 'book' : 'volume',
      payoff_style: 'staged_reveal',
      setup_role: index === 0 ? plot.premise?.surface_rule || 'establish the rule' : item.promise || 'add pressure',
      repeatable_pressure: item.escalation || 'the rule keeps extracting a price',
      payoff_cadence: index === 0 ? 'per volume' : 'per act',
      mutation: item.midpoint || 'the rule is not what it seems',
      failure_mode: item.cost || 'the cost cannot be undone',
      desire: item.promise || 'change the current order',
      opposition: plot.premise?.central_conflict || 'the rule resists',
      stakes: item.cost || 'someone is left behind',
      turn: item.midpoint || 'the rule turns against the lead',
      payoff: item.payoff || 'the lead changes the rule',
      open_question: item.cost || 'what remains after the change?',
      pressure_points: [plot.premise?.scarcity, plot.premise?.central_conflict].filter(Boolean),
      appeal_engine: {
        appeal: item.promise || 'a rule that can be bent',
        surface_limit: plot.premise?.surface_rule || 'the rule seems absolute',
        exploit: plot.premise?.leverage || 'find the exception',
        signature_win: item.payoff || 'a visible win',
        upgrade_path: item.escalation || 'the stakes rise',
        opponent_misread: plot.premise?.hidden_truth || 'the opponent misreads the cost',
        reward_type: 'consequence',
      },
    })),
    premises: [{
      name: plot.premise?.title || '核心前提',
      description: plot.premise?.statement || '核心前提',
      category: 'core',
      progression: [
        { level: 1, name: '建立规则', description: plot.premise?.surface_rule || '读者先看见规则', requirements: '主角进入规则覆盖的范围' },
        { level: 2, name: '发现代价', description: storyline.escalation || '规则开始向主角收费', requirements: '主角第一次利用规则' },
        { level: 3, name: '规则反噬', description: storyline.midpoint || '规则背后还有一层规则', requirements: '主角付出无法撤回的代价' },
        { level: 4, name: '改写规则', description: storyline.payoff || '主角找到例外', requirements: '主角承担改写后的后果' },
      ],
      appeal_engine: {
        appeal: plot.premise?.statement || 'the premise',
        surface_limit: plot.premise?.surface_rule || 'the rule',
        exploit: plot.premise?.leverage || 'the loophole',
        signature_win: storyline.payoff || 'the win',
      },
    }],
    world_timeline: [
      {
        year: 'before',
        event: plot.premise?.surface_rule || '旧规则建立',
        impact: plot.premise?.scarcity || '资源与资格被重新分配',
        related_mystery: plot.premise?.hidden_truth || '规则真正保护的是什么',
      },
      {
        year: 'now',
        event: storyline.promise || '主角进入规则',
        impact: '主角开始付出代价',
        related_mystery: storyline.midpoint || '规则的隐藏层',
      },
    ],
    world_resources: (plot.resources || []).map((resource) => ({
      name: resource.name,
      category: allowedCategories.has(resource.category)
        ? resource.category
        : (categoryMap[resource.category] || '材料'),
      scarcity: '稀有',
      description: resource.meaning || resource.category || 'world resource',
    })),
  };
}

function resultId(prefix, seed, index) {
  return `${prefix}-${seed}-${String(index + 1).padStart(2, '0')}`;
}

function namecards(rng, seed, count, roles = [], genre = '', promptChars = 160) {
  const genrePools = {
    xianxia: XIANXIA_ARCHETYPES,
    suspense: SUSPENSE_ARCHETYPES,
    urban: URBAN_ARCHETYPES,
    history: HISTORY_ARCHETYPES,
    romance: ROMANCE_ARCHETYPES,
  };
  const genrePool = genrePools[genre] || null;
  const surnames = pickMany(rng, SURNAMES, Math.min(count, SURNAMES.length));
  const given = pickMany(rng, GIVEN, Math.min(count, GIVEN.length));
  const results = [];
  const used = new Set();
  const usedArchetypes = new Set();
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
    const role = roles[i] || (i === 0 ? 'protagonist' : 'support');
    const pool = genrePool
      ? (genrePool.filter((item) => (item.roles || []).includes(role)).length
        ? genrePool.filter((item) => (item.roles || []).includes(role))
        : genrePool)
      : (ROLE_ARCHETYPES[role] || [])
        .map((archetypeName) => ARCHETYPES.find((item) => item.name === archetypeName))
        .filter(Boolean);
    const available = pool.filter((item) => !usedArchetypes.has(item.name));
    const fallback = genrePool || ARCHETYPES;
    const remaining = fallback.filter((item) => !usedArchetypes.has(item.name));
    const archetype = available.length
      ? pick(rng, available)
      : (remaining.length ? pick(rng, remaining) : pick(rng, fallback));
    usedArchetypes.add(archetype.name);
    const id = resultId('name', seed, i);
    const styleByGenre = {
      default: '近未来科幻，冷峻，低饱和',
      xianxia: '东方玄幻，水墨，清冷',
      suspense: '犯罪悬疑，冷色，写实',
      urban: '都市现实，冷调',
      history: '历史写实，旧纸色',
      romance: '爱情片，柔和光，浅景深',
    };
    const negativeByGenre = {
      default: 'anachronism, neon, inconsistent costume',
      xianxia: 'guns, modern clothing, neon',
      suspense: 'magic, fantasy costume',
      urban: 'medieval, fantasy armor',
      history: 'modern clothing, plastic, neon',
      romance: 'spaceships, fantasy races, battle armor',
    };
    const visualStyle = styleByGenre[genre] || styleByGenre.default;
    const visualNegative = negativeByGenre[genre] || negativeByGenre.default;
    const rawCharacterPrompt = [visualStyle, name, archetype.name, ...(archetype.personality || []), archetype.body, archetype.want].filter(Boolean).join('，');
    results.push({
      id,
      name,
      surname,
      given_name: givenName,
      naming_style: pick(rng, ['hard', 'literary', 'plain']),
      role_tags: [role],
      archetype: archetype.name,
      prompt: truncatePrompt(rawCharacterPrompt, promptChars),
      prompt_meta: {
        max_chars: promptChars,
        raw_chars: rawCharacterPrompt.length,
        truncated: rawCharacterPrompt.length > promptChars,
      },
      negative_prompt: visualNegative,
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

export function validateIdeaDraw(draw) {
  const results = Array.isArray(draw) ? draw : (draw?.results || []);
  const findings = [];
  const add = (severity, rule, target, issue, suggestion) => {
    findings.push({ rule_id: rule, severity, target_id: target, issue, suggestion });
  };
  for (const result of results) {
    const registry = result.thread_registry;
    if (!Array.isArray(registry)) continue;
    const ids = new Set();
    const chaptersById = new Map((result.chapters || []).map((chapter) => [chapter.id, chapter]));
    for (const thread of registry) {
      if (!thread?.id) {
        add('high', 'idea.thread.missing_id', result.id || 'outlinepack', 'thread registry entry has no id', 'Add a stable thread id.');
        continue;
      }
      if (ids.has(thread.id)) {
        add('high', 'idea.thread.duplicate_id', thread.id, 'duplicate thread id', 'Give each thread a unique id.');
      }
      ids.add(thread.id);
      if (!['active', 'resolved', 'abandoned'].includes(thread.status)) {
        add('high', 'idea.thread.invalid_status', thread.id, `unknown thread status ${thread.status}`, 'Use active, resolved or abandoned.');
      }
      if (thread.status === 'active' && thread.resolved_in) {
        add('high', 'idea.thread.active_with_resolution', thread.id, 'active thread has resolved_in', 'Clear resolved_in or mark the thread resolved.');
      }
      if (thread.status === 'resolved') {
        if (!thread.resolved_in) {
          add('high', 'idea.thread.resolved_without_chapter', thread.id, 'resolved thread has no resolved_in', 'Set resolved_in to the resolving chapter.');
        } else {
          const chapter = chaptersById.get(thread.resolved_in);
          if (!chapter) {
            add('high', 'idea.thread.unknown_resolved_chapter', thread.id, `resolved_in ${thread.resolved_in} is not a chapter`, 'Use an existing chapter id.');
          } else {
            if (chapter.thread_id !== thread.id) {
              const resolvedHere = (chapter.mysteries?.resolved || []).some((mystery) => mystery.thread_id === thread.id);
              if (!resolvedHere) {
                add('high', 'idea.thread.resolved_chapter_mismatch', thread.id, `resolved_in ${thread.resolved_in} belongs to ${chapter.thread_id}`, 'Resolve the thread in one of its own chapters.');
              }
            }
            if (!['climax', 'resolution'].includes(chapter.beat_function)) {
              add('high', 'idea.thread.resolved_outside_climax', thread.id, `resolved_in ${thread.resolved_in} is ${chapter.beat_function}`, 'Resolve on a climax or resolution chapter.');
            }
          }
        }
      }
    }
    for (const storyline of result.setup_draft?.storylines || []) {
      if (!storyline.thread_id || !ids.has(storyline.thread_id)) {
        add('high', 'idea.thread.unknown_setup_thread', storyline.name || 'storyline', 'setup storyline references an unknown thread id', 'Use an id from thread_registry.');
      }
    }
    const checkMystery = (mystery, target) => {
      if (mystery?.thread_id && !ids.has(mystery.thread_id)) {
        add('high', 'idea.thread.unknown_mystery_thread', target, `mystery references unknown thread ${mystery.thread_id}`, 'Use an id from thread_registry or add the thread.');
      }
    };
    for (const chapter of result.chapters || []) {
      for (const key of ['carried', 'planted', 'resolved', 'dropped']) {
        for (const mystery of chapter.mysteries?.[key] || []) {
          checkMystery(mystery, chapter.id);
        }
      }
      for (const scene of chapter.scenes || []) {
        for (const key of ['planted', 'resolved']) {
          for (const mystery of scene.mysteries?.[key] || []) {
            checkMystery(mystery, `${chapter.id}-S${scene.order}`);
          }
        }
      }
    }
    for (const thread of result.abandoned_threads || []) {
      if (thread?.thread_id && !ids.has(thread.thread_id)) {
        add('high', 'idea.thread.unknown_abandoned_thread', thread.thread_id, 'abandoned thread is not in thread_registry', 'Keep abandoned threads in the registry with status abandoned.');
      }
    }
  }
  return {
    ok: findings.length === 0,
    findings,
  };
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
  const warnings = [];
  const warningDetails = [];
  const deck = selectDeck(options.genre) || DEFAULT_DECK;
  const premises = deck.premises;
  const resources = deck.resources;
  const scenarios = deck.scenarios;
  const storylines = deck.storylines;
  const engines = deck.engines;
  const locations = deck.locations;
  const factions = deck.factions;
  const equipment = deck.equipment;
  let results;
  let castMeta = null;
  if (type === 'worldpack') {
    const packDefs = deck.packs;
    const selected = pickMany(rng, packDefs, Math.min(count, packDefs.length));
    const allowedRoles = new Set(['protagonist', 'antagonist', 'support']);
    const explicitRoles = (Array.isArray(options.castRoles) ? options.castRoles : String(options.castRoles || '').split(','))
      .map((role) => String(role || '').trim())
      .filter((role) => allowedRoles.has(role));
    const poolSize = GENRE_ARCHETYPE_COUNTS[deck.name] || ARCHETYPES.length;
    const requestedCastCount = Number(options.castCount);
    const autoCast = explicitRoles.length === 0 && requestedCastCount === 0;
    const autoPool = GENRE_ARCHETYPE_POOLS[deck.name] || ARCHETYPES;
    const autoRoles = ['protagonist', 'antagonist', 'support'].flatMap((role) => (
      Array.from({ length: autoPool.filter((item) => (item.roles || []).includes(role)).length }, () => role)
    ));
    const castCount = Math.max(1, Math.min(12, explicitRoles.length || (autoCast ? poolSize : requestedCastCount) || 4));
    const castRoles = explicitRoles.length
      ? explicitRoles.slice(0, castCount)
      : autoCast
        ? autoRoles.slice(0, castCount)
        : Array.from({ length: castCount }, (_, index) => (index === 0 ? 'protagonist' : index === 1 ? 'antagonist' : 'support'));
    if (!castRoles.includes('protagonist')) {
      castRoles[0] = 'protagonist';
      const message = 'cast-roles had no protagonist; the first role was changed to protagonist';
      warnings.push(message);
      warningDetails.push({ code: 'cast.protagonist_autofix', severity: 'warning', message });
    }
    castMeta = {
      auto: autoCast,
      count: castCount,
      pool_size: poolSize,
      role_counts: castRoles.reduce((counts, role) => {
        counts[role] = (counts[role] || 0) + 1;
        return counts;
      }, {}),
    };
    if (castCount > poolSize) {
      const message = `cast count ${castCount} exceeds the ${deck.name} archetype pool (${poolSize}); some archetypes will repeat`;
      warnings.push(message);
      warningDetails.push({
        code: 'cast.pool_exhausted',
        severity: 'info',
        message,
        cast_count: castCount,
        pool_size: poolSize,
        recommended_cast_count: poolSize,
      });
    }
    results = selected.map((def, packIndex) => {
      const cast = namecards(rng, seed + packIndex, castCount, castRoles, deck.name, Math.max(40, Math.min(500, Number(options.characterPromptChars) || 160)));
      return buildWorldpack(def, packIndex, seed, cast, deck, options);
    });
  } else if (type === 'plotpack') {
    const plots = [];
    for (let index = 0; index < count; index += 1) {
      const world = drawIdeas({ ...options, type: 'worldpack', count: 1, seed: seed + index });
      const plot = buildPlotpack(world.results[0], seed + index, index);
      plot.genre = String(options.genre || '');
      plots.push(plot);
    }
    results = plots;
  } else if (type === 'outlinepack') {
    const outlines = [];
    for (let index = 0; index < count; index += 1) {
      const plot = drawIdeas({ ...options, type: 'plotpack', count: 1, seed: seed + index });
      outlines.push(buildMultiVolumeOutlinePack(plot.results[0], seed + index, { ...options, index }));
    }
    results = outlines;
  } else if (type === 'namecard' || type === 'name' || type === 'cast') {
    results = namecards(rng, seed, count, [], deck.name);
  } else if (type === 'engine') {
    results = pickMany(rng, engines, Math.min(count, engines.length)).map((item, index) => ({
      id: resultId('engine', seed, index),
      ...item,
      reference_id: options.source || 'wishmachine',
    }));
  } else if (type === 'location') {
    results = pickMany(rng, locations, Math.min(count, locations.length)).map((item, index) => ({
      id: resultId('location', seed, index),
      ...item,
    }));
  } else if (type === 'faction') {
    results = pickMany(rng, factions, Math.min(count, factions.length)).map((item, index) => ({
      id: resultId('faction', seed, index),
      ...item,
    }));
  } else if (type === 'equipment') {
    results = pickMany(rng, equipment, Math.min(count, equipment.length)).map((item, index) => ({
      id: resultId('equipment', seed, index),
      ...item,
    }));
  } else if (type === 'premise' || type === 'axiom') {
    results = pickMany(rng, premises, Math.min(count, premises.length)).map((item, index) => ({
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
    results = pickMany(rng, resources, Math.min(count, resources.length)).map((item, index) => ({
      id: resultId('resource', seed, index),
      ...item,
    }));
  } else if (type === 'provocation') {
    results = pickMany(rng, PROVOCATIONS, Math.min(count, PROVOCATIONS.length)).map((item, index) => ({
      id: resultId(type, seed, index),
      ...item,
    }));
  } else if (type === 'law') {
    results = pickMany(rng, LAWS, Math.min(count, LAWS.length)).map((item, index) => ({
      id: resultId(type, seed, index),
      ...item,
    }));
  } else if (type === 'event') {
    results = pickMany(rng, EVENTS, Math.min(count, EVENTS.length)).map((item, index) => ({
      id: resultId(type, seed, index),
      ...item,
    }));
  } else if (type === 'storyline') {
    results = pickMany(rng, storylines, Math.min(count, storylines.length)).map((item, index) => ({
      id: resultId(type, seed, index),
      ...item,
    }));
  } else if (type === 'motif') {
    results = pickMany(rng, MOTIFS, Math.min(count, MOTIFS.length)).map((item, index) => ({
      id: resultId(type, seed, index),
      ...item,
    }));
  } else if (type === 'scenario' || type === 'reference') {
    results = pickMany(rng, scenarios, Math.min(count, scenarios.length)).map((item, index) => ({
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
      deck: deck.name,
      count,
      seed,
      source: options.source || '',
      category: options.category || '',
      level: options.level || 'axiom',
      mode: options.mode || 'balanced',
      chapters: Number(options.chapters) || null,
      scenes: Number(options.scenes) || null,
      target_chars: Number(options.targetChars) || null,
      volumes: Number(options.volumes) || null,
      chapters_per_volume: Number(options.chaptersPerVolume) || null,
    },
    count: results.length,
    results,
    meta: {
      genre: options.genre || '',
      deck: deck.name,
      mode: type,
      seed,
      warnings,
      warning_details: warningDetails,
      cast: castMeta,
      replay_command: `wishmachine ideas draw --type ${type}${options.genre ? ` --genre ${options.genre}` : ''} --seed ${seed} --count ${count}`,
      usage: [
        'Use names and traits as reference, not as fixed canon.',
        'Keep the seed to reproduce the draw.',
        'Do not write draw results into novel.json directly; turn them into setup/outline artifacts.',
      ],
    },
  };
}
