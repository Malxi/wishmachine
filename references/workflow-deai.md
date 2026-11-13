# 去 AI 味工作流（风格 pass）

目标不是“写得更华丽”，而是把**默认选择**改成**这一个叙述者、这一个场景的选择**。
本工作流配合 `check --profile style` 使用；CLI 只给统计和命中位置，改写由你完成。

## 0. 先建 voice card（每本书一次）

`story/style/voice.json` 是这本书的声音契约，写正文前先 `book read style`（或
`book read context` 看 summary），把 `voice.description`、`principles`、`avoid` 和
2–3 段 `samples` 带进上下文。最小形状：

```json
{
  "version": 1,
  "narrative": { "pov": "third_person_limited", "tense": "past", "distance": "close" },
  "voice": {
    "description": "冷峻、具体、少形容词；情绪从账目和动作里漏出来",
    "principles": ["用职业细节代替抽象判断", "每段至少一个可触摸的物"],
    "avoid": ["会躁式单字谓语", "段尾升华", "不是…而是…", "三连排比"]
  },
  "samples": [{ "label": "开篇", "text": "……你自己写的 200–500 字段落……" }],
  "negative_samples": [{ "label": "反面", "text": "……一段你觉得 AI 味的文字……" }]
}
```

写入：`book write style --dir <project> --apply < voice.json`（默认 dry-run）。
`samples` 用**你自己写的**或公版文本，不要复制受版权保护的当代作家原文。

## 1. 设定 loop（写正文前，最多 2 轮）

设定不过关，正文怎么写都救不回来。按“四件套”过一遍：

1. **一地点**：故事发生在哪个具体地方？谁在这里工作、记账、交税？
2. **一职业**：主角每天重复的具体劳动是什么？冲突从劳动里长出来。
3. **一矛盾**：这个地方的人相信什么，现实又逼他们做什么？
4. **一代价**：力量/规则要付什么代价？代价必须能被记账、被看见。

然后跑：

```bash
wishmachine check --dir <project> --profile style --target setup
```

关注 `style.setup.genre_salad`（题材堆叠）、`style.setup.abstract_terms`（抽象词密度）、
`style.setup.theme_aphorism`（格言式主题）、`style.setup.rules_concrete`（规则不可操作），
以及 `style.setup.name_*`（姓氏集中、描述式名字、单字名、来源缺失、重名）。
取名先做 namecard pass：先定最终题材，再 `ideas draw --type namecard --genre <实际题材>
--count 20`，把选中的 `namecard_id/naming_style/naming_logic` 写进 setup；详见
`references/name-guide.md`。
改法：

- theme 不要写“守住边界的不是墙，是……”这种格言，改成一条人物每天要执行的规矩。
- 规则必须写清“能做什么、不能做什么、违反后付什么代价”，而不是“四样作物就是四座塔”。
- 题材选一个主类型，其余作为**代价机制**存在，不要并列成卖点。

## 2. 章节 loop（每章，最多 2 轮）

1. 按 outline + voice card 写初稿。
2. 体检：

   ```bash
   wishmachine check --dir <project> --profile style --target chapter --id P1-V1-C1
   ```

3. 看 `findings` 里的 `metrics.value`、`threshold` 和 `evidence`，**只改命中句/段**，
   不要整章重写。优先处理 medium：单字谓语、否定式谓语、句首复用、段尾升华、比喻密度。
4. 复检；指标回到健康带或你明确接受即可，**不要追求 0**。
5. 朗读一遍，人工抽检“像不像人写的”。
6. 把本章新发现的“用滥词/句式”写回 voice card 的 `voice.avoid`（`book write style`）。

每场戏先过“目标/阻碍/转折/结果”四件事；连续两段没有新信息就合并或删。
同一母题（数、纸边、账、六、第七垄）全书超过 3 次就要升级代价或认知，
纯仪式性重复直接删；`style.motifs` 和 `style.book.repeated_motif` 会量化这件事，
详见 `references/scene-guide.md`。

### 关键指标与目标

| 指标 | 目标 |
|---|---|
| 单字谓语收尾 | ≤2.0/千字（第七垄基线 3.2） |
| 否定式单字谓语占比 | ≤50%（第七垄 85%） |
| 句首复用率 | ≤30%（第七垄 54%） |
| 主角名开头率 | ≤8%（第七垄 12%） |
| 段尾升华 | ≤0.3/千字 |
| 模板连接句 | ≤0.8/千字 |
| 比喻密度 | ≤2.5/千字 |
| 对话占比 | 8%–35% |

指标是**方向**不是 KPI；如果为了达标把句子改得机械，就是另一种 AI 味。

## 3. 书级 loop（每 3 章）

```bash
wishmachine audit --dir <project> --profile style --view summary
```

看全书 `metrics` 和每章 `metrics`：某个指标中位数超线、或后几章比前几章恶化 20%，
就是风格漂移。把漂移写回 voice card，下一章开头重新注入。

## 4. 改写手法（按优先级）

1. **具体性置换**：抽象判断换成只有这个人物/职业/地方会注意到的细节。
2. **句法去模板**：删“不是…而是/不仅…还/首先其次最后”；段尾停在动作或对话上；
   句子长短故意不匀。
3. **重复纪律**：重复只在信息升级时用（第二次数出第七垄、代价变了），否则删。
4. **对话口语化**：半句、抢话、答非所问、行话；叙述里少用“她说”，多用动作和停顿。
5. **场景裁剪**：晚进早出；砍 30% 世界观解释，让设定从动作和账目里漏出来。

## 5. 反例（第七垄实测）

- ❌ 马拉进去会躁。沈穗没争。
  ✅ 车夫说，马进了那块地就烦躁，怎么打都不肯往前走。沈穗没跟他争，把箱子从车上提下来。
- ❌ 她数了一遍。六垄。又数了一遍，还是六垄。
  ✅ 她数了一遍，六条。从东头数到西头，又从西头数回来，还是六条。垄沟直得不像荒了三年，
  草根把土撑得歪歪扭扭，沟却一道没塌。

## 6. 不要做的事

- 不要先写得很 AI 再整段 humanize：信息结构已经被模板化了，humanize 只能洗表面。
- 不要为了指标归零反复润色；最多 2 轮。
- 不要把 voice card 写成“文笔优美、情感细腻”这种空话；写可执行的禁令和样本。
- 不要把 `check --profile style` 当 blocking gate；它是体检，不是裁判。
