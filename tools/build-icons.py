#!/usr/bin/env python3
"""Subset Font Awesome to the icons index.html actually references.

Run after adding a new icon:   python3 tools/build-icons.py
Requires: pip install fonttools brotli
and the Font Awesome package available at FA_SRC below.
"""
import re, os, sys
from fontTools import subset

FA_SRC = os.environ.get('FA_SRC', 'node_modules/@fortawesome/fontawesome-free')
if not os.path.isdir(FA_SRC):
    sys.exit('Font Awesome not found. npm i @fortawesome/fontawesome-free@6.4.0 '
             'or set FA_SRC=/path/to/fontawesome-free')

html = open('index.html', encoding='utf-8').read()
facss = open(FA_SRC + '/css/all.min.css', encoding='utf-8').read()

used = {'solid': set(), 'brands': set()}
for cls, name in re.findall(r'"(fa[sbr]) (fa-[a-z0-9-]+)', html):
    used['brands' if cls == 'fab' else 'solid'].add(name)
for name in re.findall(r"'fas (fa-[a-z0-9-]+)'", html):
    used['solid'].add(name)
for name in re.findall(r"classList[^\n]*?'(fa-[a-z0-9-]+)'", html):
    used['solid'].add(name)

cp = {}
for block, code in re.findall(r'((?:\.fa-[a-z0-9-]+:before,?)+)\{content:"\\([0-9a-f]{2,5})"\}', facss):
    for sel in re.findall(r'\.(fa-[a-z0-9-]+):before', block):
        cp[sel] = int(code, 16)

rules, missing = [], []
for fam in ('solid', 'brands'):
    for n in sorted(used[fam]):
        (rules.append((fam, n, cp[n])) if n in cp else missing.append(n))
if missing:
    sys.exit('These icons are not in Font Awesome Free (Pro-only or misspelled): %s' % missing)

os.makedirs('fonts', exist_ok=True)
FILES = {'solid': ('fa-solid-900.woff2', 900, 'Font Awesome 6 Free'),
         'brands': ('fa-brands-400.woff2', 400, 'Font Awesome 6 Brands')}
css = ['/* Font Awesome 6 Free, subset to the %d icons this site uses. */' % len(rules)]
for fam, (fname, weight, family) in FILES.items():
    pts = sorted({c for f, n, c in rules if f == fam})
    if not pts:
        continue
    subset.main([FA_SRC + '/webfonts/' + fname,
                 '--unicodes=' + ','.join('U+%04X' % p for p in pts),
                 '--flavor=woff2', '--layout-features=', '--no-hinting',
                 '--desubroutinize', '--output-file=fonts/' + fname])
    print('%s -> %.1f KB (%d glyphs)' % (fname, os.path.getsize('fonts/' + fname) / 1024, len(pts)))
    css.append('@font-face{font-family:"%s";font-style:normal;font-weight:%d;font-display:block;'
               'src:url("%s") format("woff2")}' % (family, weight, fname))
css.append('.fa,.fas,.fab{-moz-osx-font-smoothing:grayscale;-webkit-font-smoothing:antialiased;'
           'display:var(--fa-display,inline-block);font-style:normal;font-variant:normal;'
           'line-height:1;text-rendering:auto}')
css.append('.fas{font-family:"Font Awesome 6 Free";font-weight:900}')
css.append('.fab{font-family:"Font Awesome 6 Brands";font-weight:400}')
css.append('.fa-spin{animation:fa-spin 2s linear infinite}'
           '@keyframes fa-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}'
           '@media (prefers-reduced-motion:reduce){.fa-spin{animation-delay:-1ms;'
           'animation-duration:1ms;animation-iteration-count:1}}')
for fam, n, c in rules:
    css.append('.%s:before{content:"\\%x"}' % (n, c))
open('fonts/icons.css', 'w', encoding='utf-8').write('\n'.join(css) + '\n')
print('fonts/icons.css -> %.1f KB' % (os.path.getsize('fonts/icons.css') / 1024))
