from pathlib import Path
import re

ROOT=Path(__file__).resolve().parent
PARTS=ROOT/'parts'


def normalize(text, title):
    lines=text.splitlines(); output=[]; removed=False
    for line in lines:
        # Internal handoff conclusions are redundant with the report introduction.
        if line.startswith('## Выводы для редактора общего документа'):
            removed=True; continue
        if removed:
            if line.startswith('## '): removed=False
            else: continue
        if line.startswith('# '): output.append('## '+title); continue
        if line.startswith('### '): line='#### '+line[4:]
        elif line.startswith('## '): line='### '+line[3:]
        if line.startswith('#'):
            line=re.sub(r'^(#+ )\d+\.\s*',r'\1',line)
            line=line.replace(': ', ' ').replace(' / ', ' и ')
            line=line.replace('Противоречия и незакрытые вопросы, которые нужно сохранить в финальном документе','Противоречия и вопросы для проверки')
            line=line.replace('Реестр первичных источников и краткие правила','Подробные правила и источники')
        output.append(line)
    return '\n'.join(output)


def main():
    order=['frontmatter','amazon','noon','other-marketplaces','storefronts','operating-guide']
    raw={n:(PARTS/(n+'.md')).read_text() for n in order}
    refs={}
    for text in raw.values():
        current=None
        for line in text.splitlines():
            m=re.match(r'### (A\d{2}) ',line)
            if m: current=m.group(1)
            m=re.match(r'- URL: (https?://\S+)',line)
            if m and current: refs[current]=m.group(1)
            m=re.match(r'- \*\*(N\d{2})\*\*.*?\]\((https?://[^\s]+)\)',line)
            if m: refs[m.group(1)]=m.group(2)
            m=re.match(r'\| (O\d{2}) \|.*?\]\((https?://[^\s]+)\)',line)
            if m: refs[m.group(1)]=m.group(2)
            m=re.match(r'- ([SZG]\d{2}) .*?\]\((https?://[^\s]+)\)',line)
            if m: refs[m.group(1)]=m.group(2)
    titles={'amazon':'Amazon.ae и Amazon.sa','noon':'Noon','other-marketplaces':'Другие маркетплейсы региона'}
    texts=[]
    for name in order:
        s=raw[name]
        if name in titles: s='<!-- pagebreak -->\n\n'+normalize(s,titles[name])
        if name=='storefronts' or name=='operating-guide': s='<!-- pagebreak -->\n\n'+s
        # Turn bare source URLs into human-readable native hyperlinks.
        s=re.sub(r'^- URL: (https?://\S+)$',r'- Источник [Официальная страница](\1)',s,flags=re.M)
        # The handoff markdown has bracketed source identifiers. Make them usable directly.
        def linkrefs(m):
            group=m.group(1)
            ids=re.findall(r'[ANOSZG]\d{2}',group)
            if len(ids)==2 and ('–' in group or '-' in group) and ids[0][0]==ids[1][0]:
                ids=[ids[0][0]+f'{n:02}' for n in range(int(ids[0][1:]),int(ids[1][1:])+1)]
            return ', '.join(f'[{key}]({refs[key]})' if key in refs else key for key in ids)
        s=re.sub(r'\[([ANOSZG]\d{2}(?:[\s,–\-]+[ANOSZG]\d{2})*)\](?!\()',linkrefs,s)
        # Long filenames with nested brackets break Markdown hyperlink syntax.
        s=s.replace('[Brand Ads Creative Guidelines Feb 2026 [Shared Externally].pdf]', '[Brand Ads Creative Guidelines Feb 2026 PDF]')
        s=s.replace('Пересказ каждого источника ограничен примерно 200 словами и распределён между соответствующим блоком и таблицей конфликтов.','')
        s=s.replace('Точные параметры: что подтверждено, что рекомендовано','Точные параметры и статус подтверждения')
        replacements={
            'В итоговом документе можно дать ссылку как официальный ресурс с пометкой об ограничении доступа, но нельзя приписывать ему конкретные числа без чтения.':'Конкретные рекламные видеолимиты из PDF требуют чтения действующего файла и проверки в кабинете.',
            'Однозначный общий запрет всей инфографики именно на первом фото не найден; разрешение произвольных overlays также не установлено. Вывод: первое фото делать чистым; инфографику проверять по категории/QC, преимущественно использовать дополнительные фото/A+.':'',
            'Галерея, main/alternate images. Открытый полный текст; визуальные примеры не использовались для вывода о ненаписанном разрешении overlays.':'Галерея.',
            'Повторная проверка обнаружила официальную страницу':'Официальная страница',
            'Странное нижнее ограничение':'Указанное нижнее ограничение',
            'В документации остаются несогласованные уведомления о прекращении V1: главная указывает 15.10.2026, старый International V1 endpoint — 10.08.2026.':'На главной странице документации указано прекращение V1 с 15 октября 2026 года.',
            'Старое Gulf FAQ с формулировкой «только English» уступает текущему V2, разрешающему AR.':'API V2 прямо поддерживает AR для AE/SA; язык ручной загрузки нужно сверять отдельно.',
            'Реализованный International video endpoint':'Задокументированный International video endpoint',
            'публичный category content guide не найден':'подробный creative/media guide с численными пределами не найден',
            'ориентации16:9':'ориентации 16:9',
            'under5GB/under5MB':'under 5 GB / under 5 MB',
            'under5GB':'under 5 GB',
            'under5MB':'under 5 MB',
            'требуют15':'требуют 15',
            'FAQ5':'FAQ 5',
            'AEtechnical':'AE technical',
            'приводит500':'приводит 500',
            'индексировать500байт':'индексировать 500 байт',
            'максимум9':'максимум 9',
            'весьworldwide':'весь worldwide',
            'Официальный sell.amazon.com/blog/amazon-product-video':'[Официальный блог](https://sell.amazon.com/blog/amazon-product-video)',
            'официальный sell.amazon.com/blog/amazon-product-video':'[официальный блог](https://sell.amazon.com/blog/amazon-product-video)',
        }
        for a,b in replacements.items(): s=s.replace(a,b)
        texts.append(s.strip())
    report='\n\n'.join(texts)+'\n'
    (ROOT/'marketplace_listing_rules_ru.md').write_text(report)
    print(f'Sources: {len(refs)}; words: {len(report.split())}; chars: {len(report)}')


if __name__=='__main__': main()
