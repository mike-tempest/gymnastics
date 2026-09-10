"""Check the exact static deliverable, never the dormant inherited site."""
from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import urlparse

root = Path(__file__).resolve().parents[1] / 'dist.nosync'
expected = {'index.html', 'features/index.html', 'pricing/index.html', 'founding-clubs/index.html', '404.html'}
actual = {str(p.relative_to(root)) for p in root.rglob('*.html')}
assert actual == expected, f'Unexpected page inventory: {actual ^ expected}'

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.headings = 0
        self.canonical = None
        self.ids = set()
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'h1':
            self.headings += 1
        if 'id' in attrs:
            self.ids.add(attrs['id'])
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonical = attrs.get('href')
        if tag in ('a', 'img', 'script', 'link'):
            value = attrs.get('src') or attrs.get('href')
            if value:
                self.links.append(value)
        if tag == 'img':
            assert 'alt' in attrs, 'Image without alt attribute'
        assert 'style' not in attrs, 'Inline style in published page'

for path in root.rglob('*'):
    if path.suffix not in ('.html', '.css', '.js', '.xml', '.txt', '.svg'):
        continue
    text = path.read_text()
    assert not re.search(r'swimly|swim\s+club|swimming|wavepower|swim england', text, re.I), f'Inherited content in {path}'
    if path.suffix != '.html':
        continue
    page = Page()
    page.feed(text)
    assert page.headings == 1, f'Expected one h1 in {path}'
    assert page.canonical and page.canonical.startswith('https://tumblebase.com/'), f'Wrong canonical in {path}'
    for link in page.links:
        url = urlparse(link)
        if url.scheme or url.netloc:
            continue
        if url.path:
            target = root / url.path.lstrip('/') if url.path.startswith('/') else path.parent / url.path
            if target.is_dir():
                target /= 'index.html'
            assert target.is_file(), f'Broken local link {link} in {path}'
        elif url.fragment:
            assert url.fragment in page.ids, f'Broken anchor {link} in {path}'
assert (root / 'sitemap.xml').is_file()
assert (root / 'robots.txt').is_file()
print('Verified 5 Tumblebase pages, canonical URLs, local links, image labels and clean published content.')
