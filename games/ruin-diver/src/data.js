// Every number and name the game uses. Balance lives here, not in the code.

export const W = 480, H = 270;          // the game's pixel resolution (16:9)
export const T = 16;                    // tile size in pixels; one tile of depth is one meter
export const MW = 48, MH = 306;         // the cave in tiles: 48 wide, down to the seal at 300m

export const RARITY = {
  common:    { order: 0, color: "#a8a39a", glow: "#8a8478", value: 3,  newBonus: 6 },
  uncommon:  { order: 1, color: "#6fd36a", glow: "#3fb24a", value: 8,  newBonus: 12 },
  rare:      { order: 2, color: "#5aa8ff", glow: "#2f7cff", value: 20, newBonus: 30 },
  epic:      { order: 3, color: "#c27bff", glow: "#9a3cff", value: 55, newBonus: 80 },
  legendary: { order: 4, color: "#ffc63a", glow: "#ff9a1a", value: 160, newBonus: 240 },
};

// Zones from the top down. Densities are per 100 tiles of depth.
export const ZONES = [
  {
    id: "village", from: 0, to: 100, coinValue: 2, valueK: 1, hearts: 3,
    weights: { common: 60, uncommon: 30, rare: 10 },
    stone: 0.22, gold: 0.05, gem: 0, rooms: 5, roomTile: "brick",
    items: 14, bats: 7, slimes: 6, spikes: 0.02, enemyFrom: 14, stalactites: 0.008, skulls: 0, redSlimes: 0,
    mushrooms: 15, pools: 6, oils: 5, roots: 30, crates: 5,
  },
  {
    id: "mine", from: 100, to: 300, coinValue: 3, valueK: 1.6, hearts: 7,
    weights: { common: 45, uncommon: 32, rare: 17, epic: 6 },
    stone: 0.5, gold: 0.06, gem: 0.03, rooms: 4, roomTile: "wood",
    items: 14, bats: 13, slimes: 11, spikes: 0.05, enemyFrom: 100, stalactites: 0.03, skulls: 5, redSlimes: 0.45,
    mushrooms: 7, pools: 3, oils: 4, roots: 10, crates: 4,
  },
  { id: "library", from: 300, to: 600, sealed: 0.3, coming: true },
];
export const SEAL_DEPTH = 300;
export const WINCH_DEPTHS = []; // (no winches: the way out is down)

// Bosses guard the way down. Their arena spans the cave; the gate in its floor opens when they fall.
// Each time you beat one it comes back a little tougher (up to +3 health).
export const BOSSES = [
  { id: "slime_king", top: 88, floor: 98, hp: 4, trophy: "slime_crown", coins: 25 },
  { id: "golem", top: 189, floor: 199, hp: 5, trophy: "golem_core", coins: 60 },
];
// How much harder things get with depth: enemy speed and numbers scale by 1 + depth / DEPTH_SCALE.
export const DEPTH_SCALE = 220;
// Shortcuts: once a boss is beaten you may start in its hall, by a campfire, with the gate already open.
export const STARTS = [
  { id: "top", depth: 0 },
  { id: "mine", depth: 98, boss: "slime_king" },
  { id: "deep", depth: 199, boss: "golem" },
];

// The collection. sprite names a shape in sprites.js, pal colors it. min/max limit where it shows up (meters).
export const ITEMS = [
  // ---- village: 0-100m
  { id: "rusty_key", zone: "village", rarity: "common", sprite: "key", pal: "rust" },
  { id: "teacup", zone: "village", rarity: "common", sprite: "cup", pal: "porcelain" },
  { id: "button", zone: "village", rarity: "common", sprite: "button", pal: "wood" },
  { id: "spoon", zone: "village", rarity: "common", sprite: "spoon", pal: "wood" },
  { id: "bottle", zone: "village", rarity: "common", sprite: "bottle", pal: "glassGreen" },
  { id: "rag_doll", zone: "village", rarity: "uncommon", sprite: "doll", pal: "cloth" },
  { id: "brass_bell", zone: "village", rarity: "uncommon", sprite: "bell", pal: "brass" },
  { id: "old_letter", zone: "village", rarity: "uncommon", sprite: "letter", pal: "paper" },
  { id: "music_box", zone: "village", rarity: "uncommon", sprite: "musicbox", pal: "wood", min: 20 },
  { id: "horseshoe", zone: "village", rarity: "uncommon", sprite: "horseshoe", pal: "iron", min: 20 },
  { id: "brooch", zone: "village", rarity: "rare", sprite: "brooch", pal: "sapphire" },
  { id: "crest", zone: "village", rarity: "rare", sprite: "shield", pal: "crest", min: 30 },
  { id: "candlestick", zone: "village", rarity: "rare", sprite: "candle", pal: "silver", min: 40 },
  { id: "stained_glass", zone: "village", rarity: "rare", sprite: "shard", pal: "stained", min: 50 },
  { id: "clock_gear", zone: "village", rarity: "rare", sprite: "gear", pal: "brass", min: 70 },
  // ---- mine: 100-300m
  { id: "coal", zone: "mine", rarity: "common", sprite: "chunk", pal: "coal" },
  { id: "copper_ore", zone: "mine", rarity: "common", sprite: "chunk", pal: "copper" },
  { id: "broken_pick", zone: "mine", rarity: "common", sprite: "pick", pal: "iron" },
  { id: "glove", zone: "mine", rarity: "common", sprite: "glove", pal: "leather" },
  { id: "iron_ore", zone: "mine", rarity: "uncommon", sprite: "chunk", pal: "ironOre" },
  { id: "miner_lamp", zone: "mine", rarity: "uncommon", sprite: "lantern", pal: "brass" },
  { id: "quartz", zone: "mine", rarity: "uncommon", sprite: "crystal", pal: "quartz" },
  { id: "journal", zone: "mine", rarity: "uncommon", sprite: "book", pal: "leather", min: 130 },
  { id: "amethyst", zone: "mine", rarity: "rare", sprite: "crystal", pal: "amethyst" },
  { id: "gold_nugget", zone: "mine", rarity: "rare", sprite: "chunk", pal: "gold" },
  { id: "fossil_shell", zone: "mine", rarity: "rare", sprite: "shell", pal: "bone", min: 150 },
  { id: "ruby", zone: "mine", rarity: "epic", sprite: "crystal", pal: "ruby", min: 180 },
  { id: "ancient_pick", zone: "mine", rarity: "epic", sprite: "pick", pal: "goldPick", min: 200 },
  { id: "fossil_skull", zone: "mine", rarity: "epic", sprite: "skull", pal: "bone", min: 240 },
  // boss trophies: only from beating the boss
  { id: "slime_crown", zone: "village", rarity: "epic", sprite: "crown", pal: "gold", boss: true },
  { id: "golem_core", zone: "mine", rarity: "legendary", sprite: "core", pal: "ember", boss: true },
];
export const ITEM = Object.fromEntries(ITEMS.map((it) => [it.id, it]));

// Sets: collect every item for a permanent bonus.
export const SETS = [
  { id: "village_memory", items: ["rag_doll", "rusty_key", "teacup"], bonus: { lantern: 10 } },
  { id: "bell_tower", items: ["brass_bell", "candlestick", "clock_gear"], bonus: { lantern: 15 } },
  { id: "miners_day", items: ["glove", "broken_pick", "miner_lamp", "journal"], bonus: { hearts: 1 } },
  { id: "miners_treasure", items: ["gold_nugget", "amethyst", "ruby"], bonus: { coins: 0.15 } },
];

// Stars: how many you have brought home for each star.
export const STARS = [1, 5, 15];
export const STAR3_COIN_BONUS = 0.01; // +1% coins for every item at three stars
export const VARIANT_CHANCE = 0.015;

// Upgrades: `levels` is the stat at each level (index 0 = start), cost = base * growth^level.
export const UPGRADES = [
  { id: "lantern", levels: [90, 110, 130, 155, 180, 210, 240, 280], unit: "s", base: 20, growth: 1.55 },
  { id: "bag", levels: [3, 4, 5, 6, 7, 8, 10], unit: "", base: 20, growth: 1.6 },
  { id: "hearts", levels: [3, 4, 5, 6, 7, 8], unit: "", base: 35, growth: 1.9 },
  { id: "pick", levels: [1, 1.4, 1.8, 2.3, 3], unit: "x", base: 30, growth: 1.9 },
  { id: "stomach", levels: [1, 1.15, 1.3, 1.5, 1.75, 2], unit: "x", base: 25, growth: 1.8 },
];
export const UPGRADE = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
export const upgradeCost = (u, level) => Math.round(u.base * Math.pow(u.growth, level));

// Survival: three meters that run down, and what refills them.
export const SURVIVE = {
  food: 140, water: 105,         // seconds from full to empty (times the stomach upgrade)
  starveEvery: 5,                // seconds per heart lost while hunger or thirst is empty
  mushroom: 35, cooked: 60,      // hunger a mushroom fills, raw / eaten by a campfire
  drink: 40,                     // thirst one water fills
  oil: 45,                       // light an oil flask fills (percent)
  poolUnits: 3, poolFill: 0.45, poolRegen: 25, // water in a pool, seconds per sip, seconds to refill one
  torch: { wood: 2, radius: 70 },
  campfire: { wood: 3, stone: 3, radius: 96, heal: 6 },
  rope: { wood: 2 },
  hunters: { dark: 8, lit: 16, cap: 7 }, // seconds between creatures that come looking for you
  exitDepth: 296,
};
// The collapse only starts if you take the sealed relic from its pedestal deep in the mine (see EVENTS.seal).
// The cave comes down behind you: a rockfall front that chases you to the exit. Speeds in meters (tiles) per second.
// It waits `grace` seconds, speeds up from `start` to `max` over `ramp` seconds, and hurries to stay within `catchup`
// meters of you; it holds still while a boss fight is on.
export const COLLAPSE = { grace: 0, start: 0.5, max: 0.78, ramp: 300, catchup: 26, catchK: 0.08, hurtEvery: 0.7, warn: 9 };
// The pickaxe wears out: each block costs durability (by material), crates and the merchant mend it.
export const PICK = { base: 30, perLevel: 9, cost: { arrow: 2, crumble: 0, crack: 0, dirt: 1, gold: 1, wood: 1, brick: 2, stone: 2, gem: 2 }, crate: 5, chest: 8 };
// A swing of the pickaxe: reach in pixels in front of you, how long it lasts and the wait before the next.
export const SWING = { reach: 22, time: 0.18, cooldown: 0.34 };
export const WALL = { slide: 55, jumpX: 150, jumpK: 0.92 }; // wall slide speed cap, wall jump push and height
// Spelunky-style tools and traps.
export const BOMB = { start: 3, fuse: 1.6, radius: 30, dmg: 2, throwX: 170, throwY: -200, crate: 0.4 };
export const TRAP = { range: 8, speed: 330, windup: 0.16, reload: 4, crumble: 0.5, boulder: 175, boulderDmg: 2, tntFuse: 0.35 };
export const START_KIT = { mushroom: 1, water: 1, wood: 2, stone: 0 };

// Movement and danger.
export const PHYS = {
  gravity: 1100, maxFall: 420, walk: 92, accel: 900, jump: 300, climb: 72,
  coyote: 0.1, jumpBuffer: 0.12, fallHurt: 7, fallHurt2: 12, // tiles fallen before landing hurts (1, then 2 hearts)
};
export const DIG = { arrow: 0.9, crumble: 0.2, crack: 0.18, dirt: 0.32, gold: 0.45, brick: 0.7, wood: 0.4, stone: 0.75, gem: 0.9 };
export const STONE_PICK = 0;           // (stone can always be dug; a better pick just digs faster)
export const DARK_DRAIN = 6;           // seconds per heart lost once the lantern is out
export const ROPE_LEN = 8;             // tiles a thrown rope reaches
export const LANTERN_AD_SECONDS = 30;
export const DEATH_COIN_KEEP = 0.5;

// The scripted first dive: three things in the entrance chamber, then a short cave below that shows off
// everything once (dig, stomp, a chest, a winch) and ends with a set completed.
export const FIRST_DIVE = [
  { tx: 26, ty: 8, item: "rusty_key" },
  { tx: 31, ty: 8, item: "teacup" },
  { tx: 16, ty: 8, item: "brooch" },
];
export const FIRST_CHEST_ITEM = "rag_doll";

// Chests: a relic plus a shower of coins. Rooms hold one each; a few more hide far off the main way.
export const CHESTS = { remote: { village: 3, mine: 4 }, coins: { village: 8, mine: 14 } };
export const GOLD_SLIME = { chance: 0.4, coins: 25, from: 18, to: 85 };
export const COMBO_BONUS = 2; // extra coins per stomp for each step of a combo

// Missions: three at a time, in this order. Counts carry across expeditions; depth and combo are a best.
export const MISSIONS = [
  { id: "m1", kind: "slimes", n: 3, reward: 30 },
  { id: "m2", kind: "gold", n: 5, reward: 30 },
  { id: "m3", kind: "depth", n: 25, reward: 25 },
  { id: "m4", kind: "chests", n: 2, reward: 40 },
  { id: "m5", kind: "bats", n: 3, reward: 40 },
  { id: "m6", kind: "escapeWith", n: 3, reward: 40 },
  { id: "m7", kind: "combo", n: 2, reward: 40 },
  { id: "m8", kind: "depth", n: 50, reward: 50 },
  { id: "m9", kind: "winch", n: 1, reward: 40 },
  { id: "m10", kind: "goldSlime", n: 1, reward: 60 },
  { id: "m11", kind: "hearts", n: 2, reward: 30 },
  { id: "m12", kind: "depth", n: 80, reward: 70 },
  { id: "m13", kind: "boss_slime_king", n: 1, reward: 150 },
  { id: "m14", kind: "combo", n: 3, reward: 80 },
  { id: "m15", kind: "skulls", n: 3, reward: 90 },
  { id: "m16", kind: "depth", n: 150, reward: 120 },
  { id: "m17", kind: "chests", n: 8, reward: 120 },
  { id: "m18", kind: "boss_golem", n: 1, reward: 300 },
  { id: "m19", kind: "depth", n: 250, reward: 200 },
];
export const MISSION_BEST = new Set(["depth", "combo"]); // a best within one expedition, not a running total

// ---------------------------------------------------------------- text
export const STR = {
  ko: {
    goal: "목표: {d}m 아래 출구까지 살아남기",
    toExit: "출구까지 {d}m",
    rules1: "배고픔·목마름·빛이 계속 줄어요",
    rules2: "버섯·물·기름을 찾아 채우고, 나무·돌로 횃불과 모닥불을 만들어요",
    rules3: "숨겨진 방과 고대의 석판을 찾아 300m 아래 출구까지 내려가요",
    food: "배고픔", waterM: "목마름", light: "빛",
    inv: { mushroom: "버섯", water: "물", wood: "나무", stone: "돌" },
    act: { eat: "먹기", drink: "마시기", torch: "횃불", campfire: "모닥불", rope: "로프", bomb: "폭탄" },
    needs: "{what} 부족",
    hintEat: "배고파요! 1번(버섯 먹기)을 누르세요",
    hintDrink: "목말라요! 2번(물 마시기)을 누르세요. 물웅덩이에 서 있으면 물을 떠요",
    hintLight: "빛이 꺼져가요! 기름병을 찾거나 3번으로 횃불을 세워요",
    hintDark: "어둠 속에선 괴물이 몰려와요! 횃불 근처는 안전해요",
    hintStarve: "굶주리고 있어요! 체력이 줄어요",
    hintPool: "물웅덩이! 서 있으면 물을 떠요",
    hintRoot: "뿌리를 건드리면 나무를 얻어요",
    hintCamp: "모닥불 옆에서는 체력이 차고, 버섯을 구워 먹을 수 있어요",
    placed: { torch: "횃불을 세웠어요", campfire: "모닥불을 피웠어요" },
    cooked: "구운 버섯!",
    full: "가득 찼어요",
    won: "탈출 성공!",
    survived: "생존 시간",
    reachedExit: "출구에 도착했어요!",
    relicsFound: "찾은 유물",
    missions: "미션",
    missionDone: "미션 완료!",
    missionReward: "미션 보상",
    allMissions: "모든 미션 완료!",
    mission: { slimes: "슬라임 {n}마리 밟기", gold: "금광석 {n}개 캐기", depth: "{n}m까지 내려가기", chests: "보물 상자 {n}개 열기", bats: "박쥐 {n}마리 밟기", escapeWith: "유물 {n}개 들고 탈출", combo: "연속 밟기 x{n}", winch: "탈출 윈치로 탈출", goldSlime: "황금 슬라임 밟기", hearts: "하트 {n}개 줍기", boss_slime_king: "슬라임 킹 쓰러뜨리기", boss_golem: "고대 골렘 쓰러뜨리기", skulls: "해골 {n}개 부수기" },
    digHint: "벽으로 계속 밀면 파져요!",
    stompHint: "위에서 밟으면 잡혀요!",
    digDownHint: "아래를 누르면 밑으로 파요!",
    moreBelow: "아래에 더 있어요! 구멍으로 내려가 보세요",
    chestOpen: "보물 상자!",
    jackpot: "황금 슬라임! 잡아라!",
    bosses: { slime_king: "슬라임 킹", golem: "고대 골렘" },
    bossWake: "보스 등장!",
    bossDown: "보스 처치! 아래로 가는 문이 열렸어요",
    gateShut: "보스를 쓰러뜨려야 문이 열려요",
    bossHint: "위에서 밟아서 공격!",
    start: "출발",
    starts: { top: "입구", mine: "광산 입구 100m", deep: "깊은 광산 200m" },
    died: "쓰러졌어요…",
    lostBag: "잃어버린 유물",
    revive: "다시 일어나기",
    giveUp: "포기하기",
    keepDark: "어둠 속으로 계속",
    darkness: "랜턴이 꺼졌어요! 어둠이 체력을 깎아요",
    hurt: "아야!",
    winchHint: "⬆ 위를 눌러 탈출",
    exitHint: "사다리로 올라가면 탈출!",
    noRope: "로프가 없어요",
    tooHard: "곡괭이를 강화해야 캘 수 있어요",
    nearestExit: "출구 ↑{d}m",
    atExit: "출구 바로 여기!",
    jump: "점프",
    ropeBtn: "로프",
    ctrlKeys: "←→ 이동 · Space 점프 · X 공격 · 벽으로 밀어 파기 · 벽에서 점프 = 벽차기 · 1 먹기 · 2 마시기 · 3 횃불 · 4 모닥불 · B 폭탄 · C 로프",
    ctrlTouch: "왼쪽 드래그 이동 · 아래로 끌면 파기 · 오른쪽 점프·공격 · 벽에서 점프 = 벽차기",
    keptCoins: "코인 절반만 챙겼어요",
    tapToDive: "탭해서 탐험 시작",
    dragHint: "드래그해서 움직이기",
    ascend: "올라가기",
    depth: "깊이",
    best: "최고",
    lantern: "랜턴",
    bag: "가방",
    bagFull: "가방 가득! 이제 더 좋은 유물만 바꿔 담아요",
    lanternOut: "랜턴이 꺼졌어요",
    ropeEnd: "줄 끝에 닿았어요",
    goingUp: "탈출!",
    escaped: "탈출 성공!",
    reachedDepth: "도달 깊이",
    newRecord: "신기록!",
    loot: "가져온 유물",
    nothing: "이번엔 빈손이에요. 다시 가 볼까요?",
    coins: "코인",
    looseCoins: "주운 코인",
    newBonus: "NEW 보너스",
    setBonus: "보너스",
    diveAgain: "다시 탐험하기",
    dive: "탐험하기",
    double: "코인 2배",
    doubled: "2배 받았어요!",
    recover: "되찾기",
    recovered: "되찾았어요!",
    dropped: "떨군 유물",
    skip: "괜찮아요",
    upgrades: "업그레이드",
    book: "도감",
    max: "MAX",
    locked: "{d}m에서 해금",
    needMore: "{name}까지 {n}코인 더!",
    canBuy: "업그레이드할 수 있어요!",
    hubTitle: "루인 다이버",
    hubSub: "최고 기록 {d}m · 도감 {p}%",
    seeDeeper: "더 깊은 곳에서 찾을 수 있어요",
    sec: "초",
    lvl: "Lv.{n}",
    complete: "완성도",
    sets: "세트",
    setDone: "세트 완성!",
    unknown: "???",
    seenAt: "{d}m 근처에서 봤어요",
    owned: "보유 {n}개",
    variant: "변종",
    close: "닫기",
    paused: "일시정지",
    resume: "계속하기",
    relight: "랜턴 다시 켜기 (+{s}초)",
    goUp: "올라가기",
    sealNeed: "봉인: 도감 {p}% 필요",
    sealOpen: "봉인이 반응해요… 다음 지대는 업데이트 예정!",
    zoneEnter: "{d}m · {name}",
    adPlaceholder: "광고 자리 (포키 SDK)",
    helmetSave: "투구가 막았어요!",
    lost: "유물을 떨궜어요!",
    nextGoal: "다음 목표",
    reset: "기록 초기화",
    resetConfirm: "한 번 더 누르면 모든 기록이 지워져요",
    noSave: "이 브라우저에서는 저장이 안 돼요. 창을 닫으면 기록이 사라져요.",
    upgradeNames: { lantern: "랜턴", bag: "배낭", hearts: "체력", pick: "곡괭이", stomach: "튼튼한 위장" },
    upgradeDesc: { lantern: "빛 지속", bag: "자원마다 들 수 있는 수", hearts: "하트", pick: "파는 속도", stomach: "배고픔·목마름 천천히" },
    zones: { village: "무너진 마을", mine: "지하 광산", library: "가라앉은 도서관" },
    rarity: { common: "일반", uncommon: "고급", rare: "희귀", epic: "영웅", legendary: "전설" },
    setNames: { village_memory: "마을의 기억", bell_tower: "종탑의 소리", miners_day: "광부의 하루", miners_treasure: "광부의 보물" },
    bonusText: { ropes: "로프 +{v}", lantern: "랜턴 +{v}초", hearts: "하트 +{v}", coins: "코인 +{p}%" },
    pickStone: "돌 캐기 가능",
    items: {
      rusty_key: ["녹슨 열쇠", "어느 집 대문 열쇠였을까."],
      teacup: ["깨진 찻잔", "금이 갔지만 꽃무늬는 그대로예요."],
      button: ["나무 단추", "누군가의 외투에서 떨어진 단추."],
      spoon: ["나무 숟가락", "손때가 반질반질하게 묻어 있어요."],
      bottle: ["빈 유리병", "안에서 희미하게 바다 냄새가 나요."],
      rag_doll: ["헝겊 인형", "단추 눈 하나가 떨어졌어요."],
      brass_bell: ["놋쇠 종", "흔들면 아직도 맑게 울려요."],
      old_letter: ["오래된 편지", "'꼭 돌아올게'라고만 읽혀요."],
      music_box: ["오르골", "태엽을 감으면 자장가가 흘러요."],
      horseshoe: ["행운의 편자", "문 위에 걸려 있던 행운의 상징."],
      brooch: ["할머니의 브로치", "푸른 보석이 아직도 반짝여요."],
      crest: ["마을 문장 방패", "무너지기 전 마을의 자랑."],
      candlestick: ["은 촛대", "종탑 제단을 밝히던 촛대."],
      stained_glass: ["스테인드글라스 조각", "빛을 비추면 무지개가 떠요."],
      clock_gear: ["시계탑 톱니", "마을의 시간이 멈춘 날의 톱니."],
      coal: ["석탄 덩어리", "손에 검댕이 묻어나요."],
      copper_ore: ["구리 광석", "초록 녹이 슬어 있어요."],
      broken_pick: ["부러진 곡괭이", "마지막까지 땅을 판 흔적."],
      glove: ["광부의 장갑", "손가락 끝이 다 해졌어요."],
      iron_ore: ["철광석", "묵직하고 차가워요."],
      miner_lamp: ["광부의 랜턴", "기름이 아직 조금 남았어요."],
      quartz: ["석영 결정", "투명한 육각기둥 결정."],
      journal: ["광부의 일지", "'더 깊은 곳에 무언가 있다.'"],
      amethyst: ["자수정", "보랏빛이 어둠 속에서 빛나요."],
      gold_nugget: ["금 원석", "광부들이 꿈꾸던 바로 그것."],
      fossil_shell: ["조개 화석", "이곳이 바다였다는 증거."],
      ruby: ["루비 원석", "타오르는 불꽃 같은 붉은빛."],
      ancient_pick: ["고대의 곡괭이", "누가 만든 걸까? 녹이 하나도 없어요."],
      fossil_skull: ["고대 생물 두개골", "이빨이 아주 날카로워요."],
      slime_crown: ["슬라임 왕관", "슬라임 킹을 쓰러뜨린 증표. 아직 끈적해요."],
      golem_core: ["골렘의 심장", "아직도 따뜻하게 맥동하는 돌."],
    },
  },
  en: {
    goal: "Goal: survive down to the exit at {d}m",
    toExit: "Exit in {d}m",
    rules1: "Hunger, thirst and light keep running down",
    rules2: "Find mushrooms, water and oil; build torches and campfires from wood and stone",
    rules3: "Find hidden rooms and ancient tablets on your way to the exit 300m below",
    food: "Hunger", waterM: "Thirst", light: "Light",
    inv: { mushroom: "Mushroom", water: "Water", wood: "Wood", stone: "Stone" },
    act: { eat: "Eat", drink: "Drink", torch: "Torch", campfire: "Campfire", rope: "Rope", bomb: "Bomb" },
    needs: "Need {what}",
    hintEat: "Hungry! Press 1 to eat a mushroom",
    hintDrink: "Thirsty! Press 2 to drink. Stand in a pool to fill up",
    hintLight: "Your light is fading! Find oil, or press 3 for a torch",
    hintDark: "Creatures swarm in the dark! Torchlight keeps them off",
    hintStarve: "You're starving! Losing health",
    hintPool: "A pool! Stand in it to collect water",
    hintRoot: "Touch roots to collect wood",
    hintCamp: "By a campfire you heal, and mushrooms cook",
    placed: { torch: "Torch placed", campfire: "Campfire lit" },
    cooked: "Cooked mushroom!",
    full: "Full",
    won: "Escaped!",
    survived: "Survived",
    reachedExit: "You reached the exit!",
    relicsFound: "Relics found",
    missions: "Missions",
    missionDone: "Mission complete!",
    missionReward: "Mission rewards",
    allMissions: "All missions done!",
    mission: { slimes: "Stomp {n} slimes", gold: "Dig {n} gold ore", depth: "Reach {n}m", chests: "Open {n} chests", bats: "Stomp {n} bats", escapeWith: "Escape with {n} relics", combo: "Stomp combo x{n}", winch: "Escape by winch", goldSlime: "Stomp a golden slime", hearts: "Pick up {n} hearts", boss_slime_king: "Beat the Slime King", boss_golem: "Beat the Ancient Golem", skulls: "Smash {n} skulls" },
    digHint: "Keep pushing into the wall to dig!",
    stompHint: "Jump on it to squash it!",
    digDownHint: "Hold down to dig below you!",
    moreBelow: "There's more below! Try the hole",
    chestOpen: "Treasure chest!",
    jackpot: "A golden slime! Get it!",
    bosses: { slime_king: "Slime King", golem: "Ancient Golem" },
    bossWake: "Boss!",
    bossDown: "Boss defeated! The gate below is open",
    gateShut: "Beat the boss to open the gate",
    bossHint: "Jump on its head!",
    start: "Start",
    starts: { top: "Entrance", mine: "Mine 100m", deep: "Deep mine 200m" },
    died: "You collapsed…",
    lostBag: "Lost relics",
    revive: "Get back up",
    giveUp: "Give up",
    keepDark: "Keep going in the dark",
    darkness: "Lantern's out! The dark drains your health",
    hurt: "Ouch!",
    winchHint: "⬆ Press up to escape",
    exitHint: "Climb the ladder to escape!",
    noRope: "No ropes left",
    tooHard: "Upgrade your pickaxe to dig this",
    nearestExit: "Exit ↑{d}m",
    atExit: "Exit right here!",
    jump: "Jump",
    ropeBtn: "Rope",
    ctrlKeys: "←→ move · Space jump · X attack · push into walls to dig · jump off walls · 1 eat · 2 drink · 3 torch · 4 campfire · B bomb · C rope",
    ctrlTouch: "Drag left side to move · drag down to dig · right buttons jump and attack · jump off walls",
    keptCoins: "Kept half your coins",
    tapToDive: "Tap to explore",
    dragHint: "Drag to move",
    ascend: "Go up",
    depth: "Depth",
    best: "Best",
    lantern: "Lantern",
    bag: "Bag",
    bagFull: "Bag full! Only better finds swap in now",
    lanternOut: "Lantern's out",
    ropeEnd: "End of the rope",
    goingUp: "Escape!",
    escaped: "Escaped!",
    reachedDepth: "Depth reached",
    newRecord: "New record!",
    loot: "Loot",
    nothing: "Empty-handed this time. Dive again?",
    coins: "Coins",
    looseCoins: "Coins picked up",
    newBonus: "NEW bonus",
    setBonus: "Bonus",
    diveAgain: "Explore again",
    dive: "Explore",
    double: "Double coins",
    doubled: "Doubled!",
    recover: "Recover",
    recovered: "Recovered!",
    dropped: "Dropped",
    skip: "No thanks",
    upgrades: "Upgrades",
    book: "Collection",
    max: "MAX",
    locked: "Unlocks at {d}m",
    needMore: "{n} more coins for {name}",
    canBuy: "You can upgrade!",
    hubTitle: "Ruin Diver",
    hubSub: "Best {d}m · Collection {p}%",
    seeDeeper: "Waiting somewhere deeper",
    sec: "s",
    lvl: "Lv.{n}",
    complete: "Complete",
    sets: "Sets",
    setDone: "Set complete!",
    unknown: "???",
    seenAt: "Seen near {d}m",
    owned: "Owned {n}",
    variant: "Variant",
    close: "Close",
    paused: "Paused",
    resume: "Resume",
    relight: "Relight lantern (+{s}s)",
    goUp: "Go up",
    sealNeed: "Seal: needs {p}% collection",
    sealOpen: "The seal stirs… the next zone arrives in an update!",
    zoneEnter: "{d}m · {name}",
    adPlaceholder: "Ad placeholder (Poki SDK)",
    helmetSave: "Helmet blocked it!",
    lost: "Dropped a relic!",
    nextGoal: "Next goal",
    reset: "Reset progress",
    resetConfirm: "Tap again to erase everything",
    noSave: "Saving is blocked in this browser. Progress is lost when you close it.",
    upgradeNames: { lantern: "Lantern", bag: "Pack", hearts: "Health", pick: "Pickaxe", stomach: "Iron stomach" },
    upgradeDesc: { lantern: "Light lasts", bag: "Carry per resource", hearts: "Hearts", pick: "Dig speed", stomach: "Hunger and thirst slower" },
    zones: { village: "Fallen Village", mine: "Deep Mine", library: "Sunken Library" },
    rarity: { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" },
    setNames: { village_memory: "Village Memories", bell_tower: "Bell Tower", miners_day: "A Miner's Day", miners_treasure: "Miner's Treasure" },
    bonusText: { ropes: "Ropes +{v}", lantern: "Lantern +{v}s", hearts: "Hearts +{v}", coins: "Coins +{p}%" },
    pickStone: "Digs stone",
    items: {
      rusty_key: ["Rusty Key", "Whose front door did it open?"],
      teacup: ["Cracked Teacup", "Cracked, but the flowers survived."],
      button: ["Wooden Button", "Fell off someone's coat."],
      spoon: ["Wooden Spoon", "Worn smooth by years of soup."],
      bottle: ["Empty Bottle", "It still smells faintly of the sea."],
      rag_doll: ["Rag Doll", "One button eye is missing."],
      brass_bell: ["Brass Bell", "Still rings clear when shaken."],
      old_letter: ["Old Letter", "Only 'I'll come back' is legible."],
      music_box: ["Music Box", "Wind it up for a lullaby."],
      horseshoe: ["Lucky Horseshoe", "Hung over a door for luck."],
      brooch: ["Grandma's Brooch", "The blue stone still sparkles."],
      crest: ["Village Crest", "The village's pride, before the fall."],
      candlestick: ["Silver Candlestick", "It lit the bell tower altar."],
      stained_glass: ["Stained Glass", "Hold it up and rainbows appear."],
      clock_gear: ["Clock Tower Gear", "From the day the village stopped."],
      coal: ["Lump of Coal", "Leaves soot on your fingers."],
      copper_ore: ["Copper Ore", "Crusted with green patina."],
      broken_pick: ["Broken Pickaxe", "It dug until the very end."],
      glove: ["Miner's Glove", "Worn through at the fingertips."],
      iron_ore: ["Iron Ore", "Heavy and cold."],
      miner_lamp: ["Miner's Lamp", "A little oil left inside."],
      quartz: ["Quartz Crystal", "A clear six-sided crystal."],
      journal: ["Miner's Journal", "'Something lies deeper below.'"],
      amethyst: ["Amethyst", "Glows violet in the dark."],
      gold_nugget: ["Gold Nugget", "What every miner dreamed of."],
      fossil_shell: ["Fossil Shell", "Proof this was once a sea."],
      ruby: ["Raw Ruby", "Red as a living flame."],
      ancient_pick: ["Ancient Pickaxe", "Who made it? Not a speck of rust."],
      fossil_skull: ["Ancient Skull", "Those teeth are very sharp."],
      slime_crown: ["Slime Crown", "Proof you beat the Slime King. Still sticky."],
      golem_core: ["Golem Heart", "A stone that still pulses warm."],
    },
  },
};

// ================================================================ long-term systems
// Rare materials: carried home even if you fall. Ores sit in rock (dig them out); monsters drop the rest.
export const MATS = ["copper", "iron", "crystal", "gel", "wing", "bone"];
export const ORES = [
  { id: "copper", from: 15, to: 130, n: 13 },
  { id: "iron", from: 95, to: 300, n: 13 },
  { id: "crystal", from: 150, to: 300, n: 7 },
];
// Monsters: the bestiary lists them in this order. drops: material -> chance per kill.
export const BEASTS = [
  { id: "bat", zone: "village", drops: { wing: 0.3 } },
  { id: "slime", zone: "village", drops: { gel: 0.35 } },
  { id: "gold_slime", zone: "village", drops: { crystal: 1 } },
  { id: "red_slime", zone: "mine", drops: { gel: 0.6 } },
  { id: "skull", zone: "mine", drops: { bone: 0.45 } },
  { id: "slime_king", zone: "village", boss: true, drops: { gel: 4 } },
  { id: "golem", zone: "mine", boss: true, drops: { iron: 3, crystal: 3 } },
];
export const BEAST_REWARD = { seen: 150, killed: 300 }; // once: every monster discovered / every monster beaten

// Random events: a few per zone each dive, weighted, rarer if you've met them lately.
// opts: what you can do (cost is paid from the dive: hp, mushroom, water, wood, stone, coins).
export const EVENTS = {
  supply:   { zones: ["village", "mine"], w: 3, from: 14, passive: true },
  cavein:   { zones: ["village", "mine"], w: 2, from: 25, passive: true },
  altar:    { zones: ["village", "mine"], w: 2.2, from: 20, opts: [{ id: "blood", cost: { hp: 1 } }, { id: "offer", cost: { mushroom: 2 } }] },
  merchant: { zones: ["village", "mine"], w: 2.2, from: 15, stay: true, opts: [
    { id: "food", cost: { coins: 12 } }, { id: "water", cost: { coins: 12 } }, { id: "oil", cost: { coins: 15 } },
    { id: "mats", cost: { coins: 20 } }, { id: "mend", cost: { coins: 15 } }, { id: "bombs", cost: { coins: 20 } }, { id: "rare", cost: { coins: 45 } }] },
  cursed:   { zones: ["village", "mine"], w: 1.4, from: 40, opts: [{ id: "open", cost: {} }] },
  vault:    { zones: ["mine"], w: 2, from: 105, opts: [{ id: "break", cost: { stone: 4 } }] },
  spring:   { zones: ["mine"], w: 1.6, from: 105, opts: [{ id: "drink", cost: {} }] },
  // not random: one sealed relic in every cave, and the stone tablets you read
  seal:     { zones: [], w: 0, from: 215, opts: [{ id: "take", cost: {} }] },
  tablet:   { zones: [], w: 0, opts: [] },
};
// What makes the cave feel lived in. Props stand on floors (pots break when you swing at them), critters wander,
// glowing things light their surroundings in their own colour.
export const PROPS = {
  village: { floor: ["pot", "pot", "pot_broken", "prop_skull", "glow_mush", "frame", "coin_bag", "pot"], ceil: ["vines", "spider_hang", "vines"], n: 46, ceilN: 16 },
  mine: { floor: ["pot", "pot_broken", "prop_skull", "purple_mush", "crystal_blue", "crystal_red", "stalagmite", "minecart", "helmet", "prop_pick", "fossil"], ceil: ["spider_hang", "vines"], n: 56, ceilN: 14 },
};
export const GLOW = { glow_mush: [0xffffc04a, 30], purple_mush: [0xffff5ac8, 26], crystal_blue: [0xffffb04a, 34], crystal_red: [0xff4a4aff, 30], ore_crystal: [0xff4ae0ff, 20] };
export const POT_LOOT = [["coins", 0.5], ["mushroom", 0.14], ["water", 0.1], ["oil", 0.08], ["pick", 0.08]];
export const CRITTERS = { village: ["beetle", "snail", "crab"], mine: ["beetle", "lizard", "crab", "spider"], n: 7 };
// Landmarks: one special place per zone, built from props in a big open cavern.
export const LANDMARKS = {
  village: [{ id: "grotto", props: ["glow_mush", "glow_mush", "purple_mush", "crystal_blue", "glow_mush", "purple_mush", "glow_mush"], mushrooms: 4 },
            { id: "graveyard", props: ["prop_skull", "pot_broken", "frame", "prop_skull", "pot", "coin_bag", "prop_skull"], relic: true }],
  mine: [{ id: "camp", props: ["minecart_coal", "helmet", "prop_lantern", "prop_shovel", "minecart", "prop_pick", "crate"], crates: 2 },
         { id: "bones", props: ["fossil", "prop_skull", "gold_pile", "fossil", "prop_skull", "crystal_red", "fossil"], relic: true },
         { id: "crystals", props: ["crystal_blue", "crystal_red", "crystal_blue", "crystal_blue", "crystal_red", "crystal_blue"], ore: 3 }],
};
export const SECRETS = { village: 2, mine: 3 }; // sealed rooms behind cracked walls
export const TABLETS = { village: 2, mine: 3 }; // stone tablets out in the cave (secret rooms hold more)
export const LORE_N = 12;
export const EVENTS_PER_ZONE = { village: 3, mine: 4 };

// The base on the surface. Each facility has levels; `up[n]` is the price of reaching level n.
export const FACILITIES = [
  { id: "bench", start: 1, max: 3, up: { 2: { coins: 150, copper: 4 }, 3: { coins: 420, iron: 5, crystal: 2 } } },
  { id: "lab", start: 0, max: 3, up: { 1: { coins: 90, copper: 3 }, 2: { coins: 260, iron: 4 }, 3: { coins: 600, crystal: 4 } } },
  { id: "store", start: 0, max: 3, up: { 1: { coins: 60 }, 2: { coins: 200, gel: 4 }, 3: { coins: 480, wing: 5 } } },
  { id: "museum", start: 0, max: 3, up: { 1: { coins: 100 }, 2: { coins: 300, bone: 4 }, 3: { coins: 700, crystal: 3 } } },
];
export const STORE_KIT = [{}, { wood: 2 }, { wood: 2, water: 1 }, { wood: 3, water: 1, mushroom: 1 }]; // by store level
export const MUSEUM_COINS = 0.05; // coin bonus per museum level

// Gear: made once at the workbench (its level is the highest tier you can make), then equipped.
// One slot, two once the workbench is level 3. fx are multipliers or additions the dive reads.
export const GEAR = [
  { id: "steel_pick", tier: 1, cost: { coins: 60, copper: 4 }, fx: { dig: 1.5 } },
  { id: "canteen", tier: 1, cost: { coins: 60, copper: 2, wing: 2 }, fx: { waterK: 0.75, kit: { water: 1 } } },
  { id: "gel_boots", tier: 1, cost: { coins: 60, gel: 4 }, fx: { jumpK: 1.12, fall: 4 } },
  { id: "wide_lantern", tier: 2, cost: { coins: 150, copper: 3, iron: 3 }, fx: { lightK: 0.7, lamp: 1.25 } },
  { id: "bone_mail", tier: 2, cost: { coins: 150, bone: 5, iron: 2 }, fx: { hearts: 1 } },
  { id: "detector", tier: 3, cost: { coins: 300, crystal: 3, iron: 3 }, fx: { detect: 1 } },
];
// Research at the lab: permanent, always on. needRelics / needBeasts: how much you must have found first.
export const RESEARCH = [
  { id: "farming", tier: 1, cost: { coins: 80, gel: 2 }, fx: { kit: { mushroom: 1 } } },
  { id: "filter", tier: 1, cost: { coins: 80, copper: 2 }, fx: { poolK: 0.6 } },
  { id: "refine", tier: 2, cost: { coins: 180, iron: 2, wing: 2 }, needRelics: 8, fx: { oil: 15 } },
  { id: "torchcraft", tier: 2, cost: { coins: 180, copper: 3 }, fx: { torchK: 1.3 } },
  { id: "camping", tier: 2, cost: { coins: 200, bone: 3 }, fx: { campStone: 1 } },
  { id: "beastlore", tier: 3, cost: { coins: 350, crystal: 2 }, needBeasts: 5, fx: { hunterK: 0.75 } },
];

// Challenges: checked against the save's records; each pays once when you claim it.
// (ids are stable so they can map to Steam achievements later)
export const CHALLENGES = [
  { id: "d100", kind: "best", n: 100, reward: 60 },
  { id: "d200", kind: "best", n: 200, reward: 120 },
  { id: "escape1", kind: "escapes", n: 1, reward: 200 },
  { id: "escape5", kind: "escapes", n: 5, reward: 400 },
  { id: "king", kind: "boss", id2: "slime_king", n: 1, reward: 100 },
  { id: "golem", kind: "boss", id2: "golem", n: 1, reward: 200 },
  { id: "kills50", kind: "kills", n: 50, reward: 100 },
  { id: "events10", kind: "events", n: 10, reward: 80 },
  { id: "sets2", kind: "sets", n: 2, reward: 120 },
  { id: "beasts", kind: "beasts", n: 7, reward: 150 },
  { id: "gear3", kind: "gear", n: 3, reward: 120 },
  { id: "base", kind: "base", n: 12, reward: 300 },
  { id: "noTorch", kind: "noTorch", n: 1, reward: 250 },
];

Object.assign(STR.ko, {
  secretFound: "비밀의 방을 발견했어요!", crackHint: "벽 틈으로 바람이 새어 나와요… 뭔가 있을지도?",
  landmarks: { grotto: "빛나는 버섯 동굴", graveyard: "잊힌 묘지", camp: "버려진 광부 야영지", bones: "거대한 뼈 무덤", crystals: "수정 동굴" },
  lmFound: "발견: {name}",
  tabletTitle: "고대의 석판 · {n}/{m}", tabletAgain: "이미 읽은 이야기예요", close2: "닫기", lore: "이야기",
  sealHint: "봉인된 유물이 빛나고 있어요. 꺼내면 동굴이 무너질 거예요",
  evSeal: ["봉인된 유물", "받침대 위에서 심장처럼 맥동하는 돌. 꺼내는 순간 동굴이 무너질 거예요."],
  takeOpt: "꺼낸다 (보상 ×2, 대신 동굴이 무너져요!)", tookSeal: "동굴이 무너진다! 출구까지 달려!",
  sealBonus: "봉인된 유물 보너스 ×2",
  recSecrets: "비밀의 방", recLore: "읽은 석판",
  loreText: [
    "하람 마을은 빛수정 덕분에 번성했다. 땅을 파면 팔수록, 마을은 밝아졌다.",
    "광부들은 300척 아래에서 문을 발견했다. 손잡이도, 열쇠 구멍도 없는 돌문이었다.",
    "문 앞에는 글이 새겨져 있었다. '빛을 먹는 것이 잠들어 있다. 깨우지 마라.'",
    "촌장은 문을 다시 묻자고 했다. 하지만 문틈에서 새어 나오는 빛은 너무 아름다웠다.",
    "그날 밤, 누군가 문 옆의 심장석을 꺼냈다. 땅이 처음으로 울었다.",
    "다음 날 우물이 말랐다. 그다음 날엔 종탑이 기울었다. 마을이 가라앉고 있었다.",
    "광산의 대장장이는 돌로 수호자를 빚었다. 문을 지키라고. 다시는 아무도 내려가지 못하게.",
    "슬라임들은 무너진 마을의 잔해를 먹고 자랐다. 그중 하나는 왕관을 주워 썼다.",
    "남은 사람들은 심장석을 다시 받침대에 올려 봉인했다. 땅의 울음이 멎었다.",
    "하지만 마을은 이미 땅속에 있었다. 하늘은 이제 아주 먼 곳의 구멍일 뿐이었다.",
    "가장 깊은 곳의 문은 아직 닫혀 있다. 그 너머엔 가라앉은 도서관이 있다고 한다.",
    "이 석판을 읽는 너에게. 우리도 너처럼 빛을 따라 내려왔다. 문은 아래에 있다.",
  ],
  mats: { copper: "구리", iron: "철", crystal: "빛수정", gel: "슬라임 젤", wing: "박쥐 날개", bone: "뼛조각" },
  base: "거점",
  baseTabs: { fac: "시설", bench: "작업대", lab: "연구실", beasts: "몬스터 도감", lore: "이야기", rec: "기록·도전" },
  fac: { bench: "작업대", lab: "연구실", store: "보관함", museum: "전시실" },
  facDesc: {
    bench: "장비를 만들어요. 레벨이 오르면 더 좋은 장비와 장비 칸 2개",
    lab: "유물과 희귀 자원을 연구해 영구 효과를 얻어요",
    store: "탐험을 시작할 때 보급품을 챙겨 가요",
    museum: "유물을 전시해 코인 보너스를 받아요",
  },
  facLv: "Lv.{n}",
  facNext: { store: ["", "출발 시 나무 +2", "나무 +2, 물 +1", "나무 +3, 물 +1, 버섯 +1"], museum: ["", "코인 +5%", "코인 +10%", "코인 +15%"] },
  build: "짓기", upgrade: "강화", craft: "만들기", equip: "장착", unequip: "해제", equipped: "장착 중", made: "보유",
  research: "연구", researched: "완료",
  needTier: "{f} Lv.{n} 필요",
  needRelics: "유물 {n}종 필요", needBeasts: "몬스터 {n}종 발견 필요",
  slots: "장비 칸 {a}/{b}",
  gear: {
    steel_pick: ["강화 곡괭이", "파는 속도 ×1.5"],
    canteen: ["가죽 수통", "목마름 25% 천천히, 물 +1로 출발"],
    gel_boots: ["젤 장화", "점프 높이 +12%, 낙하 피해 덜 받음"],
    wide_lantern: ["확장 랜턴", "빛이 30% 천천히 닳고, 더 넓게 비춰요"],
    bone_mail: ["뼈 갑옷", "하트 +1"],
    detector: ["탐지기", "가까운 보물·이벤트·광석 방향을 알려 줘요"],
  },
  res: {
    farming: ["버섯 재배", "버섯 +1개 들고 출발"],
    filter: ["물 거르기", "웅덩이에서 물을 더 빨리 떠요"],
    refine: ["기름 정제", "기름병이 빛을 +15 더 채워요"],
    torchcraft: ["횃불 개량", "횃불 빛 범위 +30%"],
    camping: ["야영술", "모닥불에 돌이 1개 덜 들어요"],
    beastlore: ["몬스터 연구", "어둠 속 괴물이 25% 덜 나와요"],
  },
  beastNames: { bat: "동굴 박쥐", slime: "슬라임", gold_slime: "황금 슬라임", red_slime: "붉은 슬라임", skull: "불꽃 해골", slime_king: "슬라임 킹", golem: "고대 골렘" },
  beastDesc: {
    bat: "천장에 매달려 있다가 다가가면 날아와요. 빛을 싫어해요.",
    slime: "바닥을 왔다 갔다 해요. 위에서 밟으면 끝.",
    gold_slime: "보면 도망가요. 잡으면 코인이 쏟아져요.",
    red_slime: "눈치채면 달려들어요. 두 번 밟아야 해요.",
    skull: "조준한 뒤 일직선으로 돌진해요. 빛 속에선 돌진하지 않아요.",
    slime_king: "뛰어올랐다 내려찍으며 충격파를 보내요. 공중에 있으세요.",
    golem: "바닥을 내려치고 바위를 던져요. 빨간 선이 보이면 점프!",
  },
  unknownBeast: "아직 만나지 못한 몬스터",
  beastKills: "처치 {n}", beastFirst: "처음 본 곳 {d}m", beastDrops: "드롭",
  beastSeenAll: "모든 몬스터 발견", beastKillAll: "모든 몬스터 처치",
  rec: { runs: "탐험", best: "최고 깊이", time: "총 생존 시간", coins: "총 획득 코인", relics: "유물 수집률", beasts: "발견한 몬스터", kills: "처치한 몬스터", bosses: "쓰러뜨린 보스", escapes: "탈출 성공", deaths: "쓰러짐", fav: "가장 많이 쓴 것", events: "만난 이벤트" },
  ch: {
    d100: "100m 도달", d200: "200m 도달", escape1: "처음으로 탈출", escape5: "탈출 5번", king: "슬라임 킹 처치", golem: "고대 골렘 처치",
    kills50: "몬스터 50마리 처치", events10: "이벤트 10번 만나기", sets2: "유물 세트 2개 완성", beasts: "몬스터 7종 모두 발견",
    gear3: "장비 3개 만들기", base: "거점 시설 모두 최대 레벨", noTorch: "횃불 없이 100m 도달",
  },
  claim: "받기", claimed: "받음", challenges: "도전 과제",
  ev: {
    supply: ["버려진 보급실", "상자가 잔뜩 쌓인 방이에요."],
    cavein: ["무너진 통로", "통로가 무너졌어요! 파서 뚫거나 돌아가요."],
    altar: ["고대 제단", "무언가를 바치면 보답이 있을지도…"],
    merchant: ["떠돌이 상인", "\"어둠 속에선 뭐든 비싸지. 코인 있나?\""],
    cursed: ["저주받은 상자", "검은 기운이 새어 나와요. 열면 큰 보상이 있지만…"],
    vault: ["잠긴 보물상자", "무거운 자물쇠. 돌로 내려치면 부서질 것 같아요."],
    spring: ["맑은 샘", "차갑고 깨끗한 물이 솟아요."],
  },
  evOpt: {
    blood: "하트 1개 바치기 → 희귀 유물", offer: "버섯 2개 바치기 → 희귀 자원 2개",
    food: "버섯 2개", water: "물 2개", mend: "곡괭이 수리 +12", bombs: "폭탄 2개", oil: "랜턴 기름 가득", mats: "나무 3 + 돌 3", rare: "희귀 자원 1개",
    open: "열어 본다 (어둠과 괴물이 몰려와요)", break: "돌 4개로 부수기", drink: "마신다 (목마름 가득, 하트 +1)",
  },
  hintBomb: "B로 폭탄! 벽 너머 숨겨진 방을 날려 열 수 있어요", hintArrow: "화살 함정! 앞을 지나가면 화살이 날아와요",
  hintIdol: "황금 우상… 가져가면 무슨 일이 생길까?", boulderComing: "바위가 굴러온다!", hintCrumble: "발판이 무너진다!", hintTnt: "TNT! 건드리면 터져요",
  noBombs: "폭탄이 없어요",
  collapse: "동굴이 무너진다! 아래로 도망쳐!", collapseNear: "붕괴가 바로 위에!", collapseGap: "붕괴 ↑{d}m",
  pickBroken: "곡괭이가 망가졌어요! 상자나 상인에게서 고쳐요", pickLow: "곡괭이가 닳고 있어요", hintPickLow: "곡괭이가 거의 닳았어요! 꼭 필요한 곳만 파세요", pickM: "곡괭이", attack: "공격",
  hintWall: "벽에 붙어 미끄러지다가 점프하면 벽차기!", hintSwing: "X로 곡괭이를 휘둘러 공격!", hintSwingTouch: "공격 버튼으로 곡괭이를 휘둘러요!",
  crushed: "무너진 바위에 깔렸어요",
  leave: "떠나기", evFound: "발견: {name}", pressUp: "▲ 조사", look: "조사",
  evDone: { blood: "제단이 빛나며 유물을 내놓았어요!", offer: "제단 위에 희귀 자원이 나타났어요!", open: "저주가 풀려나요! 괴물이 몰려와요!", break: "자물쇠가 부서졌어요!", drink: "기운이 나요!", bought: "거래 완료" },
  gotMat: "+{n} {name}",
  matsHome: "가져온 희귀 자원",
  saveCorrupt: "저장 데이터가 손상돼 새로 시작해요 (백업 보관됨)",
});
Object.assign(STR.en, {
  secretFound: "You found a secret room!", crackHint: "Air seeps through a crack in the wall… something's behind it?",
  landmarks: { grotto: "Glowing Grotto", graveyard: "Forgotten Graveyard", camp: "Abandoned Miners' Camp", bones: "Great Bone Pit", crystals: "Crystal Cavern" },
  lmFound: "Found: {name}",
  tabletTitle: "Ancient Tablet · {n}/{m}", tabletAgain: "You've read this one", close2: "Close", lore: "Story",
  sealHint: "A sealed relic glows here. Take it and the cave will come down",
  evSeal: ["Sealed Relic", "A stone that pulses like a heart on its pedestal. Take it, and the cave will fall."],
  takeOpt: "Take it (rewards ×2, but the cave collapses!)", tookSeal: "The cave is collapsing! Run for the exit!",
  sealBonus: "Sealed relic bonus ×2",
  recSecrets: "Secret rooms", recLore: "Tablets read",
  loreText: [
    "Haram prospered on glowcrystal. The deeper it dug, the brighter the village grew.",
    "Three hundred feet down, the miners found a door: stone, with no handle and no keyhole.",
    "Words were carved before it. 'The light-eater sleeps here. Do not wake it.'",
    "The elder said to bury it again. But the light seeping through the seam was so beautiful.",
    "That night someone took the heart-stone from beside the door. The earth wept for the first time.",
    "The next day the well ran dry. The day after, the bell tower leaned. The village was sinking.",
    "The mine's smith shaped a guardian from stone, to keep the door, so no one would go down again.",
    "Slimes grew fat on the ruins. One of them found a crown and put it on.",
    "The survivors set the heart-stone back on its pedestal. The earth stopped weeping.",
    "But the village was already underground. The sky was now only a hole, very far away.",
    "The door at the bottom is still shut. Beyond it, they say, lies a sunken library.",
    "To you who reads this: we too followed the light down. The door is below.",
  ],
  mats: { copper: "Copper", iron: "Iron", crystal: "Glowcrystal", gel: "Slime Gel", wing: "Bat Wing", bone: "Bone Shard" },
  base: "Base",
  baseTabs: { fac: "Facilities", bench: "Workbench", lab: "Lab", beasts: "Bestiary", lore: "Story", rec: "Records" },
  fac: { bench: "Workbench", lab: "Lab", store: "Storehouse", museum: "Museum" },
  facDesc: {
    bench: "Make gear. Higher levels unlock better gear and a second slot",
    lab: "Study relics and rare materials for permanent perks",
    store: "Take supplies with you at the start of a dive",
    museum: "Display relics for a coin bonus",
  },
  facLv: "Lv.{n}",
  facNext: { store: ["", "Start with +2 wood", "+2 wood, +1 water", "+3 wood, +1 water, +1 mushroom"], museum: ["", "Coins +5%", "Coins +10%", "Coins +15%"] },
  build: "Build", upgrade: "Upgrade", craft: "Make", equip: "Equip", unequip: "Unequip", equipped: "Equipped", made: "Owned",
  research: "Study", researched: "Done",
  needTier: "Needs {f} Lv.{n}",
  needRelics: "Needs {n} relics", needBeasts: "Needs {n} monsters seen",
  slots: "Gear slots {a}/{b}",
  gear: {
    steel_pick: ["Steel Pickaxe", "Dig ×1.5 faster"],
    canteen: ["Leather Canteen", "Thirst 25% slower, start with +1 water"],
    gel_boots: ["Gel Boots", "Jump +12%, falls hurt less"],
    wide_lantern: ["Wide Lantern", "Light lasts 30% longer and reaches further"],
    bone_mail: ["Bone Mail", "+1 heart"],
    detector: ["Detector", "Points to nearby treasure, events and ore"],
  },
  res: {
    farming: ["Mushroom Farming", "Start with +1 mushroom"],
    filter: ["Water Filter", "Fill water faster at pools"],
    refine: ["Oil Refining", "Oil flasks fill +15 more light"],
    torchcraft: ["Better Torches", "Torch light +30%"],
    camping: ["Campcraft", "Campfires need 1 less stone"],
    beastlore: ["Monster Studies", "25% fewer creatures in the dark"],
  },
  beastNames: { bat: "Cave Bat", slime: "Slime", gold_slime: "Golden Slime", red_slime: "Red Slime", skull: "Flame Skull", slime_king: "Slime King", golem: "Ancient Golem" },
  beastDesc: {
    bat: "Hangs from the ceiling and swoops when you come near. Hates light.",
    slime: "Patrols the floor. Stomp it from above.",
    gold_slime: "Runs when it sees you. Catch it for a shower of coins.",
    red_slime: "Charges once it notices you. Takes two stomps.",
    skull: "Aims, then dashes straight at you. Won't dash into light.",
    slime_king: "Leaps and slams, sending a shockwave. Be in the air.",
    golem: "Slams the floor and throws boulders. Jump when the red line shows!",
  },
  unknownBeast: "Not met yet",
  beastKills: "Beaten {n}", beastFirst: "First seen {d}m", beastDrops: "Drops",
  beastSeenAll: "Every monster seen", beastKillAll: "Every monster beaten",
  rec: { runs: "Dives", best: "Deepest", time: "Time survived", coins: "Coins earned", relics: "Relics", beasts: "Monsters seen", kills: "Monsters beaten", bosses: "Bosses beaten", escapes: "Escapes", deaths: "Fallen", fav: "Most used", events: "Events met" },
  ch: {
    d100: "Reach 100m", d200: "Reach 200m", escape1: "First escape", escape5: "Escape 5 times", king: "Beat the Slime King", golem: "Beat the Ancient Golem",
    kills50: "Beat 50 monsters", events10: "Meet 10 events", sets2: "Complete 2 relic sets", beasts: "See all 7 monsters",
    gear3: "Make 3 pieces of gear", base: "Max out every facility", noTorch: "Reach 100m without a torch",
  },
  claim: "Claim", claimed: "Claimed", challenges: "Challenges",
  ev: {
    supply: ["Abandoned Supply Room", "A room stacked with crates."],
    cavein: ["Cave-in", "The passage collapsed! Dig through or go around."],
    altar: ["Ancient Altar", "Offer something, and it may answer…"],
    merchant: ["Wandering Merchant", "\"Everything costs more in the dark. Got coins?\""],
    cursed: ["Cursed Chest", "Dark smoke seeps out. A big reward inside, but…"],
    vault: ["Locked Strongbox", "A heavy lock. A few stones might break it."],
    spring: ["Clear Spring", "Cold, clean water wells up."],
  },
  evOpt: {
    blood: "Offer 1 heart → a rare relic", offer: "Offer 2 mushrooms → 2 rare materials",
    food: "2 mushrooms", water: "2 water", mend: "Mend pickaxe +12", bombs: "2 bombs", oil: "Fill the lantern", mats: "3 wood + 3 stone", rare: "1 rare material",
    open: "Open it (darkness and monsters come)", break: "Smash it with 4 stones", drink: "Drink (thirst full, +1 heart)",
  },
  hintBomb: "B throws a bomb! Blow open walls to find hidden rooms", hintArrow: "Arrow trap! Walk in front of it and it fires",
  hintIdol: "A golden idol… what happens if you take it?", boulderComing: "Here comes a boulder!", hintCrumble: "The planks are giving way!", hintTnt: "TNT! Touch it and it blows",
  noBombs: "No bombs left",
  collapse: "The cave is collapsing! Run down!", collapseNear: "The collapse is right above you!", collapseGap: "Collapse ↑{d}m",
  pickBroken: "Your pickaxe broke! Mend it with crates or the merchant", pickLow: "Your pickaxe is wearing out", hintPickLow: "Your pickaxe is nearly worn out! Dig only where you must", pickM: "Pick", attack: "Attack",
  hintWall: "Slide down a wall and jump to wall-jump!", hintSwing: "Press X to swing your pickaxe!", hintSwingTouch: "Tap Attack to swing your pickaxe!",
  crushed: "Crushed by the collapse",
  leave: "Leave", evFound: "Found: {name}", pressUp: "▲ Look", look: "Look",
  evDone: { blood: "The altar glows and gives up a relic!", offer: "Rare materials appear on the altar!", open: "The curse breaks loose! Here they come!", break: "The lock breaks!", drink: "You feel better!", bought: "Deal" },
  gotMat: "+{n} {name}",
  matsHome: "Rare materials",
  saveCorrupt: "Save data was damaged, starting fresh (a backup was kept)",
});

STR.ko.ev.seal = STR.ko.evSeal; STR.en.ev.seal = STR.en.evSeal;
STR.ko.ev.tablet = ["고대의 석판", ""]; STR.en.ev.tablet = ["Ancient Tablet", ""];
STR.ko.evOpt.take = STR.ko.takeOpt; STR.en.evOpt.take = STR.en.takeOpt;
STR.ko.evDone.take = STR.ko.tookSeal; STR.en.evDone.take = STR.en.tookSeal;
