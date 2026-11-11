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
  { name: '把灾难当项目的管理者', personality: ['高效', '冷静', '对数字之外的东西反应迟钝'], contradiction: '能把灾难拆成可执行的清单，却无法面对清单上每一个名字。', want: '在下一波灾难前把系统修好', fear: '自己已经习惯了用“可接受损失”说话', mask: '永远在更新进度表', speech: '先说里程碑，再说伤亡', body: '开会时会把椅子推得笔直', backstory: '曾用一个漂亮的项目计划救下三千人，也让另外三百人变成计划外。' },
  { name: '替人记住承诺的档案员', personality: ['安静', '可靠', '对遗忘极度恐惧'], contradiction: '替所有人保管承诺，却从不敢要求别人记住自己的。', want: '让每一句承诺都有落点', fear: '自己保存的只是别人不再需要的旧话', mask: '只谈记录，不谈感受', speech: '引用日期、原话和见证人', body: '说话时会摸一摸胸前的旧档案夹', backstory: '曾因为漏记一句承诺，让两个家族打了十年。' },
  { name: '只会翻译坏消息的外交官', personality: ['温和', '精确', '在坏消息前异常冷静'], contradiction: '能把最坏的消息说得让人接受，却无法原谅自己说得太好。', want: '让停战多撑过下一次谈判', fear: '自己只是替强者把暴力包装成礼節', mask: '永远先替对方倒水', speech: '先复述对方立场，再翻译条件', body: '谈判时会反复调整桌上的杯子', backstory: '曾把一份投降书翻译得太体面，签字的人后来全死了。' },
  { name: '靠假死活着的继承人', personality: ['谨慎', '善于表演', '对身份极度敏感'], contradiction: '靠一场假死获得自由，却每天都在证明自己还活着。', want: '拿回被继承法吞掉的名字', fear: '真正的继承人回来时，自己会再次变成不存在的人', mask: '永远用别人的名字说话', speech: '习惯性省略主语', body: '听到真名时会下意识低头', backstory: '第一次假死时，他给自己写了一份无人认领的讣告。' },
  { name: '把救援当生意的船长', personality: ['务实', '讲义气', '对风险有野兽般的直觉'], contradiction: '靠救援赚钱，却总在最后一刻免费多救一个人。', want: '让船和船员都活到下一趟', fear: '自己迟早要为一次免费救援赔上整条船', mask: '只谈价钱，不谈良心', speech: '先报价，再问人数', body: '谈价时会用指节敲舱壁', backstory: '第一次免费救援，救上来的是仇人的女儿。' },
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

const EVENTS = [
  { title: '名单提前泄露', trigger: '撤离名单在广播里被提前念出。', complication: '名单上有 37 个不该存在的人。', choice: '公开完整名单，还是只救自己认识的人。' },
  { title: '星门突然关闭', trigger: '最后一扇星门在舰队抵达前关闭。', complication: '关闭命令来自舰队内部。', choice: '追查内鬼，还是先找另一条航线。' },
  { title: '复制人拒绝编号', trigger: '一批复制人集体撕掉编号牌。', complication: '她们要求先被登记姓名，才肯执行维修任务。', choice: '承认她们，还是让整艘船停摆。' },
  { title: '敌舰请求停火', trigger: '敌方旗舰挂出停火信号。', complication: '舰上只有主角能读取对方的真实身份。', choice: '接受停火，还是趁机摧毁对方。' },
  { title: '氧气只够一半人', trigger: '循环系统故障，剩余氧气只够一半人抵达下一站。', complication: '名单上恰好有一半人是复制人。', choice: '按人数分配，还是按“人格”分配。' },
  { title: '真相直播', trigger: '有人把伤亡账本接入了全舰广播。', complication: '账本公开后，最先失控的是被救的人。', choice: '切断广播，还是让所有人继续看。' },
  { title: '旧舰发来求救', trigger: '一艘失踪十年的旧舰突然发来求救。', complication: '求救声纹属于主角已经死去的朋友。', choice: '前往救援，还是保持航线。' },
  { title: '母巢出现裂缝', trigger: '虫族母巢内部出现一道可穿越的裂缝。', complication: '裂缝只在主角的旧航线图上存在。', choice: '相信旧图，还是相信现在的星图。' },
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
  } else if (type === 'scenario' || type === 'storyline' || type === 'reference') {
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
