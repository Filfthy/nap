// games/hearts.js - Hearts for Infernal Tricksters: the rules, the computer players and the card faces, all inside
// HEARTS (so nothing clashes with the other games' modules). The Infernal deck shows hearts as flames, spades as
// pentagrams, diamonds as tridents and clubs as horns; the cards themselves are ordinary.
//
// Standard rules: 52 cards (3 players: the 2 of diamonds out; 5: the 2s of diamonds and clubs out), all dealt.
// Pass three: left, right, across, then a hand without passing (4 players; otherwise left, right, none). The 2 of
// clubs (with it out, the 3) leads the first trick; follow suit if you can; the highest of the suit led wins. Each
// heart is 1 point, the queen of spades 13; no points on the first trick; hearts can't be led until broken. Take every
// point card ("shooting the moon") and everyone else scores 26 instead. Game to 100; lowest wins.

const HEARTS = (() => {
  const SUITS = ["C", "D", "S", "H"];
  const GLYPH = { S: "♠", H: "♥", D: "♦", C: "♣" };
  const SUIT_ORDER = { C: 0, D: 1, S: 2, H: 3 };                 // your hand, left to right
  const NAME = { 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10", 11: "J", 12: "Q", 13: "K", 14: "A" };
  const WORD = { 11: "jack", 12: "queen", 13: "king", 14: "ace" };
  // in words, in the Infernal suits ("the queen of pentagrams")
  const SUIT_WORD = SUIT_WORD_NOW, SUIT_ONE = SUIT_ONE_NOW;       // (games/suits.js: standard or Infernal names)
  const TARGET = 100;

  // ---- the rules ----
  //   passing      "lran" left, right, across, no pass (standard); "lra"; "lrn"; "lr"; "none" (across only with 4)
  //   lowClubLeads the 2 of clubs (or the lowest club in play) leads the first trick (off: the player left of dealer)
  //   noPointsFirst no hearts or queen of spades on the first trick (unless that's all you have)
  //   heartsBroken hearts can't be led until one has been played on another suit (unless that's all you have)
  //   moon         "others": shooting the moon gives everyone else 26; "minus": you score -26; "off"
  //   jackDiamonds the jack of diamonds is worth -10 (Omnibus Hearts)
  //   blackMaria   the ace of spades is 7 and the king 10, as well as the queen 13 (Black Maria)
  const DEFAULT_RULES = { passing: "lran", lowClubLeads: true, noPointsFirst: true, heartsBroken: true, moon: "others", jackDiamonds: false, blackMaria: false };
  function cleanRules(r) {
    const o = Object.assign({}, DEFAULT_RULES, r || {});
    for (const k of ["lowClubLeads", "noPointsFirst", "heartsBroken", "jackDiamonds", "blackMaria"]) o[k] = !!o[k];
    if (!["lr", "lrn", "lra", "lran", "none"].includes(o.passing)) o.passing = DEFAULT_RULES.passing;
    if (!["others", "minus", "off"].includes(o.moon)) o.moon = DEFAULT_RULES.moon;
    return o;
  }

  class Card {
    constructor(suit, rank) { this.suit = suit; this.rank = rank; this.value = rank; this.copy = 0; this.isSpecial = false; this.points = 0; }
  }
  const code = c => c.suit + c.rank;                                 // S12 = queen of spades
  const parse = s => new Card(s[0], +s.slice(1));
  function pointsOf(c, rules) {
    if (c.suit === "H") return 1;
    if (c.suit === "S" && c.rank === 12) return 13;
    if (rules.blackMaria && c.suit === "S" && c.rank === 14) return 7;
    if (rules.blackMaria && c.suit === "S" && c.rank === 13) return 10;
    if (rules.jackDiamonds && c.suit === "D" && c.rank === 11) return -10;
    return 0;
  }
  const isPointCard = (c, rules) => pointsOf(c, rules) > 0;
  function cardName(c) {
    if (c.suit === "S" && c.rank === 12) return "the queen of pentagrams";
    return c.rank > 10 ? `the ${WORD[c.rank]} of ${SUIT_WORD[c.suit]}` : `the ${c.rank} of ${SUIT_WORD[c.suit]}`;
  }
  function shortName(c) { return `${NAME[c.rank]} of ${SUIT_WORD[c.suit]}`; }

  function createDeck(n) {
    const d = [];
    for (const s of SUITS) for (let r = 2; r <= 14; r++) d.push(new Card(s, r));
    const out = n === 3 ? ["D2"] : n === 5 ? ["D2", "C2"] : n === 6 ? ["D2", "C2", "D3", "C3"] : [];
    return d.filter(c => !out.includes(code(c)));
  }
  const firstLead = hands => {     // the lowest club in play
    let best = null;
    hands.forEach((h, s) => h.forEach(c => { if (c.suit === "C" && (!best || c.rank < best.c.rank)) best = { s, c }; }));
    return best;
  };

  // what may be played: st = { plays, tricksPlayed, broken, firstCode }
  function legalIndices(cards, st, rules) {
    const all = cards.map((_, i) => i);
    const unlessOnly = (list, keep) => { const k = list.filter(keep); return k.length ? k : list; };
    let ok;
    if (!st.plays.length) {
      if (st.tricksPlayed === 0 && rules.lowClubLeads && st.firstCode) {
        const f = all.filter(i => code(cards[i]) === st.firstCode);
        if (f.length) return f;
      }
      ok = all;
      if (rules.heartsBroken && !st.broken) ok = unlessOnly(ok, i => cards[i].suit !== "H");
    } else {
      const lead = st.plays[0].card;
      ok = cards.some(c => c.suit === lead.suit) ? all.filter(i => cards[i].suit === lead.suit) : all;
    }
    if (rules.noPointsFirst && st.tricksPlayed === 0) ok = unlessOnly(ok, i => !isPointCard(cards[i], rules));
    return ok;
  }
  function refusalReason(cards, idx, st, rules) {
    if (legalIndices(cards, st, rules).includes(idx)) return "";
    const c = cards[idx];
    if (!st.plays.length && st.tricksPlayed === 0 && rules.lowClubLeads && st.firstCode && cards.some(x => code(x) === st.firstCode))
      return `You hold ${cardName(parse(st.firstCode))}, so you lead it to the first trick.`;
    if (st.plays.length) {
      const lead = st.plays[0].card;
      if (cards.some(x => x.suit === lead.suit) && c.suit !== lead.suit) return `You have ${SUIT_WORD[lead.suit]}, so you must follow with one.`;
    }
    if (rules.noPointsFirst && st.tricksPlayed === 0 && isPointCard(c, rules)) return "No points on the first trick (flames or the queen of pentagrams), while you have something else.";
    if (c.suit === "H" && !st.plays.length && rules.heartsBroken && !st.broken)
      return "Flames can't be led until they're broken: someone has to play a flame on a trick led with another suit.";
    return "You can't play that card now.";
  }
  const winnerIndex = cards => { let b = 0; for (let i = 1; i < cards.length; i++) if (cards[i].suit === cards[0].suit && cards[i].rank > cards[b].rank) b = i; return b; };

  const PASS_CYCLES = { lr: ["l", "r"], lrn: ["l", "r", "n"], lra: ["l", "r", "a"], lran: ["l", "r", "a", "n"], none: ["n"] };
  function passCycle(cycle, n) { const c = PASS_CYCLES[cycle] || PASS_CYCLES.lran; return n === 4 ? c : c.filter(x => x !== "a"); }
  function passOffset(roundIndex, n, cycle) { const c = passCycle(cycle, n), step = c[roundIndex % c.length]; return step === "l" ? 1 : step === "r" ? n - 1 : step === "a" ? 2 : 0; }
  function passWords(offset, n) { return offset === 0 ? "no pass" : offset === 1 ? "left" : offset === n - 1 ? "right" : "across"; }

  class Trick {
    constructor(leader, n) { this.leader = leader; this.numPlayers = n; this.plays = []; }
    addPlay(who, card) { this.plays.push({ who, card }); }
    isComplete() { return this.plays.length >= this.numPlayers; }
    winner() { return this.plays[winnerIndex(this.plays.map(p => p.card))].who; }
    get points() { return this.plays.reduce((a, p) => a + p.card.points, 0); }
  }

  class Game {
    constructor() { this.numPlayers = 4; this.phase = "idle"; this.roundIndex = -1; this.scores = []; this.history = []; this.hands = []; this.taken = []; this.takenCards = []; this.trickHistory = []; this.playedCards = []; this.rules = cleanRules(null); }
    startNewGame({ numPlayers = 4, firstDealer = 0, length = "full", presetRounds = null, rules = null } = {}) {
      this.numPlayers = numPlayers; this.rules = cleanRules(rules);
      this.target = length === "short" ? TARGET / 2 : TARGET;
      this.scores = new Array(numPlayers).fill(0); this.history = []; this.roundIndex = -1; this.dealer = firstDealer;
      this.presetRounds = presetRounds; this.phase = "idle"; this.hands = []; this.currentTrick = null;
      this.handSize = Math.floor(createDeck(numPlayers).length / numPlayers);
    }
    nextSeat(s) { return (s + 1) % this.numPlayers; }
    get totalRounds() { return 0; }
    startRound() {
      if (this.roundIndex >= 0) this.dealer = this.nextSeat(this.dealer);
      this.roundIndex++;
      const n = this.numPlayers, preset = this.presetRounds && this.presetRounds[this.roundIndex];
      if (preset) this.hands = preset.hands.map(codes => new Hand(codes.map(parse)));
      else {
        const deck = shuffle(createDeck(n));
        this.hands = [...Array(n)].map(() => new Hand([]));
        deck.forEach((c, i) => this.hands[(this.dealer + 1 + i) % n].add(c));
      }
      this.hands.forEach(h => h.cards.forEach(c => { c.points = pointsOf(c, this.rules); }));
      this.handSize = this.hands[0].cards.length;
      BACK_CREASE_SEED = (Math.random() * 4294967296) >>> 0;
      this.taken = new Array(n).fill(0); this.takenCards = [...Array(n)].map(() => []); this.tricksWon = new Array(n).fill(0);
      this.trickHistory = []; this.playedCards = []; this.tricksPlayed = 0; this.broken = false;
      this.passTo = passOffset(this.roundIndex, n, this.rules.passing);
      this.passes = new Array(n).fill(null); this.received = [...Array(n)].map(() => []);
      this.turn = null; this.currentTrick = null; this.phase = "pass";
      if (!this.passTo) this.beginPlay();
    }
    setPass(seat, indices) {
      if (this.phase !== "pass" || this.passes[seat] || indices.length !== 3 || new Set(indices).size !== 3) return { ok: false };
      this.passes[seat] = indices.map(i => this.hands[seat].cards[i]);
      if (this.passes.every(p => p)) this.applyPasses();
      return { ok: true };
    }
    applyPasses() {
      const n = this.numPlayers;
      for (let s = 0; s < n; s++) {
        for (const c of this.passes[s]) { const h = this.hands[s].cards; h.splice(h.indexOf(c), 1); }
        this.received[(s + this.passTo) % n] = this.passes[s].slice();
      }
      for (let s = 0; s < n; s++) this.received[s].forEach(c => this.hands[s].add(c));
      this.beginPlay();
    }
    beginPlay() {
      this.phase = "play";
      const f = firstLead(this.hands.map(h => h.cards));
      this.firstCode = f ? code(f.c) : null;
      this.turn = this.rules.lowClubLeads && f ? f.s : this.nextSeat(this.dealer);
      this.currentTrick = new Trick(this.turn, this.numPlayers);
    }
    get playState() { return { plays: this.currentTrick ? this.currentTrick.plays : [], tricksPlayed: this.tricksPlayed, broken: this.broken, firstCode: this.firstCode }; }
    getLegalMovesFor(seat) {
      if (this.phase !== "play" || seat !== this.turn) return [];
      return legalIndices(this.hands[seat].cards, this.playState, this.rules);
    }
    refusalReason(seat, idx) { return refusalReason(this.hands[seat].cards, idx, this.playState, this.rules); }
    playCard(seat, index) {
      if (!this.getLegalMovesFor(seat).includes(index)) return { ok: false };
      const card = this.hands[seat].removeAt(index);
      this.currentTrick.addPlay(seat, card); this.playedCards.push(card);
      if (card.suit === "H" && this.currentTrick.plays[0].card.suit !== "H") this.broken = true;
      if (this.currentTrick.isComplete()) return { ok: true, card, trickComplete: true };
      this.turn = this.nextSeat(seat);
      return { ok: true, card, trickComplete: false };
    }
    resolveCompletedTrick() {
      const t = this.currentTrick, winner = t.winner(), pts = t.points;
      this.taken[winner] += pts; this.tricksWon[winner]++;
      t.plays.forEach(p => { if (p.card.points) this.takenCards[winner].push(p.card); });
      this.trickHistory.push({ leader: t.leader, plays: t.plays.slice(), winner, points: pts });
      this.tricksPlayed++;
      const plays = t.plays.slice();
      if (this.hands[0].cards.length === 0) { this.finishRound(); return { winner, plays, points: pts, roundOver: true }; }
      this.turn = winner; this.currentTrick = new Trick(winner, this.numPlayers);
      return { winner, plays, points: pts, roundOver: false };
    }
    // the number of point cards (positive) in the pack, for shooting the moon
    get pointCardCount() { return 13 + 1 + (this.rules.blackMaria ? 2 : 0); }
    finishRound() {
      const n = this.numPlayers, need = this.pointCardCount;
      const counts = this.takenCards.map(cs => cs.filter(c => c.points > 0).length);
      const shooter = this.rules.moon !== "off" ? counts.findIndex(k => k === need) : -1;
      const full = this.taken.slice();
      let points = full.slice();
      if (shooter >= 0) {
        const moonPts = full[shooter] - (this.rules.jackDiamonds ? this.takenCards[shooter].filter(c => c.points < 0).reduce((a, c) => a + c.points, 0) : 0);
        const jd = full[shooter] - moonPts;   // (the jack of diamonds still counts for the shooter)
        points = this.rules.moon === "minus" ? full.map((p, s) => s === shooter ? -moonPts + jd : p)
                                             : full.map((p, s) => s === shooter ? jd : p + moonPts);
      }
      for (let s = 0; s < n; s++) this.scores[s] += points[s];
      this.history.push({ round: this.roundIndex + 1, points, taken: full, totals: this.scores.slice(), sweeper: shooter,
        spiders: this.takenCards.map(cs => cs.filter(c => c.suit === "S" && c.rank === 12).length) });
      this.currentTrick = null; this.turn = null;
      this.phase = this.scores.some(v => v >= this.target) ? "gameOver" : "roundEnd";
    }
    get leaders() { const lo = Math.min(...this.scores); return this.scores.map((v, s) => v === lo ? s : -1).filter(s => s >= 0); }
  }

  // ---------------------------------------------------------------- the computer players
  //   easy: medium's rules of thumb without watching the table, and now and then a careless card
  //   medium: passes the queen, ace and king of spades (unless it has plenty of spades to hide them in), high hearts
  //           and cards from a short suit; leads low, never a spade honour while the queen is out; ducks; when it
  //           can't follow, dumps the queen, then high hearts, then its highest card; stops someone shooting the moon
  //   hard: tries each card it may play and plays the rest of the hand out many times with guessed hands for the
  //         others (fitting the suits they've shown they lack, and the cards it passed), keeping the cheapest
  const T = { samples: 70, easyRandom: 0.15 };
  function tableInfo(g) {
    const n = g.numPlayers, void_ = [...Array(n)].map(() => new Set()), pc = new Array(n).fill(0);
    const tricks = (g.trickHistory || []).concat(g.currentTrick && g.currentTrick.plays.length ? [{ plays: g.currentTrick.plays, winner: -1 }] : []);
    for (const t of tricks) {
      const lead = t.plays[0].card;
      for (const p of t.plays.slice(1)) if (p.card.suit !== lead.suit) void_[p.who].add(lead.suit);
      if (t.winner >= 0) pc[t.winner] += t.plays.filter(p => p.card.points > 0).length;
    }
    const queenOut = (g.playedCards || []).some(c => c.suit === "S" && c.rank === 12) || (g.currentTrick && g.currentTrick.plays.some(p => p.card.suit === "S" && p.card.rank === 12));
    return { void_, pc, queenGone: queenOut, moon: g.rules.moon !== "off", need: g.pointCardCount };
  }
  function danger(c, hand) {
    if (c.suit === "S" && c.rank === 12) return 100;
    if (c.points < 0) return -50;                                   // the jack of diamonds: keep it
    if (c.suit === "S" && c.rank >= 13) return 60 + c.rank;         // what catches the queen
    if (c.suit === "H") return 20 + c.rank * 2;
    const same = hand.filter(x => x.suit === c.suit).length;
    return c.rank + (same <= 2 ? 4 : 0);
  }
  function passChoice(hand) {
    const left = hand.slice(), out = [];
    const take = c => { out.push(c); left.splice(left.indexOf(c), 1); };
    while (out.length < 3) {
      const spades = left.filter(c => c.suit === "S").length;
      let best = null, bestV = -Infinity;
      for (const c of left) {
        let v;
        if (c.suit === "S" && c.rank >= 12) v = spades >= 5 ? 5 : 90 + c.rank;          // with plenty of spades, hide them
        else if (c.points < 0) v = -100;
        else if (c.suit === "H") v = c.rank * 3 + (c.rank >= 11 ? 20 : 0);
        else {
          const k = left.filter(x => x.suit === c.suit).length;
          v = c.rank * 2 + (k <= 2 ? (3 - k) * 15 : 0);                       // empty a short suit
          if (c.suit === "C" && c.rank === 2) v = -20;
        }
        if (v > bestV) { bestV = v; best = c; }
      }
      take(best);
    }
    return out.map(c => hand.indexOf(c));
  }
  function mediumPlay(hand, legal, plays, n, info, me) {
    const voidAnyone = s => info ? info.void_.some((v, p) => p !== me && v.has(s)) : false;
    const queenGone = info ? info.queenGone : false;
    if (!plays.length) {
      const score = c => c.rank + (c.suit === "H" ? 6 : 0) + (voidAnyone(c.suit) ? 12 : 0)
        + (c.suit === "S" && c.rank >= 12 && !queenGone ? 40 : 0) + (c.suit === "S" && c.rank < 12 && !queenGone && !hand.some(x => x.suit === "S" && x.rank >= 12) ? -4 : 0)
        - hand.filter(x => x.suit === c.suit).length;
      return legal.reduce((a, b) => score(hand[b]) < score(hand[a]) ? b : a);
    }
    const lead = plays[0].card;
    const bestRank = Math.max(...plays.filter(p => p.card.suit === lead.suit).map(p => p.card.rank));
    const trickPts = plays.reduce((a, p) => a + p.card.points, 0);
    const last = plays.length === n - 1;
    const wins = c => c.suit === lead.suit && c.rank > bestRank;
    const safe = legal.filter(i => !wins(hand[i])), winning = legal.filter(i => wins(hand[i]));
    const pts = i => hand[i].points;
    const cheapest = (arr, high) => arr.reduce((a, b) => (pts(b) < pts(a) || (pts(b) === pts(a) && (high ? hand[b].rank > hand[a].rank : hand[b].rank < hand[a].rank))) ? b : a);
    // someone is shooting the moon: they hold every point card taken so far - take a point off them
    if (info && info.moon && winning.length) {
      const total = info.pc.reduce((a, b) => a + b, 0), shooter = info.pc.findIndex(k => k === total);
      if (total >= Math.ceil(info.need * 0.6) && shooter >= 0 && shooter !== me && plays.some(p => p.card.points > 0) && trickPts < 16) return cheapest(winning, true);
    }
    if (winning.length && trickPts < 0 && last) return cheapest(winning, true);     // the jack of diamonds, nothing bad
    if (safe.length) {
      if (last && trickPts === 0 && winning.length) {
        const free = winning.filter(i => pts(i) <= 0 && !(hand[i].suit === "S" && hand[i].rank >= 13 && !queenGone));
        if (free.length && lead.suit !== "S") return cheapest(free, true);
      }
      return safe.reduce((a, b) => danger(hand[b], hand) > danger(hand[a], hand) ? b : a);
    }
    return cheapest(winning, last);
  }
  function dealGuess(unseen, counts, me, myCards, to, passed, voids) {
    const n = counts.length;
    for (let attempt = 0; attempt < 20; attempt++) {
      const pool = shuffle(unseen.slice());
      const hands = [...Array(n)].map((_, s) => s === me ? myCards.slice() : (s === to ? passed.slice() : []));
      const order = [...Array(n).keys()].filter(s => s !== me).sort((a, b) => voids[b].size - voids[a].size);
      let ok = true;
      for (const s of order) {
        for (let i = pool.length - 1; i >= 0 && hands[s].length < counts[s]; i--) if (!voids[s].has(pool[i].suit)) hands[s].push(pool.splice(i, 1)[0]);
        if (hands[s].length < counts[s]) { ok = false; break; }
      }
      if (ok) return hands;
    }
    const pool = shuffle(unseen.slice());
    return [...Array(n)].map((_, s) => { if (s === me) return myCards.slice(); const h = s === to ? passed.slice() : []; while (h.length < counts[s]) h.push(pool.pop()); return h; });
  }
  function playOut(g, handsIn, me, first, voidsIn) {
    const n = g.numPlayers, rules = g.rules, hands = handsIn.map(h => h.slice());
    let plays = g.currentTrick.plays.map(p => ({ who: p.who, card: p.card }));
    let turn = me, tricksPlayed = g.tricksPlayed, firstMove = true, broken = g.broken;
    const pts = g.taken.slice(), base = tableInfo(g);
    const info = { void_: voidsIn.map(v => new Set(v)), pc: base.pc.slice(), queenGone: base.queenGone, moon: base.moon, need: base.need };
    let guard = 0;
    while (guard++ < 400) {
      const h = hands[turn];
      if (!h.length) break;
      const legal = legalIndices(h, { plays, tricksPlayed, broken, firstCode: g.firstCode }, rules);
      const i = firstMove ? first : legal.length === 1 ? legal[0] : mediumPlay(h, legal, plays, n, info, turn);
      firstMove = false;
      const played = h.splice(i, 1)[0];
      if (plays.length && played.suit !== plays[0].card.suit) info.void_[turn].add(plays[0].card.suit);
      if (played.suit === "H" && plays.length && plays[0].card.suit !== "H") broken = true;
      if (played.suit === "S" && played.rank === 12) info.queenGone = true;
      plays.push({ who: turn, card: played });
      if (plays.length === n) {
        const w = plays[winnerIndex(plays.map(p => p.card))].who;
        pts[w] += plays.reduce((a, p) => a + p.card.points, 0);
        info.pc[w] += plays.filter(p => p.card.points > 0).length;
        plays = []; tricksPlayed++; turn = w;
      } else turn = (turn + 1) % n;
    }
    const shooter = rules.moon !== "off" ? info.pc.findIndex(k => k === base.need) : -1;
    if (shooter >= 0) return shooter === me ? -26 : 26 + pts[me];
    return pts[me];
  }
  class AI {
    constructor({ difficulty = "medium" } = {}) { this.difficulty = difficulty; }
    setDifficulty(d) { this.difficulty = d; }
    resetMemory() {}
    choosePass(hand) {
      if (this.difficulty === "easy") { const idx = hand.map((c, i) => i); return idx.sort((a, b) => danger(hand[b], hand) - danger(hand[a], hand)).slice(0, 3); }
      return passChoice(hand);
    }
    choosePlay(ctx) {
      if (ctx.legal.length === 1) return ctx.legal[0];
      if (this.difficulty === "easy") {
        if (Math.random() < T.easyRandom) return ctx.legal[Math.floor(Math.random() * ctx.legal.length)];
        return mediumPlay(ctx.hand, ctx.legal, ctx.plays, ctx.numPlayers, null, ctx.seat);
      }
      if (this.difficulty === "hard" && ctx.game) return this.lookAhead(ctx);
      return mediumPlay(ctx.hand, ctx.legal, ctx.plays, ctx.numPlayers, ctx.game ? tableInfo(ctx.game) : null, ctx.seat);
    }
    lookAhead(ctx) {
      const g = ctx.game, me = ctx.seat, n = g.numPlayers, info = tableInfo(g);
      const inPlay = new Set([...g.playedCards, ...g.currentTrick.plays.map(p => p.card)].map(code));
      const mine = new Set(g.hands[me].cards.map(code));
      const to = (me + g.passTo) % n;
      const passed = (g.passes[me] || []).filter(c => !inPlay.has(code(c)));
      const passedSet = new Set(passed.map(code));
      const unseen = createDeck(n).filter(c => { const k = code(c); return !inPlay.has(k) && !mine.has(k) && !passedSet.has(k); });
      unseen.forEach(c => { c.points = pointsOf(c, g.rules); });
      const counts = g.hands.map(h => h.cards.length), cost = new Map(ctx.legal.map(i => [i, 0]));
      for (let k = 0; k < T.samples; k++) {
        const hands = dealGuess(unseen, counts, me, g.hands[me].cards, g.passTo ? to : -1, g.passTo ? passed : [], info.void_);
        for (const i of ctx.legal) cost.set(i, cost.get(i) + playOut(g, hands, me, i, info.void_));
      }
      let best = ctx.legal[0];
      for (const i of ctx.legal) if (cost.get(i) < cost.get(best)) best = i;
      return best;
    }
  }

  // ---------------------------------------------------------------- the card faces: standard suits (red and black,
  // the court cards from art/standard-courts, pips laid out as on any pack) or Oh Hell's Infernal deck
  const INF_SUIT = { S: "pentagrams", H: "flames", D: "tridents", C: "horns" };
  const STD_SUIT = { S: "spades", H: "hearts", D: "diamonds", C: "clubs" };
  const COLOR_CLASS = { S: "s-spade", H: "s-heart", D: "s-diamond", C: "s-club" };
  const mark = s => suitSymbol(s);
  // where the pips go on 2-10 (x, y in % of the card), as on a usual pack
  const pL = 31, pC = 50, pR = 69, pT = 21, pB = 79, pM = 50, pTM = 35.5, pBM = 64.5;
  const PIPS = {
    2: [[pC, pT], [pC, pB]], 3: [[pC, pT], [pC, pM], [pC, pB]], 4: [[pL, pT], [pR, pT], [pL, pB], [pR, pB]],
    5: [[pL, pT], [pR, pT], [pC, pM], [pL, pB], [pR, pB]], 6: [[pL, pT], [pR, pT], [pL, pM], [pR, pM], [pL, pB], [pR, pB]],
    7: [[pL, pT], [pR, pT], [pC, pTM], [pL, pM], [pR, pM], [pL, pB], [pR, pB]],
    8: [[pL, pT], [pR, pT], [pC, pTM], [pL, pM], [pR, pM], [pC, pBM], [pL, pB], [pR, pB]],
    9: [[pL, pT], [pR, pT], [pL, 40.3], [pR, 40.3], [pC, pM], [pL, 59.7], [pR, 59.7], [pL, pB], [pR, pB]],
    10: [[pL, pT], [pR, pT], [pC, 30.7], [pL, 40.3], [pR, 40.3], [pL, 59.7], [pR, 59.7], [pC, 69.3], [pL, pB], [pR, pB]],
  };
  class CardView {
    cardColorClass(card) { return COLOR_CLASS[card.suit] || ""; }
    crease(div, h) {
      const r = k => (h = (Math.imul(h, 1103515245) + 12345) >>> 0) % k;
      const roll = r(100);
      if (roll >= 17) return;
      div.dataset.crease = String(roll < 6 ? 5 + r(2) : [0, 1, 2, 3, 4, 7][r(6)]);
      div.style.setProperty("--crease-x", r(2) ? "-1" : "1"); div.style.setProperty("--crease-y", r(2) ? "-1" : "1");
    }
    inkTop(img) { const t = img.cloneNode(); t.classList.add("ink-top"); return t; }
    createCardElement(card, options = {}) {
      const div = document.createElement("div");
      div.className = "card small";
      div._card = card || null;
      if (options.clickable) div.classList.add("clickable");
      if (options.back) {
        div.classList.add("back");
        if (card) { let h = 11; for (const ch of code(card)) h = (h * 37 + ch.charCodeAt(0)) >>> 0; this.crease(div, (h ^ BACK_CREASE_SEED) >>> 0); }
        return div;
      }
      if (!card) return div;
      // the Standard style is an ordinary pack's faces (the Goodall double-headed courts, both indices, the ornate ace
      // of spades) on either card stock; "plain" is the white stock (any style but Infernal): no paper, wear or creases.
      // Napoleonic and Painted put their own court figures on whichever stock it is.
      const classic = DECK_STYLE === "standard";
      const plain = SUIT_STYLE === "standard" && FACE_STYLE === "plain";
      let h = 7; for (const ch of code(card)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      if (!plain) {
        div.dataset.paper = String(h % 8);
        div.dataset.wear = String((h >>> 4) % 6); div.style.setProperty("--wear-x", (h >>> 9) & 1 ? "-1" : "1"); div.style.setProperty("--wear-y", (h >>> 10) & 1 ? "-1" : "1");
        this.crease(div, (h ^ CREASE_SEED) >>> 0);
      }
      const rank = NAME[card.rank], cc = this.cardColorClass(card);
      for (const cls of ["corner", "corner bottom"]) {
        const k = document.createElement("div");
        k.className = cls + " " + cc;
        k.innerHTML = `<span class="rank${rank === "10" ? " ten" : ""}">${rank}</span><span class="suit">${mark(card.suit)}</span>`;
        div.appendChild(k);
      }
      const jumbo = document.createElement("div");
      jumbo.className = "jumbo-pip " + cc; jumbo.innerHTML = mark(card.suit);
      div.appendChild(jumbo);
      const center = document.createElement("div");
      center.className = "face-icon " + cc;
      center.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%";
      div.classList.add("inf-court-card");
      const art = /^[AJQK]$/.test(rank);
      if (!art) div.classList.add("inf-num");
      if (rank === "A" && SUIT_STYLE === "infernal") div.classList.add("inf-ace", "inf-ace-" + INF_SUIT[card.suit]);
      if (classic || plain) {
        // an ordinary pack: the traditional double-headed courts (court/KH.svg etc., Goodall & Son, CC0), indices at
        // both corners, the ornate ace of spades
        div.classList.remove("inf-court-card", "inf-num");
        div.classList.add("std-card", "classic-card");
        if (plain) div.classList.add("plain-card");
        if (/^[JQK]$/.test(rank) && !classic) {
          // the Napoleonic or Painted court on white card: the figure printed on it, as on the parchment
          div.classList.add("inf-court-card");
          center.innerHTML = `<div class="inf-court std-court"><img src="img/${DECK_STYLE === "napoleonic" ? "nap" : "std"}/${rank}-${STD_SUIT[card.suit]}.webp?v=3" alt="" draggable="false"></div>`;
        } else if (/^[JQK]$/.test(rank)) {
          center.innerHTML = `<div class="royal-inset"><img class="royal-inset-img" src="court/${rank}${card.suit}.svg" alt="" draggable="false"></div>`;
        } else if (rank === "A") {
          center.innerHTML = card.suit === "S" ? `<img class="ace-spade-svg" src="spade.svg" alt="" draggable="false">`
            : `<span class="std-pip std-ace" style="left:50%;top:50%">${SUIT_GLYPH[card.suit]}</span>`;
        } else {
          center.innerHTML = PIPS[card.rank].map(([x, y]) => `<span class="std-pip${y > 50 ? " flip" : ""}" style="left:${x}%;top:${y}%">${SUIT_GLYPH[card.suit]}</span>`).join("");
        }
        div.appendChild(center);
      } else if (SUIT_STYLE === "standard") {
        div.classList.add("std-card");
        if (/^[JQK]$/.test(rank)) {
          // the court cards: the figure on the parchment, as the Infernal woodcuts are
          const frame = document.createElement("div");
          frame.className = "inf-court std-court";
          const img = document.createElement("img");
          // (in the Napoleonic style, its own court: France on spades, Britain on hearts, Russia on diamonds,
          // Austria on clubs - art/napoleonic-courts)
          const courts = DECK_STYLE === "napoleonic" ? "nap" : "std";
          img.src = `img/${courts}/${rank}-${STD_SUIT[card.suit]}.webp?v=3`; img.alt = ""; img.draggable = false;
          frame.appendChild(img); frame.appendChild(this.inkTop(img));
          center.appendChild(frame);
        } else if (rank === "A") {
          div.classList.remove("inf-ace");
          center.innerHTML = `<span class="std-pip std-ace" style="left:52%;top:50%">${SUIT_GLYPH[card.suit]}</span>`;
        } else {
          center.innerHTML = PIPS[card.rank].map(([x, y]) => `<span class="std-pip${y > 50 ? " flip" : ""}" style="left:${x}%;top:${y}%">${SUIT_GLYPH[card.suit]}</span>`).join("");
        }
        div.appendChild(center);
      } else {
      const frame = document.createElement("div");
      frame.className = "inf-court";
      const img = document.createElement("img");
      img.src = art ? `img/inf-${rank}-${INF_SUIT[card.suit]}.webp` : `img/infpips/${rank}-${INF_SUIT[card.suit]}.svg?v=2`;
      img.alt = ""; img.draggable = false;
      frame.appendChild(img); frame.appendChild(this.inkTop(img));
      center.appendChild(frame); div.appendChild(center);
      }
      if (card.points) div.title = `${shortName(card)}: ${card.points > 0 ? card.points + " point" + (card.points === 1 ? "" : "s") : card.points + " (good)"}`;
      return div;
    }
  }

  // hand order: clubs, diamonds, spades, hearts (horns, tridents, pentagrams, flames); low to high
  const sortCards = (a, b) => (SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit]) || (a.rank - b.rank);

  // ---------------------------------------------------------------- the words: Rules tab, How to play, tutorial
  const passingWords = cycle => {
    const names = { l: "left", r: "right", a: "across", n: "no passing" };
    const list = c => c.map(x => names[x]).join(", ");
    if (cycle === "none") return "never: there's no passing";
    return `${list(passCycle(cycle, 4))}, and round again`;
  };
  const ruleNotes = r => ({
    passing: `Passing goes ${passingWords(r.passing)}.`,
    lowClubLeads: r.lowClubLeads ? "Whoever holds the 2 of horns leads it to the first trick." : "The player to the dealer's left leads the first trick, with any card.",
    noPointsFirst: r.noPointsFirst ? "No flames and no queen of pentagrams on the first trick, unless you have nothing else." : "Point cards may be played on the first trick.",
    heartsBroken: r.heartsBroken ? "Flames can't be led until they're broken: someone plays a flame on a trick led with another suit. (With nothing but flames, you may lead one.)" : "Flames may be led at any time.",
    moon: r.moon === "others" ? "Take every point card (shoot the moon) and you score 0, and everyone else scores 26." : r.moon === "minus" ? "Take every point card (shoot the moon) and you score −26." : "No shooting the moon: every point card just scores its points.",
    blackMaria: r.blackMaria ? "Black Maria: the ace of pentagrams is 7 points and the king 10, as well as the queen 13." : "Only the queen of pentagrams (13) and the flames (1 each) score.",
    jackDiamonds: r.jackDiamonds ? "The jack of tridents is worth −10: good to take." : "The jack of tridents is just a card.",
  });
  const rulesSpec = [
    { key: "passing", label: "Passing", options: [
      ["lran", "Left, right, across, none", "Left, right, across the table, then a hand with no passing"],
      ["lra", "Left, right, across", "Left, right, then across the table"],
      ["lrn", "Left, right, none", "Left, right, then a hand with no passing"],
      ["lr", "Left, right", "Left one hand, right the next"],
      ["none", "No passing", "Nobody passes: you play the hand you're dealt"]] },
    { key: "lowClubLeads", label: "First card", options: [
      [true, "2 of horns leads", "Whoever holds the 2 of horns leads it to the first trick"],
      [false, "Any card", "The player to the dealer's left leads the first trick with any card"]] },
    { key: "noPointsFirst", label: "First trick", options: [
      [true, "No points", "No flames or queen of pentagrams on the first trick, unless you have nothing else"],
      [false, "Points allowed", "Point cards may be played on the first trick"]] },
    { key: "heartsBroken", label: "Leading flames", options: [
      [true, "Once broken", "Flames can't be led until one has been played on a trick led with another suit"],
      [false, "Any time", "Flames may be led at any time"]] },
    { key: "moon", label: "Shooting the moon", options: [
      ["others", "Others +26", "Take every point card: you score 0, everyone else 26"],
      ["minus", "You −26", "Take every point card: you score −26"],
      ["off", "Off", "No shooting the moon"]] },
    { key: "blackMaria", label: "Pentagrams", options: [
      [false, "Queen only", "Only the queen of pentagrams scores (13)"],
      [true, "Black Maria", "The ace of pentagrams scores 7 and the king 10, as well as the queen 13"]] },
    { key: "jackDiamonds", label: "Jack of tridents", options: [
      [false, "Just a card", "The jack of tridents scores nothing"],
      [true, "−10", "The jack of tridents is worth −10 (Omnibus Hearts)"]] },
  ];
  const howTo = r => {
    const n = ruleNotes(r);
    const house = rulesSpec.filter(s => s.key !== "passing" && r[s.key] !== DEFAULT_RULES[s.key]).map(s => s.label);
    const total = 26 + (r.blackMaria ? 17 : 0);
    return `
        <h3>How to play</h3>
        <ul>
          ${SUIT_STYLE === "infernal" ? `<li>Hearts, played with the Infernal cards: hearts are <strong>flames</strong>, spades <strong>pentagrams</strong>, diamonds <strong>tridents</strong> and clubs <strong>horns</strong>.</li>` : ""}
          <li>Everyone is dealt the whole pack. Pass three cards, then play tricks, taking as few points as you can: the flames and the <strong>queen of pentagrams</strong>.</li>
          <li>The <strong>Tutorial</strong> plays one hand with you, step by step.</li>
        </ul>
        <h3>Rules</h3>
        <ul>
          <li>4 players, 13 cards each.</li>
          <li><strong>Passing</strong><br>Before each hand everyone passes three cards, face down. ${n.passing}</li>
          <li><strong>Playing</strong><br>${n.lowClubLeads} Follow the suit led if you can; if you can't, play anything. The highest card of the suit led wins the trick, and its winner leads next. There are no trumps.${r.noPointsFirst ? ` <strong>No points on the first trick</strong>, unless you have nothing else.` : ""}${r.heartsBroken ? ` <strong>Flames can't be led until they're broken</strong>.` : ""}</li>
          <li><strong>Scoring</strong><br>Each flame you take is 1 point, the queen of pentagrams 13${r.blackMaria ? ", the king of pentagrams 10 and the ace 7" : ""}${r.jackDiamonds ? "; the jack of tridents is −10" : ""}. Every hand has ${total} points in it.</li>
          <li><strong>Shooting the moon</strong><br>${n.moon}</li>
          <li>The game ends when someone reaches ${TARGET} (or ${TARGET / 2} in a short game). Lowest total wins.</li>
        </ul>
        <h3>House rules</h3>
        <ul><li>Chosen in the <strong>Rules</strong> tab before a game. ${house.length ? `In use: <strong>${house.join(", ")}</strong>.` : "None in use: these are the standard rules."}</li></ul>
        <h3>Tips</h3>
        <ul>
          <li>Pass the queen of pentagrams, and the king and ace too unless you have plenty of pentagrams to hide them among.</li>
          <li>Empty a short suit when you pass: then you can throw away your worst cards whenever it's led.</li>
          <li>Keep low cards to duck under the winning card.</li>
        </ul>`;
  };
  // the tutorial: seats 0 you, 1 Persephone (left), 2 Bub (across), 3 Lilith (right); this hand passes left
  const tutorial = {
    opponents: ["Persephone", "Bub", "Lilith"],
    firstDealer: 3,
    intro: ["Welcome to <b>Hearts</b>: take as <b>few points</b> as you can. Let's play a hand."],
    rounds: [{
      hands: [
        ["C2", "C6", "C9", "C13", "D8", "D14", "S4", "S12", "S14", "H5", "H11", "H13", "H14"],
        ["C10", "C4", "C7", "D12", "D2", "D6", "D10", "S9", "S2", "S10", "H10", "H9", "H2"],
        ["C12", "C5", "C11", "D9", "D3", "D11", "D13", "S11", "S3", "S7", "H8", "H6", "H3"],
        ["C3", "C8", "C14", "D4", "D5", "D7", "S5", "S6", "S8", "S13", "H4", "H7", "H12"]
      ],
      passes: [["S12", "D14", "D8"], ["H10", "H9", "S10"], ["D13", "C11", "H8"], ["S13", "H12", "C3"]],
      tricks: [
        ["C2", "C10", "C12", "C14"],
        ["H14", "D12", "D9", "D5"],
        ["S4", "S9", "S11", "S6"]
      ],
      coach: {
        start: [
          { t: "Your hand. Every <b>flame</b> you take is 1 point, and the <b>queen of pentagrams</b> 13. Points are bad.", spot: "#player-hand" }
        ],
        pass: { t: "First everyone passes three cards, this hand to the <b>left</b>. Pass the <b>queen of pentagrams</b> and both your <b>tridents</b> (with none left, you can throw anything when tridents are led). Then press <b>Pass these three</b>." },
        passed: [{ t: "The lifted cards are the three Lilith passed you.", spot: "#player-hand" }],
        play0: { t: "The <b>2 of horns</b> leads the first trick. Play it." },
        trick0: ["Follow the suit led if you can. The highest card of that suit wins: Lilith's ace. No points may be played on the first trick."],
        play1: { t: "Tridents are led and you have none, so play anything: throw away your <b>ace of flames</b>." },
        trick1: ["Persephone's queen of tridents wins, so she takes your flame: 1 point. Flames can't be led until one is played on another suit, as you just did: now they're <b>broken</b>, and can be led."],
        play2: { t: "Pentagrams are led. Play your <b>4</b>: low, so somebody else wins the trick." },
        trick2: ["That's ducking. Now play the rest yourself: follow when you must, duck when you can, and throw away flames and high cards when you can't follow."],
        end: { t: "That's a hand. Scores add up until someone reaches 100. Lowest wins." }
      }
    }],
    outro: ["Take <b>every</b> point card and you've <b>shot the moon</b>: everyone else scores 26 instead. Choose your players and press <b>Play</b>. The rules are under the book button."]
  };

  return { id: "hearts", defaultTable: "heart", get name() { return SUIT_STYLE === "infernal" ? "Hearts (Flames)" : "Hearts"; },
    get tagline() { return suitText("Avoid the flames and the queen of pentagrams"); }, players: [4], logo: null, storage: "hearts", std: true,
    DEFAULT_RULES, cleanRules, Game, AI, CardView, tutorial, code, parse, cardName, shortName, sortCards, passOffset, passWords, passCycle,
    pointsOf, SUIT_WORD, SUIT_ONE, TARGET,
    target: (n, length) => length === "short" ? TARGET / 2 : TARGET,
    isPrize: c => c.suit === "S" && c.rank === 12, prizeTaken: () => "the queen of pentagrams", prizeColumn: "Queens",
    sweepText: (who, you) => `${who} shot the moon!`,
    passName: c => shortName(c),
    cardsEach: n => `${Math.floor(createDeck(n).length / n)} cards each`,
    rulesSpec, ruleNotes, howTo };
})();
