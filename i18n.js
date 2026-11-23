'use strict';

/* ============================================================
   Roooms — локализация интерфейса (RU / EN)

   Источником всегда остаётся русский текст: движок формирует его
   сам, а слой локализации подменяет видимые строки. Это позволяет
   не трогать игровую логику и сохранить перевод при любом
   dynamically созданном окне.
   ============================================================ */

const LANG_KEY = 'ten_rooms_lang_v1';

// Точные соответствия: русский текст → английский.
const EN = {
  // Общее / меню
  'ЗАГРУЗКА...': 'LOADING...',
  'ИГРАТЬ': 'PLAY',
  'ЭНЦИКЛОПЕДИЯ': 'ENCYCLOPEDIA',
  'ЗВУК: ВКЛ': 'SOUND: ON',
  'ЗВУК: ВЫКЛ': 'SOUND: OFF',
  'НАСТРОЙКИ': 'SETTINGS',
  'ВЫБОР РЕЖИМА И СЛОЖНОСТИ': 'CHOOSE MODE AND DIFFICULTY',
  'ОБЫЧНЫЙ': 'NORMAL',
  '10 комнат': '10 rooms',
  '10 КОМНАТ': '10 ROOMS',
  '100 КОМНАТ': '100 ROOMS',
  'скорость ×1,5': 'speed ×1.5',
  'СЛОЖНОСТЬ': 'DIFFICULTY',
  'ЛЕГКИЙ': 'EASY',
  'СЛОЖНЫЙ': 'HARD',
  'СВЕРХТЯЖЁЛЫЙ': 'ULTRA',
  'НАЧАТЬ': 'START',
  'НАЗАД': 'BACK',
  'УРОВЕНЬ': 'LEVEL',
  'ОПЫТ | До следующего уровня 1000 XP': 'XP | 1000 until next level',
  '/ стрелки — движение': '/ arrows — move',
  'ЛКМ': 'LMB',
  'или': 'or',
  'Пробел': 'Space',
  '— удар / выстрел (можно зажимать)': '— attack / shoot (can be held)',
  'Джойстик — движение · кнопка АТАКА — удар': 'Joystick — move · ATTACK button — attack',
  'Здоровье восстанавливается +5/сек': 'Health regenerates +5/sec',
  '← ВЫХОД': '← EXIT',
  'МЕНЮ ИНФО · выбери объект слева, чтобы увидеть подробное описание': 'INFO MENU · pick an item on the left to see details',
  'ВЫБЕРИТЕ ОБЪЕКТ': 'SELECT AN ITEM',

  // Настройки / язык
  'ЯЗЫК ИНТЕРФЕЙСА': 'INTERFACE LANGUAGE',
  'ВЕРСИЯ ИГРЫ': 'GAME VERSION',
  'заглушка описания': 'Description placeholder',
  [`ВЕРСИЯ 1.1

Крупные обновления:
• Полный перевод интерфейса на английский с переключателем языка в настройках. Выбор сохраняется в save.json.
• Энциклопедия переработана: 8 разделов, 33 объекта, уточнённые описания эффектов и честные шансы дропа.
• Мобильная версия только в альбомном режиме: виртуальный джойстик, кнопка атаки и подсказка поворота.
• Расширено меню отладки: переключатели, числовые поля, BigInt для опыта и сброс уровня с сохранением языка.
• Панель версии игры: разворачивается на месте, содержит редактируемое описание и сохраняет состояние.
• Разовые уведомления об обновлениях на кнопках «Настройки» и «Версия игры»; после нажатия на версию они исчезают и больше не возвращаются.
• Сохранение вынесено на сервер: уровень, опыт, язык и просмотренные уведомления пишутся в save.json.

Исправления и интерфейс:
• WASD работает на кириллической раскладке за счёт физических кодов клавиш.
• Числовые поля: кнопка справа, ENTER, только целые числа, некорректный ввод очищает поле.
• Кнопки главного меню выровнены по высоте, панель версии масштабируется корректно на десктопе и телефоне.
• Убраны остатки русского текста из англоязычного интерфейса, в том числе в canvas и подсказках.
• Исправлено сворачивание панели версии по Esc и повторному клику без открытия паузы.
• Уточнены шансы дропа и десятичная точка в английском языке.
• Плавные анимации отключаются при prefers-reduced-motion.`]: `VERSION 1.1

Major updates:
• Full interface translation into English with a language switch in Settings. The choice is saved in save.json.
• Encyclopedia reworked: 8 sections, 33 entries, refined effect descriptions and accurate drop chances.
• Mobile version in landscape only: virtual joystick, attack button and rotate hint.
• Expanded debug menu: toggles, numeric fields, BigInt XP and level reset that keeps the language.
• Game version panel: expands in place, contains editable notes and keeps its state.
• One-time update notifications on the Settings and Game Version buttons; clicking the version button clears both and they do not return.
• Save data moved to the server: level, XP, language and seen notices are written to save.json.

Fixes and interface:
• WASD works on the Cyrillic layout thanks to physical key codes.
• Numeric fields: button on the right, ENTER, integers only, invalid input clears the field.
• Main menu buttons are equal height; the version panel scales correctly on desktop and phone.
• Removed leftover Russian text from the English interface, including canvas and hints.
• Fixed collapsing the version panel with Esc or a second click without opening pause.
• Corrected drop chances and decimal separators in English.
• Smooth animations are disabled with prefers-reduced-motion.`,
  'Русский язык': 'Russian',
  'Основной язык интерфейса': 'Main interface language',
  'Английский язык': 'English',
  'Пока заглушка': 'Full translation available',
  'Полный перевод интерфейса': 'Full interface translation',
  'Дополнительный язык интерфейса': 'Alternative interface language',
  'Интерфейс на русском языке.': 'Interface language: Russian.',
  'Интерфейс на английском языке.': 'Interface language: English.',
  'Английский язык — заглушка, перевод пока не реализован.': 'Interface language: English.',

  // HUD и сенсорное управление
  'УРОН': 'DAMAGE',
  'СКОРОСТЬ': 'SPEED',
  'СКОРОСТЬ АТАКИ': 'ATTACK SPEED',
  'ОРУЖИЕ: БЛИЖНИЙ БОЙ': 'WEAPON: MELEE',
  'ПИСТОЛЕТ': 'PISTOL',
  'ВЗРЫВ': 'EXPLOSION',
  'ВЗРЫВ ВЫКЛ': 'EXPLOSION OFF',
  'ВАМПИРИЗМ': 'VAMPIRISM',
  'ВАМПИРИЗМ ВЫКЛ': 'VAMPIRISM OFF',
  'ДРОБОВИК': 'SHOTGUN',
  'СЕКИРА': 'AXE',
  'РАПИРА': 'RAPIER',
  'ПУЛЁМЁТ': 'MG',
  'ПЕРЕГРЕВ': 'OVERHEAT',
  'ЗАМЕДЛЕНИЕ +0': 'SLOW +0',
  'КОМНАТА': 'ROOM',
  'движение': 'move',
  'удар / выстрел': 'attack / shoot',
  'Врагов: 0': 'Enemies: 0',
  'АТАКА': 'ATTACK',
  'Пауза': 'Pause',
  'Атака': 'Attack',
  'Отладка': 'Debug',

  // Поля ввода
  '±ЧИСЛО': '±NUMBER',
  'Изменение урона': 'Change damage',
  'Изменение скорости': 'Change speed',
  'Изменение здоровья': 'Change health',
  '±ПРОЦЕНТ': '±PERCENT',
  'Изменение скорости атаки в процентах': 'Change attack speed in percent',
  'Изменение замедления врагов': 'Change enemy slow',
  'КОЛИЧЕСТВО': 'AMOUNT',
  'Количество опыта': 'Amount of XP',
  'ВВЕСТИ': 'ENTER',
  'НУЖНО ЦЕЛОЕ ЧИСЛО': 'INTEGER REQUIRED',
  'НЕТ ЗАБЕГА': 'NO ACTIVE RUN',

  // Боковая панель отладки
  'ОТЛАДКА ИГРЫ': 'GAME DEBUG',
  'КОМНАТА 1/10': 'ROOM 1/10',
  'ЗДОРОВЬЕ': 'HEALTH',
  'ЗАМЕДЛЕНИЕ ВРАГОВ': 'ENEMY SLOW',
  'АВТОМАТИЧЕСКАЯ АТАКА': 'AUTO ATTACK',
  'Удержание ЛКМ / Пробела — для любого оружия': 'Hold LMB / Space — works with any weapon',
  'ВКЛ': 'ON',
  'ВЫКЛ': 'OFF',
  'ПАУЗА ВРАГОВ': 'ENEMY PAUSE',
  'Враги не двигаются и не атакуют': 'Enemies do not move or attack',
  'ПОКАЗЫВАТЬ В ИГРЕ': 'SHOW IN GAME',
  'Оставлять панель видимой после выхода из паузы': 'Keep the panel visible after leaving pause',
  'ЕЩЕ': 'MORE',
  'ИНВЕНТАРЬ': 'INVENTORY',
  'ЗАВЕРШИТЬ УРОВЕНЬ': 'CLEAR ROOM',
  'МЕНЮ ОТЛАДКИ': 'DEBUG MENU',

  // Выбор эффекта / инвентарь
  'КОМНАТА ПРОЙДЕНА': 'ROOM CLEARED',
  'ПОЛНЫЙ КОНТРОЛЬ': 'FULL CONTROL',
  'Выбери эффект и подтверди выбор': 'Pick an effect and confirm',
  'Выбери любые эффекты и подтверди выбор': 'Pick any effects and confirm',
  'Выбери эффект и подтверди выбор — до нажатия можно передумать': 'Pick an effect and confirm — you can change your mind before confirming',
  'Выбери эффект, чтобы увидеть описание': 'Pick an effect to see its description',
  'Выбери эффект, чтобы увидеть его описание': 'Pick an effect to see its description',
  'Доступны все эффекты. Можно выбрать несколько.': 'All effects are available. You can pick several.',
  'ПОДТВЕРДИТЬ': 'CONFIRM',
  'Выбери оружие и способности. Наведи на блок, чтобы увидеть описание': 'Choose a weapon and abilities. Hover a tile to see its description',
  'ТЕКУЩЕЕ ОРУЖИЕ:': 'CURRENT WEAPON:',
  'БЛИЖНИЙ БОЙ': 'MELEE',
  'ОРУЖИЕ': 'WEAPONS',
  'СПОСОБНОСТИ': 'ABILITIES',
  'ВЫБРАТЬ': 'SELECT',
  'Нажми на карточку, чтобы включить или выключить способность. Можно включить несколько.': 'Click a card to toggle an ability. You can enable several.',
  'НЕДОСТУПНО С ЭТИМ ОРУЖИЕМ': 'UNAVAILABLE WITH THIS WEAPON',
  'ВКЛЮЧЕНО': 'ENABLED',
  'НАЖМИ, ЧТОБЫ ВКЛЮЧИТЬ': 'CLICK TO ENABLE',

  // Меню отладки
  'Служебные функции': 'Utility functions',
  'РЕЖИМ БОГА': 'GOD MODE',
  'Полностью убирает входящий урон': 'Completely removes incoming damage',
  'Все баффы на выбор, можно выбрать несколько': 'All buffs available, you can pick several',
  'ОТЛАДКА ИГРОВОГО ПРОЦЕССА': 'GAMEPLAY DEBUG',
  'Разрешает боковую панель характеристик; без неё панель скрыта везде': 'Enables the stats sidebar; without it the panel is hidden everywhere',
  'СКОРОСТЬ ИГРЫ': 'GAME SPEED',
  'Меняет темп всего геймплея': 'Changes the pace of all gameplay',
  'ДОБАВИТЬ ОПЫТ': 'ADD XP',
  'Целое число любой длины. Кнопка «ВВЕСТИ» или ENTER': 'Any-length integer. Click ENTER or press ENTER',
  'СБРОСИТЬ УРОВЕНЬ': 'RESET LEVEL',

  // Пауза и подтверждения
  'ПАУЗА': 'PAUSE',
  'Игра на паузе': 'Game paused',
  'ПРОДОЛЖИТЬ': 'RESUME',
  'ВЫЙТИ В МЕНЮ': 'EXIT TO MENU',
  '— продолжить': '— resume',
  'ВЫЙТИ В МЕНЮ?': 'EXIT TO MENU?',
  'Текущий забег будет прерван. Все улучшения и прогресс комнаты потеряются.': 'The current run will be interrupted. All upgrades and room progress will be lost.',
  'ОТМЕНА': 'CANCEL',
  'ВЫЙТИ': 'EXIT',
  'СБРОСИТЬ УРОВЕНЬ?': 'RESET LEVEL?',
  'Уровень вернётся к 1, а опыт обнулится. Это действие нельзя отменить.': 'Level returns to 1 and XP resets to zero. This cannot be undone.',
  'СБРОСИТЬ': 'RESET',

  // Конец забега
  'КОНЕЦ': 'END',
  'ТЫ ПОГИБ': 'YOU DIED',
  'Комнат пройдено': 'Rooms cleared',
  'Нанесено урона': 'Damage dealt',
  'Получено урона': 'Damage taken',
  'Опыт за забег': 'XP from run',
  'Уровень игрока': 'Player level',
  'В МЕНЮ': 'MENU',
  'ПОДКРЕПЛЕНИЕ': 'REINFORCEMENTS',

  // Поворот устройства
  'ПОВЕРНИТЕ УСТРОЙСТВО': 'ROTATE YOUR DEVICE',
  'Игра работает только в альбомном режиме': 'The game only works in landscape mode',

  // Оружие
  'Короткий удар конусом перед собой. Стандартное оружие без особенностей.': 'A short cone-shaped swing in front of you. Standard weapon with no special traits.',
  'Три быстрых удара по нажатию, но долгая перезарядка. Каждый удар на 50% слабее обычного и сильно отбрасывает врагов.': 'Three fast hits per press, but a long cooldown. Each hit is 50% weaker than normal and knocks enemies back hard.',
  'Рывок к курсору (КД 1,2 с) бьёт и оглушает врагов. Урон −50%, урон в рывке −75%, после рывка — замедление 30% на 2 с.': 'Dash toward the cursor (CD 1.2s), hitting and stunning enemies. Damage −50%, dash damage −75%, then 30% slow for 2s.',
  'Одиночные выстрелы по курсору. Можно стрелять зажатием.': 'Single shots toward the cursor. Holding fires repeatedly.',
  'Задержка выстрела ×2, но за раз вылетает от 2 до 6 пуль.': 'Twice the fire delay, but 2 to 6 pellets per shot.',
  'По нажатию персонаж почти 0,7 с трясётся, затем сам выпускает залп пуль до перегрева (~3 с) и 3 с не стреляет. Удержание кнопки не работает.': 'On press the character shakes for about 0.7s, then fires a burst until overheating (~3s) and stops shooting for 3s. Holding the button does not work.',

  // Способности
  'ВЗРЫВ ПУЛЬ': 'BULLET EXPLOSION',
  'Пули при попадании пропадают и взрываются, нанося 50% урона пули всем врагам в области.': 'Bullets disappear on impact and explode, dealing 50% of bullet damage to all enemies in the area.',
  'При ударе по врагу восстанавливает 50% нанесённого урона, но естественная регенерация падает до +2 HP в секунду. Работает только с ближним боем и секирой.': 'Restores 50% of damage dealt on hit, but natural regeneration drops to +2 HP per second. Works only with melee and axe.',

  // Баффы
  'Урон +10': 'Damage +10',
  'Каждый удар наносит на 10 единиц урона больше.': 'Every hit deals 10 more damage.',
  'Скорость +10': 'Speed +10',
  'Ты движешься быстрее на 10 единиц.': 'You move 10 units faster.',
  'Здоровье +10': 'Health +10',
  'Максимальное здоровье +10. Сразу восстанавливает 10 HP.': 'Max health +10. Immediately restores 10 HP.',
  'Пистолет': 'Pistol',
  'Ближний бой заменяется одиночными выстрелами по курсору.': 'Melee is replaced with single shots toward the cursor.',
  'ОРУЖИЕ · УНИКАЛЬНЫЙ': 'WEAPON · UNIQUE',
  'Скорость атаки +10': 'Attack speed +10',
  'Твои удары и выстрелы совершаются на 10% чаще.': 'Your attacks and shots happen 10% more often.',
  'Скорость атаки +30': 'Attack speed +30',
  'Мощный эффект: все атаки и выстрелы совершаются на 30% чаще.': 'Powerful effect: all attacks and shots happen 30% more often.',
  'ПОНИЖЕННЫЙ ШАНС': 'LOWER CHANCE',
  'Урон +30': 'Damage +30',
  'Мощный эффект: +30 к урону.': 'Powerful effect: +30 damage.',
  'Скорость +30': 'Speed +30',
  'Мощный эффект: +30 к скорости передвижения.': 'Powerful effect: +30 movement speed.',
  'Здоровье +30': 'Health +30',
  'Максимальное здоровье +30. Сразу восстанавливает 30 HP.': 'Max health +30. Immediately restores 30 HP.',
  'Взрыв': 'Explosion',
  'Пули при попадании пропадают и взрываются, нанося 50% обычного урона пули всем врагам в области. Работает только с пистолетом или дробовиком. Включать и выключать можно в инвентаре.': 'Bullets disappear on impact and explode, dealing 50% of a normal bullet’s damage to all enemies in the area. Works only with pistol or shotgun. Can be toggled in the inventory.',
  'ПОНИЖЕННЫЙ ШАНС · УНИКАЛЬНЫЙ · НУЖЕН ПИСТОЛЕТ ИЛИ ДРОБОВИК': 'LOWER CHANCE · UNIQUE · REQUIRES PISTOL OR SHOTGUN',
  'Вампиризм': 'Vampirism',
  'При ударе по врагу восстанавливает 50% нанесённого урона, но естественная регенерация падает до +2 HP в секунду. Работает только с ближним боем и секирой. Включать и выключать можно в инвентаре.': 'Restores 50% of damage dealt on hit, but natural regeneration drops to +2 HP per second. Works only with melee and axe. Can be toggled in the inventory.',
  'ПОНИЖЕННЫЙ ШАНС · УНИКАЛЬНЫЙ · БЛИЖНИЙ БОЙ И СЕКИРА': 'LOWER CHANCE · UNIQUE · MELEE AND AXE',
  'Дробовик': 'Shotgun',
  'Задержка между выстрелами ×2, но за один выстрел вылетает от 2 до 6 пуль.': 'Twice the delay between shots, but 2 to 6 pellets per shot.',
  'Секира': 'Axe',
  'Три быстрых удара за одно нажатие с длинной перезарядкой. Каждый удар на 50% слабее обычного, но отбрасывание усилено вдвое.': 'Three fast hits per press with a long cooldown. Each hit is 50% weaker than normal, but knockback is doubled.',
  'Рапира': 'Rapier',
  'По нажатию — почти 0,7 с тряски и залп пуль до перегрева (~3 с), затем 3 с без стрельбы. Удержание кнопки не работает.': 'On press — about 0.7s of shaking and a bullet burst until overheating (~3s), then 3s without shooting. Holding the button does not work.',
  'Пулемёт': 'MG',
  'Замедление врагов +10': 'Enemy slow +10',
  'Все враги двигаются на 10 единиц медленнее.': 'All enemies move 10 units slower.',
  'Замедление врагов +30': 'Enemy slow +30',
  'Все враги двигаются на 30 единиц медленнее.': 'All enemies move 30 units slower.',

  // Энциклопедия: оружие
  'Дальность 78, удар сектором ~143°, перезарядка 0,5 с, урон 100%, отбрасывание 170.': 'Range 78, ~143° sector hit, 0.5s cooldown, 100% damage, knockback 170.',
  'Получение: стартовое оружие. Заменяется карточкой любого другого оружия.': 'How to get: starting weapon. Replaced by any other weapon card.',
  'Дальность 105, перезарядка 1,3 с. Одно нажатие наносит три удара, каждый — 50% обычного урона и с отбрасыванием 640.': 'Range 105, 1.3s cooldown. One press deals three hits, each at 50% normal damage with 640 knockback.',
  'Получение: уникальная карточка «Секира».': 'How to get: unique “Axe” card.',
  'КД 1,2 с. Рывок на 456 пикселей за 0,55 с в фиксированном направлении; клавиатура во время рывка не влияет на путь.': 'CD 1.2s. Dashes 456 pixels in 0.55s in a fixed direction; keyboard input does not affect the path during the dash.',
  'Урон 50%, каждый враг получает только одно попадание за рывок и оглушается на 2 с. Входящий урон в рывке ×0,25. Удар о стену прерывает рывок и оглушает игрока на 1 с; после обычного рывка скорость −30% на 2 с.': '50% damage, each enemy can be hit once per dash and is stunned for 2s. Incoming damage during the dash ×0.25. Hitting a wall interrupts the dash and stuns the player for 1s; after a normal dash, speed −30% for 2s.',
  'Получение: уникальная карточка «Рапира».': 'How to get: unique “Rapier” card.',
  'Перезарядка 0,35 с, одна пуля со скоростью 560. Прицел — курсор. Зажатие ЛКМ или Пробела работает по умолчанию.': '0.35s cooldown, one bullet at speed 560. Aims at the cursor. Holding LMB or Space works by default.',
  'Получение: уникальная карточка «Пистолет».': 'How to get: unique “Pistol” card.',
  'Перезарядка 0,7 с, за выстрел вылетает от 2 до 6 пуль с разлётом 0,55 рад. Зажатие по умолчанию не работает.': '0.7s cooldown, 2 to 6 pellets with 0.55 rad spread per shot. Holding does not work by default.',
  'Получение: уникальная карточка «Дробовик».': 'How to get: unique “Shotgun” card.',
  'По нажатию ~0,66 с тряски, затем автоматическая стрельба ~3 с с интервалом 0,09 с. После этого перегрев на 3 с; зажатие кнопки не работает.': 'On press ~0.66s of shaking, then automatic fire for ~3s at 0.09s intervals. Then overheats for 3s; holding the button does not work.',
  'Получение: уникальная карточка «Пулемёт».': 'How to get: unique “MG” card.',
  'СТАРТОВОЕ': 'STARTER',
  'УНИКАЛЬНЫЙ ДРОП': 'UNIQUE DROP',

  // Энциклопедия: разделы
  'ЭФФЕКТЫ': 'EFFECTS',
  'СПОСОБНОСТИ': 'ABILITIES',
  'ОРУЖИЕ': 'WEAPONS',
  'СЛОЖНОСТЬ': 'DIFFICULTY',
  'РЕЖИМЫ': 'MODES',
  'УРОВЕНЬ': 'LEVEL',
  'УПРАВЛЕНИЕ': 'CONTROLS',
  'ОТЛАДКА': 'DEBUG',
  'Уникальный эффект: после получения больше не выпадает.': 'Unique effect: once obtained, it never drops again.',
  'Доступен только с пистолетом или дробовиком: с другим оружием шанс 0%.': 'Only available with pistol or shotgun: 0% chance with other weapons.',
  'ПОНИЖЕННЫЙ ШАНС · УНИКАЛЬНЫЙ': 'LOWER CHANCE · UNIQUE',
  'Пули при попадании во врага или препятствие исчезают и взрываются в радиусе 78. Взрыв наносит 50% урона пули всем врагам в зоне; враги за укрытием получают 50% урона взрыва.': 'Bullets vanish on hitting an enemy or obstacle and explode with radius 78. The explosion deals 50% of bullet damage to all enemies in the zone; enemies behind cover take 50% of explosion damage.',
  'Совместимость: пистолет и дробовик. С ближним боем, секирой, рапирой и пулемётом не работает.': 'Compatible with: pistol and shotgun. Does not work with melee, axe, rapier or MG.',
  'При ударе по врагу восстанавливает 50% нанесённого урона. Естественная регенерация падает с +5 до +2 HP в секунду.': 'Restores 50% of damage dealt on hit. Natural regeneration drops from +5 to +2 HP per second.',
  'Совместимость: ближний бой и секира. С рапирой, пистолетом, дробовиком и пулемётом не работает.': 'Compatible with: melee and axe. Does not work with rapier, pistol, shotgun or MG.',

  // Энциклопедия: сложность
  'ОПЫТ ×0,5': 'XP ×0.5',
  'ОПЫТ ×1': 'XP ×1',
  'ОПЫТ ×2': 'XP ×2',
  'ОПЫТ ×5': 'XP ×5',
  'Характеристики врагов ×1, количество врагов ×1.': 'Enemy stats ×1, enemy count ×1.',
  'Волны по 2–3 врага; следующая приходит только после 100% убитых врагов предыдущей волны.': 'Waves of 2–3 enemies; the next arrives only after 100% of the previous wave is killed.',
  'Новая комната полностью восстанавливает HP.': 'A new room fully restores HP.',
  'Волны по 3–5 врагов; следующая приходит после 50% убитых.': 'Waves of 3–5 enemies; the next arrives after 50% are killed.',
  'Характеристики врагов ×1, количество врагов ×0,5.': 'Enemy stats ×1, enemy count ×0.5.',
  'Волны по 4–5 врагов; следующая приходит после 50% убитых или через 5 секунд.': 'Waves of 4–5 enemies; the next arrives after 50% are killed or after 5 seconds.',
  'Характеристики врагов ×1,2 (HP, урон и скорость), количество врагов ×3.': 'Enemy stats ×1.2 (HP, damage and speed), enemy count ×3.',
  'Волны по 5–6 врагов; следующая приходит после 20% убитых.': 'Waves of 5–6 enemies; the next arrives after 20% are killed.',
  'Новая комната НЕ лечит: здоровье приходится возвращать баффами и вампиризмом.': 'A new room does NOT heal: health must be restored with buffs and vampirism.',

  // Энциклопедия: режимы
  'СКОРОСТЬ ×1,5': 'SPEED ×1.5',
  'Стандартный забег из 10 комнат. Обычные враги сильнеют от комнаты к комнате на 5–30%.': 'Standard 10-room run. Regular enemies get 5–30% stronger each room.',
  'Боссы: на 5-й комнате 750 HP и 30 урона, на 10-й — 1500 HP и 50 урона.': 'Bosses: room 5 has 750 HP and 30 damage, room 10 has 1500 HP and 50 damage.',
  'В комнатах с боссом препятствия не создаются.': 'Boss rooms have no obstacles.',
  'Забег из 100 комнат: весь геймплей ускорен в 1,5 раза.': '100-room run: all gameplay is 1.5× faster.',
  'Босс каждые 10 комнат: 1000 HP и 50 урона, каждый следующий сильнее в 1,5 раза; на 100-й комнате параметры сбрасываются к первому боссу.': 'A boss every 10 rooms: 1000 HP and 50 damage, each next one 1.5× stronger; on room 100 stats reset to the first boss.',
  'Опыт не делится: итоговый множитель зависит только от выбранной сложности.': 'XP is not divided: the final multiplier depends only on the chosen difficulty.',

  // Энциклопедия: уровень
  'УРОВЕНЬ ИГРОКА': 'PLAYER LEVEL',
  'СОХРАНЯЕТСЯ В save.json': 'SAVED IN save.json',
  'Уровень растёт от опыта, начисленного после забега, и сохраняется между запусками.': 'Level grows from XP awarded after a run and persists between launches.',
  'Требуемый опыт: 1000 × 1,1^(уровень−1) с округлением; на очень высоких уровнях значение ограничено числовым лимитом JS.': 'Required XP: 1000 × 1.1^(level−1), rounded; at very high levels the value is capped by JavaScript’s numeric limit.',
  'В конце забега считается разница нанесённого и полученного урона. При поражении удерживается 70–90% (зависит от уровня), затем применяется множитель сложности. Отрицательный результат обнуляется.': 'At the end of a run, damage dealt minus damage taken is calculated. On defeat, 70–90% is kept (depends on level), then the difficulty multiplier applies. A negative result becomes zero.',
  'В меню отладки можно добавить целое число опыта любой длины, в том числе отрицательное.': 'The debug menu lets you add an integer amount of XP of any length, including negative.',

  // Энциклопедия: управление
  'ДВИЖЕНИЕ': 'MOVEMENT',
  'WASD или стрелки. Используются физические коды клавиш, поэтому раскладка не важна: на русской раскладке работают ЦФЫВ.': 'WASD or arrow keys. Physical key codes are used, so keyboard layout does not matter: on the Russian layout, ЦФЫВ work.',
  'Столкновения с препятствиями и краями комнаты не дают выйти за поле.': 'Collisions with obstacles and room edges keep you inside the field.',
  'АТАКА И ПРИЦЕЛ': 'ATTACK AND AIM',
  'ЛКМ или Пробел — удар/выстрел; направление задаёт курсор.': 'LMB or Space — attack/shoot; the cursor sets the direction.',
  'По умолчанию зажатие повторяет атаку только у пистолета. В меню отладки игры переключатель «Автоматическая атака» разрешает зажатие для любого оружия.': 'By default, holding repeats attacks only with the pistol. In the gameplay debug menu, the “Auto attack” toggle enables holding for any weapon.',
  'ПАУЗА И ВЫХОД': 'PAUSE AND EXIT',
  'T, P или Esc открывают паузу в бою, выборе эффекта и инвентаре; повторное нажатие возвращает из паузы в игру.': 'T, P or Esc open pause during combat, effect selection and inventory; pressing again returns from pause to the game.',
  'В паузе: «ПРОДОЛЖИТЬ», переключатель звука и «ВЫЙТИ В МЕНЮ» с подтверждением.': 'In pause: “RESUME”, the sound toggle and “EXIT TO MENU” with confirmation.',
  'Ё на русской раскладке или ` на английской открывает меню отладки; повторное нажатие закрывает его.': 'The ` key opens the debug menu; pressing it again closes it.',
  'ВЫБОР ЭФФЕКТА': 'EFFECT SELECTION',
  'После пройденной комнаты предлагаются две карточки. Клик по карточке выбирает эффект, «ПОДТВЕРДИТЬ» применяет его и открывает инвентарь.': 'After clearing a room, two cards are offered. Click a card to pick an effect, “CONFIRM” applies it and opens the inventory.',
  'При включённом «Полном контроле» доступны все эффекты сразу и можно отметить несколько.': 'With “Full control” enabled, all effects are available at once and you can pick several.',
  'Выбери одно оружие и при желании включи/выключи имеющиеся способности, затем нажми «ВЫБРАТЬ».': 'Choose one weapon and optionally toggle your abilities, then click “SELECT”.',
  'Наведение на квадратную карточку скрывает иконку и показывает описание в непрозрачном окошке.': 'Hovering a square card hides its icon and shows a description in an opaque panel.',
  'ПОЛЯ ВВОДА': 'INPUT FIELDS',
  'Числовые поля работают по одной схеме: поле ввода, кнопка справа и ENTER. Принимаются только целые числа; некорректный ввод очищает поле.': 'Numeric fields all work the same way: an input, a button on the right and ENTER. Only integers are accepted; invalid input clears the field.',
  'Пока поле ввода в фокусе, WASD и горячие клавиши игры не срабатывают.': 'While an input is focused, WASD and game hotkeys do not trigger.',

  // Энциклопедия: отладка
  'ОТКРЫВАЕТСЯ С ВКЛАДКИ «ОТЛАДКА»': 'OPENS FROM THE “DEBUG” TAB',
  '«Режим бога» — полностью убирает входящий урон.': '“God mode” — completely removes incoming damage.',
  '«Полный контроль» — все эффекты на выбор, можно выбрать несколько.': '“Full control” — all effects available, you can pick several.',
  '«Отладка игрового процесса» — главный выключатель боковой панели: если он выключен, панель не показывается ни в паузе, ни в игре.': '“Gameplay debug” — master switch for the sidebar: when off, the panel is hidden both in pause and in game.',
  '«Скорость игры» — пресеты 0,25×, 0,5×, 1×, 1,5× и 2×.': '“Game speed” — presets 0.25×, 0.5×, 1×, 1.5× and 2×.',
  '«Добавить опыт» — целое число любой длины через BigInt; кнопка «Ввести» или ENTER, отрицательные значения обнуляют опыт.': '“Add XP” — any-length integer via BigInt; click ENTER or press ENTER; negative values reset XP to zero.',
  '«Сбросить уровень» — возвращает уровень 1 и опыт 0 после подтверждения; «Назад» возвращает в меню или паузу.': '“Reset level” — returns to level 1 and XP 0 after confirmation; “Back” returns to the menu or pause.',
  'МЕНЮ ОТЛАДКИ ИГРЫ': 'GAMEPLAY DEBUG MENU',
  'БОКОВАЯ ПАНЕЛЬ': 'SIDEBAR',
  'Пять полей с плюсом/минусом: урон, скорость, здоровье, скорость атаки (в процентах) и замедление врагов.': 'Five +/- fields: damage, speed, health, attack speed (percent) and enemy slow.',
  '«Автоматическая атака» — зажатие ЛКМ/Пробела работает для любого оружия; сама по себе кнопка атаку не начинает.': '“Auto attack” — holding LMB/Space works with any weapon; the toggle alone does not start an attack.',
  '«Пауза врагов» — враги, боссы, их пули, спавн и подкрепления замирают; игрок может двигаться, атаковать и менять настройки.': '“Enemy pause” — enemies, bosses, their bullets, spawning and reinforcements freeze; the player can move, attack and change settings.',
  '«Показывать в игре» — работает только при включённом главном переключателе: выключено — панель только в паузе, включено — и в паузе, и во время забега.': '“Show in game” — only works when the master toggle is on: off shows the panel only in pause, on shows it in pause and during the run.',
  'Кнопки: «ЕЩЕ» — полный контроль без завершения комнаты; «ИНВЕНТАРЬ» — тоже без перехода; «ЗАВЕРШИТЬ УРОВЕНЬ» — обычный проход комнаты; «МЕНЮ ОТЛАДКИ» — открывает общую отладку через паузу.': 'Buttons: “MORE” — full control without clearing the room; “INVENTORY” — also without advancing; “CLEAR ROOM” — normal room completion; “DEBUG MENU” — opens the general debug menu through pause.',

  // Прочее
  'Шанс появиться между уровнями: ~18,5% за выбор из полного пула (две карточки).': 'Chance to appear between levels: ~18.5% when picking from the full pool (two cards).',
  'Шанс появиться между уровнями: ~5,8% за выбор из полного пула (две карточки).': 'Chance to appear between levels: ~5.8% when picking from the full pool (two cards).',
  'XP · ПРЕДЕЛ ЧИСЛА JS': 'XP · JS NUMBER LIMIT',
  'работает': 'works',
  'не работает': 'does not work',
};

// Шаблоны для строк с подстановками. Порядок важен: сначала частные.
const PATTERNS = [
  [/^Включается и выключается в инвентаре\. Уникальный дроп\. (Шанс появиться между уровнями: ~[\d,]+% за выбор из полного пула \(две карточки\)\.) Карточка появляется только если у вас уже есть пистолет или дробовик\.$/,
    (m, chance) => `Can be toggled in the inventory. Unique drop. ${translateText(chance)} The card only appears if you already have a pistol or shotgun.`],
  [/^Включается и выключается в инвентаре\. Уникальный дроп\. (Шанс появиться между уровнями: ~[\d,]+% за выбор из полного пула \(две карточки\)\.)$/,
    (m, chance) => `Can be toggled in the inventory. Unique drop. ${translateText(chance)}`],
  [/^Шанс появиться между уровнями: ~([\d,]+)% за выбор из полного пула \(две карточки\)\.$/,
    (m, num) => `Chance to appear between levels: ~${num.replace(',', '.')}% when picking from the full pool (two cards).`],
  [/^Способности: взрыв пуль — (.+?); вампиризм — (.+?)\.$/,
    (m, a, b) => `Abilities: bullet explosion — ${translateText(a)}; vampirism — ${translateText(b)}.`],
  [/^«(.+)» снят\. Выбери эффекты и подтверди\.$/,
    (m, name) => `“${translateText(name)}” removed. Pick effects and confirm.`],
  [/^Победа! Опыт начислен полностью\.(?: (Опыт ×[\d.]+ за сложность\.))?$/,
    (m, note) => `Victory! XP awarded in full.${note ? ' ' + translateText(note) : ''}`],
  [/^Поражение: вычтено (\d+)% опыта, удержано (\d+)%\.(?: (Опыт ×[\d.]+ за сложность\.))?$/,
    (m, a, b, note) => `Defeat: ${a}% of XP deducted, ${b}% kept.${note ? ' ' + translateText(note) : ''}`],
  [/^Поражение: опыт не начислен\.(?: (Опыт ×[\d.]+ за сложность\.))?$/,
    (m, note) => `Defeat: no XP awarded.${note ? ' ' + translateText(note) : ''}`],
  [/^Опыт ×([\d.]+) за сложность\.$/, (m, n) => `XP ×${n} for difficulty.`],
  [/^ВСЕ (\d+) КОМНАТ ПРОЙДЕНЫ!$/, (m, n) => `ALL ${n} ROOMS CLEARED!`],
  [/^БОСС · (\d+) УРОНА · (\d+) \/ (\d+) HP$/, (m, d, hp, max) => `BOSS · ${d} DMG · ${hp}/${max} HP`],
  [/^БОСС · КОМНАТА (\d+)$/, (m, n) => `BOSS · ROOM ${n}`],
  [/^КОМНАТА (\d+)$/, (m, n) => `ROOM ${n}`],
  [/^КОМНАТА (\d+)\/(\d+)$/, (m, n, total) => `ROOM ${n}/${total}`],
  [/^Врагов: (\d+)$/, (m, n) => `Enemies: ${n}`],
  [/^ОРУЖИЕ: (.+)$/, (m, name) => `WEAPON: ${translateText(name)}`],
  [/^В МЕНЮ \((\d+)\)$/, (m, n) => `MENU (${n})`],
  [/^ПЕРЕГРЕВ ([\d.]+)с$/, (m, n) => `OVERHEAT ${n}s`],
  [/^ЗАМЕДЛЕНИЕ \+(-?\d+)$/, (m, n) => `SLOW +${n}`],
  [/^ЗАМЕДЛЕНИЕ (-?\d+)$/, (m, n) => `SLOW ${n}`],
  [/^УРОН (-?\d+)$/, (m, n) => `DAMAGE ${n}`],
  [/^СКОРОСТЬ (-?\d+)$/, (m, n) => `SPEED ${n}`],
  [/^АТАКА (\d+)%$/, (m, n) => `ATTACK ${n}%`],
  [/^ОПЫТ \| До следующего уровня (\d+) XP$/, (m, n) => `XP | ${n} until next level`],
  [/^XP · УРОВЕНЬ (\d+)$/, (m, n) => `XP · LEVEL ${n}`],
  [/^(.+?) · (\d+)$/, (m, title, n) => `${translateText(title)} · ${n}`],
  // Число плюс подсказка поля ввода: «+10 УРОН 12» → «+10 DAMAGE 12»
  [/^([+-]?\d+) (.+)$/, (m, delta, rest) => `${delta} ${translateText(rest)}`],
];

function translateText(src) {
  if (currentLang === 'ru' || typeof src !== 'string' || !src) return src;
  // Сохраняем внешние пробелы текстовых узлов.
  const lead = (src.match(/^\s*/) || [''])[0];
  const trail = (src.match(/\s*$/) || [''])[0];
  const core = src.slice(lead.length, src.length - trail.length);
  if (!core) return src;

  let out;
  if (Object.prototype.hasOwnProperty.call(EN, core)) {
    out = EN[core];
  } else {
    out = core;
    for (const [re, rep] of PATTERNS) {
      re.lastIndex = 0;
      if (re.test(core)) {
        re.lastIndex = 0;
        out = core.replace(re, rep);
        break;
      }
    }
  }
  return lead + out + trail;
}

function readStoredLanguage() {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === 'ru' || stored === 'en') return stored;
  } catch (e) { /* localStorage может быть недоступен */ }
  return 'en'; // английский — основной язык по умолчанию
}

let currentLang = readStoredLanguage();
let applying = false;

const I18N_ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];

function applyTextNode(node) {
  if (node.__i18nOriginal === undefined) node.__i18nOriginal = node.nodeValue;
  const want = translateText(node.__i18nOriginal);
  if (node.nodeValue !== want) node.nodeValue = want;
  node.__i18nLang = currentLang;
}

function applyAttrs(el) {
  for (const attr of I18N_ATTRS) {
    if (!el.hasAttribute(attr)) continue;
    const stored = `__i18n_${attr}`;
    if (el[stored] === undefined) el[stored] = el.getAttribute(attr);
    const want = translateText(el[stored]);
    if (el.getAttribute(attr) !== want) el.setAttribute(attr, want);
  }
}

function collectTextNodes(root, out) {
  if (!root) return;
  if (root.nodeType === Node.TEXT_NODE) {
    if (root.nodeValue && root.nodeValue.trim()) out.push(root);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const tag = root.tagName ? root.tagName.toLowerCase() : '';
  if (tag === 'script' || tag === 'style' || tag === 'noscript') return;
  applyAttrs(root);
  for (const child of root.childNodes) collectTextNodes(child, out);
}

function processNode(root) {
  if (applying || !root) return;
  applying = true;
  try {
    const nodes = [];
    collectTextNodes(root, nodes);
    for (const node of nodes) applyTextNode(node);
  } finally {
    applying = false;
  }
}

function applyI18n() {
  document.documentElement.lang = currentLang;
  processNode(document.body);
  window.dispatchEvent(new CustomEvent('languagechange', { detail: { language: currentLang } }));
}

function getLanguage() {
  return currentLang;
}

function setLanguage(lang) {
  if (lang !== 'ru' && lang !== 'en') return;
  currentLang = lang;
  try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* ignore */ }
  applyI18n();
}

// Подхватываем все строки, которые игра создаёт уже после загрузки.
if (typeof MutationObserver !== 'undefined') {
  const observer = new MutationObserver((records) => {
    if (applying) return;
    const targets = new Set();
    for (const rec of records) {
      if (rec.type === 'childList') {
        rec.addedNodes.forEach((n) => targets.add(n));
      } else if (rec.type === 'characterData' || rec.type === 'attributes') {
        targets.add(rec.target);
      }
    }
    targets.forEach((n) => processNode(n));
  });
  observer.observe(document.body, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: I18N_ATTRS,
  });
}

window.I18N = { t: translateText, translateText, getLanguage, setLanguage, applyI18n };
applyI18n();
