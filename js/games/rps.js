// Rock Paper Scissors - show a fist, an open palm or two fingers to the phone camera. First to 3 rounds wins.
// Physical sensor: the hand camera. It reuses the same finger classifier as the hand twin:
//   fist = rock, open palm = paper, index + middle finger = scissors.
// Modes: against the computer, or two players on two phones.

import { W, H, C, text, circle, roundRect, P_COLOR } from "./engine.js";

const MOVE = { fist: "rock", palm: "paper", hover: "scissors" };
const BEATS = { rock: "scissors", paper: "rock", scissors: "paper" };
const WIN_AT = 3, COUNT = 0.7, SHOW = 1.0, REVEAL = 2.0;

export const roundWinner = (a, b) => (a === b ? 0 : !a ? 2 : !b ? 1 : BEATS[a] === b ? 1 : 2);

export default {
  id: "rps", title: "Rock Paper Scissors", icon: "hand", sensor: "hand",
  desc: "Show rock, paper or scissors to the camera. Best of five against the computer, or a friend.",
  modes: [{ id: "cpu", label: "vs computer", players: 1, scored: true }, { id: "duo", label: "2 players", players: 2, scored: false }],
  phone: "Start the camera. Show a fist (rock), open palm (paper) or two fingers (scissors) when the screen says Show.",
  howto: ["Wait for 3, 2, 1, then show your move to the camera.",
          "Fist is rock, open palm is paper, index and middle finger is scissors.",
          "A round with no clear hand shape is lost. First to 3 rounds wins.",
          "Keyboard: player 1 keys 1 2 3, player 2 keys 8 9 0."],

  init(g, mode) {
    return { phase: "count", t: 0, n: 3, round: 1, wins: [0, 0, 0], duo: mode.id === "duo", moves: [null, null, null], cpu: null,
             votes: [null, {}, {}], last: null, nextPhase: null };
  },

  update(g, s, dt) {
    s.t += dt;
    if (s.phase === "count") {
      const n = 3 - Math.floor(s.t / COUNT);
      if (n !== s.n && n > 0) g.sfx("tick");
      s.n = Math.max(0, n);
      if (s.t >= COUNT * 3) {
        s.phase = "show"; s.t = 0; s.votes = [null, {}, {}]; g.sfx("go");
        s.cpu = ["rock", "paper", "scissors"][Math.floor(Math.random() * 3)];          // chosen before the player shows anything
      }
    } else if (s.phase === "show") {
      for (const p of s.duo ? [1, 2] : [1]) {
        const i = g.input(p);
        if (i.hand && MOVE[i.gesture]) s.votes[p][i.gesture] = (s.votes[p][i.gesture] ?? 0) + 1;
      }
      if (s.t >= SHOW) {
        for (const p of [1, 2]) {
          const v = Object.entries(s.votes[p] ?? {}).sort((a, b) => b[1] - a[1])[0];
          s.moves[p] = v && v[1] >= 6 ? MOVE[v[0]] : null;                           // needs about 0.1 s of a steady shape
        }
        if (!s.duo) s.moves[2] = s.cpu;
        const w = roundWinner(s.moves[1], s.moves[2]);
        s.last = w;
        if (w) { s.wins[w]++; g.addScore(w === 2 && !s.duo ? 0 : w, 100); }
        g.sfx(w === 1 ? "good" : w === 2 ? "bad" : "tick");
        if (w) g.buzz(w, [60, 40, 60]);
        s.phase = "reveal"; s.t = 0;
      }
    } else if (s.phase === "reveal" && s.t >= REVEAL) {
      const champ = s.wins[1] >= WIN_AT ? 1 : s.wins[2] >= WIN_AT ? 2 : 0;
      if (champ) {
        if (champ === 1 || s.duo) g.addScore(champ, 200);
        return g.end({ title: s.duo ? `Player ${champ} wins` : champ === 1 ? "You win" : "Computer wins", win: s.duo ? true : champ === 1, winner: champ,
                       detail: `${s.wins[1]} - ${s.wins[2]}` });
      }
      s.round++; s.phase = "count"; s.t = 0; s.n = 3; s.moves = [null, null, null];
    }
  },

  draw(g, s) {
    const c = g.ctx, who = s.duo ? ["", "Player 1", "Player 2"] : ["", "You", "Computer"];
    for (const p of [1, 2]) {
      const cx = p === 1 ? W * 0.25 : W * 0.75;
      text(who[p], cx, 56, { size: 22, color: P_COLOR[p], align: "center" });
      for (let k = 0; k < WIN_AT; k++) circle(cx - 28 + k * 28, 86, 8, k < s.wins[p] ? P_COLOR[p] : null, k < s.wins[p] ? null : C.border2);
      // card
      roundRect(cx - 130, 130, 260, 300, 14, C.surface, s.phase === "reveal" && s.last === p ? C.ok : C.border2);
      const showMove = s.phase === "reveal" ? s.moves[p] : null;
      if (showMove) drawMove(c, showMove, cx, 270);
      else if (s.phase === "reveal") text("No move", cx, 280, { size: 24, color: C.text3, align: "center" });
      else {
        const live = p === 1 || s.duo ? g.input(p).hand : true;
        if (p === 2 && !s.duo) text(s.phase === "show" ? "Thinking" : "Ready", cx, 280, { size: 24, color: C.text3, align: "center" });
        else text(live ? "Hand ready" : "Show your hand", cx, 280, { size: 22, color: live ? C.ok : C.text3, align: "center" });
      }
      if (showMove) text(showMove.toUpperCase(), cx, 410, { size: 16, color: C.text2, align: "center" });
    }
    text(`Round ${s.round}`, W / 2, 56, { size: 16, color: C.text2, align: "center" });
    text("vs", W / 2, 285, { size: 22, color: C.text3, align: "center", base: "middle" });
    let msg = "";
    if (s.phase === "count") msg = s.n > 0 ? String(s.n) : "";
    else if (s.phase === "show") msg = "SHOW!";
    else msg = s.last === 0 ? "Draw" : `${who[s.last]} ${who[s.last] === "You" ? "win" : "wins"} the round`;
    text(msg, W / 2, 520, { size: s.phase === "count" ? 64 : 36, weight: 700, color: s.phase === "show" ? C.warn : C.text, align: "center", base: "middle" });
    if (s.phase === "show") { c.fillStyle = C.warn; c.fillRect(W / 2 - 140, 570, 280 * (1 - s.t / SHOW), 5); }
  },
};

function drawMove(c, move, x, y) {
  c.save(); c.translate(x, y); c.lineWidth = 6; c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = C.text; c.fillStyle = C.s3;
  if (move === "rock") {
    c.beginPath(); c.arc(0, 0, 70, 0, Math.PI * 2); c.fill(); c.stroke();
    c.lineWidth = 3; c.strokeStyle = C.text3;
    c.beginPath(); c.moveTo(-34, -20); c.lineTo(-10, -8); c.lineTo(8, -30); c.moveTo(-18, 30); c.lineTo(10, 18); c.lineTo(34, 30); c.stroke();
  } else if (move === "paper") {
    c.beginPath(); c.roundRect(-52, -70, 104, 140, 8); c.fill(); c.stroke();
    c.lineWidth = 3; c.strokeStyle = C.text3;
    for (let k = -40; k <= 40; k += 20) { c.beginPath(); c.moveTo(-30, k); c.lineTo(30, k); c.stroke(); }
  } else {
    for (const s of [-1, 1]) {
      c.save(); c.rotate(s * 0.32); c.beginPath(); c.roundRect(s * 16 - 11, -78, 22, 100, 10); c.fill(); c.stroke(); c.restore();
    }
    circle(0, 40, 17, C.s3, C.text, 6);
    circle(0, 40, 4, C.text);
  }
  c.restore();
}
