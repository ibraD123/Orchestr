from pathlib import Path
import re
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'marketplace_listing_rules_ru.md'
DEST = ROOT / 'Basira_Marketplace_Listing_Rules_2026-11-08.docx'


def shade(cell, fill):
    sh = OxmlElement('w:shd'); sh.set(qn('w:fill'), fill)
    cell._tc.get_or_add_tcPr().append(sh)


def hyperlink(p, label, url, bold=False):
    rel = p.part.relate_to(url, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink', is_external=True)
    h = OxmlElement('w:hyperlink'); h.set(qn('r:id'), rel)
    r = OxmlElement('w:r'); rp = OxmlElement('w:rPr')
    color = OxmlElement('w:color'); color.set(qn('w:val'), '215E89'); rp.append(color)
    u = OxmlElement('w:u'); u.set(qn('w:val'), 'single'); rp.append(u)
    if bold: rp.append(OxmlElement('w:b'))
    r.append(rp); t = OxmlElement('w:t'); t.text = label; r.append(t); h.append(r); p._p.append(h)


def inline(p, s, bold=False):
    pattern = r'(\[[^\]]+\]\(https?://[^\s]+\)|\*\*.+?\*\*|`[^`]+`)'
    for part in re.split(pattern, s):
        if not part: continue
        m = re.fullmatch(r'\[([^\]]+)\]\((https?://[^\s]+)\)', part)
        if m: hyperlink(p, m.group(1), m.group(2), bold=bold)
        elif part.startswith('**') and part.endswith('**'): inline(p, part[2:-2], bold=True)
        elif part.startswith('`') and part.endswith('`'):
            r = p.add_run(part[1:-1]); r.font.name = 'Arial'; r.font.size = Pt(9)
        else: p.add_run(part).bold=bold


def setup(doc):
    sec = doc.sections[0]
    sec.page_width = Inches(8.5); sec.page_height = Inches(11)
    sec.top_margin = Inches(.72); sec.bottom_margin = Inches(.68)
    sec.left_margin = sec.right_margin = Inches(.72)
    sec.header_distance = Inches(.28); sec.footer_distance = Inches(.28)
    styles = doc.styles
    for name in ('Normal', 'Body Text', 'List Bullet', 'List Number'):
        st=styles[name]; st.font.name='Arial'; st.font.size=Pt(10.5); st.font.color.rgb=RGBColor(0,0,0)
        st.paragraph_format.space_after=Pt(5)
        st.paragraph_format.line_spacing=1.08
    styles['Title'].font.name='Arial'; styles['Title'].font.size=Pt(29); styles['Title'].font.color.rgb=RGBColor(0,0,0)
    styles['Title'].paragraph_format.space_after=Pt(16)
    for name, size in [('Heading 1',19),('Heading 2',14),('Heading 3',11.5)]:
        st=styles[name]; st.font.name='Arial'; st.font.size=Pt(size); st.font.bold=True; st.font.color.rgb=RGBColor(0,0,0)
        st.paragraph_format.space_before=Pt(13); st.paragraph_format.space_after=Pt(7)
        st.paragraph_format.keep_with_next=True
    # The header is deliberately text only.
    h=sec.header.paragraphs[0]; h.alignment=WD_ALIGN_PARAGRAPH.RIGHT
    r=h.add_run('BASIRA  /  Правила товарных карточек'); r.font.name='Arial'; r.font.size=Pt(8); r.font.color.rgb=RGBColor.from_string('666666')
    f=sec.footer.paragraphs[0]; f.alignment=WD_ALIGN_PARAGRAPH.RIGHT
    r=f.add_run('Проверено 8 ноября 2026  ·  '); r.font.size=Pt(8)
    fld=OxmlElement('w:fldSimple'); fld.set(qn('w:instr'),'PAGE'); f._p.append(fld)
    sec.different_first_page_header_footer=True
    doc.core_properties.title='Правила товарных карточек на маркетплейсах ОАЭ и Саудовской Аравии'
    doc.core_properties.subject='Изображения, инфографика, видео, расширенный контент и публикация'
    doc.core_properties.author='Basira Research'


def table(doc, rows):
    rows=[r for r in rows if not re.fullmatch(r'[\s|:\-]+',r)]
    cells=[[c.strip() for c in r.strip().strip('|').split('|')] for r in rows]
    n=len(cells[0]); tab=doc.add_table(rows=0, cols=n); tab.alignment=WD_TABLE_ALIGNMENT.CENTER; tab.autofit=False
    width=7.06
    # Two column specs give readable labels and room for actual requirements.
    ratios=([.25,.75] if n==2 else [.08,.46,.46] if n==3 and cells[0][0]=='ID' else [.20,.40,.40] if n==3 else [1/n]*n)
    for col, ratio in zip(tab.columns, ratios): col.width=Inches(width*ratio)
    for i,row in enumerate(cells):
        tr=tab.add_row()
        no_split=OxmlElement('w:cantSplit'); tr._tr.get_or_add_trPr().append(no_split)
        for j, txt in enumerate(row):
            c=tr.cells[j]; c.width=Inches(width*ratios[j]); c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.TOP
            pr=c._tc.get_or_add_tcPr()
            margins=OxmlElement('w:tcMar')
            for edge,val in [('top','75'),('bottom','75'),('left','95'),('right','95')]:
                e=OxmlElement('w:'+edge); e.set(qn('w:w'),val); e.set(qn('w:type'),'dxa'); margins.append(e)
            pr.append(margins)
            p=c.paragraphs[0]; p.paragraph_format.space_after=Pt(2); p.paragraph_format.line_spacing=1.02
            inline(p,txt)
            for run in p.runs: run.font.size=Pt(9)
            if i==0:
                shade(c,'EDEFF1')
                for run in p.runs: run.bold=True
        if i==0:
            repeat=OxmlElement('w:tblHeader'); tr._tr.get_or_add_trPr().append(repeat)
    borders=OxmlElement('w:tblBorders')
    for edge in ('top','left','bottom','right','insideH','insideV'):
        e=OxmlElement('w:'+edge); e.set(qn('w:val'),'single'); e.set(qn('w:sz'),'4'); e.set(qn('w:color'),'D9D9D9'); borders.append(e)
    tab._tbl.tblPr.append(borders)
    doc.add_paragraph().paragraph_format.space_after=Pt(0)


def main():
    doc=Document(); setup(doc)
    lines=SOURCE.read_text().splitlines(); i=0
    while i<len(lines):
        line=lines[i].strip()
        if not line: i+=1; continue
        if line=='<!-- pagebreak -->': doc.add_page_break(); i+=1; continue
        if line.startswith('|'):
            rows=[]
            while i<len(lines) and lines[i].strip().startswith('|'): rows.append(lines[i]); i+=1
            table(doc,rows); continue
        if line.startswith('# '): p=doc.add_paragraph(style='Title'); inline(p,line[2:])
        elif line.startswith('## '):
            p=doc.add_paragraph(style='Heading 1'); inline(p,line[3:])
        elif line.startswith('### '): p=doc.add_paragraph(style='Heading 2'); inline(p,line[4:])
        elif line.startswith('#### '): p=doc.add_paragraph(style='Heading 3'); inline(p,line[5:])
        elif line.startswith('- '):
            p=doc.add_paragraph(style='List Bullet'); inline(p,line[2:])
            if line.startswith(('- Источник ', '- География/', '- [Техническая таблица')):
                p.paragraph_format.keep_with_next=True
        elif re.match(r'^\d+\. ',line):
            p=doc.add_paragraph(); p.paragraph_format.left_indent=Inches(.25); p.paragraph_format.first_line_indent=Inches(-.25); inline(p,line)
        elif line.startswith('<!--'): pass
        else: p=doc.add_paragraph(); inline(p,line)
        i+=1
    doc.save(DEST)
    print(DEST)


if __name__=='__main__': main()
