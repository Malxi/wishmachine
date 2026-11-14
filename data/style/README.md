# style data

本目录存放**人类风格参考**，不是文档：

- `human-samples.json`：内置公版/授权样本。每条带 `id/source/author/work/url/license/text`。
  - 鲁迅、朱自清、郁达夫：中国 life+50 公版；其他法域请自行确认。
  - 老舍、废名：中国 life+50 公版，但 life+70 法域要到 2037/2038，仓库全球分发时请谨慎。
  - 最后一条是作者 Malxi 本人提供并授权公开使用的样本（可复制、改编）。
- `voice-card.example.json`：voice card 示例，`samples` 必须引用这里的 `sample_id` 或用户确认的 human 样本。

写入 `story/style/writing-style.json` 时，`references[]` 必须带 `sample_id`（公版）或
`source: "human"` + `license` + `user_confirmed: true`（用户本人提供）。AI 不得自己写示范段落。
