#!/usr/bin/env python3
"""Download and subset the web fonts this site uses, so nothing renders through
a third party (fewer connections, and no visitor data sent to Google).

Run:  python3 tools/build-fonts.py      Requires: pip install fonttools brotli
"""
import re, subprocess, os, sys
from fontTools import subset

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
# Only the weights the stylesheet actually asks for.
WANT = {'Playfair Display': ['400', '700'], 'Nunito': ['400', '500', '600', '700', '800']}
URL = ('https://fonts.googleapis.com/css2'
       '?family=Playfair+Display:wght@400;700&family=Nunito:wght@400;500;600;700;800&display=swap')
# Basic Latin, Latin-1, and the typographic marks the copy uses.
UNICODES = 'U+0020-007E,U+00A0-00FF,U+2013-2014,U+2018-201A,U+201C-201E,U+2026,U+00B7,U+2122,U+20AC,U+00A3'

css = subprocess.run(['curl', '-sS', '-H', 'User-Agent: ' + UA, URL],
                     capture_output=True, text=True).stdout
if 'font-face' not in css:
    sys.exit('Could not fetch the font stylesheet from Google Fonts.')

os.makedirs('fonts', exist_ok=True)
out, total = [], 0
for label, face in re.findall(r'(?:/\*\s*([\w\-\[\]]+)\s*\*/\s*)?(@font-face\s*\{[^}]*\})', css):
    if label != 'latin':                       # an English site needs no latin-ext
        continue
    url = re.search(r'url\((https://fonts\.gstatic\.com[^)]+)\)', face).group(1)
    fam = re.search(r"font-family:\s*'([^']+)'", face).group(1)
    wt = re.search(r'font-weight:\s*(\d+)', face).group(1)
    if wt not in WANT.get(fam, []):
        continue
    name = '%s-%s.woff2' % (fam.replace(' ', ''), wt)
    subprocess.run(['curl', '-sS', '-o', 'fonts/_raw.woff2', url], check=True)
    subset.main(['fonts/_raw.woff2', '--unicodes=' + UNICODES, '--flavor=woff2',
                 '--layout-features=kern,liga', '--no-hinting',
                 '--output-file=fonts/' + name])
    size = os.path.getsize('fonts/' + name); total += size
    print('  %-34s %6.1f KB' % (name, size / 1024))
    out.append('@font-face{font-family:"%s";font-style:normal;font-weight:%s;'
               'font-display:swap;src:url("%s") format("woff2")}' % (fam, wt, name))
os.path.exists('fonts/_raw.woff2') and os.remove('fonts/_raw.woff2')
open('fonts/fonts.css', 'w', encoding='utf-8').write(
    '/* Playfair Display + Nunito, self-hosted and subset to Latin. */\n' + '\n'.join(out) + '\n')
print('  %-34s %6.1f KB total across %d files' % ('', total / 1024, len(out)))
