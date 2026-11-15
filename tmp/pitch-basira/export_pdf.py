from pathlib import Path
import json
import re
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from PIL import Image

ROOT = Path('/Users/ibragimdaudov/Desktop/Basira')
TMP = ROOT / 'tmp/pitch-basira'
OUT = ROOT / 'output/pdf/Basira-Pitch-Deck-EN-2026-11.pdf'
FONTS = Path('/System/Library/Fonts/Supplemental')
for family, name in [('Arial', 'Arial.ttf'), ('ArialBold', 'Arial Bold.ttf'),
                     ('Georgia', 'Georgia.ttf'), ('GeorgiaBold', 'Georgia Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(family, str(FONTS / name)))

records = [json.loads(line) for line in (TMP / 'text-layout.ndjson').read_text().splitlines() if line]
assert not any(re.search('[А-Яа-яЁё]', r.get('text', '')) for r in records)

def wrapped_lines(text, font, size, width):
    lines = []
    for paragraph in text.split('\n'):
        line = ''
        for word in paragraph.split():
            candidate = (line + ' ' + word).strip()
            if line and pdfmetrics.stringWidth(candidate, font, size) > width:
                lines.append(line)
                line = word
            else:
                line = candidate
        lines.append(line)
    return lines

def searchable_text(c, r):
    p = r['position']
    st = r.get('style', {})
    font = 'Georgia' if st.get('typeface') == 'Georgia' else 'Arial'
    if st.get('bold'):
        font += 'Bold'
    size = st.get('fontSize', 26) * .75
    width = p['width'] * .75
    x = p['left'] * .75
    y = (720 - p['top']) * .75 - size
    txt = c.beginText()
    txt.setFont(font, size)
    txt.setTextRenderMode(3)
    for line in wrapped_lines(r.get('text', ''), font, size, width):
        xx = x
        if st.get('alignment') == 'right':
            xx += width - pdfmetrics.stringWidth(line, font, size)
        txt.setTextOrigin(xx, y)
        txt.textOut(line)
        y -= size * 1.12
    c.drawText(txt)

market = 'https://www.wam.ae/en/article/c2h35yn-uae-e-commerce-market-size-reaches-aed422-billion'
zid = 'https://zid.sa/en/partners/developers/themes/'
urls = [market, zid, 'https://www.photoroom.com/enterprise',
        'https://listingoptimization.ai/', 'https://streamoid.com/']

def add_link(c, url, x, y, w, h):
    c.linkURL(url, (x*.75, (720-y-h)*.75, (x+w)*.75, (720-y)*.75), relative=0, thickness=0)

c = canvas.Canvas(str(OUT), pagesize=(960, 540), pageCompression=1)
c.setTitle('Basira Pitch Deck - English - November 2026')
c.setAuthor('Basira')
c.setSubject('Product, market, business model and proposed agency pilots in the UAE and Saudi Arabia')
c.setCreator('Basira presentation export')
for page in range(16):
    img = TMP / 'render' / f'pdf-{page+1:02}.png'
    with Image.open(img) as im:
        assert im.size == (2560, 1440), (img, im.size)
    c.drawImage(ImageReader(str(img)), 0, 0, 960, 540, preserveAspectRatio=True, mask='auto')
    for r in records:
        if r['slideIndex'] == page:
            searchable_text(c, r)
    # The competitive comparison remains searchable as well as visually intact.
    if page == 9:
        txt = c.beginText(48, 390)
        txt.setFont('Arial', 10)
        txt.setTextRenderMode(3)
        for line in [
            'Product / Advertised focus / Basira focus',
            'Photoroom: Product imagery, video and visual operations at scale.',
            'Listing Optimization AI: Amazon imagery and A+, review and competitor analysis.',
            'Streamoid / Catalogix: Product data, content and catalog operations for fashion.',
            'Basira: Audit, confirmed product facts, Creator and client approvals. A connected GCC content workflow.'
        ]:
            txt.textLine(line)
        c.drawText(txt)
    if page == 10:
        add_link(c, market, 68, 435, 550, 28)
        add_link(c, zid, 704, 435, 490, 28)
    if page == 15:
        for j, url in enumerate(urls):
            add_link(c, url, 64, 183+j*83, 1140, 32)
    title = 'Basira' if page == 0 else next(
        (r['text'] for r in records if r['slideIndex'] == page and r['position']['top'] == 44),
        f'Slide {page+1}')
    c.bookmarkPage(f'slide-{page+1}')
    c.addOutlineEntry(title.replace('\n', ' '), f'slide-{page+1}', level=0, closed=False)
    c.showPage()
c.save()
print(OUT)
print(f'{OUT.stat().st_size:,} bytes')
