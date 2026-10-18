// games/nap.js - Nap (Napoleon) for Infernal Tricksters, with the Infernal deck: spades are pentagrams, hearts flames,
// diamonds tridents, clubs horns.
//
// Standard rules: played for counters - everyone starts with 50 (25 in a short game). Five cards each. An auction,
// once round from the dealer's left: pass, or bid more tricks than anyone so far - 2, 3, 4, or Nap (all five). The
// highest bidder plays alone against everyone else and leads; the suit of that first card is trumps. Follow suit if
// you can; the highest trump wins, or else the highest card of the suit led. Make your bid and every other player
// pays you that many counters; fail and you pay each of them that many. Nap: 10 from each if you make it, 5 to each
// if you don't. Nobody pays more than they have; a player with none left drops out (if it's you, the game ends).
// If everyone passes, it's a new deal. After 12 deals (or when one player is left) the most counters wins.

const NAP = (() => {
  const SUITS = ["C", "D", "H", "S"];
  const SUIT_ORDER = { C: 0, D: 1, H: 2, S: 3 };
  const NAME = { 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10", 11: "J", 12: "Q", 13: "K", 14: "A" };
  const WORD = { 11: "jack", 12: "queen", 13: "king", 14: "ace" };
  const SUIT_WORD = SUIT_WORD_NOW;       // (games/suits.js: standard or Infernal names)
  const ICON = { S: "s-pentagram", H: "s-flame", D: "s-trident", C: "s-horns" };
  const COLOR = { S: "s-spade", H: "s-heart", D: "s-diamond", C: "s-club" };
  const DEALS = 12;                     // a game: 12 deals that are played (6 for a short game)
  const MAX_DEALS = 40;                 // (last one standing: a game still stops somewhere)
  const STAKE = 50;                     // the counters everyone starts with (25 for a short game)
  // the bids: tricks, and the specials (Misère ranks between 3 and 4; Wellington and Blücher only follow Nap)
  const MIS = 3.5, NAPB = 5, WELL = 6, BLU = 7, PASS = -1;
  const BID_NAME = { 1: "1", 2: "2", 3: "3", 3.5: "Misère", 4: "4", 5: "Nap", 6: "Wellington", 7: "Blücher" };
  const tricksNeeded = b => b === MIS ? 0 : b >= NAPB ? 5 : b;
  // what a bid wins from (or pays to) each other player
  const stakes = b => b === MIS ? [3, 3] : b === NAPB ? [10, 5] : b === WELL ? [10, 10] : b === BLU ? [15, 15] : [b, b];

  // ---- the rules ----
  //   minBid     the lowest bid: 2 (standard) or 1
  //   misere     Misère allowed: take no tricks at all, no trumps (3 each way)
  //   wellington Wellington and Blücher: after a Nap, Wellington (10 each way), then Blücher (15 each way)
  //   allPass    "redeal": if everyone passes, a new deal; "dealer": the dealer must bid the lowest bid
  //   ending     "deals": 12 deals (6 short), or until one player is left; "last": play on until one player is left
  //   broke      "out": a player with no counters left drops out; "end": the game ends there
  //   cover      you may only bid what you could pay out if you lost it
  //   pool       everyone puts 1 counter in the pool each deal; whoever makes Nap (or more) takes it
  const DEFAULT_RULES = { minBid: 2, misere: true, wellington: false, allPass: "redeal", ending: "deals", broke: "out", cover: false, pool: false };
  function cleanRules(r) {
    const o = Object.assign({}, DEFAULT_RULES, r || {});
    o.minBid = o.minBid === 1 ? 1 : 2; o.misere = !!o.misere; o.wellington = !!o.wellington; o.cover = !!o.cover; o.pool = !!o.pool;
    if (!["redeal", "dealer"].includes(o.allPass)) o.allPass = "redeal";
    if (!["deals", "last"].includes(o.ending)) o.ending = "deals";
    if (!["out", "end"].includes(o.broke)) o.broke = "out";
    return o;
  }

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
    constructor() { this.numPlayers = 4; this.phase = "idle"; this.roundIndex = -1; this.scores = []; this.history = []; this.hands = []; this.taken = []; this.trickHistory = []; this.playedCards = []; this.rules = cleanRules(null); this.bids = []; this.won = []; this.active = []; this.pool = 0; }
    startNewGame({ numPlayers = 4, firstDealer = 0, length = "full", presetRounds = null, rules = null } = {}) {
      this.numPlayers = numPlayers; this.rules = cleanRules(rules);
      this.stake = length === "short" ? STAKE / 2 : STAKE;
      this.target = this.rules.ending === "last" ? MAX_DEALS : length === "short" ? DEALS / 2 : DEALS;   // (deals, not points)
      this.scores = new Array(numPlayers).fill(this.stake);     // (everyone's counters)
      this.active = new Array(numPlayers).fill(true); this.pool = 0;
      this.history = []; this.roundIndex = -1; this.dealer = firstDealer;
      this.presetRounds = presetRounds; this.phase = "idle"; this.hands = []; this.currentTrick = null;
      this.bids = new Array(numPlayers).fill(null); this.won = new Array(numPlayers).fill(0); this.handSize = 5;
    }
    // the next player still in, clockwise
    nextSeat(s) { for (let k = 1; k <= this.numPlayers; k++) { const t = (s + k) % this.numPlayers; if (this.active[t] !== false) return t; } return s; }
    get activeCount() { return this.active.filter(a => a !== false).length; }
    get totalRounds() { return 0; }
    startRound() {
      if (this.roundIndex >= 0 || this.active[this.dealer] === false) this.dealer = this.nextSeat(this.dealer);
      this.roundIndex++;
      const n = this.numPlayers, preset = this.presetRounds && this.presetRounds[this.roundIndex];
      if (preset) this.hands = preset.hands.map(codes => new Hand(codes.map(parse)));
      else {
        const deck = shuffle(createDeck());
        this.hands = [...Array(n)].map(() => new Hand([]));
        let seat = this.dealer;
        for (let i = 0; i < 5 * this.activeCount; i++) { seat = this.nextSeat(seat); this.hands[seat].add(deck[i]); }
      }
      this.handSize = 5;
      BACK_CREASE_SEED = (Math.random() * 4294967296) >>> 0;
      // the pool: a counter from everyone still in
      this.ante = new Array(n).fill(0);
      if (this.rules.pool) for (let s = 0; s < n; s++) if (this.active[s] && this.scores[s] > 0) { this.scores[s]--; this.ante[s] = 1; this.pool++; }
      this.taken = new Array(n).fill(0); this.won = new Array(n).fill(0); this.tricksWon = this.won;
      this.trickHistory = []; this.playedCards = []; this.tricksPlayed = 0;
      this.bids = new Array(n).fill(null); this.declarer = null; this.contract = null; this.trump = null;
      this.passTo = 0; this.passes = new Array(n).fill(null); this.received = [...Array(n)].map(() => []);
      this.currentTrick = null;
      this.phase = "bid";
      this.turn = this.nextSeat(this.dealer);
    }
    get highBid() { return Math.max(PASS, ...this.bids.filter(b => b != null)); }
    // what a seat may bid now: pass, or anything above the highest bid so far (and, covering bids, that it could pay)
    legalBids(seat) {
      const r = this.rules, hi = this.highBid, out = [];
      const forced = seat === this.dealer && r.allPass === "dealer" && hi === PASS;
      if (!forced) out.push(PASS);
      for (let b = r.minBid; b <= 4; b++) if (b > hi) out.push(b);
      if (r.misere && MIS > hi) out.push(MIS);
      if (NAPB > hi) out.push(NAPB);
      if (r.wellington && hi === NAPB) out.push(WELL);
      if (r.wellington && hi === WELL) out.push(BLU);
      let ok = out.sort((a, b) => a - b);
      if (r.cover) {
        const can = b => b === PASS || stakes(b)[1] * (this.activeCount - 1) <= this.scores[seat];
        const covered = ok.filter(can);
        ok = covered.length ? covered : ok.slice(0, 1).concat(forced ? [] : []);
        if (forced && !covered.some(b => b !== PASS)) ok = [out.find(b => b !== PASS)];   // (the dealer must bid something)
      }
      return ok;
    }
    placeBid(seat, bid) {
      if (this.phase !== "bid" || seat !== this.turn || this.bids[seat] != null || !this.legalBids(seat).includes(bid)) return { ok: false };
      this.bids[seat] = bid;
      if (seat === this.dealer || bid === BLU) {
        const hi = this.highBid;
        if (hi === PASS) { this.phase = "allPassed"; return { ok: true, allPassed: true }; }
        this.beginPlay();
      } else this.turn = this.nextSeat(seat);
      return { ok: true };
    }
    beginPlay() {
      const hi = this.highBid;
      this.declarer = this.bids.indexOf(hi); this.contract = hi;
      this.trump = null;                      // set by the first card led (none at all for Misère)
      this.phase = "play";
      this.turn = this.declarer;
      this.currentTrick = new Trick(this.turn, this.activeCount);
    }
    get playState() { return { plays: this.currentTrick ? this.currentTrick.plays : [] }; }
    getLegalMovesFor(seat) {
      if (this.phase !== "play" || seat !== this.turn) return [];
      return legalIndices(this.hands[seat].cards, this.currentTrick.plays);
    }
    refusalReason(seat, idx) {
      if (this.getLegalMovesFor(seat).includes(idx)) return "";
      const lead = this.currentTrick.plays[0];
      return lead ? `You have ${SUIT_WORD[lead.card.suit]}, so you must follow with one.` : "You can't play that card now.";
    }
    playCard(seat, index) {
      if (!this.getLegalMovesFor(seat).includes(index)) return { ok: false };
      const card = this.hands[seat].removeAt(index);
      if (this.tricksPlayed === 0 && !this.currentTrick.plays.length && this.contract !== MIS) this.trump = card.suit;
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
      // the hand is decided early: the declarer has made it, or can no longer
      if (this.hands[this.declarer].cards.length === 0 || this.decided) { this.finishRound(); return { winner, plays, points: 0, roundOver: true }; }
      this.turn = winner; this.currentTrick = new Trick(winner, this.activeCount);
      return { winner, plays, points: 0, roundOver: false };
    }
    get decided() {
      const w = this.won[this.declarer], left = 5 - this.tricksPlayed;
      if (this.contract === MIS) return w > 0;
      const need = tricksNeeded(this.contract);
      return w >= need || w + left < need;
    }
    get made() { const w = this.won[this.declarer]; return this.contract === MIS ? w === 0 : w >= tricksNeeded(this.contract); }
    finishRound() {
      const n = this.numPlayers, d = this.declarer, [win, lose] = stakes(this.contract), made = this.made;
      const before = this.scores.slice(), opp = [];
      for (let k = 1; k < n; k++) { const s = (d + k) % n; if (this.active[s]) opp.push(s); }
      if (made) for (const s of opp) { const pay = Math.min(win, this.scores[s]); this.scores[s] -= pay; this.scores[d] += pay; }
      else {
        // the declarer pays each of them - as far as their counters go, shared out evenly if they run short
        const owe = lose * opp.length, have = this.scores[d];
        if (have >= owe) for (const s of opp) { this.scores[s] += lose; this.scores[d] -= lose; }
        else { const each = Math.floor(have / opp.length); let rest = have - each * opp.length; for (const s of opp) { const p = each + (rest-- > 0 ? 1 : 0); this.scores[s] += p; this.scores[d] -= p; } }
      }
      // the pool: to whoever makes Nap (or more)
      let poolWon = 0;
      if (this.rules.pool && made && this.contract >= NAPB) { poolWon = this.pool; this.scores[d] += this.pool; this.pool = 0; }
      const points = this.scores.map((v, s) => v - before[s]);
      // anyone with nothing left
      const broke = [];
      for (let s = 0; s < n; s++) if (this.active[s] && this.scores[s] <= 0) { broke.push(s); if (this.rules.broke === "out") this.active[s] = false; }
      this.taken = points.slice();
      this.history.push({ round: this.roundIndex + 1, points, totals: this.scores.slice(), sweeper: -1, spiders: new Array(n).fill(0),
        declarer: d, contract: this.contract, won: this.won.slice(), made, trump: this.trump, tricks: this.tricksPlayed, broke, poolWon, pool: this.pool, ante: this.ante.slice() });
      // (the cards nobody played go back with the rest)
      this.hands.forEach(h => { h.cards.length = 0; });
      this.currentTrick = null; this.turn = null;
      const over = this.history.length >= this.target || this.activeCount <= 1 || this.scores[0] <= 0 || (this.rules.broke === "end" && broke.length);
      if (over && this.pool) {                 // (an unclaimed pool is shared out at the end)
        const ins = [...Array(n).keys()].filter(s => this.active[s] !== false && this.scores[s] > 0);
        const each = Math.floor(this.pool / Math.max(1, ins.length));
        ins.forEach(s => { this.scores[s] += each; }); this.pool -= each * ins.length;
        this.history[this.history.length - 1].totals = this.scores.slice();
      }
      this.phase = over ? "gameOver" : "roundEnd";
    }
    get leaders() { const hi = Math.max(...this.scores); return this.scores.map((v, s) => v === hi ? s : -1).filter(s => s >= 0); }
  }

  // ---------------------------------------------------------------- the computer players
  //   bidding: for each suit as trumps, counts the tricks it should take leading first (high trumps, length, side
  //            aces and guarded kings) and bids the best of them if it beats the bid so far; Misère with nothing
  //            above an 8; easy bids a little wildly
  //   declarer: leads its trump suit from the top to draw trumps, then its side winners; ducks everything in Misère
  //   defenders: gang up - beat the declarer's card as cheaply as they can, play low when a fellow defender is
  //              already winning; against Misère, lead low and play under the declarer when they can
  //   hard: tries each card and plays the hand out many times with guessed hands (fitting the suits they've shown
  //         they lack, and the auction), counting the result for itself
  //   medium and hard bid by simulation (simBid, below): the unseen cards dealt out many times to fit the auction, each
  //         deal played out with good sense, giving the chance of making each bid - and they bid whatever is worth most
  //         counters on average (tools/nap-ai/lab.js measured it: about a counter a deal better than bidding by rules)
  function estimate(hand, trump) {
    const by = s => hand.filter(c => c.suit === s).sort((a, b) => b.rank - a.rank);
    const tr = by(trump);
    let t = 0;
    tr.forEach((c, i) => { if (c.rank === 14) t += 1; else if (c.rank === 13) t += tr.length >= 2 ? 0.9 : 0.5; else if (c.rank === 12) t += tr.length >= 3 ? 0.75 : 0.35; else if (c.rank === 11) t += tr.length >= 3 ? 0.5 : 0.15; });
    if (tr.length >= 3) t += (tr.length - 2) * 0.55;
    for (const s of SUITS) if (s !== trump) { const cs = by(s); cs.forEach(c => { if (c.rank === 14) t += 0.8; else if (c.rank === 13 && cs.length >= 2) t += 0.35; }); }
    return t;
  }
  function bestTrump(hand) { let best = SUITS[0], v = -1; for (const s of SUITS) { const e = estimate(hand, s); if (e > v) { v = e; best = s; } } return { suit: best, est: v }; }
  function misereFits(hand) { return hand.every(c => c.rank <= 8) && hand.filter(c => c.rank <= 5).length >= 2; }
  function chooseBid(hand, legal, difficulty, n, pool = 0) {
    const { est } = bestTrump(hand);
    const bold = difficulty === "easy" ? 0.6 * (Math.random() - 0.3) : difficulty === "hard" ? 0.15 : 0;
    const crowd = n >= 5 ? -0.25 : n === 3 ? 0.2 : 0;           // more defenders, harder to make
    const lead = typeof NAP_LEAD !== "undefined" ? NAP_LEAD : 0.8;   // leading first, and choosing trumps, is worth something
    const can = est + lead + bold + crowd;
    let pick = PASS;
    for (const b of legal) {
      if (b === PASS) continue;
      if (b === MIS) { if (misereFits(hand) && pick < MIS) pick = MIS; continue; }
      const need = tricksNeeded(b);
      // (a fat pool tempts a Nap)
      if (b >= NAPB) { const napAt = 4.6 - Math.min(0.9, pool * 0.05); if (can >= napAt && (b === NAPB || can >= napAt + 0.3)) pick = b; continue; }
      if (can >= need - 0.2) pick = b;
    }
    // the lowest bid that's enough to win the auction, not the most the hand could make: unless it's the last word
    if (pick === PASS && !legal.includes(PASS)) pick = legal[0];
    return pick;
  }
  function choosePlay(hand, legal, g, me, info) {
    const plays = g.currentTrick.plays, decl = g.declarer, mis = g.contract === MIS, trump = g.trump;
    const isDecl = me === decl;
    if (!plays.length) {
      if (isDecl) {
        if (mis) return legal.reduce((a, b) => hand[b].rank < hand[a].rank ? b : a);
        // first lead: from the trump suit it bid on; then draw trumps while the others may hold them, then winners
        const t = trump || bestTrump(hand).suit;
        const trumps = legal.filter(i => hand[i].suit === t);
        if (trumps.length && (!trump || info.trumpsOut > 0)) return trumps.reduce((a, b) => hand[b].rank > hand[a].rank ? b : a);
        return legal.reduce((a, b) => (hand[b].rank === info.top[hand[b].suit]) - (hand[a].rank === info.top[hand[a].suit]) > 0 || hand[b].rank > hand[a].rank ? b : a);
      }
      // a defender leads: against Misère, low; otherwise a winner if it has one, else something the declarer lacks
      if (mis) return legal.reduce((a, b) => hand[b].rank < hand[a].rank ? b : a);
      const winners = legal.filter(i => hand[i].rank === info.top[hand[i].suit] && hand[i].suit !== trump);
      if (winners.length) return winners[0];
      const voidDecl = legal.filter(i => info.void[decl].has(hand[i].suit) && hand[i].suit !== trump);
      if (voidDecl.length) return voidDecl[0];
      return legal.reduce((a, b) => (hand[b].suit === trump) - (hand[a].suit === trump) < 0 || hand[b].rank < hand[a].rank ? b : a);
    }
    const cards = plays.map(p => p.card), curW = winnerIndex(cards, trump), curWho = plays[curW].who;
    const beats = c => { const w = cards[curW]; return c.suit === w.suit ? c.rank > w.rank : c.suit === trump; };
    const winning = legal.filter(i => beats(hand[i])), losing = legal.filter(i => !beats(hand[i]));
    const cheap = arr => arr.reduce((a, b) => ((hand[b].suit === trump) - (hand[a].suit === trump) < 0) || ((hand[b].suit === trump) === (hand[a].suit === trump) && hand[b].rank < hand[a].rank) ? b : a);
    const dear = arr => arr.reduce((a, b) => ((hand[b].suit !== trump) && (hand[a].suit === trump)) || ((hand[b].suit === trump) === (hand[a].suit === trump) && hand[b].rank > hand[a].rank) ? b : a);
    if (mis) {
      if (isDecl) return losing.length ? dear(losing) : cheap(winning);
      // defenders against Misère: let the declarer win - play under their card; else get rid of high cards
      if (curWho === decl && losing.length) return dear(losing);
      return losing.length ? dear(losing) : cheap(winning);
    }
    if (isDecl) return winning.length ? cheap(winning) : cheap(losing);
    // defending: a fellow defender has it - play low; the declarer has it (or is still to play) - beat it if we can
    const declStill = !plays.some(p => p.who === decl);
    if (curWho !== decl && !declStill) return losing.length ? cheap(losing) : cheap(winning);
    if (winning.length) return declStill ? dear(winning) : cheap(winning);
    return cheap(losing);
  }
  function tableInfo(g) {
    const cur = g.currentTrick ? g.currentTrick.plays : [];          // (no trick yet during the auction)
    const gone = new Set([...g.playedCards, ...cur.map(p => p.card)].map(code));
    const top = {}; for (const s of SUITS) { let r = 14; while (r >= 2 && gone.has(s + r)) r--; top[s] = r; }
    const v = [...Array(g.numPlayers)].map(() => new Set());
    const tricks = g.trickHistory.concat(cur.length ? [{ plays: cur }] : []);
    for (const t of tricks) { const lead = t.plays[0].card; for (const p of t.plays.slice(1)) if (p.card.suit !== lead.suit) v[p.who].add(lead.suit); }
    let trumpsOut = 0;
    if (g.trump) for (let r = 2; r <= 14; r++) if (!gone.has(g.trump + r)) trumpsOut++;
    return { top, void: v, trumpsOut };
  }
  // ---- guessing the hidden hands (for the hard player's look-ahead and the simulated bidding)
  // what each seat held at the start (its cards now and those it has played); would a player holding those have bid as
  // this seat did? (the auction replayed with the rules-of-thumb bidder: a guide to what a bid says about a hand)
  function playedBy(g) {
    const p = [...Array(g.numPlayers)].map(() => []);
    for (const t of g.trickHistory) for (const x of t.plays) p[x.who].push(x.card);
    if (g.currentTrick) for (const x of g.currentTrick.plays) p[x.who].push(x.card);
    return p;
  }
  function bidFits(g, seat, cards) {
    const r = g.rules, bid = g.bids[seat];
    if (bid == null) return true;
    let hi = PASS, s = g.nextSeat(g.dealer);
    for (let k = 0; k < g.numPlayers && s !== seat; k++) { const b = g.bids[s]; if (b != null && b > hi) hi = b; s = g.nextSeat(s); }
    const legal = [PASS];
    for (let x = r.minBid; x <= 4; x++) if (x > hi) legal.push(x);
    if (r.misere && MIS > hi) legal.push(MIS);
    if (NAPB > hi) legal.push(NAPB);
    legal.sort((x, y) => x - y);
    const want = chooseBid(cards, legal, "medium", g.activeCount, 0);
    // a pass says "not enough to bid"; a bid says "about this strong" (a bid either side of it will do)
    if (bid === PASS) return want === PASS;
    return want !== PASS && Math.abs(Math.min(want, 5) - Math.min(bid, 5)) <= 1;
  }
  // the unseen cards dealt to the others: none of a suit a player has shown out of, and (if it can be managed) the way
  // they bid
  function guessHands(g, me, infer = true, tries = 300) {
    const seen = new Set([...g.playedCards, ...(g.currentTrick ? g.currentTrick.plays.map(p => p.card) : []), ...g.hands[me].cards].map(code));
    const unseen = createDeck().filter(c => !seen.has(code(c)));
    const counts = g.hands.map(h => h.cards.length), v = tableInfo(g).void, pl = playedBy(g);
    const order = [...Array(g.numPlayers).keys()].filter(s => s !== me && counts[s]).sort((a, b) => v[b].size - v[a].size);
    let fallback = null;
    for (let t = 0; t < (infer ? tries : 50); t++) {
      const pool = shuffle(unseen.slice()), hands = counts.map((c, s) => s === me ? g.hands[me].cards.slice() : []);
      let ok = true;
      for (const s of order) {
        for (let i = pool.length - 1; i >= 0 && hands[s].length < counts[s]; i--) if (!v[s].has(pool[i].suit)) hands[s].push(pool.splice(i, 1)[0]);
        if (hands[s].length < counts[s]) { ok = false; break; }
      }
      if (!ok) continue;
      if (!fallback) fallback = hands;
      if (!infer || order.every(s => bidFits(g, s, hands[s].concat(pl[s])))) return hands;
    }
    if (fallback) return fallback;
    const pool = shuffle(unseen.slice());
    return counts.map((c, s) => s === me ? g.hands[me].cards.slice() : pool.splice(0, c));
  }
  // one deal played out from the first lead with good sense; the tricks the declarer takes
  function simRound(g, handsIn, decl, contract) {
    const n = g.numPlayers, hands = handsIn.map(h => h.slice());
    const sim = { numPlayers: n, declarer: decl, contract, trump: null, playedCards: [], trickHistory: [], currentTrick: { plays: [] }, tricksPlayed: 0 };
    let turn = decl, won = 0;
    for (let t = 0; t < 5; t++) {
      for (let k = 0; k < g.activeCount; k++) {
        const hand = hands[turn], legal = legalIndices(hand, sim.currentTrick.plays);
        const i = legal.length === 1 ? legal[0] : choosePlay(hand, legal, sim, turn, tableInfo(sim));
        const card = hand.splice(i, 1)[0];
        if (t === 0 && k === 0 && contract !== MIS) sim.trump = card.suit;
        sim.currentTrick.plays.push({ who: turn, card });
        turn = g.nextSeat(turn);
      }
      const ps = sim.currentTrick.plays, w = ps[winnerIndex(ps.map(p => p.card), sim.trump)].who;
      if (w === decl) won++;
      sim.trickHistory.push({ plays: ps }); ps.forEach(p => sim.playedCards.push(p.card));
      sim.currentTrick = { plays: [] }; sim.tricksPlayed++; turn = w;
    }
    return won;
  }
  // the bid worth most counters on average: each bid's chance from K guessed deals, played out once as a trick contract
  // (the tricks it takes) and once as Misère (if Misère may be bid); passing is worth nothing
  function simBid(g, seat, legal, K) {
    if (legal.length === 1) return legal[0];
    const opp = g.activeCount - 1, tricks = new Array(6).fill(0), wantMis = legal.includes(MIS);
    let misOk = 0;
    for (let k = 0; k < K; k++) {
      const hands = guessHands(g, seat, true, 60);
      tricks[simRound(g, hands, seat, 4)]++;
      if (wantMis && simRound(g, hands, seat, MIS) === 0) misOk++;
    }
    const chance = b => b === MIS ? misOk / K : tricks.slice(tricksNeeded(b)).reduce((a, x) => a + x, 0) / K;
    const pool = g.rules.pool ? g.pool : 0;
    let best = PASS, bestEV = 0;
    for (const b of legal) {
      if (b === PASS) continue;
      const p = chance(b), [w, l] = stakes(b);
      const ev = opp * (p * w - (1 - p) * l) + (b >= NAPB ? p * pool : 0);
      if (best === PASS && !legal.includes(PASS) ? true : ev > bestEV) { bestEV = ev; best = b; }
    }
    return best;
  }

  class AI {
    constructor({ difficulty = "medium" } = {}) { this.difficulty = difficulty; }
    setDifficulty(d) { this.difficulty = d; }
    resetMemory() {}
    choosePass() { return [0, 1, 2]; }
    chooseBid(ctx) {
      const g = ctx.game;
      if (g && this.difficulty !== "easy" && ctx.seat != null) return simBid(g, ctx.seat, ctx.legalBids, this.difficulty === "hard" ? 100 : 30);
      return chooseBid(ctx.hand, ctx.legalBids, this.difficulty, g ? g.activeCount : ctx.numPlayers, g && g.rules.pool ? g.pool : 0);
    }
    choosePlay(ctx) {
      if (ctx.legal.length === 1) return ctx.legal[0];
      const g = ctx.game;
      if (this.difficulty === "easy" && Math.random() < 0.2) return ctx.legal[Math.floor(Math.random() * ctx.legal.length)];
      if (this.difficulty === "hard") return this.lookAhead(ctx);
      return choosePlay(ctx.hand, ctx.legal, g, ctx.seat, tableInfo(g));
    }
    // the hard player: each card it may play, the rest of the hand played out 120 times with guessed hands
    lookAhead(ctx) {
      const g = ctx.game, me = ctx.seat, score = new Map(ctx.legal.map(i => [i, 0]));
      for (let k = 0; k < 120; k++) {
        const hands = guessHands(g, me, true, 25);     // (a few tries at fitting the auction: it has to be quick)
        for (const i of ctx.legal) score.set(i, score.get(i) + this.playOut(g, hands, me, i));
      }
      let best = ctx.legal[0];
      for (const i of ctx.legal) if (score.get(i) > score.get(best)) best = i;
      return best;
    }
    playOut(g, handsIn, me, first) {
      const n = g.numPlayers, hands = handsIn.map(h => h.slice()), inN = g.activeCount, next = s => g.nextSeat(s);
      const sim = { declarer: g.declarer, contract: g.contract, trump: g.trump, numPlayers: n, playedCards: g.playedCards.slice(),
        trickHistory: g.trickHistory.slice(), currentTrick: { plays: g.currentTrick.plays.slice() }, tricksPlayed: g.tricksPlayed };
      const won = g.won.slice();
      let turn = me, firstMove = true, guard = 0;
      while (guard++ < 60) {
        const h = hands[turn];
        if (!h.length) break;
        const legal = legalIndices(h, sim.currentTrick.plays);
        const i = firstMove ? first : legal.length === 1 ? legal[0] : choosePlay(h, legal, sim, turn, tableInfo(sim));
        firstMove = false;
        const card = h.splice(i, 1)[0];
        if (sim.tricksPlayed === 0 && !sim.currentTrick.plays.length && sim.contract !== MIS) sim.trump = card.suit;
        sim.currentTrick.plays.push({ who: turn, card });
        if (sim.currentTrick.plays.length === inN) {
          const ps = sim.currentTrick.plays, w = ps[winnerIndex(ps.map(p => p.card), sim.trump)].who;
          won[w]++; sim.trickHistory.push({ plays: ps }); ps.forEach(p => sim.playedCards.push(p.card));
          sim.currentTrick = { plays: [] }; sim.tricksPlayed++; turn = w;
        } else turn = next(turn);
      }
      const made = sim.contract === MIS ? won[sim.declarer] === 0 : won[sim.declarer] >= tricksNeeded(sim.contract);
      return (me === sim.declarer) === made ? 1 : 0;
    }
  }

  // ---------------------------------------------------------------- on screen, and the words
  const sortCards = (a, b) => (SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit]) || (a.rank - b.rank);
  const mark = s => suitIcon(s);
  const bidLabel = b => b === PASS ? "Pass" : BID_NAME[b];
  const bidOptions = g => g.legalBids(0).map(b => ({ value: b, label: bidLabel(b),
    tip: b === PASS ? "Pass: let someone else play" : b === MIS ? "Misère: take no tricks at all (no trumps) - 3 from each player, or 3 to each"
      : b === NAPB ? "Nap: take all five tricks - 10 from each player, or 5 to each" : b === WELL ? "Wellington: all five - 10 from each, or 10 to each"
      : b === BLU ? "Blücher: all five - 15 from each, or 15 to each" : `Take ${b} tricks or more - ${b} from each player, or ${b} to each` }));
  const bidTitle = g => `Your bid · ${g.highBid === PASS ? "nobody has bid yet" : "highest so far " + bidLabel(g.highBid)}`;
  // a bid by a name: a number in a wax seal; a word (Misère, Nap...) on a little parchment label
  const token = (b, extra = "") => typeof BID_NAME[b] === "string" && isNaN(+BID_NAME[b])
    ? `<span class="nap-word${extra}" data-tip="Bid ${bidLabel(b)}">${bidLabel(b)}</span>`
    : `<span class="bid-token revealed${extra}" data-tip="Bid ${bidLabel(b)}">${bidLabel(b)}</span>`;
  const coins = (g, seat) => `<span class="nap-coins" data-tip="Counters">${g.scores[seat]}</span>`;
  const statsHtml = (g, seat) => {
    if (g.active[seat] === false) return `<span class="stat-muted">cleaned out</span>`;
    return coins(g, seat) + statsInner(g, seat);
  };
  const statsInner = (g, seat) => {
    const b = g.bids[seat];
    if (g.phase === "bid") {
      if (b == null) { const t = g.turn === seat; return `<span class="bid-token empty">${t ? "…" : ""}</span><span class="stat-muted">${t ? "bidding…" : "waiting"}</span>`; }
      return b === PASS ? `<span class="stat-muted">passed</span>` : token(b);
    }
    if (g.declarer == null) return "";
    const won = g.won[seat] || 0;
    if (seat === g.declarer) {
      const need = tricksNeeded(g.contract);
      return `${token(g.contract, (g.contract !== MIS && won >= need ? " on-target" : "") + " laurel")}<span class="stat">Won <b>${won}</b>${g.contract === MIS ? "" : ` of ${need}`}</span>`;
    }
    return `<span class="stat-muted">against</span><span class="stat">Won <b>${won}</b></span>`;
  };
  // the winning bid, as said when the bidding ends, and the contract under the trumps (the bidder's bid wears a laurel)
  const bidResult = (g, name) => {
    if (g.declarer == null) return "";
    const d = g.declarer, you = d === 0, who = name(d), b = bidLabel(g.contract), need = tricksNeeded(g.contract);
    if (g.contract === MIS) return you ? "You won the bid: Misère. Take no tricks at all - there are no trumps."
      : `${who} won the bid: Misère. ${who} must take no tricks - there are no trumps.`;
    const what = need >= 5 ? `${b}: all five tricks` : `${b} tricks`;
    return you ? `You won the bid: ${what}. Lead a card - its suit is trumps.`
      : `${who} won the bid: ${what}, playing alone against the rest of you.`;
  };
  const contractLine = (g, name) => g.declarer == null ? "" : `<i class="nap-contract"><span>${name(g.declarer)}</span><span>${bidLabel(g.contract)}</span></i>`;
  const marker = (g, name = s => "") => g.phase === "play" || g.phase === "roundEnd"
    ? (g.contract === MIS ? { html: `${contractLine(g, name)}<span>∅</span><b>none</b>`, caption: "Trumps", tip: "Misère: no trumps" }
      : g.trump ? { html: `${contractLine(g, name)}<span>${mark(g.trump)}</span><b>${SUIT_WORD[g.trump]}</b>`, caption: "Trumps", tip: `${SUIT_WORD[g.trump][0].toUpperCase() + SUIT_WORD[g.trump].slice(1)} are trumps this hand` }
      : { html: `${contractLine(g, name)}<span>?</span><b>first lead</b>`, caption: "Trumps", tip: "The suit of the first card led will be trumps" })
    : { html: `<span>?</span><b>bidding</b>`, caption: "Trumps", tip: "Trumps are the suit of the first card the winning bidder leads" };
  const summary = (g, r, name) => {
    const who = name(r.declarer), b = bidLabel(r.contract), [win, lose] = stakes(r.contract);
    let sub = r.made ? `${who} made ${b === "Misère" ? "Misère" : b === "Nap" || r.contract > NAPB ? b : b + " tricks"}: ${win} from each player.`
                     : `${who} ${r.contract === MIS ? "took a trick" : "fell short"} on ${b}: ${lose} to each player.`;
    if (r.poolWon) sub += ` And the pool: ${r.poolWon}!`;
    const outs = r.broke.map(s => s === 0 ? "You're" : name(s) + " is");
    if (outs.length) sub += ` ${outs.join(" and ")} cleaned out.`;
    let html = `<thead><tr><th>Player</th><th>Bid</th><th>Won</th><th>Counters</th><th>Left</th></tr></thead><tbody>`;
    for (let s = 0; s < g.numPlayers; s++) {
      if (g.active[s] === false && !r.broke.includes(s)) { html += `<tr class="missed"><td>${name(s, true)}</td><td colspan="4">out</td></tr>`; continue; }
      html += `<tr class="${r.points[s] >= 0 ? "exact" : "missed"}${s === 0 ? " me" : ""}"><td>${name(s, true)}</td><td>${s === r.declarer ? b : "-"}</td><td>${r.won[s]}</td>` +
        `<td>${r.points[s] > 0 ? "+" : ""}${r.points[s]}</td><td>${r.totals[s]}</td></tr>`;
    }
    return { sub, html: html + "</tbody>", title: `Deal ${g.history.length} complete` };
  };
  // faces: the declarer pleased with each trick won, furious when the bid is lost; the others the other way round
  const react = (app, g, res) => {
    const d = g.declarer, mis = g.contract === MIS, made = g.made;
    if (g.phase === "roundEnd" || g.phase === "gameOver") {
      for (let s = 0; s < g.numPlayers; s++) app.react(s, (s === d) === made ? "win" : "bust", 3000);
      if (!made && typeof CAVE !== "undefined") CAVE.flare();
      return;
    }
    const good = mis ? res.winner !== d : res.winner === d;
    app.react(d, good ? "win" : "bust", 1800);
  };
  const ruleNotes = r => ({
    minBid: r.minBid === 1 ? "The lowest bid is 1 trick." : "The lowest bid is 2 tricks.",
    misere: r.misere ? "Misère may be bid (between 3 and 4): take no tricks at all, with no trumps - 3 from each player, or 3 to each." : "No Misère.",
    wellington: r.wellington ? "After a Nap, Wellington may be bid (10 each way), and after that Blücher (15 each way)." : "Nap is the highest bid.",
    allPass: r.allPass === "dealer" ? "If everyone else passes, the dealer must bid the lowest bid." : "If everyone passes, the cards are dealt again by the next dealer.",
    ending: r.ending === "last" ? "Play on until only one player has counters left." : "The game ends after 12 deals (6 in a short game), or when only one player is left.",
    broke: r.broke === "end" ? "When anyone runs out of counters, the game ends." : "A player who runs out of counters drops out (if it's you, the game ends).",
    cover: r.cover ? "You may only bid what you could pay out if you lost: Nap with four players needs 15 counters." : "You may bid anything, whatever counters you have left.",
    pool: r.pool ? "Everyone puts 1 counter in the pool each deal; whoever makes Nap (or more) takes the whole pool." : "No pool.",
  });
  const rulesSpec = [
    { key: "minBid", label: "Lowest bid", options: [[2, "2 tricks", "The lowest bid is 2"], [1, "1 trick", "Bids may start at 1"]] },
    { key: "misere", label: "Misère", options: [[true, "Allowed", "Misère: take no tricks at all, no trumps; it ranks between 3 and 4"], [false, "Not allowed", "No Misère bids"]] },
    { key: "wellington", label: "After Nap", options: [[false, "Nap is top", "Nap is the highest bid"], [true, "Wellington, Blücher", "After a Nap: Wellington (10 each way), then Blücher (15 each way)"]] },
    { key: "allPass", label: "All pass", options: [["redeal", "New deal", "If everyone passes, deal again"], ["dealer", "Dealer bids", "If everyone else passes, the dealer must bid"]] },
    { key: "ending", label: "Game end", options: [["deals", "12 deals", "The game ends after 12 deals (6 short), or when one player is left"], ["last", "Last one standing", "Play on until only one player has counters"]] },
    { key: "broke", label: "Cleaned out", options: [["out", "Drops out", "A player with no counters left drops out"], ["end", "Game ends", "The game ends as soon as anyone runs out"]] },
    { key: "cover", label: "Cover your bid", options: [[false, "Off", "Bid anything"], [true, "On", "Only bid what you could pay out if you lost"]] },
    { key: "pool", label: "Nap pool", options: [[false, "Off", "No pool"], [true, "On", "1 counter each into the pool every deal; making Nap takes the pool"]] },
  ];
  const howTo = r => {
    const n = ruleNotes(r), house = rulesSpec.filter(s => r[s.key] !== DEFAULT_RULES[s.key]).map(s => s.label);
    return `
        <h3>How to play</h3>
        <ul>
          ${SUIT_STYLE === "infernal" ? `<li>Nap (Napoleon), with the Infernal cards: spades are <strong>pentagrams</strong>, hearts <strong>flames</strong>, diamonds <strong>tridents</strong> and clubs <strong>horns</strong>.</li>` : `<li>Nap (Napoleon), an old pub game for counters.</li>`}
          <li>Played for counters: everyone starts with ${STAKE} (${STAKE / 2} in a short game). Five cards each, and whoever bids highest plays alone against everyone else. <strong>Most counters wins.</strong></li>
          <li>The <strong>Tutorial</strong> plays one hand with you, step by step.</li>
        </ul>
        <h3>Rules</h3>
        <ul>
          <li>3 to 5 players, five cards each.</li>
          <li><strong>The auction</strong><br>Once round, from the dealer's left: pass, or bid more than anyone so far - the number of tricks you'll take, or <strong>Nap</strong> for all five. ${n.minBid} ${n.misere} ${n.wellington} ${n.allPass}</li>
          <li><strong>Playing</strong><br>The highest bidder leads, and the suit of that first card is <strong>trumps</strong> for the hand. Follow suit if you can; if you can't, play anything. The highest trump wins the trick, or the highest card of the suit led. The winner leads next.</li>
          <li><strong>Paying</strong><br>Make your bid and every other player pays you that many counters; fall short and you pay each of them. Nap: 10 from each, or 5 to each. Nobody pays more than they have. ${n.cover} ${n.pool}</li>
          <li><strong>The end</strong><br>${n.broke} ${n.ending} (Deals where everyone passes don't count.) Most counters wins.</li>
        </ul>
        <h3>House rules</h3>
        <ul><li>Chosen in the <strong>Rules</strong> tab before a game. ${house.length ? `In use: <strong>${house.join(", ")}</strong>.` : "None in use: these are the standard rules."}</li></ul>
        <h3>Tips</h3>
        <ul>
          <li>Bid on a long suit with its top cards: lead from it first and it becomes trumps.</li>
          <li>Against the bidder, work together: don't beat a card that's already beating the bidder.</li>
        </ul>`;
  };
  // the tutorial: you deal, so you bid last; Wellington bids 2, and you take it with 3
  const tutorial = {
    opponents: ["Joséphine", "Wellington", "Nelson"],
    firstDealer: 0,
    intro: ["Welcome to <b>Nap</b>: five cards each, and whoever bids highest plays alone against everyone else. Let's play a hand."],
    rounds: [{
      hands: [
        ["S14", "S13", "S10", "H14", "D4"],
        ["S2", "D7", "H3", "C10", "C5"],
        ["S5", "S9", "H8", "D12", "C13"],
        ["S7", "H5", "H10", "D9", "C2"]
      ],
      bids: [3, PASS, 2, PASS],
      tricks: [
        ["S14", "S2", "S5", "S7"],
        ["S13", "D7", "S9", "H5"],
        ["H14", "H3", "H8", "H10"]
      ],
      coach: {
        start: [{ t: "Your five cards. Everyone bids how many tricks they'll take; the highest bidder plays alone against the rest.", spot: "#player-hand" }],
        bid: { t: "Joséphine passed, Wellington bid 2 and Nelson passed. To play, bid higher: your ace and king of pentagrams and ace of flames should take 3. Bid <b>3</b>." },
        play0: { t: "You won the auction, so you lead - and the suit of your first card becomes <b>trumps</b>. Lead your <b>ace of pentagrams</b>." },
        trick0: ["Pentagrams are trumps, and everyone had to follow with one. 1 trick of your 3."],
        play1: { t: "Lead your <b>king of pentagrams</b> to draw out the last trumps." },
        trick1: ["Joséphine and Nelson had no pentagrams left, so they could play anything. 2 tricks."],
        play2: { t: "Now your <b>ace of flames</b>." },
        trick2: ["3 tricks: you've made your bid, and everyone else pays you 3 counters."],
        end: { t: "That's a hand. The others gang up to stop whoever wins the auction. After 12 deals, whoever has the most counters wins." }
      }
    }],
    outro: ["Bid <b>Nap</b> to take all five tricks: 10 counters from every player if you do it, 5 to each if you don't. Run out of counters and you're out. Choose your players and press <b>Play</b>. The rules are under the book button."]
  };

  return { id: "nap", name: "Nap", titleLogo: "img/logo-nap.webp?v=1", subtitle: "The classic trick-taking game",
    defaultCast: "napoleonic", defaultStyle: "napoleonic",   // (its opponents: the Napoleonic cast, art/nap-cast/ - see CASTS in bs-app.js)
    std: true, defaultTable: "empire", defaultBack: "imperial-green", tagline: "Bid against the table: two tricks, three, four - or all five", players: [3, 4, 5], logo: null, storage: "nap",
    DEFAULT_RULES, cleanRules, Game, AI, CardView: HEARTS.CardView, tutorial, bidResult, code, parse, cardName, shortName, sortCards,
    passOffset: () => 0, passWords: () => "no pass", hasBids: true, highWins: true, PASS,
    target: (n, length) => length === "short" ? DEALS / 2 : DEALS,
    goalText: (n, length) => `${length === "short" ? STAKE / 2 : STAKE} counters each`,
    goalLabel: g => { const k = Math.min(g.history.length + (g.phase === "roundEnd" || g.phase === "gameOver" ? 0 : 1), g.target);
      return (g.rules.ending === "last" ? `Deal <b>${k}</b>` : `Deal <b>${k}</b> of ${g.target}`) + (g.rules.pool ? ` · pool ${g.pool}` : ""); },
    unit: "counters",
    isPrize: () => false, prizeTaken: () => "", prizeColumn: "Bids made",
    sweepText: () => "", passName: c => shortName(c), cardsEach: () => "5 cards each",
    bidOptions, bidTitle, statsHtml, marker, summary, react, bidLabel,
    rulesSpec, ruleNotes, howTo, demo: ["S14", "S13", "H14", "D11", "C2", "S2"] };
})();
