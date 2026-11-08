# Другие площадки ОАЭ и Саудовской Аравии: правила карточек и доступность продавцам

Дата проверки открытых источников: **8 ноября 2026 года**. Этот раздел дополняет исследование Amazon и noon. Выбор площадок отражает разные каналы продаж, а не рейтинг по обороту: Carrefour — универсальный retail marketplace; Trendyol Gulf — международная платформа с локальным seller route; Namshi — fashion; Tradeling — B2B; Sharaf DG — специализированный канал ОАЭ.

Обозначения: **подтверждено** — первичный источник прямо описывает правило и нужную географию; **частично** — источник есть, но ограничения или страна раскрыты неполно; **не найдено публичной спецификации** — нельзя объявлять функцию запрещённой/неподдерживаемой. Публичная форма заявки не гарантирует активацию продавца. Seller marketplace и поставка товара ритейлеру для перепродажи — разные модели.

## Сравнение доступности и глубины открытых правил

| Площадка | Подключение внешнего продавца | Подтверждённая география | Что публично известно о карточках | Видео карточки |
|---|---|---|---|---|
| Carrefour | В UAE опубликована самостоятельная подача регистрации с верификацией. В KSA официальный Help Center также предлагает стать продавцом после рассмотрения каталога | UAE и отдельный seller route на KSA-сайте; допуск и country-specific договор нужно подтвердить | UAE: загрузка категории через шаблон, Product ID/GS1, требования к изображениям. KSA-specific media spec не найдена | Публичная локальная спецификация не найдена |
| Trendyol International / Gulf | Seller Center публикует регистрацию UAE и Saudi Arabia; после подключения — кабинет/API | В International API явно указаны AE и SA (также KW) | Наиболее подробная публичная спецификация среди площадок этого раздела: поля, язык, атрибуты, варианты, фото, HTML, QC и видео | **Есть официальный International V2 API** и технические требования |
| Namshi | Официальный noon FAQ требует отдельной регистрации; Namshi Terms прямо упоминают buyer/seller | Country-specific доступность seller account для UAE/KSA и условия подключения следует подтвердить | Открытые Terms описывают ответственность за listings; численные нормы контента и схема загрузки публично не установлены | Публичная спецификация не найдена; это не доказательство отсутствия функции |
| Tradeling | Исторический официальный seller PDF описывает регистрацию компании и размещение каталога; текущая страница Become a Seller возвращает исследовательскому инструменту 403 | UAE/B2B MENA; конкретную доступность локального продавца и доставки в KSA нужно согласовать | Актуального публичного style guide карточки не найдено | Публичная спецификация не найдена |
| Sharaf DG | Действующая UAE-страница Sell With Us: зарегистрированный в UAE бизнес с Trade License; есть Sign Up и product uploads/API | Подтверждён UAE seller route. Наличие магазинов группы в других странах не доказывает такой же marketplace там | Управление товаром/остатком и API заявлены, публичный category content guide не найден | Публичная спецификация не найдена |

## Carrefour UAE: конкретные правила и пределы применимости

**Допуск.** Официальная seller KB направляет на [форму регистрации Carrefour UAE](https://marketplace.carrefouruae.com/seller/register). Несмотря на название статьи «International Seller», текст требует UAE-документы: Trade License, Emirates ID, VAT и банковские сведения. В этой же статье перечислены gated categories, включая baby, beauty/personal care, household cleaning, смартфоны, крупную технику, продовольствие и apparel. Поэтому нельзя обещать регистрацию иностранной компании без UAE-документов или допуск любой категории. [O01]

**Создание карточки.** В Seller Portal выбирают Inventory → Import via Upload → категорию/подкатегорию → Download Template for Offers; затем заполняют шаблон и загружают его как Product (Create or Update). Именно текущий шаблон нужной категории должен определять обязательные поля. Открытая статья не даёт лимиты title/description, требования EN/AR, формулу названия или правила вариаций. [O02]

**Идентификаторы.** Публичная KB говорит, что товар нельзя разместить без Product ID, зарегистрированного в GS1. Если такой товар уже есть в каталоге, продавец добавляет своё offer через Sell Yours; собственный Offer SKU не заменяет Product ID. Это правило источника Carrefour UAE; возможные исключения/waiver в нём не описаны. [O04]

**Фотографии.** Официальная статья о feed errors требует прямые скачиваемые image URLs, минимум три фото, JPEG/PNG/GIF, чистый белый фон для всех изображений, заполнение товаром 85% кадра, чёткое соответствие продаваемому товару; watermark и logo запрещены. Размер описан неоднозначно: «at least 1000*1000 pixels in either width or height». Для подготовки безопасно делать обе стороны не меньше 1000 px; это наша консервативная интерпретация, а не уточнение площадки. [O03]

Статья не разделяет main и secondary image, не объясняет исключения для lifestyle/инфографики, не устанавливает явный общий запрет любого текста. Из требования белого фона и запрета logo нельзя самостоятельно вывести, что любые схемы запрещены или разрешены. До подтверждения category guide инфографику следует считать **требующей проверки**, особенно в первом слоте. Видео, rich content, число дополнительных слотов, image file size и техническая политика по AI-контенту в найденной публичной локальной документации не раскрыты. [O03]

**KSA отдельно.** На официальном KSA-сайте статья «How can I become a seller with Carrefour?» предлагает зарегистрироваться, после чего команда рассматривает каталог и связывается с заявителем. Любопытная деталь: опубликованная там форма ведёт на marketplace.carrefouruae.com. Это подтверждает канал подачи заявки, но не доказывает применение UAE-документов или UAE image rules к KSA. В разделе также различены marketplace seller, SHOPS и поставка товара в магазины; нельзя считать их одним self-service процессом. [O05]

Практические пробелы Carrefour: запросить текущий country/category upload template; EN/AR title и description limits; GTIN exemption; variation grouping; правила первого/остальных фото; поддержку и доступность product video; current activation eligibility. Даты изменения статей KB не раскрыты; прямое открытие некоторых страниц возвращает 403, но текст доступен в индексе первичного домена. Поэтому это опубликованные правила, а не обещание текущей операционной активации.

## Trendyol Gulf: официальные International V2 правила

**География и версия.** На главной странице Developers раздельные ветки Domestic Türkiye и International Marketplace. В последней для Saudi Arabia указан storeFrontCode=SA, для UAE — AE. Все перечисленные ниже правила взяты из International v3.0, а не турецкой документации. Действующий Seller Center перечисляет отдельные UAE и Saudi Arabia registration links. [O06, O07, O12]

В документации остаются несогласованные уведомления о прекращении V1: главная указывает 15.10.2026, старый International V1 endpoint — 10.08.2026. Для новой интеграции на дату исследования нужен **Product V2**; не строить реализацию на V1 даже если таблица старой страницы сохраняет ACTIVE. Страница Product Create v2 при проверке отображала «Updated about 1 month ago»; это относительная метка интерфейса, а не установленная дата вступления правил в силу. [O06, O08]

**Поля карточки и язык.** Product Create V2 требует `storeFrontCode`; `Accept-Language=en` задаёт английский, `ar` поддержан для SA/AE/KW. Обязательны barcode (до 40 символов), title (до 100), productMainId (до 40, общий для вариантов), brandId, categoryId, quantity, description (HTML, до 30 000), listPrice, salePrice, images, vatRate и attributes. Строковый barcode API сам по себе не доказывает требование GS1 GTIN. `listPrice` ≥ `salePrice`; максимум 1000 items/запрос. Отправка запускает approval. [O08]

Старое Gulf FAQ с формулировкой «только English» уступает текущему V2, разрешающему AR. VAT нужно брать из country table: SA — 15, AE — 5. [O07, O08]

**Атрибуты и варианты.** Нужно получать актуальные brand/category/attribute/value dictionaries. Используется конечная leaf category; API сообщает `required`, `allowCustom`, `allowMultipleAttributeValues`, `slicer` и `varianter`. Новые атрибуты могут появляться: документация рекомендует обновлять список еженедельно, дерево — перед операцией. `slicer` создаёт отдельную карточку/content (например, цвет); `varianter` задаёт выбор внутри content (например, размер). Группировка опирается на productMainId. После approval атрибуты slicer/varianter имеют ограничения на изменение. [O09, O10]

**Фото.** Для API Product Create V2: HTTPS URL с SSL; максимум восемь фото на barcode; 1200 × 1800 px и 96 dpi. Эти параметры доказаны именно для API; нельзя объявлять их универсальным пределом всех ручных загрузчиков Seller Center. Публичный International API не устанавливает на этой странице допустимые raster formats, максимальный image file size, белый фон, порядок ракурсов или разрешение инфографики/водяных знаков. Для художественных правил нужен Gulf category guide из кабинета. [O08]

**Расширенное описание.** Best Practices разрешают простой HTML без JS и styles, без iframe. Указаны 4 000–30 000 символов; при описании короче 4 000 должен присутствовать image tag. Странное нижнее ограничение нужно учитывать как опубликованную спецификацию и проверить на своей категории/тестовом аккаунте; нельзя обещать полноценный A+ редактор на основании HTML-поля. [O10]

**Видео карточки.** International V2 содержит сервис Video Upload / Listing Services с обязательным storefront header: MP4/MOV, максимум 500 MB, длительность 8–120 секунд. Один productContentId может иметь одно active video; одно видео связывается максимум со 100 content IDs. Video title — 3–50 символов, description — до 500. Загрузка идёт по HTTP/HTTPS URL. SUCCESS означает получение файла, а показ покупателю начинается при `isApproved=true`; нужна отдельная проверка результата. Сам источник предупреждает, что ограничения размера, длительности и timeout динамически управляются и могут меняться. [O11]

Файл проверяют по расширению и фактическому формату. Разрешены типы назначения, включая product promotion, usage, assembly/installation, packaging, store promotion и advertisement. Это классификация API, а не разрешение любых рекламных утверждений. Кодек, разрешение/aspect ratio, audio/subtitle language, watermark/claims policy, thumbnail и доступность конкретному seller account в публичной странице не указаны. Реализованный International video endpoint с AE/SA storefronts — сильное свидетельство интеграционного пути, но доступ конкретного кабинета и категорий стоит проверить при подключении. [O07, O11]

## Namshi: отдельная платформа, технические нормы нельзя выводить из noon

Noon прямо пишет, что для Namshi требуется **отдельная регистрация**. Собственные Namshi Terms упоминают регистрацию buyer и seller; значит, наличие внешнего продавца не следует отрицать. Однако открытый самостоятельный seller onboarding с полным country-specific перечнем требований к карточке в ходе исследования не подтверждён. Нельзя утверждать без первичного подтверждения, что Namshi доступен только по приглашению, или что всем noon sellers он автоматически открыт. [O13, O14]

Публичные Terms возлагают на пользователя ответственность за опубликованные listings, включая нарушение интеллектуальных и иных прав третьих лиц и неприемлемый контент. Они не заменяют договор продавца или fashion image guide. [O15]

**Не найдено публичной seller-спецификации:** title/description limits, обязательные языки и перевод, brand/GTIN/style/size grouping, size chart template, число и параметры фото, flat lay/model/ghost mannequin rules, background, first-image infographic exceptions, видеокодек/длительность/размер, rich-content schema и QC reasons. Наличие фотографий/видео в покупательской витрине не устанавливает право продавца загружать такой контент. Стартовый маршрут — [Namshi Help Center](https://help.namshi.com/portal/en/kb) и отдельное подключение к seller/brand team; правила noon переносить нельзя. [O13–O15]

## Tradeling: B2B-каталог и ограниченная открытая документация

Официальный seller PDF Tradeling (июль 2024) описывает регистрацию компании, размещение неограниченного числа товаров, помощь с загрузкой и продажу по установленным ценам или через переговоры. Это подтверждает модель B2B marketplace для внешних компаний; опубликованные в PDF комиссии относятся к дате документа, а не гарантированным тарифам ноября 2026. Обновлённое 1 сентября 2026 приложение, опубликованное разработчиком Blink Technologies FZCO, продолжает описывать Tradeling как B2B eMarketplace с оптовыми категориями. [O16, O17]

Текущая [страница Become a Seller](https://www.tradeling.com/ae-en/page/become-a-seller) найдена, но возвращала 403 исследовательскому инструменту. Её неподтверждённые детали, которые пересказывают сторонние агентства, здесь не выдаются за правила площадки. Граница UAE/MENA coverage не равна подтверждённому самостоятельному seller programme в каждой стране, включая KSA. [O18]

**Не найдено актуальной публичной спецификации:** title/description caps; required EN/AR; category attributes и certificates; GTIN exemptions; bundle/pack-size/MOQ и variation schema; фотофон/инфографика, число/форматы/размеры фото; seller product video; rich content. В интернете встречаются пересказы 2021–2024 годов с числами 1000 × 1000, пять фото и т. п.; без текущего первичного category guide их нельзя использовать как валидатор.

Для B2B-проекта целесообразно подготовить pack/case quantity, unit of measure, MOQ, price tiers, срок годности/партии и подтверждающие документы, **как рабочую рекомендацию**, затем сопоставить их с реальным шаблоном Tradeling. Это не установленный в открытом источнике обязательный набор. У менеджера/в кабинете нужно получить current product upload CSV, category guide, image rejection checklist, video/rich-content availability и перечень обслуживаемых seller/customer countries.

## Sharaf DG UAE: дополнительный специализированный канал

На текущей странице Sell With Us условия сформулированы конкретно: зарегистрированный в UAE бизнес с действующей Trade License, товар для продажи в UAE, наличие ассортимента и способность отвечать на customer queries. Страница ведёт на Sign Up и описывает контроль listings/inventory. Отдельная marketplace registration page прямо упоминает product uploads и API. Это внешний seller route, а не только предложение стать оптовым поставщиком сети. [O19, O20]

Повторная проверка обнаружила официальную страницу **Seller Basics / Guidelines on Listing new categories & new products**. Она требует предоставить сведения о товаре с сайта бренда, собственного сайта или product data sheets; раскрыть политику качества, гарантии, ремонта/возврата; по запросу подтвердить владение запасом и разрешение бренда на продажи в UAE. Для food отдельно указана маркировка EN/AR — это правило физической этикетки, не доказательство обязательного языка listing. Численных creative/media specifications страница не содержит. [O21]

**Публичная technical specification не найдена:** title/description/EN–AR, обязательные EAN/brand attrs, variants, количество/px/MB/форматы фото, main vs secondary rules, текст/watermarks, product-video upload и rich content. Видео на рекламной странице самой площадки не является доказательством seller video feature. Наличие магазинов группы в Oman/Bahrain/Egypt также не доказывает открытый marketplace route там. Для Basira подключение этой площадки следует делать после получения seller template/API schema и соответствующего media guide. [O19, O20]

## Выводы для Basira: что можно реализовать по доказанным правилам

1. Сделать **разные профили `platform × country × category × placement × ingestion channel`**. У Trendyol API и ручной uploader могут иметь разные рамки; у Carrefour публичная UAE KB не означает идентичное правило KSA.
2. Для Trendyol International уже можно строить V2 export с динамическими dictionaries, EN/AR, portrait photo export и video pipeline с отдельными состояниями transferred / processed / approved. Media upload success не должен означать «показано покупателю».
3. Для Carrefour UAE можно предложить проверку GS1/Product ID, прямых image URLs и опубликованного фото-чеклиста. Инфографику первого кадра не оценивать как universally allowed, а показывать необходимость category exception.
4. Для Namshi, Tradeling и Sharaf DG запускать **режим проверки по загруженному seller guide**. При отсутствии нормы выводить «нет подтверждённого правила», а не выдуманный error или автоматическое разрешение.
5. По каждой норме хранить URL, дату проверки, страну, тип источника, category scope, effective date и уверенность. Публичный источник без даты/с 403 при повторном чтении показывать как требующий сверки с кабинетом.

## Реестр первичных источников

Все ссылки проверялись 08.11.2026. «Индекс» означает, что официальный текст доступен поисковому индексу, но непосредственное чтение могло вернуть 403. Такой статус указан явно.

| ID | Источник / точный URL | Что подтверждает и границы |
|---|---|---|
| O01 | [Carrefour — How to register: International Seller](https://mafcarrefour8.zohodesk.com/portal/en/kb/articles/internal) | UAE регистрация, верификация, gated categories. Официальная seller KB, индекс; дата изменения не видна |
| O02 | [Carrefour — How to create listing/upload products](https://mafcarrefour8.zohodesk.com/portal/en/kb/articles/how-to-lis) | Category template и feed upload; не даёт публичных limits текста |
| O03 | [Carrefour — Feed Error: Incorrect Image links](https://mafcarrefour8.zohodesk.com/portal/en/kb/articles/listing-creation-request-incorrect-image-links) | Прямые URLs и общий image checklist. UAE links; индекс, при прямом открытии 403 |
| O04 | [Carrefour — No product ID / Add offer to existing listing](https://mafcarrefour8.zohodesk.com/portal/en/kb/articles/no) | Product ID/GS1 и присоединение offer к каталогу; waiver не описан |
| O05 | [Carrefour KSA — Sell With Us](https://www.carrefourksa.com/mafsau/en/helpcenter/topics/227-privacy-and-more?articleId=4453) | Seller application после review каталога; отдельно SHOPS/retail supplier. Не содержит KSA technical guide |
| O06 | [Trendyol Developers — Integration Documentation](https://developers.trendyol.com/) | Domestic/International разделение и уведомление о V2 |
| O07 | [Trendyol International — Regions and Store Front Codes](https://developers.trendyol.com/v3.0/docs/5-regions-and-store-front-codes) | AE/SA storefronts; актуальная маршрутизация и country scope |
| O08 | [Trendyol International — Product Create v2](https://developers.trendyol.com/v3.0/docs/product-create-v2) | Обязательные поля, EN/AR, title/description caps, API photo spec, approval |
| O09 | [Trendyol International — Category Attribute List v2](https://developers.trendyol.com/v3.0/docs/category-attribute-list-v2) | Required/dictionary/variant flags, обновления категорий |
| O10 | [Trendyol International — Product Services Best Practices](https://developers.trendyol.com/v3.0/docs/copy-of-1-product-services-best-practices) | HTML-описания, productMainId, slicer/varianter и ограничения updates |
| O11 | [Trendyol International — Video Upload / Listing Services](https://developers.trendyol.com/v3.0/docs/video-upload-filtering-services) | Формат/размер/длительность видео, association и approval; limits динамические |
| O12 | [Trendyol Seller Center — Gulf registration entries](https://partner.trendyol.com/sa/auth/logout?redirect=%2Fsa%2Fauth%2Fsso%2Flms%3Fdomain%3DINT%26env%3Dprod%26url%3D%252Fseller-information-center%252Fsa%252Fsearch%253FsearchTerm%253DSiemens123%252A) | Индексируемая форма содержит отдельные UAE/SA registration links. Длинный URL сохранён как фактически проверенный; основной вход: partner.trendyol.com |
| O13 | [noon — Seller Onboarding FAQ](https://help.noon.com/portal/en/kb/articles/seller-onboarding-faq) | Namshi требует отдельного подключения; это не Namshi image policy |
| O14 | [Namshi — Our Affiliates & Additional Functions](https://help.namshi.com/portal/en/kb/articles/our-affiliates-additional-functions) | Собственные Terms прямо охватывают buyer/seller; onboarding requirements не раскрыты |
| O15 | [Namshi — Liability & Indemnities](https://help.namshi.com/portal/en/kb/articles/liability-indemnities) | Ответственность за listings/IP/права третьих лиц; нет численных media limits |
| O16 | [Tradeling — Commission Structure, July 2024](https://academy.tradeling.com/app/uploads/2024/10/Comission_Structure_En.pdf) | Компания/каталог/оптовые продажи и помощь с upload; исторический PDF, индекс. Тарифы не считаются текущими |
| O17 | [Tradeling — official developer listing on Google Play](https://play.google.com/store/apps/details?hl=en_US&id=com.tradeling.mobilebuyerapp) | Активная B2B wholesale модель, developer Blink Technologies FZCO; обновление 01.09.2026. Это не seller technical guide |
| O18 | [Tradeling — Become a Seller](https://www.tradeling.com/ae-en/page/become-a-seller) | Нужный seller route, но 403 в исследовательском инструменте. Содержимое не использовано для утверждения технических правил |
| O19 | [Sharaf DG UAE — Sell With Us](https://uae.sharafdg.com/sell-with-us/) | UAE business/Trade License и путь Sign Up, управление товарами |
| O20 | [Sharaf DG UAE — Marketplace Register](https://uae.sharafdg.com/marketplace/register/?source=signup_button_header) | Внешний marketplace seller и product uploads/API; не содержит media guide |
| O21 | [Sharaf DG UAE — Seller Basics / listing guidelines](https://uae.sharafdg.com/ar/seller-basics/) | Источники product information, качество/гарантия и разрешение бренда; не содержит численных image/video rules. Страница доступна по /ar/, основной текст руководства на английском |

## Контрольные вопросы для закрытой документации

Чтобы закрыть публичные пробелы, от каждой площадки нужны: действующий договор и страна seller account; category taxonomy и upload template; обязательные/рекомендованные поля с limits; main/gallery image guide с примерами допустимой инфографики; техническая и редакционная video policy; способы связать видео с карточкой; language/translation workflow; rich-content schema; QC/rejection codes и порядок appeals; правила авторства/лицензий и AI media. Это список недостающих материалов исследования, а не обязательная проверка, придуманная площадками.
