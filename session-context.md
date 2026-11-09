# Foly — контекст за продължаване на сесията

Последно обновяване: 7 ноември 2026 г.

## Проект и работа

- Корен: `c:\Users\MartinByalov\Documents\GitHub\foly`.
- Среда: Windows, PowerShell 7, VS Code, JavaScript ES modules, Node.js native test runner.
- Няма `package.json` в корена. Потвърдената команда за целия тестов набор е `node --test`, изпълнена от корена.
- Потребителят общува на български и предпочита реално изпълнение и проверка пред обещания. Не питай дали да продължиш, ако задачата е ясна и режимът позволява редакции.
- Преди работа прочети действащите инструкции, включително `.clinerules/`. В plan mode не редактирай.
- Ползвай абсолютни пътища. Не губи съществуващи промени. Проверявай файловете и изпълнявай тестовете след промени по код.

## Цел и изисквания

Основната текуща цел е по-бързо и надеждно отваряне на квадратите с открития.
Потребителят изрично каза: „Това Connection unavailable не трябва да го имаме. Трябва по-бързо да зареждат“.

Не отслабвай следните ограничения заради скоростта:

- Съдържанието трябва да е на избрания език, без тиха подмяна с английски.
- Спазват се избраните категории/режими.
- Изображението трябва да е валидирано и заредено; изискванията за лиценз, атрибуция и безопасност остават задължителни.
- Не показвай непроверена или измислена карта като успешен fallback.
- Премахването на съобщение за грешка не доказва, че успешно зареждане е гарантирано.

## По-рано завършени промени (контекст от предходната сесия)

- Поддръжка на 14 езика: en, bg, fr, hi, es, pt, de, zh, ar, ru, it, nl, pl, tr.
- Укрепен превод на вече разкрити карти: ограничени UTF-8 части, сериализация и споделяне на заявки, атомарно обновяване на картата, защита от остарели езикови резултати и контролиран retry.
- Централизирани About/Sources/Privacy в локално авторско съдържание за всички езици. Разграничени реалните източници и Wikipedia режимите за откриване.
- Wix-hosted paused video е заменено с локално `media/background.webp`; има `media/background-provenance.md`.
- Подробности за поведението: `docs/random-facts.md`.
- По-старият baseline преди loading промените е бил 413 успешни теста. Това НЕ е последният резултат.

## Направено по зареждането

### Първи етап

- Премахната изкуствената reveal пауза от 560 ms.
- `fetchJson` приема външен `signal` и го комбинира с request timeout чрез `AbortSignal.any`.
- Добавени проверки за отказ преди/след provider и общ deadline в `discoverWithFallback`.
- Ограничени отделните API/image изчаквания до максимум 4 секунди при deadline wrapper.
- Commons metadata кеш в паметта: TTL 5 минути, максимум 100 записа за source-set/transport. Случайните article draws не се кешират.
- Поправена идентичността на transport wrapper чрез стабилен `cacheIdentity`, за да се използва кешът между отделни отваряния.
- Добавени regression тестове за deadline, transport cancellation и reuse на Commons metadata при свежи article draws.
- Първоначалният общ deadline е бил 12 секунди за един опит. Виж актуалното поведение по-долу — това вече е променено.

### Актуално поведение след искането да няма Connection unavailable

- `discover` приема `concurrency`, по подразбиране 1; валидни стойности са цели числа 1–3.
- Homepage подава `concurrency: 2`. Ако има няколко избрани source режима, до два се изпълняват паралелно; първият напълно валидиран резултат печели чрез `Promise.any`.
- Shared remaining queue и `finished` флаг не позволяват нови providers след намерен резултат. При един избран режим няма изкуствено добавяне на други категории.
- Homepage прави до два опита, всеки с `timeout: 6000`: първи опит и един автоматичен retry. Горната граница остава приблизително 12 секунди общо, не 6 секунди общо.
- При приключване на deadline wrapper контролерът се abort-ва и при успех, за да прекрати останалите API заявки.
- `showConnectionStatus` и създаването на `connectionStatus` banner са премахнати от `main.js`.
- Ако и двата опита откажат, няма празен modal и няма error banner. Квадратът остава неотворен и може да се натисне отново. Това все още е неуспешно откриване, не гарантирано решение за availability.
- При промяна на езика старият резултат не се записва като карта на новия език.

### Последна довършителна поправка при resume

- В `resolver.js` добавени `signal?.throwIfAborted()` след зареждането на fact image и след image/thumbnail validation.
- В sequential catch отказът вече се препредава, вместо да се третира като обикновен provider failure. Така закъсняла снимка не може да приключи отменен опит успешно.
- Добавен integration regression тест в `tests/foly-catalog.test.mjs`: валиден бърз паралелен winner abort-ва бавния transport и не стартира третия provider.
- Важно ограничение: API transport cancellation е реализирано. Самото физическо image зареждане не е доказано отменяемо чрез AbortSignal; image loader се ограничава с timeout и резултатите се проверяват за cancellation.

## Основни файлове за тази работа

Всички относителни имена по-долу са спрямо корена на проекта, а не външни пътища.

- `js/foly/resolver.js` — fetchJson, rights/safety presentation, sequential/parallel discovery и cancellation проверки.
- `js/foly/catalog.js` — езиково ограничаване на primary/fallback, deadline, bounded transport/image wrappers, cacheIdentity, abort при приключване.
- `js/foly/main.js` — openBox, два шестсекундни опита, concurrency 2, няма connection banner и reveal delay.
- `js/foly/wikipedia.js` — Wikipedia режими и bounded Commons metadata cache.
- `js/foly/images.js` — image loading/decode поведение.
- `tests/foly-discovery.test.mjs` — fast provider срещу hung provider, ограничение на активните providers и съществуващи discovery изисквания.
- `tests/foly-catalog.test.mjs` — езикови ограничения, fallback, deadline, cancellation и winner-cancels-loser regression.
- `tests/foly-navigation.test.mjs` — homepage expectations за 6000 ms, concurrency 2, retry и липса на connectionStatus.
- `tests/foly-wikipedia.test.mjs` — metadata cache reuse/fresh article draws и Wikipedia coverage.
- `tests/foly-image-decode.test.mjs` — image decode regression tests.
- `scripts/check-foly-facts-browser.mjs` — UI/browser coverage; добавена проверка, че няма connectionStatus element.
- `docs/random-facts.md` — актуализирано описание на новото loading поведение.

## Последни потвърдени проверки

### След последната cancellation поправка

- `node --test`: **419 теста, 419 pass, 0 fail**, без cancelled/skipped/todo; около 3.34 секунди в това изпълнение.
- `node --check js/foly/resolver.js`: exit 0.
- `git --no-pager diff --check`: exit 0.
- Лог: `%TEMP%\foly-resumed-tests.txt`.
- Първият shell wrapper е отчел terminal closure/code 1 след отпечатан успешен тестов отчет. Отделна следваща команда потвърди съдържанието на отчета, syntax exit 0 и diff-check exit 0. Не бъркай wrapper проблема с тестов failure.

### Browser — преди последната cancellation поправка

- `node scripts/check-foly-facts-browser.mjs` е приключил с `Browser UI regression checks passed. Live availability is reported separately.`
- Успешни 56 fixture UI комбинации: 14 езика × 4 ширини; също preview checks EN/BG.
- Логове: `%TEMP%\foly-fast-open-browser.txt` и `%TEMP%\foly-fast-open-browser-error.txt` (при последната проверка error log е празен).
- Последният live report: EN, BG, FR — `Every source came back empty`; HI — успех с изображение, заглавие „ग्राहम गूच“.
- По-ранна live проверка е успяла за EN/FR/HI и е отказала за BG. Резултатите варират.
- Този browser run предхожда последните допълнителни cancellation проверки и новия 419-и тест. Не го представяй като browser проверка на най-новите редове.

## Какво все още НЕ е решено / доказано

- Надеждното успешно live зареждане НЕ е завършено. Банерът е премахнат, но външните източници продължават да могат да откажат.
- Няма контролирано измерване „преди/след“ за successful opening latency и success rate по езици. Не обещавай конкретно ускорение или гарантирана наличност.
- Паралелността помага при няколко режима; при единична избрана категория не създава втори независим път сама по себе си.
- Няма потвърден инфраструктурен blocker; причините за live failures трябва да се изследват, а не да се обявяват автоматично за липса на интернет.
- По-нататъшно ускоряване не бива да заобикаля Commons лицензната проверка или mandatory image decode.

## Следващи стъпки при продължаване

1. Прочети този файл, актуалните инструкции и текущите `resolver.js`, `catalog.js`, `main.js`, `wikipedia.js`, `images.js`.
2. Пусни отново целия `node --test` и browser script върху текущия код. Разграничи fixture UI резултатите от live availability.
3. Измери време и failure stage на реални отваряния за представителни езици (поне EN/BG/FR/HI), включително random-only и няколко избрани режима. Разгледай API status/CORS, metadata rejection, липсващи допустими изображения и decode/timeouts.
4. Установи реалния bottleneck, преди нови архитектурни промени. Ако предлагаш prefetch/буфер, запази език/категории/rights/safety и ограничен трафик; не показвай непроверено съдържание.
5. Провери автоматичния retry, спирането на последващи API заявки след deadline/winner, възможността за повторно натискане и езиковата смяна по време на зареждане.
6. Добави regression tests за откритите случаи, изпълни тестовете, syntax и diff проверки, и докладвай само потвърдени резултати.

## Git и предпазни мерки

- Работното дърво има много предходни промени и untracked файлове. Няма направен commit от тази работа.
- При последната проверка tracked промените включват README.md, css/theme.css, index.html (MM), js/app.js, няколко базови теста; има staged deletion на foly.html и unstaged deletion на js/background.js.
- Голяма част от Foly файловете (`js/foly/`, `docs/`, много `tests/foly-*`, scripts/data/media) са untracked. `git diff --stat` и `git diff --check` сами не обхващат съдържанието им. Тестовете ги зареждат директно.
- Не прави reset/clean и не stage-вай всички файлове автоматично. Не приемай, че всички промени са от последната задача.
- При Git inspection използвай `git --no-pager ...`; обикновен `git diff --stat` е отворил pager и е задържал командата.
- Shell понякога връща съобщение за затворен terminal въпреки отпечатан отчет. При съмнение прочети логовете и потвърди конкретните exit codes с отделна кратка команда.

## Текуща заявка на потребителя

### Последваща работа: мобилен вертикален и хоризонтален режим

#### Най-нови изисквания и промени

- За целия сайт езикът вече е преди категориите в header DOM; езиковият overlay е вляво. Категориите са най-вдясно.
- Мобилният grid няма отстояния от един квадрат: `gridGeometry` връща `inset: 0`, заема цялата ширина и започва непосредствено под header, приключвайки непосредствено над footer. Header/footer остават видими.
- Мобилно определение за геометрия: ширина до 680 px или landscape с височина до 480 px. Симетричен header отстъп 16 px; header минимум 64 px.
- Portrait: © FOLY. долу вляво, About/Sources/Privacy на хоризонтален центриран ред. Landscape запазва copyright вляво и вертикална навигация вдясно.
- Последен пълен тест: 430/430 pass, `%TEMP%\foly-edge-tests-final.txt`; syntax и diff check успешни.
- Browser assertions са адаптирани към новите edge-to-edge изисквания. Финалният текущ run пише в `%TEMP%\foly-edge-browser-final.txt` и `%TEMP%\foly-edge-browser-final-error.txt`; проверете резултата преди да твърдите пълно browser покритие.

- Добавен `js/foly/layout.js` с чиста функция `gridGeometry(width, height)` и 11 regression теста в `tests/foly-layout.test.mjs`.
- `main.js` вече използва геометрия, съобразена и с височината. В landscape размерът се ограничава така, че да има поне един цял ред между четирите вертикални отстояния. Броят редове използва floor, за да няма отрицателни междуредия.
- `css/foly.css`: 44 px контроли за телефон/touch/нисък landscape, bounded dynamic-viewport menus/dialogs, scrollable overlays, 16 px search field срещу auto zoom и no-hover scaling за touch.
- Browser script вече проверява 1892×844, 1280×844, 390×844, 320×568, 568×320 и 844×390 за всичките 14 езика; добавени проверки за цял ред и horizontal overflow.
- Последен пълен unit run: **430/430 pass**, `node --test --test-concurrency=1`; лог `%TEMP%\foly-mobile-serial-tests2.txt`. Средата беше бавна и някои shell команди бяха прекъсвани; serial run приключи за около 332 секунди.
- Browser log за тази работа: `%TEMP%\foly-mobile-browser2.txt`, error log `%TEMP%\foly-mobile-browser2-error.txt`. Проверете края на тези логове за окончателния резултат; не приемайте стария 56-case резултат за landscape coverage.
- Допълнение: първият browser run спря при landscape alignment; преместен е тестовият курсор на (0, 0), за да не остава hover от предходните взаимодействия. Отделният run с `FOLY_LANDSCAPE_ONLY=1` премина всичките 28 fixture комбинации за 568×320 и 844×390 и preview EN/BG. Логове: `%TEMP%\foly-landscape-browser.txt` и `%TEMP%\foly-landscape-browser-error.txt`. Проверете финалния live отчет отделно. Последна целева проверка: 31/31 layout/navigation теста; diff check без грешки.

Потребителят поиска този файл да бъде създаден (ако липсва) и да запази контекста преди рестарт на сесията. Файлът не съществуваше и беше създаден. Това е документационна задача; не означава, че оставащият live-loading проблем е решен.