# Refresh workflow

setup/outline JSON 被改写或导入、md 伴生文件过期时使用。

```bash
node scripts/wishmachine.js refresh --dir my-book            # setup + outline
node scripts/wishmachine.js refresh setup --dir my-book
node scripts/wishmachine.js refresh outline --dir my-book
node scripts/wishmachine.js refresh --target all --dir my-book
```

`refresh` 只重建：

```text
story/setup/story_setup.md
story/compose/outline.md
```

它不调用模型、不生成正文、不改变 JSON artifact。`book write setup/outline --apply` 本身
会同步重建对应 md，只有手工改过或导入 JSON 时才需要单独 `refresh`。
