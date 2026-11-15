#!/usr/bin/env python3
"""Report-only collocation scan: abstract nouns paired with life verbs.

This does NOT judge violations. In Chinese, 死/活/流血/呼吸 take living subjects, so a sentence
like "名字不死" makes the reader stop and translate a metaphor mid-line. But 证据链断了 / 编号从中间
断开 / 名单上还有活人 are all correct, so a blanket ban would wreck good prose.

Used as an editorial net: run it over a chapter, read the handful of candidates, and decide
by hand which one is a real mismatch.

usage: check_collocation.py <file-or-dir> [more...]
Exit code is always 0 — this is a lens, not a gate.
"""
import glob
import io
import os
import re
import sys

ABSTRACT = [
    '名字', '规矩', '制度', '记忆', '记录', '证据', '程序', '系统', '时间', '真相',
    '案子', '名单', '编号', '报告', '规则', '命令', '身份', '卷宗', '条款', '关系',
    '顺序', '流程', '手续', '户籍', '登记', '批文', '回执',
]
LIFE_VERBS = ['死', '活', '流血', '呼吸', '喘', '饿', '困', '醒', '睡', '哭', '笑', '咽', '吐']

# 这些组合是正常搭配或名词，不该报。
NOUN_COMPOUNDS = ['死者', '死人', '活人', '活口', '死因', '活路', '死活', '记忆体']
SAFE_PAIRS = [
    (r'编号', r'断'),      # 编号/线/链 可以断
    (r'证据', r'断'),
    (r'名单', r'活人'),
]


def iter_files(paths):
    for path in paths:
        if os.path.isdir(path):
            for file in sorted(glob.glob(os.path.join(path, '**', '*.md'), recursive=True)):
                # checkpoints/ 是同一章的历次快照，扫它会重复报同一个句子。
                if f'{os.sep}checkpoints{os.sep}' in file:
                    continue
                yield file
        elif os.path.isfile(path):
            yield path


def scan(text):
    hits = []
    for noun in ABSTRACT:
        for verb in LIFE_VERBS:
            # 名词和动词之间最多隔 2 个非句子标点字符，避免跨句误配
            pattern = re.compile(f'{re.escape(noun)}[^。！？]{{0,2}}?{re.escape(verb)}')
            for match in pattern.finditer(text):
                span = text[max(0, match.start() - 10):match.end() + 10].replace('\n', ' ')
                hit = match.group(0)
                if any(compound in hit for compound in NOUN_COMPOUNDS):
                    continue
                if any(re.search(f'{a}[^。！？]{{0,2}}?{b}', hit) for a, b in SAFE_PAIRS):
                    continue
                hits.append((hit, span))
    return hits


def main():
    paths = sys.argv[1:] or ['.']
    total = 0
    seen_files = set()
    for file in iter_files(paths):
        if os.path.basename(file).startswith('.'):
            continue
        real = os.path.realpath(file)
        if real in seen_files:
            continue
        seen_files.add(real)
        try:
            text = io.open(file, encoding='utf-8').read()
        except (OSError, UnicodeDecodeError):
            continue
        hits = scan(text)
        if not hits:
            continue
        total += len(hits)
        print(f"\n{file}")
        for hit, span in hits:
            print(f"  {hit:<12} …{span}…")
    if total == 0:
        print('没有候选句。')
    else:
        print(f"\n共 {total} 处候选。注意：这里面大部分是误伤（证据链断了、编号断开都正常），")
        print('请人读一遍再决定改哪一句；不要整批替换。')


if __name__ == '__main__':
    main()
