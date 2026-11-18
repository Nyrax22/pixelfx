// Designed rooms, Spelunky style: the cave is a grid of 12x8-tile rooms, four across. A path runs down through it
// (rooms on it always connect left and right; drops between them get a ladder), and the rooms off the path are vaults,
// trap rooms, stores and bat caves. Each template is hand-made; some cells are random, and any room may be mirrored.
//
//   .  air        #  dirt       ?  dirt half the time     =  brick (wood in the mine)    w  wooden ledge
//   _  crumbling planks          L  ladder                 ^  spikes                      > <  arrow trap facing right / left
//   C  chest      P  pot         X  TNT barrel             M  monster                     I  golden idol (boulder trap!)
//   G  gold in the rock          $  loose coins            m  mushroom    o  oil          ~  water pool

export const RW = 12, RH = 8;

export const PATH = [
  ["############", "####....####", "##........##", "............", "..M.........", "............", "....^^^.....", "############"],
  ["############", "##.......###", "#..........#", "............", "............", "............", "..>.....P...", "############"],
  ["############", "#..........#", "............", "............", "............", "............", "............", "###______###"],
  ["############", "###......###", "#..........#", "............", "...ww..ww...", "............", "..X..M...X..", "############"],
  ["############", "#....##....#", "#....##....#", "............", "......M.....", "....#..#....", ".P..#..#..P.", "############"],
  ["############", "##GG....GG##", "#..........#", "............", "..M......M..", "............", ".....$$.....", "#####??#####"],
  ["############", "#..........#", "#...wwww...#", "............", "............", "............", "..^^....^^..", "############"],
  ["############", "#..?....?..#", "............", "............", "............", "............", "..m..~..m...", "############"],
  ["############", "#..........#", "#..........#", "======.=====", "............", "............", "........<...", "############"],
  ["############", "##........##", "#..M.......#", "............", "...______...", "............", "..P...o..P..", "############"],
  ["############", "#....??....#", "#..........#", "...=....=...", "...=.C..=...", "...======...", "............", "############"],
  ["############", "#..........#", "#.X......X.#", "#.ww....ww.#", "............", "............", "....>..M....", "############"],
  // a chest on rotten planks over a spike pit: grab it, then jump before they give
  ["############", "#..........#", "#..........#", "......C.....", "....____....", "............", "............", "#####^^#####"],
  // treasure bricked in beside a barrel of TNT: blow it (and maybe yourself)
  ["############", "#.......=..#", "#......X=.C#", "........====", "............", "............", "..P.....M...", "############"],
];

export const SIDE = [
  // a bricked-up vault: bomb it or dig in
  ["############", "############", "###======###", "###=C..G=###", "###=.$$.=###", "###======###", "############", "############"],
  // the idol: take it and run
  ["############", "#..........#", "#..........#", "#..........#", "#....=I=....", "#....===....", "#...........", "############"],
  // a store room full of pots
  ["############", "############", "##........##", "##.P.PP.P.##", "##wwwwwwww##", "##.P..C.P...", "##..........", "############"],
  // a bat cave
  ["############", "#..........#", "#.M..M..M..#", "#..........#", "#..........#", "#....??....#", "#..P....P..#", "############"],
  // solid rock with a seam of gold
  ["############", "####????####", "###??GG??###", "##????????##", "###??????###", "####????####", "############", "############"],
  // powder store: don't swing in here
  ["############", "#..........#", "#..X.XX.X..#", "#.wwwwwwww.#", "#..........#", "#...C.......", "#...........", "############"],
  // a little spring
  ["############", "##........##", "#..........#", "#..........#", "#....m.....#", "#..........#", "...~....~...", "############"],
  // collapsed passage
  ["############", "#?????????##", "#??......??#", "??........??", "?..........?", "?...P..M....", "............", "############"],
  // arrow gallery guarding a chest
  ["############", "############", "############", "#<.......C.#", "#.wwwwwwww.#", "#...........", "#...........", "############"],
];

/** Mirror a template left-right (arrow traps turn round with it). */
export const mirror = (rows) => rows.map((r) => [...r].reverse().map((c) => (c === ">" ? "<" : c === "<" ? ">" : c)).join(""));

/**
 * Lay the room grid down. rows: the y of each room row (top tile); startCol: where the way in arrives.
 * Returns, for each row, the 4 room kinds ("path" / "side"), the column the path leaves downward from, and the template.
 */
export function planRows(R, rows, startCol) {
  const plan = [];
  let col = startCol;
  for (let r = 0; r < rows.length; r++) {
    const kinds = ["side", "side", "side", "side"];
    const entry = col;
    kinds[col] = "path";
    // wander sideways, then drop
    let dir = R.next() < 0.5 ? -1 : 1, steps = 0;
    while (steps++ === 0 ? R.next() < 0.85 : R.next() < 0.5) {
      if (col + dir < 0 || col + dir > 3) dir = -dir;
      col += dir;
      kinds[col] = "path";
    }
    plan.push({ y: rows[r], kinds, entry, exit: col });
  }
  return plan;
}
