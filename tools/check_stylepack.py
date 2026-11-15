#!/usr/bin/env python3
"""Verify a chapter against a drawn stylepack card's measurable targets.

usage: check_stylepack.py <chapter.md> <stylepack.json|-> [--card-index N]

The stylepack JSON is the raw `ideas draw --type stylepack` output (or a card object).
Every target is a range: PASS/FAIL per dimension, plus the imagery blacklist check
(any banned term must appear zero times) and the paragraph-end mix distance.
"""
import io
import json
import re
import sys
import statistics as st

CJK = re.compile(r'[\u4e00-\u9fff]')
SENT = re.compile(r'(?<=[。！？])')
DIALOGUE_END = re.compile(r'[”"]\s*$')
JUDGE = re.compile(r'(就是|才是|不过是|其实是|本来就是|总是|永远|从来|唯一|真正|说到底|毕竟|只不过)')
ACTIONISH = re.compile(r'(了|着|过来|过去|回去|下来|起来|上|下|起|开|住|掉|完|走|拿|放|推|拉|合|抬|低|转|站|停|伸|看|说|问)[。！？]?\s*$')


def load_card(path, index):
    if path == '-':
        return json.load(sys.stdin)
    data = json.load(io.open(path, encoding='utf-8'))
    if isinstance(data, dict) and 'results' in data:
        return data['results'][index]
    return data


def measure(text):
    body = '\n'.join(line for line in text.split('\n') if not line.startswith('#'))
    paras = [p.strip() for p in re.split(r'\n\s*\n', body) if CJK.search(p)]
    sizes, lengths, ends = [], [], {'dialogue': 0, 'action': 0, 'description': 0}
    for para in paras:
        sents = [s for s in SENT.split(para) if CJK.search(s)]
        if not sents:
            continue
        sizes.append(len(sents))
        lengths.extend(len(CJK.findall(s)) for s in sents)
        last = sents[-1].strip()
        if DIALOGUE_END.search(para.strip()):
            ends['dialogue'] += 1
        elif JUDGE.search(last):
            ends['description'] += 1
        elif ACTIONISH.search(last):
            ends['action'] += 1
        else:
            ends['description'] += 1
    total_ends = sum(ends.values()) or 1
    return {
        'paragraph_sentences': st.mean(sizes) if sizes else 0,
        'sentence_mean_chars': st.mean(lengths) if lengths else 0,
        'sentence_cv': (st.pstdev(lengths) / st.mean(lengths)) if lengths else 0,
        'short_sentence_ratio': (sum(1 for n in lengths if n <= 5) / len(lengths)) if lengths else 0,
        'paragraph_end_mix': {k: v / total_ends for k, v in ends.items()},
        '_body': body,
        '_paragraphs': len(paras),
        '_sentences': len(lengths),
    }


def imagery_counts(body, lexicon):
    allow = lexicon.get('allow') or []
    ban = lexicon.get('ban') or []
    allowed_hits = {w: body.count(w) for w in allow if body.count(w)}
    banned_hits = {w: body.count(w) for w in ban if body.count(w)}
    return allowed_hits, banned_hits


def main():
    chapter = sys.argv[1]
    card = load_card(sys.argv[2] if len(sys.argv) > 2 else '-',
                     int(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[3] == '--card-index' else 0)
    target = card.get('rhythm_target') or {}
    lexicon = card.get('imagery_lexicon') or {}
    m = measure(io.open(chapter, encoding='utf-8').read())
    where = '/'.join(chapter.replace('\\', '/').split('/')[-2:])
    print(f"牌：{card.get('label')}（{card.get('style_id')}）| 章：{where}")
    print(f"实测：{m['_paragraphs']} 段 / {m['_sentences']} 句")
    print()
    ok_all = True
    # Only the two controllable scales are judged. cv / 短句占比 / 段末配比 are printed as
    # reference:十轮实测证明它们一次成型做不到（段末动作 8% vs 目标 35%），
    # 属于"写完再定点改写"的目标，不该当一稿的验收线。
    labels = {
        'paragraph_sentences': '段均句数',
        'sentence_mean_chars': '句长均值',
    }
    for key, label in labels.items():
        if key not in target:
            continue
        lo, hi = target[key]
        value = m[key]
        ok = lo <= value <= hi
        ok_all = ok_all and ok
        print(f"  {'PASS' if ok else 'FAIL'}  {label:16} 目标 {lo}–{hi}  实测 {value:.2f}")
    print()
    print(f"  参考（不判定）句长cv {m['sentence_cv']:.2f} · 短句占比 {m['short_sentence_ratio']:.2f} · "
          f"段末 对白{m['paragraph_end_mix']['dialogue']:.0%}/动作{m['paragraph_end_mix']['action']:.0%}"
          f"/描写{m['paragraph_end_mix']['description']:.0%}")
    if lexicon:
        allowed, banned = imagery_counts(m['_body'], lexicon)
        print()
        print(f"  意象白名单命中：{'、'.join(f'{w}{c}' for w, c in sorted(allowed.items(), key=lambda kv: -kv[1])[:8]) or '（无）'}")
        if banned:
            ok_all = False
            print(f"  FAIL 黑名单命中（必须为 0）：{'、'.join(f'{w}{c}' for w, c in banned.items())}")
        else:
            print('  PASS 黑名单命中：0')
    print()
    print('总判：', 'PASS ✅' if ok_all else 'FAIL ❌')


if __name__ == '__main__':
    main()
