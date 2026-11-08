# Amazon.ae: правила товарных карточек, изображений и видео

Дата проверки: 8 ноября 2026. Основной рынок — UAE. Saudi Arabia и Egypt рассматриваются только там, где источник прямо устанавливает географию. Это исследование контента карточки, а не исчерпывающая юридическая проверка товара или регистрации продавца.

## Как читать доказательства

**AE / SA** — help явно пишет применимость к соответствующей стране. **Global API** — техническая документация Amazon для поддерживаемых магазинов. **US / general** — официальный источник Amazon, но перенос его числовых лимитов в UAE требует подтверждения локальным кабинетом. Домен sellercentral.amazon.ae сам по себе не доказывает применимость новости: форумы зеркалируют международные обсуждения. Много help-страниц при прямом открытии показывает JavaScript/login shell; их содержимое получено из индексируемого официального текста. Такой способ чтения отмечен ниже. Источник-политика выше по весу, чем маркетинговый блог или сообщение пользователя на форуме.

## Выводы для редактора общего документа

1. **MAIN, вторичная галерея, swatch, A+, Brand Story, PDP video и рекламное video — разные поверхности.** Требования нельзя объединять в один шаблон «Amazon video» или «Amazon image».
2. **Добавленная поверх MAIN инфографика не становится разрешённой потому, что похожая карточка уже опубликована.** Нужны категория/тип изображения/источник фактически отображаемого текста. Надпись на самом товаре или его реальном экране отличается от добавленного графического слоя. Вторичная галерея допускает поясняющую инфографику в рамках общих ограничений. Источники A09, A11–A13.
3. **Не фиксировать 75 символов как подтверждённый универсальный максимум title для AE или SA.** Прямое исключение четырёх рынков из реформы 2026 конфликтует с локализованной SA help и зеркальными объявлениями. Реальный лимит конкретного product type брать из актуальной PTD/schema и кабинета; 200 тоже не универсальный гарантированный предел. A02–A04, A27.
4. **Не переносить 500 MB / 6–45 секунд из Sponsored Brands в карточку.** Для AE PDP video подтверждены отдельные параметры в A14. Sponsored Products video на октябрь 2026 официально ограничен США, хотя обычная реклама SP доступна в UAE. A23–A25.
5. **Не обещать UAE доступ к Manage Your Experiments по маркетинговой странице.** В опубликованном перечне eligibility AE/SA отсутствуют; нужна проверка реального A/B-инструмента аккаунта. A21–A22.
6. **Для Basira правила должны храниться с marketplace, product type, placement, authority, датой и уровнем достоверности.** Это наша рекомендация на основе противоречий источников, а не правило Amazon. Неизвестное требование должно давать «проверить в кабинете», а не ложный hard fail.

## Точные параметры: что подтверждено, что рекомендовано

| Поверхность | Требование / предел | Рекомендация или ограничение интерпретации | Источник |
|---|---|---|---|
| Title AE/SA | Зависит от действующей схемы категории; переход 75+125 имеет прямое региональное исключение | Нельзя универсально валидировать 75 или 200 | A02–A04, A27 |
| Generic Keyword AE | Менее 250 **байт**, не символов | Проверять байты кодировки; не дублировать уже заполненные слова | A05 |
| Bullet points | Количество и длина зависят от product type | Не подтверждены универсальные «5 × 500» для UAE | A06, A27 |
| Изображение | Длинная сторона 500–10 000 px; не менее 72 dpi; JPEG, TIFF, PNG, неанимированный GIF | JPEG предпочтителен; 1000+ px рекомендованы и включают zoom. Универсальные 1600/2000 px и 10 MB как обязательные не подтверждены текущим локальным guide | A09–A10 |
| MAIN | Белый RGB 255/255/255; товар 85%; соответствие реальному товару; отдельные категорийные исключения | Категорийное lifestyle-исключение не разрешает дополнительный текст/логотипы | A09 |
| Количество фото | Минимум одно соответствующее MAIN | Рекомендация минимум шесть **дополнительных** изображений и одно видео — не установленный максимум галереи | A09 |
| PDP video AE | MOV/MP4, до 1080p, максимум 5 GB, 1–12 минут; horizontal 16:9 / vertical 9:16; thumbnail JPEG/PNG/GIF/BMP менее 5 MB | Выбирать язык, ASIN и обложку; не применять рекламные лимиты | A14 |
| PDP video access | Аккаунт активен более трёх месяцев; ASIN создан и опубликован; Brand Registry не обязателен в guide | Для доступности конкретного инструмента проверять аккаунт | A14–A15 |
| PDP video display | Для softlines при ≥6 изображениях video подавляется в desktop-view | Не обобщать на все категории и устройства | A14 |
| A+ | Basic до 5 модулей; Premium до 7; Brand Story 1 модуль до 19 карточек | Данные general guide; размеры задаёт конкретный модуль, не один общий баннер | A18 |
| Premium A+ eligibility | Brand Story на всех принадлежащих бренду ASIN + 5 одобренных и опубликованных проектов за 12 месяцев | Current FAQ говорит worldwide access при eligibility в одной стране; реально видимый доступ — в A+ Manager | A19 |
| Sponsored Brands video | 6–45 секунд; ≤500 MB; MP4/MOV; 16:9; 1280×720, 1920×1080 или 3840×2160 | До 20 секунд рекомендовано, не обязательно | A23 |

## Реестр первичных источников и краткие правила

### A01 — How to list products on Amazon — Listing Guide

- URL: https://sell.amazon.ae/content/listing-guide
- География/поверхность: UAE; создание ASIN/offer, классификация, идентификаторы, публикация. Публичная официальная страница, прочитана целиком.
- Обязательное: сначала проверить category/brand gating и завершить нужные approvals. GTIN (UPC/EAN/JAN/ISBN) отличается от внутреннего SKU; для товара без GTIN возможно исключение. Для существующего товара добавляют offer, новый ASIN создают при отсутствии товара. Brand Registry требует прав на бренд; агент подключается владельцем торговой марки.
- Операции: индивидуальная форма, category templates/bulk upload, интеграция API. Processing Report показывает ошибки после загрузки. Build International Listings пытается переводить и создавать detail pages, но не гарантирует успешную локализацию. Категория и бренд могут требовать документы.
- Рекомендация: выбрать расширенный шаблон категории; перед экспортом проверить разрешения. Универсального требования «арабский обязателен во всех карточках» эта страница не устанавливает.

### A02 — SP-API Updates: EU FBM Requirements, Product Type Definitions API Title Structure, External Fulfillment API Shipment Status

- URL: https://developer-docs.amazon.com/sp-api/changelog/sp-api-updates-eu-fbm-requirements-product-type-definitions-api-title-structure-external-fulfillment-api-shipment-status
- География/поверхность: Global API; titles. Официальный changelog, 1 июля 2026; прямое чтение.
- С 27 июля 2026 объявлена модульная структура non-media title: `item_name` до 75 символов, `title_differentiation` до 125, всего 200. Новый дополнительный атрибут доступен при `item_name` ≤75. Касается Listings Items API и JSON_LISTINGS_FEED; существующие записи сами по себе не требуют изменения до обновления.
- **Прямое исключение: Saudi Arabia, Egypt, Turkey, United Arab Emirates.** Поэтому этот релиз не является доказательством нового лимита 75 для AE/SA. Брать живые требования нужного product type/marketplace.
- Надёжность: датированный продуктовый changelog прямо задаёт региональный scope; более сильное свидетельство применимости, чем зеркало общей новости.

### A03 — Product title requirements and guidelines

- URL: https://sellercentral.amazon.sa/help/hub/reference/external/GYTR6SYGFA5E3EQC?mons_sel_locale=en_AE
- География/поверхность: текст явно помечен Saudi Arabia; titles. Официальный индексируемый help; прямое открытие может показать shell.
- Индексируемая версия требует 75 символов с пробелами для большинства non-media и одновременно говорит о worldwide scope. Запрещает рекламные обещания вроде бесплатной доставки, декоративные символы; требует понятного описания товара.
- **Конфликт:** A02 прямо исключает SA из перехода. Внутри этой help-версии также остался фрагмент о 200 символах. Не устранять противоречие выбором удобного числа: показывать неопределённость и сверять schema/category template.
- Для AE соответствующий help: https://sellercentral.amazon.ae/help/hub/reference/external/GYTR6SYGFA5E3EQC?locale=en-US — в проверке не получен полный локальный текст; это не самостоятельное доказательство лимита.

### A04 — Updates to improve your product titles begin on July 27

- URL: https://sellercentral.amazon.ae/seller-forums/discussions/t/2f40628c-eb97-4b24-b983-cb1e331e06dc
- География/поверхность: официальное объявление, зеркало AE Seller Forums; не надёжное доказательство UAE rollout. Публикация 10 июня 2026, индексируемый текст.
- Объявляет 75 символов для non-media и новое поле Item Highlights 125 символов, видимое и индексируемое; упоминает постепенную AI-переработку title и период review для brand owners.
- Применимость к UAE не считать подтверждённой: исключение в A02 противоречит такому прочтению. В финальном тексте достаточно показать конфликт; не предлагать обязательную массовую обрезку titles.

### A05 — Search optimization / Optimize listings for search

- URL: https://sellercentral.amazon.ae/gp/help/external/G10471
- География/поверхность: UAE; backend Generic Keyword и browse classification. Официальный индексируемый help.
- Обязательное/ограничение: Generic Keyword **менее 250 байт**. Поле для общих релевантных терминов и синонимов; brand names, ASIN, оскорбительные/неуместные слова могут исключаться. Нужна подходящая browse-классификация.
- Рекомендации: не повторять слова, уже присутствующие в title/brand и других учитываемых полях; не превращать поле в бессмысленное перечисление. Байты и символы отличаются, особенно для арабского: это техническое следствие кодировки, а не разрешение автоматически добавлять переводы в любое поле. Конкретное имя атрибута и требования смотреть в schema.

### A06 — Product bullet point requirements

- URL: https://sellercentral.amazon.com/help/hub/reference/external/GX5L8BF8GLMML6CX?language=en_us
- География/поверхность: US/general; bullets. Официальный индексируемый help, использовать как общую редакционную базу, не доказательство UAE длины.
- Требования/ограничения: длина зависит от product type; исключаются emoji/декоративные символы, placeholders, повторяющиеся блоки, ASIN, внешние контакты/ссылки, обещания возврата денег, содержание, для которого есть отдельные поля. Claims должны соответствовать политике своей категории.
- Рекомендации: не менее трёх содержательных пунктов, заглавная первая буква, короткие фразы, разделение частей точкой с запятой, без сплошного CAPS и бессмысленных сокращений. Не утверждать, что любое упоминание bamboo или material запрещено: ограничения связаны с конкретными claims и товарами.

### A07 — Product detail page rules

- URL: https://sellercentral.amazon.com/help/hub/reference/external/G200390640?langue=en_US
- География/поверхность: US/general; title, description, images, identity. Официальный индексируемый help; локальную применимость отдельных чисел не предполагаем.
- Один ASIN — один уникальный товар; нельзя создавать дубли или заменять идентичность существующего товара новым. Исправлять грамматику/уточнять сведения можно, превращать карточку в другой товар — нет. Идентификаторы должны быть надлежащими; соблюдать GTIN/GS1-политику.
- В статический товарный контент не помещают цену, доступность, доставку/спецпредложения, контакты и внешние URL, запросы отзывов/тестимониалы, временные рекламные сообщения, произвольные HTML/JavaScript. Нельзя обходить модерацию циклическим возвратом запрещённых claims/картинок.
- Description должен описывать сам товар; размер/формат, claims, инструкции и обязательные сведения определяются категорией и локальными требованиями.

### A08 — Variation relationship FAQ

- URL: https://sellercentral.amazon.ae/help/hub/reference/external/G201951410?locale=en-US
- География/поверхность: явно UAE; parent/child variations и общий каталог. Индексируемый help.
- Variations объединяют почти одинаковые товары, различающиеся допустимыми атрибутами, например размером, цветом, вкусом. Parent — виртуальная связь; child — конкретный вариант. Доступные variation themes определяются product type, а не желанием продавца.
- Detail page принадлежит каталогу Amazon, а не отдельному seller. Валидные варианты другого продавца могут появляться в общей family; некорректное присоединение unrelated-товара — повод для обращения в support.
- Последствие для агентства: связь SKU–ASIN–parent и корректность variant-specific фото/характеристик проверять отдельно; загрузка собственного контента не гарантирует его отображение.

### A09 — Product image guide

- URL: https://sellercentral.amazon.ae/help/hub/reference/external/G1881?locale=ar-AE
- Техническая таблица того же guide также индексируется: https://sellercentral.amazon.ae/help/hub/reference/external/1881?locale=zh-CN
- География/поверхность: явно UAE; MAIN/галерея/swatch. Официальный индексируемый help.
- Требуется минимум одно compliant MAIN. Рекомендованы ≥6 дополнительных фото и видео. Upload не гарантирует display: Amazon выбирает контент разных contributors; появление выбранного фото может занять 24 часа.
- Техусловия: 500–10 000 px по длинной стороне, ≥72 dpi, JPEG/TIFF/PNG/неанимированный GIF; JPEG предпочтителен, 1000+ px рекомендованы для zoom.
- MAIN: реалистичный точный товар целиком, 85% кадра, один вид, только входящее в комплект; белый RGB 255/255/255. Lifestyle допускается ограниченным product types без дополнительного текста/логотипов. Упаковка — когда существенная часть товара. Манекены запрещены; взрослую одежду показывают на модели, учитывая mobility exceptions; обувь — один ботинок в заданном ракурсе.
- Фотореалистичные полностью синтетические люди требуют `contains-synthetic-performer` в XMP `dc:subject`; реальные retouched люди, отсутствие людей и нефотореалистичные персонажи исключены. Это не общий «AI запрещён».

### A10 — Technical image file requirements

- URL: https://sellercentral.amazon.ae/help/hub/reference/external/G9FUUH87RBNXGKB7?locale=en-US
- География/поверхность: явно UAE; файлы product images. Индексируемый help.
- RGB принимается; CMYK обозначен **Not preferred** с рекомендацией конвертировать в RGB, а не безусловным reject всех CMYK. Grayscale принимается для точного изображения серого/серебристого металлического товара. Не рассчитывать на ICC-профиль как гарантию правильного цвета.
- Не принимаются EPS/BMP/PDF и собственные форматы приложений PSD/Illustrator/CDR/DOC и т. п. До загрузки убрать слои. Рекомендованы минимальное сжатие, максимальное качество JPEG без повторных пересохранений, TIFF без compression.
- Техническое соответствие не отменяет content policy; товарное фото и thumbnail видео имеют разные списки разрешённых форматов.

### A11 — Prohibited badging and abusive and banned words and graphics

- URL: https://sellercentral.amazon.ae/gp/help/external/GQ2VU6MXD8H6VGSU
- География/поверхность: UAE; изображения и графические claims. Официальный индексируемый help.
- Запрещённые promo/badging элементы нельзя легализовать переносом с MAIN в дополнительное фото. Нельзя имитировать Amazon badges и trademarks, например Amazon’s Choice, Prime, Best seller; также запрещаются вводящие в заблуждение promotional/certification graphics, неподтверждённые claims, оскорбительная графика.
- Для продукта нужен отдельный слой проверки «allowed information infographic» versus «prohibited badge/promo»: измерения/состав не равны искусственному знаку превосходства или платформенной награде.

### A12 — Text, logo, graphics, and watermarks

- URL: https://sellercentral.amazon.com/gp/help/external/GB6V3RU3M5XG24GC
- География/поверхность: US/general; MAIN и swatch. Официальный индексируемый help.
- Добавленный текст, логотипы, графические элементы, рамки, цветовые блоки и watermarks запрещены для соответствующих строгих image slots. Информация, реально напечатанная на товаре/упаковке, отличается от добавленной после съёмки. Реалистичная информация внутри экрана устройства может быть частью самого продукта; выноски снаружи экрана — другой случай.
- Объяснение пользователю: наличие читаемых цифр на часах или названия на флаконе не означает разрешение рисовать рекламную плашку на MAIN.

### A13 — Product Image Requirements and Best Practices

- URL: https://sellercentral.amazon.ae/seller-forums/discussions/t/13af96ea-6b07-4bf9-8dbe-a13292c2e3b1?mons_sel_locale=en_AE
- География/поверхность: AE форум, ответ Amazon staff; изображения. Прямое/индексируемое чтение. Вес ниже актуального help.
- Staff рекомендует infographic с преимуществами/характеристиками и изображениями размеров для **secondary** images; MAIN должен сохранять строгие правила.
- В публикации встречается явно сомнительная техническая величина 10 GB: **не использовать её как image file cap**. Технические пределы брать из A09–A10 и формы загрузки.
- Полезен как первичное пояснение допустимого secondary infographic, а не основание для правил всех стран или исключений MAIN.

### A14 — Shoppable video guide

- URL: https://sellercentral.amazon.ae/help/hub/reference/external/GSL5BGQC2EYYDQ29
- География/поверхность: явно UAE; видео карточки рядом с фото. Свежий индексируемый help, проверка 8.11.2026.
- Требования: активный аккаунт более трёх месяцев; brand-registered или non-brand; созданные/опубликованные ASIN. MOV/MP4, ≤1080p, максимум 5 GB, **1–12 минут**, horizontal **16:9** / vertical **9:16**; thumbnail JPEG/PNG/GIF/BMP **менее 5 MB**. Выбираются title, ASIN, поддерживаемый язык, обложка; инструмент поддерживает множественную загрузку до 15 файлов за операцию.
- Review обычно 1–7 рабочих дней; после approval/detail-page publication проверять статус и ожидать до трёх дней. Для **softlines** при ≥6 изображениях video подавляется в **desktop**. Загрузить ≠ получить гарантированный слот.
- Запрещены внешние URL и promotional CTA; нужны права на музыку/изображения/прочие audiovisual works. Полностью AI-созданные фотореалистичные люди требуют специального XMP-тега, как в A09.
- Глобальный максимум числа видео на ASIN и приоритет сортировки для AE этим исследованием однозначно не установлен.

### A15 — Shoppable video guide (US)

- URL: https://sellercentral.amazon.com/gp/help/external/Y4LL3M3WJEFE8MZ
- География/поверхность: явно US; дополнительная официальная редакционная база PDP video. Индексируемый help.
- Помимо техпараметров guide требует качественного изображения/звука, видимого товара, профессиональной подачи, достоверной информации. Не допускает misleading claims, внешние ссылки, promotional CTA, чужую музыку/искусство без прав, видимый посторонний branding.
- В таблице US описаны horizontal 16:9 и vertical 9:16; локальный UAE guide A14 также подтверждает эти ориентации.
- Различает overview, unboxing, how-to, setup, troubleshooting, brand story. Автоперенос между странами не гарантирован: глобальные display-эксперименты и отдельные исключения не равны полноценной публикации на всех рынках.
- AI disclosure: keyword `contains-synthetic-performer` в XMP `dc:subject`; речь о полностью синтетическом фотореалистичном человеке, а не всех AI-модификациях.

### A16 — Display videos across related product detail pages

- URL: https://sellercentral.amazon.ae/seller-forums/discussions/t/e625da91-a2d5-4895-86da-6000aa5952c3?mons_sel_locale=en_AE
- География/поверхность: официальное объявление, AE forum; видео в variation family. Индексируемый текст.
- Инструмент позволяет связать ролик с вариантами через переключатель Include ASIN(s)’ product variations либо явно выбрать ASIN. Изменения распространения могут занять до трёх дней.
- Для агентства это отдельная проверка: ролик о конкретном цвете/комплектации не должен автоматически обещать ту же комплектацию всем child ASIN. Распространять только действительно релевантный материал. Эта последняя фраза — практический вывод из требования соответствия ASIN, не новый запрет Amazon.

### A17 — Create Your Amazon Storefront | Step-by-Step Guide for UAE Sellers

- URL: https://sell.amazon.ae/build-an-online-store
- География/поверхность: UAE; A+ и Stores. Публичная страница, прямое чтение.
- A+ добавляет структурированный брендовый рассказ и product information: изображения, текст, сравнительные таблицы; доступ связан с brand eligibility. **Store** — отдельная многостраничная брендовая витрина, а не дополнительные slots обычной карточки.
- Разделять Standard listing, A+, Brand Story и Store при генерации/экспорте. Доступность A+ в UAE подтверждается локальной маркетинговой страницей; точные размеры/число модулей и permissions берутся из A+ Content Manager и A18–A20.
- Локально запрещены specific pricing/promotions и ссылки на warranties, guarantees, customer service, websites/contact information. Review может занять семь рабочих дней и дольше в пик; после approval — до 24 часов до отображения. Это ориентиры страницы, не гарантированный SLA. В инструкции сохраняется старое название Enhanced Brand Content, поэтому путь интерфейса сверять с текущим кабинетом.

### A18 — A+ Content guide

- URL: https://sellercentral.amazon.com/help/hub/reference/external/GLG4RQK2Y2RJADU4?locale=en-En
- География/поверхность: US/general; Basic/Premium A+, Brand Story. Официальный индексируемый help.
- Basic: до **5** detail-page modules; Premium: до **7**; Brand Story: **один** carousel-модуль, до **19** карточек. Basic поддерживает изображения/текст/сравнения; Premium — большие изображения, video/hotspots, navigation carousel и Q&A.
- Табличные примеры 970×300 и 1464×600 не означают, что все изображения этих размеров: каждый выбранный модуль задаёт собственные размеры и поля. Следовать текущему module editor, проверять mobile preview.
- A+ не универсален для всех типов товара: guide отдельно отмечает ограничения BMVD для Seller Central. Не смешивать Seller Central BMVD с отдельным KDP-процессом.

### A19 — About A+ Content / Premium A+ FAQ

- URL: https://sellercentral.amazon.com/help/hub/reference/external/G202102930?locale=en_us
- География/поверхность: general eligibility, source US с прямым worldwide wording; Premium A+. Индексируемый help.
- Текущие критерии: опубликованный A+ Brand Story на всех принадлежащих бренду ASIN в A+ Manager; минимум **5 одобренных и опубликованных проектов** за последние **12 месяцев**. Проверка eligibility еженедельная, доступ обозначается banner в Manager. FAQ говорит, что достижение eligibility в одной стране даёт worldwide Premium access.
- Бесплатность описана как **промопериод**, не бессрочная гарантия. При будущем платном предложении предусмотрен opt-in; уже опубликованный в промопериод контент сохраняется по описанным FAQ условиям.
- Старые официальные PDF/форумы с **15** проектами устарели относительно этого FAQ. Нельзя обещать автоматическое наличие конкретного модуля до проверки аккаунта.

### A20 — A+ Content guidelines

- URL: https://sellercentral.amazon.com/help/hub/reference/external/GGW8U76SSNTRTBX7?local=en-US
- География/поверхность: US/general; A+ text/images. Официальный индексируемый help.
- Запрещены цены/скидки/promotions/срочность, shipping statements, внешние URL/QR/contact details, гарантийные обещания и customer review quotes; competitor references/сравнения с чужими товарами. Сравнительный модуль — для собственного каталога.
- Claims, награды и сертификаты должны быть обоснованы; источник/организация/дата нужны там, где это требует guideline. Не обобщать рекламный superlative без доказательства.
- Изображения должны соответствовать полям модуля; не использовать анимацию, watermarks, нечитаемый текст. Типичные image specifications: JPG/BMP/PNG, RGB, менее 2 MB, минимум 72 dpi; это **A+**, не общий gallery cap. Alt text должен описывать изображение. Точные поля/ограничения проверить в локальном A+ Manager.

### A21 — Manage Your Experiments FAQ

- URL: https://sellercentral.amazon.com/help/hub/reference/external/9FCELUZGHBD9C7H?locale=en-US
- География/поверхность: явно перечисленные магазины; A/B-тестирование titles/images/bullets/A+ в рамках доступных функций. Индексируемый официальный help.
- Публикуемый список содержит US, Canada, Mexico, UK, Germany, France, Spain, Italy, Netherlands, Poland, Sweden, India, Japan; **UAE и Saudi Arabia не перечислены**.
- Следствие: наличие ссылки MYE на локальной brand-page недостаточно для обещания этого инструмента UAE/SA селлеру. Доступность, права Brand Registry и достаточный traffic конкретного ASIN проверяются в реальном аккаунте. Отсутствие в списке — основание обозначить неподтверждённость, а не утверждать невозможность будущего rollout.

### A22 — Amazon Brand Registry UAE | Protect & Grow Your Brand

- URL: https://sell.amazon.ae/brand-registry/
- География/поверхность: UAE маркетинговая страница brand tools. Прямое чтение.
- Локально описаны Brand Registry, A+, Premium A+ и брендовые инструменты: richer images, video, comparison experiences. Это подтверждает наличие продуктового направления, но не одинаковую eligibility любого seller/ASIN.
- Страница также продвигает Manage Your Experiments и ведёт к общим/US материалам. **Конфликт применения** с A21: нельзя считать рекламную ссылку точным перечнем поддерживаемых стран. В документации Basira разделять marketing available, documented eligible и account verified.

### A23 — Sponsored Brands video — Ad specs and guidelines

- URL: https://advertising.amazon.com/resources/ad-specs/sponsored-brands-video
- География/поверхность: Amazon Ads; **рекламный Sponsored Brands video**, не PDP video. Публичная актуальная спецификация, прямое/индексируемое чтение.
- Обязательные спецификации: **6–45 s**, **≤500 MB**, **MP4/MOV**, **16:9**, 1280×720/1920×1080/3840×2160; codec H.264/H.265, progressive; profile Main/Baseline. FPS 23.976/23.98/24/25/29.97/29.98/30. Video bitrate минимум 1 Mbps. Audio PCM/AAC/MP3, mono/stereo, ≥96 kbps, ≥44.1 kHz.
- Рекомендованы ≤20 s и video bitrate ≥4 Mbps. Язык должен соответствовать поддерживаемому marketplace. Избегать letterbox/pillarbox и держать важный текст вне нижней правой safe area.
- Собственная advertising moderation; требования SB нельзя подставлять в listing-video validator. Языковые/subtitle требования зависят от locale и ad acceptance policy.

### A24 — Showcase your product collection with video to Stores campaigns

- URL: https://advertising.amazon.com/resources/whats-new/sponsored-brands-video-to-stores
- География/поверхность: явно **Saudi Arabia, United Arab Emirates, Egypt** среди доступных рынков; Sponsored Brands video с landing в Store. Официальный launch description.
- Объявляет поддержку product collection в video-to-Store: требуется минимум один товар, интерфейс предлагает три; товары должны относиться к landing page. Доступ через Amazon Ads console/API для соответствующих advertisers.
- Это региональное доказательство рекламного SB video. Оно **не** устанавливает возможность PDP upload, не подтверждает Sponsored Products video в UAE и не заменяет текущие account eligibility/creative specs.

### A25 — Understand Sponsored Products video

- URL: https://advertising.amazon.in/help/G45ASMDJY8XXQQFK
- География/поверхность: официальный help, обновлён **14 октября 2026**, прямо **US only**, Books excluded. Индексируемый полный текст.
- SP video добавляет product-feature videos к Sponsored Products ads, вручную или через opt-in auto-assembly существующих video assets; автоматическая сборка не означает генерацию нового контента.
- Если Add video неактивна, help предлагает проверить US marketplace. Обычная доступность Sponsored Products в AE/SA не доказывает наличие этого **video** формата. Не обещать продукту Basira SP-video export/publish для UAE как действующую официальную функцию.

### A26 — Ad Specs, Guidelines and Requirements for Video Ads

- URL: https://advertising.amazon.com/resources/ad-specs/custom-media/amazon-video-ads?product=service
- География/поверхность: рекламные Amazon video ads / placement-specific display/custom media; не обычная карточка. Публичная спецификация.
- Пример для этого семейства: рекомендовано 1920×1080 (16:9), ≥15 FPS, audio 128 kbps/44 kHz, рекомендуемый bitrate 2 MBps; файл менее 500 MB. Desktop/mobile до 3 минут, Fire tablet до 15 секунд; краткий ролик ≤15 секунд рекомендуется.
- Это иллюстрирует, почему даже внутри **рекламы** нельзя делать один лимит для SB/DSP/OLV/Streaming/Fire. Проверять точный ad product, placement, рынок и доступность. Не применять указанные параметры к AE PDP или ко всему Amazon DSP.

### A27 — Retrieve a Product Type Definition

- URL: https://developer-docs.amazon.com/sp-api/lang-en_EN/docs/retrieve-a-product-type-definition
- География/поверхность: Global API, включая AE при корректном marketplace; атрибуты product type. Официальная техническая инструкция.
- `getDefinitionsProductType` возвращает schema для product type/marketplace; seller-specific требования доступны при передаче `sellerId`. Ссылки на schema-документы действуют семь дней. Для full validation нужен enforced requirements set; частичные обновления отличаются.
- Schema содержит обязательные/условные поля, разрешённые значения и длины; логика parent/child/standalone различается. Нужно разрешение selling partner и Product Listing role.
- Реализация Basira: получать и версионировать schema, сверять размеры/цвета/материал/brand/GTIN/variation theme, разделять факты продукта и offer. Это правильная опора для числовых title/bullet limits при локальных противоречиях; schema не отменяет editorial/content policy.

### A28 — Listings Items API Issues Troubleshooting

- URL: https://developer-docs.amazon/sp-api/docs/listings-items-api-issues-troubleshooting
- География/поверхность: Global API; create/update/read SKU и ошибки. Официальная техническая инструкция.
- Синхронная validation может отклонить payload; после принятия идут downstream-проверки и **асинхронные** ошибки. Клиент должен обрабатывать обе категории. `ACCEPTED` означает принятие к обработке, не гарантию live-карточки или победы собственного content contribution.
- Разбирать missing/invalid attributes, max length, images, schema/category conflicts. После отправки читать listing issues/статус и проверять живое отображение, а не показывать пользователю «опубликовано» по одному HTTP 200.
- Число и доступность API-операций для A+/video проверяются отдельно; обычный Listings Items endpoint не означает API-загрузку всего мультимедиа.

### A29 — Notification Type Values

- URL: https://developer-docs.amazon.com/sp-api/docs/notification-type-values
- География/поверхность: Global API, all marketplaces для соответствующих событий; monitoring schema/listing health. Официальная техническая документация.
- `PRODUCT_TYPE_DEFINITIONS_CHANGE` сигнализирует о новом type/version; `LISTINGS_ITEM_ISSUES_CHANGE` — о появлении, исправлении или обновлении issues. Детали дополнительно читаются Listings Items API.
- Документ различает `SEARCH_SUPPRESSED`, `LISTING_SUPPRESSED`, `ATTRIBUTE_SUPPRESSED`, `CATALOG_ITEM_REMOVED`; это разные последствия, а не единая «блокировка аккаунта».
- Для Basira полезны уведомления об изменении требований, ухудшении buyability/discoverability и отклонении атрибута. Конкурентские private business metrics из этих seller-authorized интерфейсов не становятся открытыми.

### A30 — Keyword optimization for non-English marketplaces

- URL: https://advertising.amazon.com/library/guides/non-us-keyword
- География/поверхность: international advertising, в том числе UAE/SA; **keyword targeting**, не обязательный listing language. Публичная инструкция.
- Amazon описывает Middle East как bilingual marketplace: English как основной язык UAE, Arabic — Saudi Arabia; рекомендует кампании на обоих языках и анализ search terms.
- Это основание продумать отдельные EN/AR assets и ключи, но не доказательство требования писать две версии каждого title, смешивать два языка в одном поле или принудительно использовать Arabic на всех PDP.
- Для listing/video/A+ язык выбирается из доступных локальных полей и supported languages. Проверять арабский proofreading, RTL layout и локальные units — наша производственная рекомендация.

## Противоречия и незакрытые вопросы, которые нужно сохранить в финальном документе

| Вопрос | Что говорят первичные источники | Решение для документа/продукта |
|---|---|---|
| Title 2026 AE/SA | A02 исключает AE/SA/EG/TR; A03 и A04 дают 75 без согласованного регионального scope | «Лимит конкретного product type требует локального подтверждения». Не маркировать все titles >75 как нарушение |
| PDP video count | Current US blog и старые форумы дают разные числа; локальный AE hard maximum count однозначно не подтверждён | Для AE не публиковать универсальные max4/max5 без проверки uploader; ориентации16:9/9:16 подтверждены A14 |
| Thumbnail видео | Официальный sell.amazon.com/blog/amazon-product-video ошибочно пишет under5GB; AE help A14 пишет under5MB | Использовать help <5MB. Blog не источник технических пределов |
| Сколько фото оставить ради видео | Общий US blog говорит <6 для всего; AE guide уточняет softlines + desktop | Не советовать всем категориям удалять фото; проверять live display и устройство |
| Premium A+ | Старые официальные материалы требуют15 проектов; актуальный FAQ5 и worldwide eligibility | Использовать A19, отметить account verification и промопериод цены |
| MYE | Локальная UAE marketing-page рекламирует; актуальный eligibility-list не содержит UAE/SA | Доступ неподтверждён, не включать в гарантированный feature list |
| CMYK | В кратких guide часто объявляется строго запрещённым; AEtechnical A10 говорит Not preferred | Экспортировать RGB как безопасный стандарт, не выдавать ложный hard fail |
| Backend keyword 250 vs 500 bytes | Локальный A05 требует <250; общая API troubleshooting A28 приводит500 как пример schema-length в смешанном seller/vendor контексте | Не считать API-пример разрешением индексировать500байт в AE. Сверять schema и локальную search policy отдельно |
| 1600/2000 px / 10 MB / максимум9 фото | Часто повторяется во вторичных материалах и старых styleguides, но текущий AE guide не устанавливает универсально | Указывать только подтверждённые минимумы/диапазоны; рекомендуемый production preset отдельно |

Не установлены в открытых официальных источниках: единый для всех категорий AE предел description/bullets; обязательный English+Arabic во всех полях; общая схема eligibility всех новых AI-tools; API-публикация всех видов PDP/A+ video; точное время гарантированного review. Это не повод додумывать значения: проверяются локальные templates, help аккаунта и uploader.

## Практический чек-лист карточки для AE

Это синтез исследования, а не дополнительный набор правил Amazon.

1. Определить marketplace, product type, brand role и approvals; найти существующий точный ASIN, проверить GTIN/исключение.
2. Подтянуть schema, обязательные характеристики и допустимую variation theme; сверить текст, фото, упаковку, размеры, количество и child ASIN.
3. Для каждого asset указать placement: MAIN / secondary / swatch / A+ / Brand Story / PDP video / конкретная реклама.
4. Проверить достоверность claims и отсутствие запрещённого promo/badging/contact content; MAIN отдельно проверить по категории.
5. Экспортировать фото и видео по соответствующим техническим требованиям, добавить точный AI-person metadata там, где он нужен; не путать общий AI-label с требуемым keyword.
6. Применить EN/AR only в поддерживаемые поля/локали, проверить RTL и читаемость на мобильном.
7. Получить approval/processing report, обработать синхронные и асинхронные errors, проверить живые desktop/mobile PDP и variant mapping.
8. Проверять фактически отображаемые assets и изменения policy/schema; обещания роста конверсии подтверждать собственным измерением. Исторические Amazon проценты — не гарантированный эффект для конкретного UAE продавца.
