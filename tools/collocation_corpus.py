#!/usr/bin/env python3
"""Corpus-based verb/object plausibility.

Why: the cold-read reviewer cannot judge collocation ("拉开" + "尸体" sailed through three runs), and a
word list only covers the cases someone thought of. What actually distinguishes them is usage: in real
Chinese, "拉开" is followed by 门/抽屉/帘/柜门 and never by 尸体. So count what the language does.

build  scans a corpus, records for each physical verb the two-character objects that share its clause,
       and writes a table.
check  reads a chapter, extracts (verb, clause) pairs, and reports clauses whose object never co-occurs
       with that verb in the corpus, along with the objects that verb does take.

usage:
  collocation_corpus.py build --corpus ~/books --out ~/.cache/wm-collocation.json
  collocation_corpus.py check --table ~/.cache/wm-collocation.json chapters/P1-V1-C1.md
"""
import argparse
import glob
import io
import json
import os
import re
import sys

import jieba
import jieba.posseg as posseg

# 只收物理动作动词：这些词的受事在真实语料里范围很窄，统计就有意义。
VERBS = [
    '拉开', '推开', '掀开', '打开', '关上', '合上', '盖上', '掏出', '摸出', '拿出', '抽出',
    '抓住', '捏住', '按住', '扣住', '攥住', '扶住', '扒开', '掰开', '撬开', '砸开', '撕开',
    '拖开', '踢开', '踢翻', '拽住', '拎起', '扛起', '搬起', '捧起', '捡起', '掀起',
]
VERB_SET = set(VERBS)
CLAUSE_SPLIT = re.compile(r'[。！？；，、“”「」：:\n]')
CJK = re.compile(r'[\u4e00-\u9fff]')


def clauses(text):
    for piece in CLAUSE_SPLIT.split(text):
        piece = piece.strip()
        if len(piece) >= 2 and CJK.search(piece):
            yield piece


def verb_nouns(clause):
    """同一子句里出现的（动作动词, 名词）对。用词性限定，避免 2-gram 碎片和人物名污染。"""
    verbs, nouns = [], []
    for word, flag in posseg.cut(clause):
        if word in VERB_SET:
            verbs.append(word)
        elif flag.startswith('n') and not flag.startswith('nr') and len(word) >= 2:
            nouns.append(word)
    return [(verb, noun) for verb in verbs for noun in nouns]


def build(corpus_paths, min_count=3):
    table = {verb: {} for verb in VERBS}
    files = []
    for path in corpus_paths:
        if os.path.isdir(path):
            files.extend(glob.glob(os.path.join(path, '**', '*.md'), recursive=True))
            files.extend(glob.glob(os.path.join(path, '**', '*.txt'), recursive=True))
        else:
            files.append(path)
    scanned = 0
    for file in files:
        try:
            text = io.open(file, encoding='utf-8', errors='ignore').read()
        except OSError:
            continue
        scanned += len(CJK.findall(text))
        for clause in clauses(text):
            # 便宜的前置过滤：不含目标动词的子句不送进分词器
            if not any(verb in clause for verb in VERB_SET):
                continue
            for verb, noun in verb_nouns(clause):
                table[verb][noun] = table[verb].get(noun, 0) + 1
    kept = {}
    for verb, counts in table.items():
        top = {obj: count for obj, count in counts.items() if count >= min_count}
        kept[verb] = dict(sorted(top.items(), key=lambda item: -item[1])[:80])
    return {'scanned_cjk': scanned, 'files': len(files), 'min_count': min_count, 'table': kept}


def check(table, text):
    verbs = table['table']
    findings = []
    for clause in clauses(text):
        if not any(verb in clause for verb in verbs):
            continue
        for verb, noun in verb_nouns(clause):
            if verbs[verb].get(noun, 0) > 0:
                continue
            findings.append({
                'verb': verb,
                'noun': noun,
                'clause': clause,
                'usual_objects': list(verbs[verb].keys())[:8],
            })
    return findings


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)
    build_cmd = sub.add_parser('build')
    build_cmd.add_argument('--corpus', nargs='+', required=True)
    build_cmd.add_argument('--out', required=True)
    build_cmd.add_argument('--min-count', type=int, default=3)
    check_cmd = sub.add_parser('check')
    check_cmd.add_argument('--table', required=True)
    check_cmd.add_argument('files', nargs='+')
    args = parser.parse_args()

    if args.command == 'build':
        result = build(args.corpus, args.min_count)
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        io.open(args.out, 'w', encoding='utf-8').write(json.dumps(result, ensure_ascii=False))
        size = os.path.getsize(args.out)
        print(f"扫过 {result['scanned_cjk']:,} 字 / {result['files']} 个文件 → {args.out} ({size / 1024:.0f} KB)")
        for verb in ['拉开', '推开', '抓住']:
            print(f"  {verb}: {list(result['table'][verb].keys())[:8]}")
        return

    table = json.loads(io.open(args.table, encoding='utf-8').read())
    total = 0
    for file in args.files:
        text = io.open(file, encoding='utf-8', errors='ignore').read()
        findings = check(table, text)
        total += len(findings)
        if not findings:
            continue
        print(f'\n{file}')
        for item in findings:
            print(f"  {item['verb']} + {item['noun']}   子句「{item['clause']}」")
            print(f"      语料里 {item['verb']} 常带：{'、'.join(item['usual_objects'])}")
    print(f'\n共 {total} 处：这个名词在语料里从未与该动词在同一子句出现。')
    print('注意：语料没覆盖到的正当搭配也会落到这里（生僻名词、方言、故意陌生化），人读一遍再改。')


if __name__ == '__main__':
    sys.exit(main())
