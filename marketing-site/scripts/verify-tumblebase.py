"""Check the exact static deliverable, never the dormant inherited site."""
from html.parser import HTMLParser
from pathlib import Path
import re
import json
from datetime import date
from xml.etree import ElementTree
from urllib.parse import urlparse

root = Path(__file__).resolve().parents[1] / 'dist.nosync'
expected = {'index.html', 'features/index.html', 'pricing/index.html', 'founding-clubs/index.html', '404.html'}
records = json.loads((root.parent / 'site/data/clubs.json').read_text())
def slugify(value):
    return re.sub('[^a-z0-9]+', '-', value.lower()).strip('-')
regions = {record['region'] for record in records}
paths = {'/', '/features/', '/pricing/', '/founding-clubs/', '/clubs/'}
paths |= {f'/clubs/{slugify(region)}/' for region in regions}
slugs = set()
assert len(records) >= 100, 'Initial directory requires at least 100 sourced clubs'
assert {record['nation'] for record in records} == {'England', 'Scotland', 'Wales', 'Northern Ireland'}
for record in records:
    assert re.fullmatch('[a-z0-9]+(?:-[a-z0-9]+)*', record['slug']), record
    assert record['slug'] not in slugs, f"Duplicate club slug: {record['slug']}"
    slugs.add(record['slug'])
    assert all(isinstance(record[key], str) and record[key].strip() for key in ('name', 'nation', 'region', 'town'))
    assert record['addresses'] and all(isinstance(address, str) and address.strip() for address in record['addresses'])
    assert len(set(address.lower() for address in record['addresses'])) == len(record['addresses'])
    assert isinstance(record['disciplines'], list) and len(record['disciplines']) == len(set(record['disciplines']))
    assert all(isinstance(item, str) and item.strip() for item in record['disciplines'])
    assert date.fromisoformat(record['checkedAt']) <= date.today(), 'Future source check'
    assert record['sources'] and all(source['label'].strip() for source in record['sources'])
    for url in [source['url'] for source in record['sources']] + ([record['website']] if record['website'] else []):
        parsed = urlparse(url)
        assert parsed.scheme in ('https', 'http') and parsed.netloc and not parsed.username, f'Unsafe source URL: {url}'
    paths.add(f"/clubs/{slugify(record['region'])}/{record['slug']}/")
expected |= {path.strip('/') + '/index.html' for path in paths if path != '/'}
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
    assert page.canonical and page.canonical.startswith('https://www.tumblebase.com/'), f'Wrong canonical in {path}'
    relative = str(path.relative_to(root))
    expected_path = '/404/' if relative == '404.html' else '/' + relative.removesuffix('index.html')
    assert page.canonical == 'https://www.tumblebase.com' + expected_path, f'Wrong page canonical in {path}'
    for script in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', text, re.S):
        structured = json.loads(script)
        assert structured.get('@context') == 'https://schema.org'
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
sitemap = ElementTree.parse(root / 'sitemap.xml')
urls = [element.text for element in sitemap.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
assert len(urls) == len(set(urls)), 'Duplicate sitemap entries'
assert set(urls) == {'https://www.tumblebase.com' + path for path in paths}, 'Sitemap does not match public pages'
assert 'https://www.tumblebase.com/sitemap.xml' in (root / 'robots.txt').read_text()
print(f'Verified {len(actual)} pages, {len(records)} sourced clubs, exact sitemap, canonical URLs, structured data and local links.')
