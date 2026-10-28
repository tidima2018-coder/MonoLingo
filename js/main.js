'use strict';
window.App = (() => {
 const key='chess-learning-v1';let storageKey=key;let data={wins:0,completed:[],dailyDates:[],dailyStreak:0,lastDailyDate:'',stageVersion:1},legacyProfile=false,storageOK=true;
 function migrateCompleted(completed){
  const migrated=[];let oldPuzzleCount=3;
  completed.forEach(oldStage=>{
   if(!Number.isInteger(oldStage)||oldStage<0||oldStage>=30)return;
   if(oldStage<=6){migrated.push([0,12,1,13,2,14,3][oldStage]);return;}
   if(oldStage%3===0||oldStage===29){const oldLevel=Math.min(3,1+Math.floor((oldStage-7)/7));migrated.push(oldLevel*3);}
   else migrated.push(12+oldPuzzleCount++);
  });
  return [...new Set(migrated)];
 }
 try{
  const activeProfileId=localStorage.getItem('chess-active-profile-id');if(activeProfileId)storageKey=key+':'+activeProfileId;
  const saved=JSON.parse(localStorage.getItem(storageKey));
  if(saved&&Array.isArray(saved.completed)){
   legacyProfile=saved.stageVersion!==1||Object.prototype.hasOwnProperty.call(saved,'xp');
   const completed=saved.stageVersion===1?saved.completed:migrateCompleted(saved.completed);
   data={wins:Number(saved.wins)||0,completed:completed.filter(x=>Number.isInteger(x)&&x>=0&&x<30),dailyDates:Array.isArray(saved.dailyDates)?saved.dailyDates.filter(x=>typeof x==='string').slice(-60):[],dailyStreak:Number.isInteger(saved.dailyStreak)&&saved.dailyStreak>0?saved.dailyStreak:0,lastDailyDate:typeof saved.lastDailyDate==='string'?saved.lastDailyDate:'',stageVersion:1};
  }
 }catch(e){storageOK=false;}
 const theories=[
  ['Правила игры','Цель партии — мат: король под шахом, и защитить его невозможно. На каждом ходу проверь, не висит ли фигура без защиты.','Сначала ищи безопасные ходы и простые взятия. Не торопись атаковать, пока не видишь ответ соперника.',['Король не должен оставаться под шахом.','Партия выигрывается матом, а не количеством взятий.']],
  ['Ценность фигур','Фигуры имеют разную ценность: пешка — 1, конь и слон — 3, ладья — 5, ферзь — 9. Это ориентир, а не строгий закон.','Перед взятием сравни, чем ты отдаёшь и что получаешь. Защищённая фигура может быть дороже пешки, но не стоит терять ферзя ради неё.',['Считай размен в обе стороны.','Перед ходом проверь, кто защитит новую позицию.']],
  ['Развитие коней','Коней обычно развивают к центру: оттуда они контролируют больше полей и быстрее подключаются к атаке.','Не делай несколько ходов одной фигурой без причины. Выведи коня, создай давление на центр и сохрани пешечную защиту короля.',['Развивай фигуры к центру.','Не отдавай коня бесплатно пешке или слону.']],
  ['Развитие слонов','Слону нужны открытые диагонали. Сначала подумай о центре: центральные пешки могут открыть слона или, наоборот, запереть его.','Развивай слона на активную диагональ, но не позволяй противнику выиграть темп нападением на него.',['Открой диагональ пешкой.','Сравни активность слона с риском его потерять.']],
  ['Борьба за центр','Пешки e- и d-линий влияют на центральные поля и открывают дороги фигурам. Контроль центра помогает быстро перебрасывать силы.','Занимай или атакуй центр пешками и фигурами. Не продвигай все пешки сразу: сначала подготовь поддержку.',['Контролируй центральные поля.','Поддерживай выдвинутую пешку фигурами.']],
  ['Связка фигуры','Фигура связана, если уход с линии откроет нападение на более ценную фигуру или короля. Связка ограничивает защитника и может сделать его уязвимым.','Ищи линию слон—конь—король или ладья—фигура—ферзь. Усиль давление на связанную фигуру, прежде чем брать её.',['Проверь, что стоит за целью на линии.','Убедись, что связанная фигура не может уйти безопасно.']],
  ['Развивай фигуры с темпом','Шах, нападение на ферзя или угроза взятия вынуждают соперника отвечать. Такие ходы помогают развиваться, одновременно задавая вопрос.','Ищи полезный ход, который ещё и создаёт угрозу. Не считай каждый шах хорошим: после него может улучшиться позиция соперника.',['Проверь ответ на шах.','Совмещай развитие с угрозой.']],
  ['Рокировка и безопасность','Рокировка уводит короля от центра и вводит ладью в игру. Для неё король и нужная ладья не должны уже ходить; между ними не должно быть фигур.','Сначала развивай лёгкие фигуры и освободи поля рокировки. Не задерживай короля в центре, когда линии открываются.',['Рокируй до вскрытия центра.','Не рокируй вслепую в атаку соперника.']],
  ['Тактика двойного удара','Двойной удар создаёт две угрозы одним ходом. Соперник может защититься от одной, но вторая позволяет выиграть материал.','Ищи фигуру, которая одновременно нападает на короля и ферзя, или на две незащищённые фигуры. Считай возможное спасение каждой цели.',['Шах часто делает угрозу особенно сильной.','Проверь, может ли одна фигура защитить обе цели.']],
  ['План в миттельшпиле','Когда фигуры развиты, улучши худшую фигуру и найди слабость в позиции соперника. Не начинай атаку без достаточного числа участников.','Выбери линию для ладьи, устойчивое поле для коня или цель для пешечного продвижения. Планы помогают найти несколько хороших ходов подряд.',['Улучши самую пассивную фигуру.','Подключай фигуры к одной понятной цели.']],
  ['Ладьи на открытых линиях','Ладья особенно сильна на открытой или полуоткрытой линии. Сдвоенные ладьи поддерживают вторжение и защищают проходные пешки.','Соедини ладьи, затем поставь одну на линию без своих пешек. Вторжение на седьмую горизонталь часто создаёт угрозы пешкам и королю.',['Открытая линия должна вести к цели.','Перед вторжением проверь, не попадёт ли ладья под нападение.']],
  ['Расчёт вариантов','Перед длинным планом рассчитай несколько форсированных ответов: шахи, взятия и прямые угрозы. Сравни конечные позиции, а не только первый ход.','В сильной позиции последовательность «шах — взятие — угроза» помогает не пропустить ответ соперника. После расчёта ещё раз проверь безопасность своей фигуры.',['Рассматривай сильнейший ответ соперника.','Останови расчёт в устойчивой позиции и оцени материал.']]
 ];
 const botNames=['Начинающий','Ученик','Любитель','Тактик','Комбинатор','Крепкий клубный','Сильный клубный','Эксперт','Мастер','Сильный мастер','Почти гроссмейстер','Максимальная сила'];
 const botPatronymics=['Михалыч','Петрович','Ильич','Сергеич','Андреич','Васильич','Николаич','Фёдорович','Григорьич','Алексеич','Макарыч','Степаныч'];
 const botDescriptions=['уровень силы 0 — начни знакомство с партиями.','уровень силы 2 — замечает простые угрозы.','уровень силы 4 — увереннее обращается с фигурами.','уровень силы 6 — точнее считает простые варианты.','уровень силы 8 — сильнее наказывает за слабую защиту.','уровень силы 10 — серьёзный соперник для практики.','уровень силы 12 — ищи план и проверяй тактику.','уровень силы 14 — играй внимательно в сложных позициях.','уровень силы 16 — продумывай варианты заранее.','уровень силы 18 — очень сильное сопротивление.','уровень силы 19 — почти максимальный уровень.','уровень силы 20 — максимальная сила.'].map((description,index)=>botPatronymics[index]+' · '+description);
 const botLessons=botNames.map((name,i)=>{const skill=[0,2,4,6,8,10,12,14,16,18,19,20][i],level=Math.floor(i/3);return [name,botDescriptions[i],'game.html?level='+level+'&skill='+skill+'&stage='+i,theories[i]];});
 const puzzles=[
  {title:'Конь в вилке',text:'Найди ход конём: дай шах королю и одновременно напади на ферзя.',fen:'4k3/5q2/8/8/2N5/8/8/4K3 w - - 0 1',solution:'c4d6',hint:'Конь умеет атаковать фигуры на расстоянии. Ищи поле, с которого он шахует короля и нападает на ферзя.',topic:'Вилка конём'},
  {title:'Ферзь и поддержка короля',text:'Белые ходят. Поставь мат ферзём за один ход.',fen:'7k/8/5KQ1/8/8/8/8/8 w - - 0 1',solution:'g6g7',mate:true,hint:'Ферзь может приблизиться к королю на g7: белый король защищает это поле.',topic:'Мат с поддержкой короля'},
  {title:'Ладья на последней горизонтали',text:'Найди мат ладьёй. У короля почти все поля заняты собственными пешками.',fen:'6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1',solution:'e1e8',mate:true,hint:'Пешечный щит может стать ловушкой. Открой ладье путь по восьмой горизонтали.',topic:'Мат на последней горизонтали'},
  {title:'Слон с шахом',text:'Найди шах слоном, одновременно забирая пешку рядом с королём.',fen:'4k3/5p2/8/3B4/8/8/8/K7 w - - 0 1',solution:'d5f7',hint:'Диагональ слона ведёт к пешке f7. После взятия слон продолжит атаковать короля e8.',topic:'Шах со взятием'},
  {title:'Открой линию для ладьи',text:'Белые ходят. Убери коня с линии ладьи и открой шах королю.',fen:'4k3/8/8/4N3/8/8/8/K3R3 w - - 0 1',solution:'e5f7',hint:'Конь стоит между ладьёй и королём. Переставь его с шахом: ладья получит открытую линию.',topic:'Вскрытый шах'},
  {title:'Связанный конь',text:'Сними слоном коня, который прикован к королю по диагонали.',fen:'4k3/8/2n5/1B6/8/8/8/K7 w - - 0 1',solution:'b5c6',hint:'Конь c6 закрывает диагональ слона к королю e8. Взятие вскрывает шах.',topic:'Связка и выигрыш фигуры'},
  {title:'Взятие на проходе',text:'Сделай специальное взятие пешкой на проходе. Это право действует только сразу после двойного хода пешки.',fen:'4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2',solution:'e5d6',hint:'Чёрная пешка только что прошла два поля. Белая пешка может взять её на d6, не приземляясь на её клетку.',topic:'Правило en passant'},
  {title:'Пешка превращается в ферзя',text:'Продвинь проходную пешку до последней горизонтали и выбери ферзя.',fen:'k7/4P3/8/8/8/8/8/4K3 w - - 0 1',solution:'e7e8q',hint:'Пешка уже рядом с последней горизонталью. После хода e8 выбери превращение в ферзя.',topic:'Превращение пешки'},
  {title:'Забери ферзя ладьёй',text:'Белые ходят. Выиграй незащищённого ферзя ладьёй.',fen:'k7/3q4/8/8/8/8/8/3R2K1 w - - 0 1',solution:'d1d7',hint:'Проверь вертикаль d: между ладьёй и ферзём нет фигур.',topic:'Незащищённая фигура'},
  {title:'Ферзь под ударом',text:'Найди прямое взятие ферзя ладьёй по открытой вертикали.',fen:'k7/4q3/8/8/8/8/8/4R1K1 w - - 0 1',solution:'e1e7',hint:'Ферзь стоит на той же открытой линии, что и белая ладья. Сосчитай пустые клетки между ними.',topic:'Взятие по открытой линии'},
  {title:'Ферзь забирает пешку',text:'Белые ходят. Забери центральную пешку ферзём.',fen:'7k/8/8/3p4/8/8/8/K2Q4 w - - 0 1',solution:'d1d5',hint:'Ферзь движется по свободной вертикали к центральной пешке.',topic:'Взятие ферзём'},
  {title:'Безопасная рокировка',text:'Убери короля из центра и введи ладью в игру рокировкой.',fen:'r3k2r/ppp2ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1',solution:'e1g1',hint:'Король и ладья ещё не ходили, между ними пусто, а поля рокировки безопасны.',topic:'Рокировка и безопасность короля'},
  {title:'Отрази угрозу королю',text:'Белые под шахом. Уведи короля на безопасное поле.',fen:'4r1k1/8/8/8/8/8/8/4K3 w - - 0 1',solution:'e1d1',hint:'При шахе сначала спаси короля: отступи с вертикали ладьи.',topic:'Выход из-под шаха'},
  {title:'Ферзь нападает на две цели',text:'Дай шах королю и создай угрозу ладье на той же горизонтали.',fen:'k6r/8/8/4Q3/8/8/8/K7 w - - 0 1',solution:'e5e8',hint:'Поставь ферзя между двумя целями: шах королю на a8 и нападение на ладью h8.',topic:'Двойное нападение ферзём'},
  {title:'Забери коня',text:'Найди диагональ слона к незащищённому коню.',fen:'7k/8/8/8/5n2/8/8/2B3K1 w - - 0 1',solution:'c1f4',hint:'Слон проходит по диагонали c1–f4 и забирает коня.',topic:'Слон против коня'},
  {title:'Ладья атакует ферзя с шахом',text:'Найди шах ладьёй, который одновременно нападает на ферзя.',fen:'q6k/8/8/8/8/8/8/R5K1 w - - 0 1',solution:'a1a8',hint:'Возьми ферзя на a8: ладья одновременно шахует короля h8 по горизонтали.',topic:'Линейный двойной удар'},
  {title:'Останови пешку',text:'Белые ходят. Возьми проходную пешку до того, как она превратится.',fen:'7k/5p2/8/8/8/8/8/5R1K w - - 0 1',solution:'f1f7',hint:'Ладья может снять пешку на f7 по вертикали: король соперника не успевает к превращению.',topic:'Остановка проходной пешки'},
  {title:'Центральная пешка под защитой',text:'Выиграй центральную пешку ладьёй, сохранив короля в безопасности.',fen:'4k3/8/8/4p3/8/8/8/4R1K1 w - - 0 1',solution:'e1e5',hint:'Ладья идёт по свободной вертикали и забирает пешку на e5.',topic:'Контроль открытой линии'}
 ];
 const puzzleTheories=[
  ['Вилка конём','Конь атакует по букве «Г» и способен одновременно атаковать короля и ферзя.','Поставь коня на поле, откуда королю шах, а ферзь окажется под ударом. Сначала проверь, что чёрный король не может взять коня.',['Шах ограничивает выбор соперника.','После ответа на шах ферзь останется под боем.']],
  ['Мат с поддержкой короля','Ферзь один не всегда может поставить мат: король помогает контролировать соседние поля.','В этой позиции король уже близко. Используй поддержку короля и перекрой все безопасные поля чёрного короля ферзём.',['Ферзь не должен быть доступен для взятия.','Сосчитай поля отступления короля.']],
  ['Матовая клетка ладьи','Пешки у своего короля ограничивают его бегство. Ладья может воспользоваться этим на открытой горизонтали.','Перед решающим шахом проверь, какие поля заняты собственными пешками соперника, а какие контролирует твой король.',['Ладья должна давать шах по линии.','Пешечный щит может запирать короля.']],
  ['Шах со взятием','Шах, который одновременно выигрывает материал, часто сильнее простого нападения.','Проверь диагональ слона к королю и возможное взятие фигуры рядом с ним. После взятия король должен остаться под атакой.',['Учитывай направление движения слона.','Не оставляй своего короля под шахом.']],
  ['Вскрытый шах','Когда фигура уходит с линии дальнобойной фигуры, она может открыть шах издалека.','Здесь конь закрывает вертикаль ладьи. Найди ход коня, который одновременно полезен сам по себе и освобождает линию.',['Шах наносит ладья, а не ушедшая фигура.','Ушедшая фигура может создать вторую угрозу.']],
  ['Связка','Слон на диагонали короля ограничивает движение фигуры между ними. Связанная фигура не может просто уйти, если откроет шах.','Рассмотри взятие коня слоном: после него слон сам продолжит атаковать короля по диагонали.',['Между слоном и королём должна быть прямая диагональ.','Перед взятием проверь ответ короля.']],
  ['Взятие на проходе','En passant — единственное шахматное взятие, при котором пешка берёт не фигуру на клетке назначения.','Это взятие возможно только сразу после того, как пешка соперника пошла на два поля и оказалась рядом.',['Пешка назначения становится на поле за взятой пешкой.','Право на en passant исчезает после следующего хода.']],
  ['Превращение','Дойдя до последней горизонтали, пешка превращается в ферзя, ладью, слона или коня.','Сравни стоимость выбора: ферзь обычно сильнее, но в редких позициях превращение в коня нужно для шаха или предотвращения пата.',['Превращение происходит в том же ходе.','Выбери фигуру в появившемся диалоге.']],
  ['Фигура без защиты','Перед ходом проверь ценность фигур соперника и посчитай прямые линии нападения.','Незащищённый ферзь — цель высокой ценности. Если путь ладьи свободен, взятие может выиграть партию сразу.',['Сосчитай пустые клетки на вертикали.','Убедись, что ладья сама не висит.']],
  ['Открытая вертикаль','Ладья использует открытую линию, чтобы атаковать цель на другом конце доски.','Смотри вдоль вертикали ладьи и проверь, какие фигуры соперника стоят без защиты.',['Ладья движется только по прямой.','Промежуточные клетки должны быть свободны.']],
  ['Активный слон','Дальнобойная фигура может совмещать шах с атакой пешки или другой фигуры.','Проследи диагональ от слона и оцени, будет ли королю достаточно времени защитить атакованную цель.',['Слон атакует только по диагонали.','После шаха оцени, что останется без защиты.']],
  ['Рокировка','Рокировка одним ходом перемещает короля в безопасную сторону и ставит ладью ближе к центру.','Она невозможна, если король или выбранная ладья уже двигались, если путь занят или король проходит под шахом.',['Все условия рокировки должны соблюдаться.','Короткая рокировка — ход короля e1–g1.']],
  ['Ответ на шах','Если король под шахом, нужно снять угрозу немедленно. Обычно можно отойти королём, взять атакующую фигуру или закрыть линию.','Проверь поля отхода короля. Не выбирай клетку, которую всё ещё контролирует ладья.',['В шах нельзя игнорировать угрозу.','Проверь безопасность целевой клетки.']],
  ['Двойное нападение ферзём','Ферзь сочетает возможности ладьи и слона, поэтому может одновременно атаковать разные цели.','Расположи ферзя так, чтобы он угрожал королю по горизонтали и ладье по другой линии. Шах вынудит соперника отвечать.',['Проверь обе линии нападения.','Оцени, что останется под боем после ответа на шах.']],
  ['Диагональ слона','Слон может забирать цель на другой клетке по диагонали, если клетки между ними свободны.','Найди диагональ от слона к коню. Не перепутай направление с ходом ладьи.',['Считай смещение по обеим координатам.','Взятие заканчивает движение на клетке цели.']],
  ['Линейная атака','Ладья опасна, когда её линия открыта и на ней стоят ценные фигуры. Один ход может создать шах и выиграть фигуру.','Подними ладью по свободной вертикали: оцени, какой король окажется под шахом и какая цель попадёт под удар.',['Одна линия может связывать несколько целей.','Шах должен быть легальным и не открывать шах своему королю.']],
  ['Проходная пешка','Проходная пешка может добраться до последней горизонтали, если противник не остановит её.','Перед продвижением пешки найди активную фигуру, способную перехватить её. Ладья часто справляется с этой задачей по вертикали.',['Считай, сколько ходов до превращения.','Не допускай, чтобы пешка прошла мимо защиты.']],
  ['Ладья на открытой линии','Открытая вертикаль помогает ладье атаковать пешку в центре и поддерживать давление.','Если между ладьёй и центральной пешкой нет фигур, проверь, можно ли выиграть её одним прямым ходом.',['Центральные пешки влияют на важные поля.','После взятия проверь активность ладьи.']]
 ];
 const lessons=[],botCount=botLessons.length;
 botLessons.forEach(lesson=>lessons.push(lesson));
 puzzles.forEach((p,index)=>{p.lesson=botCount+index;p.hint=p.hint||'Проверь сначала шахи, затем взятия и угрозы.';lessons.push([p.title,p.text,'puzzles.html?lesson='+p.lesson,{title:p.topic,lead:puzzleTheories[index][1],body:puzzleTheories[index][2],points:puzzleTheories[index][3]}]);});
 function unlocked(i){if(i===0||i===botCount)return true;const isPuzzle=lessons[i]?.[2].startsWith('puzzles.html');for(let previous=i-1;previous>=0;previous--)if(lessons[previous]?.[2].startsWith('puzzles.html')===isPuzzle)return data.completed.includes(previous)||data.completed.includes(i);return true;}
 function complete(i){if(!Number.isInteger(i)||i<0||i>=lessons.length||!unlocked(i))return;if(!data.completed.includes(i)){data.completed.push(i);save();}}
 function save(){try{localStorage.setItem(storageKey,JSON.stringify(data));}catch(e){storageOK=false;}document.dispatchEvent(new CustomEvent('app-progress-change'));}
 if(legacyProfile)save();
 function win(level,stage){data.wins++;const i=Number.isInteger(stage)?stage:[0,3,6,9][level];if(lessons[i]?.[2].startsWith('game.html?')&&(Number.isInteger(stage)||lessons[i][2].startsWith('game.html?level='+level)))complete(i);save();}
 function theoryUrl(i){return 'lesson.html?stage='+i;}
 function localDate(date=new Date()){return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');}
 function dailyPuzzle(date=localDate()){const safe=/^\d{4}-\d{2}-\d{2}$/.test(date)?date:localDate(),[year,month,dayOfMonth]=safe.split('-').map(Number),day=Math.floor(Date.UTC(year,month-1,dayOfMonth)/86400000);return puzzles[((day%puzzles.length)+puzzles.length)%puzzles.length];}
 function completeDaily(date=localDate()){if(data.dailyDates.includes(date))return false;const yesterday=new Date(date+'T12:00:00');yesterday.setDate(yesterday.getDate()-1);data.dailyStreak=data.lastDailyDate===localDate(yesterday)?data.dailyStreak+1:1;data.lastDailyDate=date;data.dailyDates.push(date);data.dailyDates=data.dailyDates.slice(-60);save();return true;}
 function dailyStreakLabel(){const count=data.dailyStreak,unit=count%10===1&&count%100!==11?'день':count%10>=2&&count%10<=4&&(count%100<12||count%100>14)?'дня':'дней';return 'Серия: '+count+' '+unit;}
 function getProgressSnapshot(){return {completed:data.completed.slice(),dailyDates:data.dailyDates.slice(),dailyStreak:data.dailyStreak,lastDailyDate:data.lastDailyDate,wins:data.wins};}
 function hydrateCloudProgress(profile){
  const before=JSON.stringify(data);
  if(storageKey===key){
   storageKey=key+':'+profile.id;
   try{localStorage.setItem(storageKey,JSON.stringify(data));}catch(e){storageOK=false;}
  }
  data.completed=[...new Set([...data.completed,...(Array.isArray(profile.completed_stages)?profile.completed_stages:[])])]
   .filter(i=>Number.isInteger(i)&&i>=0&&i<lessons.length).sort((a,b)=>a-b);
  data.wins=Math.max(data.wins,Number(profile.wins)||0);
  data.dailyDates=[...new Set([...data.dailyDates,...(Array.isArray(profile.daily_dates)?profile.daily_dates:[])])].sort().slice(-60);
  data.dailyStreak=Math.max(data.dailyStreak,Number(profile.daily_streak)||0);
  data.lastDailyDate=[data.lastDailyDate,profile.last_daily_date||''].sort().pop();
  save();
  return before!==JSON.stringify(data);
 }
 const isHome=location.pathname.endsWith('/')||location.pathname.endsWith('/index.html');
 if(isHome){
 const $=id=>document.getElementById(id);
 document.querySelector('#app').innerHTML=`<section id="welcome" class="welcome minimal-welcome"><div class="minimal-mark" aria-hidden="true"><span class="minimal-ring"></span><span class="minimal-knight">♞</span></div><span class="eyebrow">Твой ход</span><h1>Шахматы.<br>С каждым ходом лучше.</h1><p class="minimal-description">Играй, решай задачи и развивай своё мышление.</p><a class="button primary welcome-cta" href="#learning">Играть и развиваться <span aria-hidden="true">→</span></a></section><section id="learning" class="learning-view" hidden><div class="learning-heading"><span class="eyebrow">Каждый ход — новый навык</span><h1>Твой путь в шахматах.</h1><p>Играй и открывай новые этапы.</p><a class="button primary" href="${theoryUrl(lessons.findIndex((_,i)=>unlocked(i)&&!data.completed.includes(i))<0?0:lessons.findIndex((_,i)=>unlocked(i)&&!data.completed.includes(i)))}">Продолжить обучение →</a></div><div class="stats"><div class="card"><strong>${data.completed.length} / ${lessons.length}</strong><span>Пройдено этапов</span></div><div class="card"><strong>${data.wins}</strong><span>Побед над ботами</span></div><div class="card"><strong>${data.dailyStreak}</strong><span>Дней подряд с задачей дня</span></div></div><div class="layout"><section><span class="eyebrow">Твой маршрут</span><h2>От первого хода к первой стратегии</h2><div class="course-progress"><span style="width:${data.completed.length/lessons.length*100}%"></span></div><div class="path"></div></section><aside class="mode-sidebar"><span class="eyebrow">Выбери свой темп</span><h2>Больше практики</h2><a class="mode-card mode-bot" href="game.html"><span class="mode-icon">♞</span><span><strong>Против бота</strong><small>12 этапов: от силы 0 до 20</small></span><span class="mode-arrow" aria-hidden="true">→</span></a><a class="mode-card mode-friend" href="game.html?mode=friend"><span class="mode-icon">♚</span><span><strong>С другом</strong><small>Одна доска · два соперника</small></span><span class="mode-arrow" aria-hidden="true">→</span></a><a class="mode-card mode-puzzle" href="puzzles.html"><span class="mode-icon" aria-hidden="true">♝</span><span><strong>Тактические задачи</strong><small>${puzzles.length} разных позиций и тем</small></span><span class="mode-arrow" aria-hidden="true">→</span></a><div class="course-note"><strong>Партии и задачи — отдельно</strong><p>Проходи последовательные маршруты и возвращайся к теории каждого этапа.</p></div></aside></div><footer>Аккаунт, прогресс и статистика синхронизируются через Supabase.${storageOK?'':' Локальное хранилище отключено; настройки доски не сохранятся.'}</footer></section><dialog id="welcome-theory" class="theory-dialog"><span class="eyebrow">Короткая теория перед началом</span><h2>${theories[0][0]}</h2><p>${theories[0][1]}</p><p>${theories[0][2]}</p><ul>${theories[0][3].map(point=>'<li>'+point+'</li>').join('')}</ul><div class="actions"><button id="welcome-skip" type="button">Пропустить теорию</button><button id="welcome-begin" class="primary" type="button">К обучению →</button></div></dialog>`;
 let entered=false;
 try{entered=localStorage.getItem('chess-welcome-completed')==='1'||localStorage.getItem('chess-intro-theory-shown')==='1'||data.completed.length>0||data.wins>0;}catch(e){}
 function showHomeView(){
  if(location.hash==='#learning'){entered=true;try{localStorage.setItem('chess-welcome-completed','1');}catch(e){}}
  const learning=entered;
  document.getElementById('welcome').hidden=learning;document.getElementById('learning').hidden=!learning;
  document.body.classList.toggle('on-welcome',!learning);
  if(learning&&location.hash!=='#learning')history.replaceState(null,'','#learning');
 }
 showHomeView();window.addEventListener('hashchange',()=>{showHomeView();window.scrollTo({top:0,behavior:'auto'});});
 const intro=$('welcome-theory');let introSeen=false;
 try{introSeen=localStorage.getItem('chess-intro-theory-shown')==='1';}catch(e){}
 if(!entered&&!introSeen&&intro)intro.showModal();
 function dismissIntro(){try{localStorage.setItem('chess-intro-theory-shown','1');localStorage.setItem('chess-welcome-completed','1');}catch(e){}intro.close();entered=true;location.hash='learning';showHomeView();}
 $('welcome-skip').onclick=dismissIntro;$('welcome-begin').onclick=dismissIntro;
 }
 return {data,lessons,puzzles,unlocked,complete,win,dailyPuzzle,completeDaily,localDate,dailyStreakLabel,theoryUrl,botCount,botPatronymics,getProgressSnapshot,hydrateCloudProgress};
})();
