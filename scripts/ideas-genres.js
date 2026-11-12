// Genre decks for non-sci-fi, non-xianxia requests.
// Cards are reference material, not verified facts.

export const SUSPENSE = {
  name: 'suspense',
  premises: [
    { title: '密室里的第七个证人', statement: '一桩密室案有六名目击者，每个人都记得第七个人在场，但监控里只有六个影子。', surface_rule: '只有能互相印证的证词才算证据。', hidden_truth: '第七个人不是凶手，而是被所有人共同删掉的关键证人。', scarcity: '案发时段的监控只有一份，且已经被剪辑。', conflict: '刑侦队、检察院与媒体争夺“谁有资格作证”。', leverage: '用六份证词里的同一处口误反推被删掉的人。', counter: '把六份证词同时公开，让它们互相拆台。' },
    { title: '记忆鉴定：被修改的目击', statement: '记忆鉴定技术可以判断证词是否被植入，但鉴定本身需要读取证人的整段记忆。', surface_rule: '只有通过记忆鉴定的证词可以上庭。', hidden_truth: '鉴定机构会把不合格的记忆“修正”成可上庭的版本。', scarcity: '鉴定设备只有一台，排队按案件优先级。', conflict: '证人、鉴定机构与辩护律师争夺记忆的所有权。', leverage: '让同一段记忆被两次鉴定，得到两个不同结果。', counter: '把鉴定过程全程公开。' },
    { title: '失踪者名单上的空行', statement: '连环失踪案的卷宗里，每个受害者都有一页，唯独第七页只有编号没有名字。', surface_rule: '没有名字的卷宗不能立案。', hidden_truth: '第七页是警方内部的“可放弃人员”名单。', scarcity: '原始卷宗只保留在旧档案室。', conflict: '失踪者家属、警局与市政厅争夺立案权。', leverage: '把编号与殡仪馆的无名尸记录对上。', counter: '让所有家属共同申请公开卷宗。' },
    { title: '伪证产业链', statement: '职业证人在法庭上出售“可信的目击”，价格按案件影响力和刑期计算。', surface_rule: '只有首次作证且无前科的人可被采信。', hidden_truth: '产业链真正的产品不是证词，而是让真证人不敢出现。', scarcity: '能通过背景审查的“干净证人”很少。', conflict: '律师、职业证人与真证人争夺叙事权。', leverage: '让一名职业证人在两起案件里给出互相矛盾的证词。', counter: '公开所有职业证人的出庭记录。' },
  ],
  resources: [
    { name: '原始案卷', category: '证据', meaning: '未经整理的现场记录与口供。', issuer: '刑侦队档案室', spend_rule: '调阅需两名以上警员签字。', scarcity: '多数案卷只有一份纸质原件。' },
    { name: '证物袋', category: '物证', meaning: '封装现场物证的编号袋。', issuer: '鉴证科', spend_rule: '开启后必须重新封存并记录。', scarcity: '编号一旦错乱，整条证据链失效。' },
    { name: '监控硬盘', category: '影像', meaning: '案发时段的原始监控。', issuer: '物业或警局', spend_rule: '可被覆盖、剪辑或“意外损坏”。', scarcity: '关键时段往往只有一份。' },
    { name: '口供副本', category: '证词', meaning: '证人签字确认的陈述副本。', issuer: '审讯室', spend_rule: '修改需证人重新签字。', scarcity: '未签字的口供不能上庭。' },
  ],
  scenarios: [
    { title: '不在场证明', pressure: '每个嫌疑人都有不在场证明，但所有证明都依赖同一块钟。', twist: '钟不是被调过，而是被换过。' },
    { title: '第二具尸体', pressure: '密室案结案前，第二具尸体出现在已经封存的现场。', twist: '第二具尸体才是原本的死者。' },
    { title: '证人翻供', pressure: '唯一目击者在开庭前翻供，并声称自己从未见过死者。', twist: '翻供后的证词与另一桩旧案完全一致。' },
    { title: '密室钥匙', pressure: '密室只有一把钥匙，钥匙却在死者手里。', twist: '门从来没有锁，是所有人默认它锁着。' },
  ],
  engines: [
    { title: '证据等级制度', artifact: '证据分级表', issuer: '检察院', holder: '承办检察官', stated_purpose: '按可信度给证据排序', hidden_function: '用等级把无法验证的真相排除在外', loophole: '分级表只规定证据类型，不规定证据来源', cost: '每排除一条证据，就有一个证人被放弃', protagonist_role: '替证据找来源的刑警', counter_expectation: '主角把分级表改成所有证据必须公开来源' },
    { title: '记忆鉴定制度', artifact: '记忆鉴定报告', issuer: '司法鉴定中心', holder: '鉴定师', stated_purpose: '判断证词是否被植入', hidden_function: '把不合格证人改造成合格证人', loophole: '鉴定只判断记忆是否完整，不判断是否真实', cost: '每次鉴定都会磨损证人的一段记忆', protagonist_role: '拒绝签字的鉴定师', counter_expectation: '主角公开所有鉴定原始数据' },
    { title: '保释交易制度', artifact: '保释协议', issuer: '法院', holder: '辩护律师', stated_purpose: '用保释金换取候审自由', hidden_function: '把证人是否出庭变成可交易风险', loophole: '保释协议只约束被告，不约束证人', cost: '每次保释都让一个证人更不敢开口', protagonist_role: '替证人申请保护的律师', counter_expectation: '主角让所有证人集体拒证' },
    { title: '媒体审判制度', artifact: '直播许可证', issuer: '法院新闻处', holder: '媒体', stated_purpose: '让公众监督审判', hidden_function: '用镜头决定谁看起来有罪', loophole: '许可证只限制拍摄位置，不限制剪辑', cost: '每次直播都会让一个证人被网暴', protagonist_role: '拒绝对证人打灯的记者', counter_expectation: '主角把完整未剪辑素材公开' },
  ],
  storylines: [
    { title: '真相与伪证', promise: '主角想证明一个被所有人认定有罪的人无罪。', escalation: '每找到一条新证据，就多一个证人改口。', midpoint: '主角发现自己的关键证据也是伪造的。', payoff: '主角公开证据链的全部瑕疵。', cost: '公开后真凶可能永远无法定罪。' },
    { title: '受害者与替罪羊', promise: '主角想替死者找到名字。', escalation: '每确认一个死者，就多一个家庭被卷入。', midpoint: '主角发现死者名单被用来保护活人。', payoff: '主角让所有死者同时被点名。', cost: '点名会让一个幸存者成为下一个目标。' },
    { title: '时间线', promise: '主角想还原案发当晚的每一分钟。', escalation: '每补上一分钟，就推翻一个嫌疑人的不在场证明。', midpoint: '主角发现最关键的一分钟没有任何记录。', payoff: '主角用所有人的记忆拼出空白的一分钟。', cost: '拼出来的真相无法在法庭上使用。' },
    { title: '沉默的证人', promise: '主角想让一个不敢开口的证人作证。', escalation: '每保护一次证人，就暴露一次警方内部消息。', midpoint: '证人真正害怕的不是凶手，而是警察。', payoff: '主角让证人以匿名方式公开证词。', cost: '匿名证词无法直接定罪。' },
  ],
  locations: [
    { name: '审讯室', type: '警局', description: '一张桌、两把椅、一面单向玻璃。', function: '逼出第一份口供。', danger: '录音随时可能被“设备故障”抹掉。' },
    { name: '旧公寓', type: '现场', description: '墙纸发霉、门锁完好、邻居都说没听见声音。', function: '重建密室。', danger: '现场已经被清理过三次。' },
    { name: '停尸房', type: '法医楼', description: '冷柜编号与卷宗编号永远差一位。', function: '确认无名尸身份。', danger: '一具尸体可能对应两个名字。' },
    { name: '档案室', type: '警局', description: '铁架、灰尘、按年份扎捆的旧卷宗。', function: '找到被抽走的第七页。', danger: '调阅记录会暴露调查方向。' },
  ],
  factions: [
    { name: '刑侦队', type: '警方', goal: '尽快结案并维持破案率。', resource: '原始案卷', method: '用口供和监控拼出可起诉的故事。', secret: '队里有人替真凶改过记录。' },
    { name: '检察院', type: '司法', goal: '保证证据链可上庭。', resource: '证据分级表', method: '排除无法验证的证据。', secret: '分级表被用来保护特定证人。' },
    { name: '媒体', type: '舆论', goal: '抢到最有冲击力的叙事。', resource: '直播许可证', method: '用剪辑决定观众先相信谁。', secret: '记者手里有未公开的完整监控。' },
    { name: '辩方律所', type: '法律', goal: '制造合理怀疑。', resource: '保释协议', method: '用程序瑕疵拖延审判。', secret: '律所也在买卖证人。' },
  ],
  equipment: [
    { name: '录音笔', type: '取证设备', function: '录下未公开的对话。', cost: '录音一旦公开，来源就会被追查。', limit: '电池只够录四十分钟。' },
    { name: '证物袋', type: '封存工具', function: '保证物证不被污染。', cost: '拆封后证据链需要重新建立。', limit: '编号一旦错位就无法补救。' },
    { name: '监控硬盘', type: '影像存储', function: '保存关键时段的原始画面。', cost: '读取会留下访问记录。', limit: '可被远程格式化。' },
    { name: '测谎仪', type: '审讯设备', function: '显示证人的生理波动。', cost: '误判会让无辜者崩溃。', limit: '不能作为单独证据。' },
  ],
  packs: [
    { theme: 'suspense-room', premise: '密室里的第七个证人', motif: '罗阿诺克殖民地的消失', engine: '证据等级制度', resources: ['原始案卷', '口供副本'], scenarios: ['不在场证明', '证人翻供'], storylines: ['真相与伪证', '时间线'], location: '审讯室', faction: '刑侦队', equipment: '录音笔' },
    { theme: 'suspense-memory', premise: '记忆鉴定：被修改的目击', motif: '迪亚特洛夫山口的帐篷', engine: '记忆鉴定制度', resources: ['口供副本', '证物袋'], scenarios: ['第二具尸体', '密室钥匙'], storylines: ['受害者与替罪羊', '沉默的证人'], location: '停尸房', faction: '检察院', equipment: '测谎仪' },
  ],
};

export const URBAN = {
  name: 'urban',
  premises: [
    { title: '流量合同：直播间的卖身契', statement: '平台用流量合同绑定主播，合同规定账号、声纹和“人设”都归平台所有。', surface_rule: '只有签约账号能获得推荐流量。', hidden_truth: '合同真正买断的是主播离开平台后还能不能做自己。', scarcity: '首页推荐位每季只签少数人。', conflict: '主播、平台与经纪公司争夺账号归属。', leverage: '用一场公开直播证明账号人格属于主播。', counter: '让所有主播集体停播一天。' },
    { title: '竞业协议：离职后的三年', statement: '公司用竞业协议限制离职员工，补偿金按最低工资发放，违约赔偿按年薪计算。', surface_rule: '签了竞业协议的人三年内不得进入同行业。', hidden_truth: '协议真正保护的不是商业秘密，而是公司对熟练工的垄断。', scarcity: '能付得起违约金的只有大公司。', conflict: '离职员工、原公司与新公司争夺择业权。', leverage: '证明公司从未真正支付补偿金。', counter: '把协议模板公开给所有求职者。' },
    { title: '家族信托：谁有资格姓这个姓', statement: '家族企业用信托分配股权，受益人必须改回祖姓并接受家族委员会审查。', surface_rule: '只有登记在族谱上的受益人可以获得分红。', hidden_truth: '信托真正筛选的是“谁愿意为家族放弃自己的人生”。', scarcity: '族谱每十年修订一次，错过就失去资格。', conflict: '子女、配偶与职业经理人争夺受益权。', leverage: '找到一份被排除在族谱外的旧遗嘱。', counter: '把信托改成所有员工共同持股。' },
    { title: '租房算法：信用分决定门牌', statement: '房东用信用分和社交数据筛选租客，分数低的人只能租到更远、更贵的房子。', surface_rule: '平台只向信用分达标者展示房源。', hidden_truth: '算法真正筛选的是“谁不会投诉”。', scarcity: '核心区房源只通过平台放租。', conflict: '租客、房东与平台争夺筛选权。', leverage: '用同一份资料注册两个账号，得到不同结果。', counter: '公开算法的筛选参数。' },
  ],
  resources: [
    { name: '流量合同', category: '合约', meaning: '绑定账号、人设与推荐位的合同。', issuer: '平台经纪部', spend_rule: '解约需赔偿未来三年预估流水。', scarcity: '首页推荐位每季只签少数人。' },
    { name: '竞业补偿金', category: '劳动凭证', meaning: '离职后限制择业的补偿。', issuer: '原公司', spend_rule: '按月发放，断发即失效。', scarcity: '多数公司按最低工资发放。' },
    { name: '家族股权', category: '资产', meaning: '家族信托分配的受益权。', issuer: '家族委员会', spend_rule: '受益人必须接受年度审查。', scarcity: '族谱每十年修订一次。' },
    { name: '信用分', category: '身份数据', meaning: '平台根据社交与消费数据给出的租房分数。', issuer: '租房平台', spend_rule: '分数低者只能看到高价房源。', scarcity: '核心区房源只通过平台放租。' },
  ],
  scenarios: [
    { title: '热搜第一', pressure: '主角被推上热搜第一，词条内容是“主角承认自己造假”。', twist: '词条是平台自动生成的，主角从未说过那句话。' },
    { title: '裁员名单', pressure: '公司要求每个部门交出一份裁员名单，名单会在周五公布。', twist: '名单上的第一个名字是部门负责人自己。' },
    { title: '婚礼请柬', pressure: '主角收到一张婚礼请柬，新郎是五年前已经分手的前任。', twist: '请柬上的新娘名字是主角自己的旧名。' },
    { title: '直播事故', pressure: '主角在直播中失言，平台要求他按提词器道歉。', twist: '提词器上的道歉稿是平台三年前写好的。' },
  ],
  engines: [
    { title: '平台算法引擎', artifact: '推荐位合同', issuer: '平台', holder: '签约主播', stated_purpose: '把内容分配给最可能观看的人', hidden_function: '用流量控制主播能说什么', loophole: '算法只计算观看时长，不计算内容真假', cost: '每次上推荐都会让主播更不敢停播', protagonist_role: '拒绝按提词器说话的主播', counter_expectation: '主角把推荐参数公开' },
    { title: '竞业协议引擎', artifact: '竞业协议', issuer: '公司人力', holder: '离职员工', stated_purpose: '保护商业秘密', hidden_function: '用补偿金锁住熟练工', loophole: '协议只限制岗位，不限制行业', cost: '每次维权都会拖长空窗期', protagonist_role: '替离职员工打官司的律师', counter_expectation: '主角让所有员工集体拒签' },
    { title: '家族信托引擎', artifact: '家族信托', issuer: '家族委员会', holder: '受益人', stated_purpose: '把股权留给家族成员', hidden_function: '用姓氏和审查筛选听话的人', loophole: '信托只认族谱，不认血缘', cost: '每个受益人都要放弃一部分人生', protagonist_role: '被族谱排除的私生女', counter_expectation: '主角把信托改成员工持股' },
    { title: '租房信用引擎', artifact: '信用分', issuer: '租房平台', holder: '租客', stated_purpose: '帮房东筛选可靠租客', hidden_function: '把不会投诉的人分配到更差的房子', loophole: '信用分只统计消费，不统计投诉', cost: '每次申诉都会降低分数', protagonist_role: '被算法降分的租客', counter_expectation: '主角公开平台筛选参数' },
  ],
  storylines: [
    { title: '账号与人格', promise: '主角想拿回自己的账号。', escalation: '每证明一次账号属于自己，平台就多一条封禁理由。', midpoint: '主角发现账号的“人设”已经被公司注册成商标。', payoff: '主角在直播中公开全部合同。', cost: '公开后平台会永久封禁这个账号。' },
    { title: '离职与竞业', promise: '主角想自由地换工作。', escalation: '每面试一家公司，原公司就发一封律师函。', midpoint: '主角发现补偿金从未足额到账。', payoff: '主角把竞业协议告上法庭。', cost: '官司期间没有公司敢录用他。' },
    { title: '家族与股权', promise: '主角想拿回属于自己的股份。', escalation: '每靠近信托一步，家族就多一条“不符合资格”的理由。', midpoint: '主角发现自己的名字从族谱上被划掉过。', payoff: '主角公开旧遗嘱。', cost: '公开后家族企业会分裂。' },
    { title: '租房与尊严', promise: '主角想租到一间不被算法歧视的房子。', escalation: '每换一个平台，信用分就被重置一次。', midpoint: '主角发现平台在卖“高信用分”身份。', payoff: '主角公开平台的后台参数。', cost: '公开后他会被所有平台拉黑。' },
  ],
  locations: [
    { name: '写字楼', type: '公司', description: '玻璃幕墙、打卡机、永远亮着的会议室。', function: '裁员、竞业、股权谈判。', danger: '门禁记录会暴露谁来过。' },
    { name: '直播间', type: '平台', description: '补光灯、提词器、实时弹幕。', function: '公开真相或被迫道歉。', danger: '平台可以随时切断信号。' },
    { name: '城中村', type: '居住区', description: '握手楼、共享厨房、贴满招租广告。', function: '寻找不受算法筛选的房源。', danger: '没有正式合同，随时被清退。' },
    { name: '婚礼酒店', type: '社交场合', description: '水晶灯、签到台、所有人都在拍照。', function: '公开家庭秘密。', danger: '任何一句话都会被直播出去。' },
  ],
  factions: [
    { name: '平台', type: '互联网公司', goal: '维持流量与广告收入。', resource: '推荐位合同', method: '用算法决定谁能被看见。', secret: '平台在卖高信用分身份。' },
    { name: '家族委员会', type: '家族', goal: '保住家族企业的控制权。', resource: '家族信托', method: '用族谱和审查筛选受益人。', secret: '族谱被改过不止一次。' },
    { name: '经纪公司', type: '中介', goal: '从主播合同里抽成。', resource: '流量合同', method: '用违约赔偿锁住主播。', secret: '公司和平台共享同一套人设模板。' },
    { name: '租客互助会', type: '民间组织', goal: '让租客获得不被算法筛选的房源。', resource: '信用分数据', method: '交换房东直租信息。', secret: '互助会里混入了平台调查员。' },
  ],
  equipment: [
    { name: '手机', type: '个人设备', function: '直播、录音、保存证据。', cost: '平台可以远程锁机。', limit: '电量只够直播两小时。' },
    { name: '工牌', type: '身份凭证', function: '进入公司并记录门禁。', cost: '刷卡记录会暴露行动。', limit: '离职当天失效。' },
    { name: '直播灯', type: '直播设备', function: '让镜头里的人看起来可信。', cost: '灯光越亮，越难隐藏表情。', limit: '需要稳定电源。' },
    { name: '合同副本', type: '法律文件', function: '证明合同条款。', cost: '出示副本会暴露来源。', limit: '原件在公司保险柜里。' },
  ],
  packs: [
    { theme: 'urban-traffic', premise: '流量合同：直播间的卖身契', engine: '平台算法引擎', resources: ['流量合同', '信用分'], scenarios: ['热搜第一', '直播事故'], storylines: ['账号与人格', '租房与尊严'], location: '直播间', faction: '平台', equipment: '直播灯' },
    { theme: 'urban-office', premise: '竞业协议：离职后的三年', engine: '竞业协议引擎', resources: ['竞业补偿金', '家族股权'], scenarios: ['裁员名单', '婚礼请柬'], storylines: ['离职与竞业', '家族与股权'], location: '写字楼', faction: '家族委员会', equipment: '工牌' },
  ],
};

export const HISTORY = {
  name: 'history',
  premises: [
    { title: '边镇粮价：一石米换一条命', statement: '边镇粮价由官府和粮商共同定价，粮引可以转让，也可以用来抵税。', surface_rule: '没有粮引的人不能从官仓买粮。', hidden_truth: '粮价不是由收成决定，而是由下一场战事的时间决定。', scarcity: '官仓只在战事前来粮，粮引按月发放。', conflict: '边军、粮商与百姓争夺粮引。', leverage: '用一份被篡改的粮价册证明有人在囤积。', counter: '把粮价册贴在城门上。' },
    { title: '海禁：片板不许下海', statement: '海禁规定片板不许下海，但市舶司仍向特定海商发放海引。', surface_rule: '没有海引的船一律按走私论处。', hidden_truth: '海禁真正保护的是官商合营的垄断航线。', scarcity: '海引每年只发数十张。', conflict: '海商、市舶司与沿海卫所争夺海引。', leverage: '用一张过期海引证明官船也在走私。', counter: '把海引名单公开。' },
    { title: '宫城档案：被烧掉的起居注', statement: '起居注记录皇帝每日言行，原件封存，任何人不得私阅。', surface_rule: '只有史官和内阁首辅可以调阅起居注。', hidden_truth: '被烧掉的那一卷记录的是一次没有发生的早朝。', scarcity: '起居注只有一份，副本由史官私藏。', conflict: '史官、内廷与内阁争夺记录权。', leverage: '用副本上的墨迹证明原件被替换。', counter: '把起居注抄本公开给言官。' },
    { title: '匠营：官匠的籍不能改', statement: '官匠入匠籍，世代不得脱籍；只有立下军功或得到特旨才能改籍。', surface_rule: '匠籍子弟不得参加科举。', hidden_truth: '匠籍真正锁住的是军器生产的核心技术。', scarcity: '特旨每十年只发几道。', conflict: '官匠、军器监与文官争夺脱籍资格。', leverage: '用一份错造的军器账逼军器监承认匠籍可改。', counter: '让所有官匠联名请求改籍。' },
  ],
  resources: [
    { name: '粮引', category: '凭证', meaning: '从官仓买粮的凭证，可转让抵税。', issuer: '边镇粮道', spend_rule: '按月发放，过期作废。', scarcity: '战事前官仓才来粮。' },
    { name: '海引', category: '许可证', meaning: '允许出海贸易的凭证。', issuer: '市舶司', spend_rule: '每年审核，船、货、人须一致。', scarcity: '每年只发数十张。' },
    { name: '路引', category: '通行证', meaning: '离开籍贯或通过关卡的凭证。', issuer: '地方官府', spend_rule: '必须写明目的地与事由。', scarcity: '边镇路引需要保人。' },
    { name: '军功札', category: '功勋凭证', meaning: '记录军功、可换取赏赐或脱籍的文书。', issuer: '边军主帅', spend_rule: '需两名以上军官联署。', scarcity: '军功札常被主将扣压。' },
  ],
  scenarios: [
    { title: '粮价一夜翻倍', pressure: '边镇粮价一夜翻倍，官仓却贴出“粮足”告示。', twist: '粮价不是粮商抬的，是官府自己放的假消息。' },
    { title: '瘟疫封城', pressure: '城中出现瘟疫，官府下令封城，只准持路引者离开。', twist: '路引名单上的人早就不在城里。' },
    { title: '海禁开闸', pressure: '朝廷突然开放一处海口，海商争抢第一批海引。', twist: '开放是为了让某艘官船混进商队。' },
    { title: '宫变前夜', pressure: '宫城档案被连夜转移，史官要求清点。', twist: '少的那一卷记录的是当夜的值班名单。' },
  ],
  engines: [
    { title: '漕运制度', artifact: '漕运粮册', issuer: '户部', holder: '漕运官', stated_purpose: '把南粮北运', hidden_function: '用损耗比例决定谁能分到粮', loophole: '粮册只记总数，不记每船实际载重', cost: '每运一石粮，就有一斗在路上消失', protagonist_role: '核对粮册的小吏', counter_expectation: '主角把每船载重公开' },
    { title: '保甲制度', artifact: '保甲册', issuer: '地方官府', holder: '保长', stated_purpose: '维持地方治安', hidden_function: '用连坐把风险转给邻里', loophole: '保甲册只记户主，不记实际居住者', cost: '每报一人，就有一户被牵连', protagonist_role: '拒绝连坐的保长', counter_expectation: '主角让所有住户共同担保' },
    { title: '军功核验制度', artifact: '军功札', issuer: '边军主帅', holder: '士兵', stated_purpose: '核实战功并发放赏赐', hidden_function: '用核验权扣压普通士兵的军功', loophole: '军功札只记首级数，不记谁先登城', cost: '每核一次功，就有一批人白死', protagonist_role: '替士兵核功的书吏', counter_expectation: '主角让士兵互相作证' },
    { title: '市舶抽分制度', artifact: '抽分单', issuer: '市舶司', holder: '海商', stated_purpose: '按货值抽税', hidden_function: '用估价权决定谁能做海贸', loophole: '抽分单只估货值，不估航线', cost: '每抽一次，就有一船货被压价', protagonist_role: '拒绝签字的市舶吏', counter_expectation: '主角公开所有估价记录' },
  ],
  storylines: [
    { title: '制度与生存', promise: '主角想让边镇的人活过这个冬天。', escalation: '每调一石粮，就多一个上官要打点。', midpoint: '主角发现粮价是朝廷故意放的。', payoff: '主角把粮册贴在城门上。', cost: '公开后边镇会被断粮。' },
    { title: '旧案与新政', promise: '主角想翻一桩十年前的旧案。', escalation: '每翻一案，就牵出一个还在位的官员。', midpoint: '旧案的主审官是主角的恩师。', payoff: '主角公开旧案卷宗。', cost: '公开后新政会被保守派推翻。' },
    { title: '家国与私情', promise: '主角想保住家人和城。', escalation: '每保一次城，就要放弃一个家人。', midpoint: '主角发现家人也在利用他的位置。', payoff: '主角选择开城。', cost: '开城后他将失去官职。' },
    { title: '海禁与海商', promise: '主角想开放一条合法的海路。', escalation: '每开一条路，就多一艘官船冒充商船。', midpoint: '主角发现海引名单被卖给了海盗。', payoff: '主角公开海引名单。', cost: '公开后沿海会陷入混乱。' },
  ],
  locations: [
    { name: '边镇', type: '军镇', description: '土墙、烽燧、粮仓和永远排队的百姓。', function: '粮价、军功、保甲。', danger: '战事一来，城门先关。' },
    { name: '码头', type: '港口', description: '桅杆、货栈、市舶司的抽分房。', function: '海引、走私、抽分。', danger: '没有海引的船会被当场扣下。' },
    { name: '宫城', type: '宫廷', description: '高墙、档案库、每天按时关闭的宫门。', function: '起居注、宫变、密旨。', danger: '任何记录都可能被烧掉。' },
    { name: '匠营', type: '工坊', description: '炉火、铁屑、世代住在营里的官匠。', function: '军器、匠籍、脱籍。', danger: '匠籍子弟不能科举。' },
  ],
  factions: [
    { name: '户部', type: '朝廷', goal: '维持漕运与国库。', resource: '漕运粮册', method: '用损耗和税册控制地方。', secret: '户部自己也在卖粮引。' },
    { name: '边军', type: '军队', goal: '守住边镇并按时发饷。', resource: '军功札', method: '用核功权控制士兵。', secret: '主将扣压了大量军功。' },
    { name: '市舶司', type: '衙门', goal: '管理海贸与抽分。', resource: '海引', method: '用估价权筛选海商。', secret: '市舶司与海盗共享航线。' },
    { name: '海商', type: '商帮', goal: '获得稳定海引并扩大航线。', resource: '货单', method: '用官商合营收买抽分吏。', secret: '海商在替朝廷运私货。' },
  ],
  equipment: [
    { name: '官印', type: '权力凭证', function: '让文书生效。', cost: '丢失官印会被革职查办。', limit: '只能由本人使用。' },
    { name: '路引', type: '通行证', function: '通过关卡。', cost: '路引上的目的地不能改。', limit: '过期即失效。' },
    { name: '火铳', type: '军器', function: '守城与破门。', cost: '火药受潮就会炸膛。', limit: '匠营每月只产数支。' },
    { name: '账册', type: '文书', function: '记录粮、兵、税。', cost: '改一笔就要改十笔。', limit: '原件只在主官手里。' },
  ],
  packs: [
    { theme: 'history-grain', premise: '边镇粮价：一石米换一条命', engine: '漕运制度', resources: ['粮引', '路引'], scenarios: ['粮价一夜翻倍', '瘟疫封城'], storylines: ['制度与生存', '家国与私情'], location: '边镇', faction: '边军', equipment: '官印' },
    { theme: 'history-sea', premise: '海禁：片板不许下海', engine: '市舶抽分制度', resources: ['海引', '军功札'], scenarios: ['海禁开闸', '宫变前夜'], storylines: ['海禁与海商', '旧案与新政'], location: '码头', faction: '海商', equipment: '火铳' },
  ],
};
