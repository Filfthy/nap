// games/sergeant.js - Sergeant Major (8-5-3) for Infernal Tricksters, three players, with the Infernal deck: spades
// are pentagrams, hearts flames, diamonds tridents, clubs horns.
//
// Standard rules: 16 cards each, and 4 face down (the kitty). Each player has a quota of tricks: the dealer 8, the
// player on the dealer's left 5, the third player 3. The dealer names trumps, takes the kitty and discards four.
// From the second hand on, whoever took more tricks than their quota last time gives a card for each trick over to
// a player who fell short, who must give back their highest card of that suit (it may be the same card). The player
// on the dealer's left leads; follow suit if you can; the highest trump wins, or else the highest card of the suit
// led. Each trick over your quota scores 1, each under loses 1. A game is 9 deals, everyone dealing three times;
// highest total wins.

const SERGEANT = (() => {
  const SUITS = ["C", "D", "H", "S"];
  const SUIT_ORDER = { C: 0, D: 1, H: 2, S: 3 };
  const NAME = { 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10", 11: "J", 12: "Q", 13: "K", 14: "A" };
  const WORD = { 11: "jack", 12: "queen", 13: "king", 14: "ace" };
  const SUIT_WORD = SUIT_WORD_NOW, SUIT_ONE = SUIT_ONE_NOW;       // (games/suits.js: standard or Infernal names)
  const ICON = { S: "s-pentagram", H: "s-flame", D: "s-trident", C: "s-horns" };
  const COLOR = { S: "s-spade", H: "s-heart", D: "s-diamond", C: "s-club" };
  const DEALS = 9;

  // ---- the rules ----
  //   quotas   "853": dealer 8, left 5, right 3 (standard); "952": 9, 5, 2
  //   kitty    the dealer takes the kitty and discards four (off: the kitty stays out of play)
  //   exchange cards change hands after a hand, by how far each player was over or under (off: never)
  const DEFAULT_RULES = { quotas: "853", kitty: true, exchange: true };
  function cleanRules(r) {
    const o = Object.assign({}, DEFAULT_RULES, r || {});
    if (!["853", "952"].includes(o.quotas)) o.quotas = "853";
    o.kitty = !!o.kitty; o.exchange = !!o.exchange;
    return o;
  }
  const quotaList = r => r.quotas === "952" ? [9, 5, 2] : [8, 5, 3];      // dealer, left, right

  class Card {
    constructor(suit, rank) { this.suit = suit; this.rank = rank; this.value = rank; this.copy = 0; this.isSpecial = false; this.points = 0; }
  }
  const code = c => c.suit + c.rank;
  const parse = s => new Card(s[0], +s.slice(1));
  const cardName = c => c.rank > 10 ? `the ${WORD[c.rank]} of ${SUIT_WORD[c.suit]}` : `the ${c.rank} of ${SUIT_WORD[c.suit]}`;
  const shortName = c => `${NAME[c.rank]} of ${SUIT_WORD[c.suit]}`;
  function createDeck() { const d = []; for (const s of SUITS) for (let r = 2; r <= 14; r++) d.push(new Card(s, r)); return d; }
  function winnerIndex(cards, trump) {
    let b = 0;
    for (let i = 1; i < cards.length; i++) { const c = cards[i], w = cards[b]; if (c.suit === w.suit ? c.rank > w.rank : c.suit === trump) b = i; }
    return b;
  }
  function legalIndices(cards, plays) {
    const all = cards.map((_, i) => i);
    if (!plays.length) return all;
    const lead = plays[0].card;
    return cards.some(c => c.suit === lead.suit) ? all.filter(i => cards[i].suit === lead.suit) : all;
  }
  class Trick {
    constructor(leader, n) { this.leader = leader; this.numPlayers = n; this.plays = []; }
    addPlay(who, card) { this.plays.push({ who, card }); }
    isComplete() { return this.plays.length >= this.numPlayers; }
    get points() { return 0; }
  }

  class Game {
    constructor() { this.numPlayers = 3; this.phase = "idle"; this.roundIndex = -1; this.scores = []; this.history = []; this.hands = []; this.taken = []; this.trickHistory = []; this.playedCards = []; this.rules = cleanRules(null); this.won = []; this.quota = []; this.owed = []; }
    startNewGame({ firstDealer = 0, length = "full", presetRounds = null, rules = null } = {}) {
      this.numPlayers = 3; this.rules = cleanRules(rules);
      this.target = length === "short" ? 6 : DEALS;
      this.scores = [0, 0, 0]; this.history = []; this.roundIndex = -1; this.dealer = firstDealer % 3;
      this.presetRounds = presetRounds; this.phase = "idle"; this.hands = []; this.currentTrick = null;
      this.won = [0, 0, 0]; this.quota = [0, 0, 0]; this.owed = []; this.handSize = 16;
    }
    nextSeat(s) { return (s + 1) % 3; }
    get totalRounds() { return 0; }
    startRound() {
      if (this.roundIndex >= 0) this.dealer = this.nextSeat(this.dealer);
      this.roundIndex++;
      const preset = this.presetRounds && this.presetRounds[this.roundIndex];
      if (preset) { this.hands = preset.hands.map(codes => new Hand(codes.map(parse))); this.kitty = preset.kitty.map(parse); }
      else {
        const deck = shuffle(createDeck());
        this.hands = [0, 1, 2].map(() => new Hand([]));
        for (let i = 0; i < 48; i++) this.hands[(this.dealer + 1 + i) % 3].add(deck[i]);
        this.kitty = deck.slice(48);
      }
      const q = quotaList(this.rules);
      this.quota = [0, 0, 0]; this.quota[this.dealer] = q[0]; this.quota[(this.dealer + 1) % 3] = q[1]; this.quota[(this.dealer + 2) % 3] = q[2];
      this.handSize = 16;
      BACK_CREASE_SEED = (Math.random() * 4294967296) >>> 0;
      this.taken = [0, 0, 0]; this.won = [0, 0, 0]; this.tricksWon = this.won;
      this.trickHistory = []; this.playedCards = []; this.tricksPlayed = 0; this.trump = null;
      this.passTo = 0; this.passes = [null, null, null]; this.received = [[], [], []];
      this.exchanges = this.rules.exchange ? this.owed.map(o => ({ giver: o.from, taker: o.to })) : [];
      this.currentTrick = null;
      this.phase = "trump"; this.turn = this.dealer;
    }
    chooseTrump(suit) {
      if (this.phase !== "trump" || !SUITS.includes(suit)) return { ok: false };
      this.trump = suit;
      if (this.rules.kitty) { this.kitty.forEach(c => this.hands[this.dealer].add(c)); this.kitty = []; this.phase = "discard"; }
      else this.afterDiscard();
      return { ok: true };
    }
    discard(indices) {
      if (this.phase !== "discard" || indices.length !== 4 || new Set(indices).size !== 4) return { ok: false };
      const h = this.hands[this.dealer].cards, out = indices.map(i => h[i]);
      out.forEach(c => h.splice(h.indexOf(c), 1));
      this.discards = out;
      this.afterDiscard();
      return { ok: true, cards: out };
    }
    afterDiscard() { if (this.exchanges.length) { this.phase = "exchange"; this.turn = this.exchanges[0].giver; } else this.beginPlay(); }
    // the next exchange: the giver gives a card; the taker gives back their highest of that suit
    give(idx) {
      if (this.phase !== "exchange" || !this.exchanges.length) return { ok: false };
      const { giver, taker } = this.exchanges[0];
      const h = this.hands[giver].cards, card = h[idx];
      if (!card) return { ok: false };
      h.splice(idx, 1); this.hands[taker].add(card);
      const th = this.hands[taker].cards, back = th.filter(c => c.suit === card.suit).reduce((a, b) => b.rank > a.rank ? b : a);
      th.splice(th.indexOf(back), 1); this.hands[giver].add(back);
      this.exchanges.shift();
      if (this.exchanges.length) this.turn = this.exchanges[0].giver; else this.beginPlay();
      return { ok: true, giver, taker, card, back };
    }
    beginPlay() {
      this.phase = "play";
      this.turn = this.nextSeat(this.dealer);
      this.currentTrick = new Trick(this.turn, 3);
    }
    get playState() { return { plays: this.currentTrick ? this.currentTrick.plays : [] }; }
    getLegalMovesFor(seat) {
      if (this.phase !== "play" || seat !== this.turn) return [];
      return legalIndices(this.hands[seat].cards, this.currentTrick.plays);
    }
    refusalReason(seat, idx) {
      if (this.getLegalMovesFor(seat).includes(idx)) return "";
      const lead = this.currentTrick && this.currentTrick.plays[0];
      return lead ? `You have ${SUIT_WORD[lead.card.suit]}, so you must follow with one.` : "You can't play that card now.";
    }
    playCard(seat, index) {
      if (!this.getLegalMovesFor(seat).includes(index)) return { ok: false };
      const card = this.hands[seat].removeAt(index);
      this.currentTrick.addPlay(seat, card); this.playedCards.push(card);
      if (this.currentTrick.isComplete()) return { ok: true, card, trickComplete: true };
      this.turn = this.nextSeat(seat);
      return { ok: true, card, trickComplete: false };
    }
    resolveCompletedTrick() {
      const t = this.currentTrick, winner = t.plays[winnerIndex(t.plays.map(p => p.card), this.trump)].who;
      this.won[winner]++;
      this.trickHistory.push({ leader: t.leader, plays: t.plays.slice(), winner, points: 0 });
      this.tricksPlayed++;
      const plays = t.plays.slice();
      if (this.hands[0].cards.length === 0) { this.finishRound(); return { winner, plays, points: 0, roundOver: true }; }
      this.turn = winner; this.currentTrick = new Trick(winner, 3);
      return { winner, plays, points: 0, roundOver: false };
    }
    finishRound() {
      const diff = [0, 1, 2].map(s => this.won[s] - this.quota[s]);
      for (let s = 0; s < 3; s++) this.scores[s] += diff[s];
      this.taken = diff.slice();
      // who owes cards next hand: each trick over, a card to someone who was under (the most under first)
      const up = [], down = [];
      diff.forEach((d, s) => { for (let k = 0; k < d; k++) up.push(s); for (let k = 0; k < -d; k++) down.push(s); });
      down.sort((a, b) => diff[a] - diff[b]);
      this.owed = up.map((from, k) => ({ from, to: down[k] })).filter(o => o.to != null);
      this.history.push({ round: this.roundIndex + 1, points: diff, won: this.won.slice(), quota: this.quota.slice(), trump: this.trump,
        totals: this.scores.slice(), sweeper: -1, spiders: [0, 0, 0], owed: this.owed.slice() });
      this.currentTrick = null; this.turn = null;
      this.phase = this.history.length >= this.target ? "gameOver" : "roundEnd";
    }
    get leaders() { const hi = Math.max(...this.scores); return this.scores.map((v, s) => v === hi ? s : -1).filter(s => s >= 0); }
  }

  // ---------------------------------------------------------------- the computer players
  //   trumps: the suit that's longest and strongest; discards: the lowest cards of its shortest plain suits, to
  //   leave a void it can trump; gives: a low card from a plain suit it's short of high cards in (it gets back the
  //   other player's best of that suit); plays: every trick is worth having - it wins as cheaply as it can, leads
  //   its sure winners, and otherwise throws its least useful card. Hard plays the hand out with guessed hands.
  const suitStrength = (hand, s) => { const cs = hand.filter(c => c.suit === s); return cs.length * 3 + cs.reduce((a, c) => a + Math.max(0, c.rank - 9), 0); };
  function chooseTrump(hand) { return SUITS.reduce((a, b) => suitStrength(hand, b) > suitStrength(hand, a) ? b : a); }
  function chooseDiscard(hand, trump) {
    const left = hand.slice(), out = [];
    while (out.length < 4) {
      const plain = left.filter(c => c.suit !== trump && c.rank < 13);
      const pool = plain.length ? plain : left.filter(c => c.suit !== trump).length ? left.filter(c => c.suit !== trump) : left;
      const len = s => left.filter(c => c.suit === s).length;
      const c = pool.reduce((a, b) => (len(b.suit) < len(a.suit) || (len(b.suit) === len(a.suit) && b.rank < a.rank)) ? b : a);
      out.push(c); left.splice(left.indexOf(c), 1);
    }
    return out.map(c => hand.indexOf(c));
  }
  function chooseGive(hand, trump) {
    const plain = hand.filter(c => c.suit !== trump);
    const pool = plain.length ? plain : hand;
    const hasTop = s => hand.some(c => c.suit === s && c.rank === 14);
    const c = pool.reduce((a, b) => ((hasTop(b.suit) ? 1 : 0) - (hasTop(a.suit) ? 1 : 0) < 0 || ((hasTop(b.suit) === hasTop(a.suit)) && b.rank < a.rank)) ? b : a);
    return hand.indexOf(c);
  }
  function topLeft(g) {
    const gone = new Set([...g.playedCards, ...(g.currentTrick ? g.currentTrick.plays.map(p => p.card) : [])].map(code));
    const top = {}; for (const s of SUITS) { let r = 14; while (r >= 2 && gone.has(s + r)) r--; top[s] = r; }
    return top;
  }
  function mediumPlay(hand, legal, plays, trump, top) {
    const cheap = arr => arr.reduce((a, b) => ((hand[b].suit === trump) - (hand[a].suit === trump) < 0) || ((hand[b].suit === trump) === (hand[a].suit === trump) && hand[b].rank < hand[a].rank) ? b : a);
    if (!plays.length) {
      const sure = legal.filter(i => hand[i].rank === top[hand[i].suit] && hand[i].suit !== trump);
      if (sure.length) return sure[0];
      const trumpTop = legal.filter(i => hand[i].suit === trump && hand[i].rank === top[trump]);
      if (trumpTop.length) return trumpTop[0];
      return cheap(legal);
    }
    const cards = plays.map(p => p.card), w = cards[winnerIndex(cards, trump)];
    const beats = c => c.suit === w.suit ? c.rank > w.rank : c.suit === trump;
    const winning = legal.filter(i => beats(hand[i])), losing = legal.filter(i => !beats(hand[i]));
    if (winning.length) {
      if (plays.length === 2) return cheap(winning);
      const sure = winning.filter(i => hand[i].suit === trump ? hand[i].rank === top[trump] || cards.every(c => c.suit !== trump) : hand[i].rank === top[hand[i].suit]);
      return sure.length ? cheap(sure) : cheap(winning);
    }
    return cheap(losing);
  }
  class AI {
    constructor({ difficulty = "medium" } = {}) { this.difficulty = difficulty; }
    setDifficulty(d) { this.difficulty = d; }
    resetMemory() {}
    choosePass() { return [0, 1, 2]; }
    chooseTrump(hand) { return this.difficulty === "easy" && Math.random() < 0.3 ? SUITS[Math.floor(Math.random() * 4)] : chooseTrump(hand); }
    chooseDiscard(hand, trump) { return chooseDiscard(hand, trump); }
    chooseGive(hand, trump) { return chooseGive(hand, trump); }
    choosePlay(ctx) {
      if (ctx.legal.length === 1) return ctx.legal[0];
      const g = ctx.game;
      if (this.difficulty === "easy" && Math.random() < 0.2) return ctx.legal[Math.floor(Math.random() * ctx.legal.length)];
      if (this.difficulty === "hard") return this.lookAhead(ctx);
      return mediumPlay(ctx.hand, ctx.legal, ctx.plays, g.trump, topLeft(g));
    }
    lookAhead(ctx) {
      const g = ctx.game, me = ctx.seat;
      const seen = new Set([...g.playedCards, ...g.currentTrick.plays.map(p => p.card), ...g.hands[me].cards, ...(me === g.dealer && g.discards ? g.discards : [])].map(code));
      const unseen = createDeck().filter(c => !seen.has(code(c)));
      const counts = g.hands.map(h => h.cards.length);
      const voids = [0, 1, 2].map(() => new Set());
      for (const t of g.trickHistory.concat([{ plays: g.currentTrick.plays }])) if (t.plays.length) { const lead = t.plays[0].card; for (const p of t.plays.slice(1)) if (p.card.suit !== lead.suit) voids[p.who].add(lead.suit); }
      const score = new Map(ctx.legal.map(i => [i, 0]));
      for (let k = 0; k < 50; k++) {
        const pool = shuffle(unseen.slice()), hands = counts.map((c, s) => s === me ? g.hands[me].cards.slice() : []);
        for (const s of [0, 1, 2]) if (s !== me) {
          for (let i = pool.length - 1; i >= 0 && hands[s].length < counts[s]; i--) if (!voids[s].has(pool[i].suit)) hands[s].push(pool.splice(i, 1)[0]);
          while (hands[s].length < counts[s] && pool.length) hands[s].push(pool.pop());
        }
        for (const i of ctx.legal) score.set(i, score.get(i) + this.playOut(g, hands, me, i));
      }
      let best = ctx.legal[0];
      for (const i of ctx.legal) if (score.get(i) > score.get(best)) best = i;
      return best;
    }
    playOut(g, handsIn, me, first) {
      const hands = handsIn.map(h => h.slice()), won = g.won.slice(), trump = g.trump;
      const gone = new Set(g.playedCards.map(code));
      let plays = g.currentTrick.plays.slice(), turn = me, firstMove = true, guard = 0;
      plays.forEach(p => gone.add(code(p.card)));
      while (guard++ < 80) {
        const h = hands[turn];
        if (!h.length) break;
        const legal = legalIndices(h, plays);
        const top = {}; for (const s of SUITS) { let r = 14; while (r >= 2 && gone.has(s + r)) r--; top[s] = r; }
        const i = firstMove ? first : legal.length === 1 ? legal[0] : mediumPlay(h, legal, plays, trump, top);
        firstMove = false;
        const card = h.splice(i, 1)[0]; gone.add(code(card));
        plays.push({ who: turn, card });
        if (plays.length === 3) { const w = plays[winnerIndex(plays.map(p => p.card), trump)].who; won[w]++; plays = []; turn = w; }
        else turn = (turn + 1) % 3;
      }
      return won[me];
    }
  }

  // ---------------------------------------------------------------- before the play: trumps, kitty, exchanges
  const mark = s => suitIcon(s);
  const cap = w => w[0].toUpperCase() + w.slice(1);
  async function preplay(app, ep) {
    const g = app.game, t = app.tutRound(), name = s => s === 0 ? "You" : app.seatName(s);
    // trumps
    if (g.phase === "trump") {
      let suit;
      if (g.dealer === 0) {
        app.render();
        if (app.tut) app.coach("trump");
        suit = await app.chooseOption({ title: `You deal: your quota is <b>${g.quota[0]}</b>. Choose trumps`,
          options: SUITS.map(s => ({ value: s, label: `${mark(s)} ${cap(SUIT_WORD[s])}`, tip: `${cap(SUIT_WORD[s])} are trumps`, disabled: t && t.trump && s !== t.trump })),
          note: "Pick the suit you're longest and strongest in." });
        if (app.tut) app.hideCoach();
      } else {
        await app.pause(900);
        suit = t && t.trump ? t.trump : app.aiEngine.chooseTrump(g.hands[g.dealer].cards);
      }
      if (ep !== app.epoch) return false;
      g.chooseTrump(suit);
      if (g.dealer !== 0) app.showToast(`${app.seatName(g.dealer)} chooses ${SUIT_WORD[suit]} as trumps.`);
      app.render();
      // the kitty to the dealer
      if (g.phase === "discard") {
        await app.flyCards(-1, g.dealer, 4);
        if (ep !== app.epoch) return false;
        app.render();
        let idx;
        if (g.dealer === 0) {
          if (app.tut) app.coach("discard");
          idx = await app.pickCards({ n: 4, title: "Discard four cards", button: "Discard these four", allowed: t && t.discard,
            note: "You've taken the kitty: put four cards out of the hand." });
          if (app.tut) app.hideCoach();
        } else idx = t && t.discardAI ? t.discardAI.map(c => g.hands[g.dealer].cards.findIndex(x => code(x) === c)) : app.aiEngine.chooseDiscard(g.hands[g.dealer].cards, g.trump);
        if (ep !== app.epoch) return false;
        g.discard(idx);
        app.render();
        await app.flyCards(g.dealer, -1, 4);
        if (ep !== app.epoch) return false;
      }
    }
    // the exchanges
    while (g.phase === "exchange") {
      const { giver, taker } = g.exchanges[0];
      let idx;
      if (giver === 0) {
        idx = (await app.pickCards({ n: 1, title: `Give ${app.seatName(taker)} a card`, button: "Give it",
          note: `They give you back their highest card of that suit. (You took ${g.history.length ? g.history[g.history.length - 1].points[0] : 0} over your quota last hand.)` }))[0];
      } else { await app.pause(800); idx = app.aiEngine.chooseGive(g.hands[giver].cards, g.trump); }
      if (ep !== app.epoch) return false;
      const r = g.give(idx);
      await app.flyCards(giver, taker, 1);
      await app.flyCards(taker, giver, 1);
      if (ep !== app.epoch) return false;
      if (giver === 0) app.showToast(`You gave ${cardName(r.card)}; ${app.seatName(taker)} gave back ${cardName(r.back)}.`);
      else if (taker === 0) app.showToast(`${app.seatName(giver)} gave you ${cardName(r.card)}; you gave back ${cardName(r.back)}, your highest ${SUIT_ONE[r.card.suit]}.`);
      else app.showToast(`${app.seatName(giver)} and ${app.seatName(taker)} swap cards.`);
      app.received = giver === 0 ? [r.back] : taker === 0 ? [r.card] : app.received;
      app.render();
      await app.pause(1100);
      if (ep !== app.epoch) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- on screen, and the words
  const sortCards = (a, b) => (SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit]) || (a.rank - b.rank);
  const statsHtml = (g, seat) => {
    const q = g.quota[seat], w = g.won[seat] || 0;
    const cls = g.phase === "play" || g.phase === "roundEnd" ? (w >= q ? " on-target" : "") : "";
    return `<span class="bid-token revealed${cls}" data-tip="Quota: ${q} tricks">${q}</span>` +
      (g.phase === "play" || g.phase === "roundEnd" ? `<span class="stat">Won <b>${w}</b>${w > q ? ` <small>(+${w - q})</small>` : ""}</span>` : `<span class="stat-muted">quota</span>`);
  };
  const marker = g => g.trump ? { html: `<span>${mark(g.trump)}</span><b>${SUIT_WORD[g.trump]}</b>`, caption: "Trumps", tip: `${cap(SUIT_WORD[g.trump])} are trumps this hand` }
    : { html: `<span>?</span><b>dealer's choice</b>`, caption: "Trumps", tip: "The dealer chooses trumps" };
  const summary = (g, r, name) => {
    const owed = r.owed.length ? r.owed.reduce((m, o) => { const k = o.from + ">" + o.to; m[k] = (m[k] || 0) + 1; return m; }, {}) : {};
    const lines = Object.entries(owed).map(([k, c]) => { const [f, t] = k.split(">").map(Number); return `${name(f)} give${f === 0 ? "" : "s"} ${t === 0 ? "you" : name(t)} ${c} card${c === 1 ? "" : "s"}`; });
    const sub = g.phase === "gameOver" ? "That was the last deal: the game is over." : g.rules.exchange && lines.length ? `Next hand: ${lines.join("; ")}.` : "Next hand: no cards change hands.";
    let html = `<thead><tr><th>Player</th><th>Quota</th><th>Won</th><th>+/−</th><th>Total</th></tr></thead><tbody>`;
    for (let s = 0; s < 3; s++) html += `<tr class="${r.points[s] >= 0 ? "exact" : "missed"}${s === 0 ? " me" : ""}"><td>${name(s, true)}</td><td>${r.quota[s]}</td><td>${r.won[s]}</td><td>${r.points[s] > 0 ? "+" : ""}${r.points[s]}</td><td>${r.totals[s]}</td></tr>`;
    return { sub, html: html + "</tbody>", title: `Deal ${g.history.length} complete` };
  };
  const react = (app, g, res) => {
    const w = res.winner;
    if (g.phase === "roundEnd" || g.phase === "gameOver") { for (let s = 0; s < 3; s++) app.react(s, g.won[s] >= g.quota[s] ? "win" : "bust", 2800); return; }
    if (g.won[w] === g.quota[w]) app.react(w, "win", 2400);
    const left = 16 - g.tricksPlayed;
    for (let s = 0; s < 3; s++) if (s !== w && g.won[s] + left < g.quota[s] && !(app.smBust || {})[s + "/" + g.roundIndex]) { (app.smBust = app.smBust || {})[s + "/" + g.roundIndex] = 1; app.react(s, "bust", 2200); if (typeof CAVE !== "undefined") CAVE.flare(); }
  };
  const ruleNotes = r => ({
    quotas: r.quotas === "952" ? "Quotas: the dealer 9 tricks, the player on the left 5, the third player 2." : "Quotas: the dealer 8 tricks, the player on the left 5, the third player 3.",
    kitty: r.kitty ? "The dealer takes the four cards of the kitty and discards four." : "The kitty stays out of play.",
    exchange: r.exchange ? "After a hand, whoever went over their quota gives a card for each trick over to someone who fell short, who gives back their highest card of that suit." : "No cards change hands between deals.",
  });
  const rulesSpec = [
    { key: "quotas", label: "Quotas", options: [["853", "8 - 5 - 3", "The dealer needs 8 tricks, the player on the left 5, the third player 3"], ["952", "9 - 5 - 2", "The dealer needs 9, the player on the left 5, the third player 2"]] },
    { key: "kitty", label: "Kitty", options: [[true, "Dealer takes it", "The dealer picks up the four kitty cards and discards four"], [false, "Left out", "The kitty isn't used"]] },
    { key: "exchange", label: "Exchanges", options: [[true, "On", "After each hand, over-quota players swap cards with under-quota players"], [false, "Off", "No cards change hands"]] },
  ];
  const howTo = r => {
    const n = ruleNotes(r), house = rulesSpec.filter(s => r[s.key] !== DEFAULT_RULES[s.key]).map(s => s.label);
    return `
        <h3>How to play</h3>
        <ul>
          <li>Sergeant Major, for exactly three players.</li>
          ${SUIT_STYLE === "infernal" ? `<li>With the Infernal cards: spades are <strong>pentagrams</strong>, hearts <strong>flames</strong>, diamonds <strong>tridents</strong> and clubs <strong>horns</strong>.</li>` : ""}
          <li>Each player has a <strong>quota</strong> of tricks to take. Beat it and you score, and you get to swap cards with whoever fell short. <strong>Highest score wins.</strong></li>
          <li>The <strong>Tutorial</strong> plays one hand with you, step by step.</li>
        </ul>
        <h3>Rules</h3>
        <ul>
          <li>16 cards each, and four face down: the kitty. ${n.quotas}</li>
          <li><strong>Trumps</strong><br>The dealer chooses trumps. ${n.kitty}</li>
          <li><strong>Exchanges</strong><br>${n.exchange}</li>
          <li><strong>Playing</strong><br>The player on the dealer's left leads. Follow suit if you can; if you can't, play anything. The highest trump wins the trick, or the highest card of the suit led. The winner leads next.</li>
          <li><strong>Scoring</strong><br>Each trick over your quota scores 1; each trick short loses 1.</li>
          <li>A game is ${DEALS} deals (6 in a short game), so everyone deals equally often. Highest total wins.</li>
        </ul>
        <h3>House rules</h3>
        <ul><li>Chosen in the <strong>Rules</strong> tab before a game. ${house.length ? `In use: <strong>${house.join(", ")}</strong>.` : "None in use: these are the standard rules."}</li></ul>
        <h3>Tips</h3>
        <ul>
          <li>Dealing, make the suit you're longest in trumps, and discard to leave yourself a void you can trump.</li>
          <li>When you give a card, give a low one in a suit where the other player probably holds the ace: you get it back.</li>
        </ul>`;
  };
  // the tutorial: you deal (quota 8); pentagrams are trumps; you discard four; then three coached tricks
  const tutorial = {
    opponents: ["Persephone", "Bub"],
    firstDealer: 0,
    intro: ["Welcome to <b>Sergeant Major</b>, for three: each of you has a <b>quota</b> of tricks to take. Let's play a hand."],
    rounds: [{
      hands: [
        ["S14", "S13", "S12", "S9", "S7", "S4", "H14", "H13", "H6", "D14", "D9", "D3", "D2", "C11", "C5", "C3"],
        ["S11", "S8", "S3", "H12", "H9", "H5", "H2", "D13", "D10", "D7", "D5", "C14", "C10", "C8", "C4", "C2"],
        ["S10", "S6", "S5", "S2", "H11", "H10", "H8", "H7", "H3", "D12", "D11", "D8", "C13", "C12", "C9", "C7"]
      ],
      kitty: ["H4", "D6", "D4", "C6"],
      trump: "S",
      discard: ["C11", "C6", "C5", "C3"],
      tricks: [
        ["D14", "D5", "D8"],
        ["H14", "H2", "H3"],
        ["S14", "S3", "S2"]
      ],
      coach: {
        start: [{ t: "Your hand. You deal, so your <b>quota</b> is 8 tricks; Persephone, on your left, needs 5, and Bub 3.", spot: "#player-hand" }],
        trump: { t: "The dealer chooses trumps. You're long in <b>pentagrams</b>, with the ace, king and queen: choose them." },
        discard: { t: "You've picked up the kitty. Discard four: all your <b>horns</b> - then whenever horns are led, you can trump them." },
        play0: { t: "Persephone led a trident. Win it with your <b>ace of tridents</b>." },
        trick0: ["1 trick of your 8. Every trick you win counts, so win whenever you can."],
        play1: { t: "Lead your <b>ace of flames</b>." },
        trick1: ["2 tricks."],
        play2: { t: "Draw out the others' trumps: lead your <b>ace of pentagrams</b>." },
        trick2: ["3 tricks. Play the rest yourself: win what you can, and trump when you're out of a suit."],
        end: { t: "That's a hand. Next hand, whoever went over their quota gives a card for each trick over to someone who fell short - and gets back that player's highest card of the suit." }
      }
    }],
    outro: ["After 9 deals the highest score wins. Choose your opponents and press <b>Play</b>. The rules are under the book button."]
  };

  return { id: "sergeant", name: "Sergeant Major", std: true, tagline: "Three players, three quotas: 8, 5 and 3 tricks", players: [3], logo: null, storage: "sergeant",
    DEFAULT_RULES, cleanRules, Game, AI, CardView: HEARTS.CardView, tutorial, code, parse, cardName, shortName, sortCards,
    passOffset: () => 0, passWords: () => "no pass", highWins: true,
    target: (n, length) => length === "short" ? 6 : DEALS,
    goalText: (n, length) => `${length === "short" ? 6 : DEALS} deals`,
    goalLabel: g => `Deal <b>${Math.min(g.history.length + (g.phase === "roundEnd" || g.phase === "gameOver" ? 0 : 1), g.target)}</b> of ${g.target}`,
    isPrize: () => false, prizeTaken: () => "", prizeColumn: "Over quota",
    resultExtra: (g, seat) => g.history.filter(h => h.points[seat] > 0).length,
    sweepText: () => "", passName: c => shortName(c), cardsEach: () => "16 cards each",
    preplay, statsHtml, marker, summary, react,
    rulesSpec, ruleNotes, howTo, demo: ["S14", "S12", "H14", "D11", "C2", "S2"] };
})();
