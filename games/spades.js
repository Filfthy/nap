// games/spades.js - Spades for Infernal Tricksters, the cutthroat game (everyone for themselves, no partners), played
// with the Infernal deck: spades are pentagrams (and trumps), hearts flames, diamonds tridents, clubs horns.
//
// Standard rules: 52 cards (3 players: the 2 of horns out, 17 each; 4: 13 each; 5: the 2s of horns and tridents
// out, 10 each). Everyone bids, in turn from the dealer's left, how many tricks they'll take - or Nil (none). The
// player left of the dealer leads; follow suit if you can; pentagrams are trumps, and can't be led until one has
// been played on another suit. Make your bid: 10 a trick bid, and 1 for each trick over (a "bag"); every 10 bags
// cost 100. Miss it: minus 10 a trick bid. Nil: 100 if you take no tricks, minus 100 if you take any. Game to 500;
// highest wins.

const SPADES = (() => {
  const SUITS = ["C", "D", "H", "S"];
  const SUIT_ORDER = { C: 0, D: 1, H: 2, S: 3 };
  const NAME = { 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10", 11: "J", 12: "Q", 13: "K", 14: "A" };
  const WORD = { 11: "jack", 12: "queen", 13: "king", 14: "ace" };
  const SUIT_WORD = SUIT_WORD_NOW;       // (games/suits.js: standard or Infernal names)
  const TARGET = 500;

  // ---- the rules ----
  //   nil          bidding Nil (no tricks at all) is allowed
  //   bags         every 10 overtricks ("bags") cost 100
  //   spadesBroken pentagrams can't be led until one has been played on another suit (unless that's all you have)
  //   lowClubLeads the 2 of horns (or the lowest horn) leads the first trick (off: the player left of the dealer)
  //   nilBags      tricks taken by a failed Nil count as bags too
  const DEFAULT_RULES = { nil: true, bags: true, spadesBroken: true, lowClubLeads: false, nilBags: true };
  function cleanRules(r) {
    const o = Object.assign({}, DEFAULT_RULES, r || {});
    for (const k of Object.keys(DEFAULT_RULES)) o[k] = !!o[k];
    return o;
  }

  class Card {
    constructor(suit, rank) { this.suit = suit; this.rank = rank; this.value = rank; this.copy = 0; this.isSpecial = false; this.points = 0; }
  }
  const code = c => c.suit + c.rank;
  const parse = s => new Card(s[0], +s.slice(1));
  const cardName = c => c.rank > 10 ? `the ${WORD[c.rank]} of ${SUIT_WORD[c.suit]}` : `the ${c.rank} of ${SUIT_WORD[c.suit]}`;
  const shortName = c => `${NAME[c.rank]} of ${SUIT_WORD[c.suit]}`;
  function createDeck(n) {
    const d = [];
    for (const s of SUITS) for (let r = 2; r <= 14; r++) d.push(new Card(s, r));
    const out = n === 3 ? ["C2"] : n === 5 ? ["C2", "D2"] : [];
    return d.filter(c => !out.includes(code(c)));
  }
  // the winner: the highest pentagram, or else the highest card of the suit led
  function winnerIndex(cards) {
    let b = 0;
    for (let i = 1; i < cards.length; i++) {
      const c = cards[i], w = cards[b];
      if (c.suit === w.suit ? c.rank > w.rank : c.suit === "S") b = i;
    }
    return b;
  }
  function legalIndices(cards, st, rules) {
    const all = cards.map((_, i) => i);
    if (!st.plays.length) {
      if (st.tricksPlayed === 0 && rules.lowClubLeads && st.firstCode) {
        const f = all.filter(i => code(cards[i]) === st.firstCode);
        if (f.length) return f;
      }
      if (rules.spadesBroken && !st.broken) { const k = all.filter(i => cards[i].suit !== "S"); if (k.length) return k; }
      return all;
    }
    const lead = st.plays[0].card;
    return cards.some(c => c.suit === lead.suit) ? all.filter(i => cards[i].suit === lead.suit) : all;
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
    if (c.suit === "S" && !st.plays.length && rules.spadesBroken && !st.broken)
      return "Pentagrams can't be led until they're broken: someone has to trump with one first.";
    return "You can't play that card now.";
  }
  // a hand's score for one player: bid, tricks taken, the rules -> { points, bags }
  function handScore(bid, won, rules) {
    if (bid === 0) {
      if (won === 0) return { points: 100, bags: 0 };
      return { points: -100, bags: rules.nilBags ? won : 0 };
    }
    if (won >= bid) return { points: bid * 10 + (won - bid), bags: won - bid };
    return { points: -bid * 10, bags: 0 };
  }

  class Trick {
    constructor(leader, n) { this.leader = leader; this.numPlayers = n; this.plays = []; }
    addPlay(who, card) { this.plays.push({ who, card }); }
    isComplete() { return this.plays.length >= this.numPlayers; }
    winner() { return this.plays[winnerIndex(this.plays.map(p => p.card))].who; }
    get points() { return 0; }
  }

  class Game {
    constructor() { this.numPlayers = 4; this.phase = "idle"; this.roundIndex = -1; this.scores = []; this.bags = []; this.history = []; this.hands = []; this.taken = []; this.trickHistory = []; this.playedCards = []; this.rules = cleanRules(null); this.bids = []; this.won = []; }
    startNewGame({ numPlayers = 4, firstDealer = 0, length = "full", presetRounds = null, rules = null } = {}) {
      this.numPlayers = numPlayers; this.rules = cleanRules(rules);
      this.target = length === "short" ? TARGET / 2 : TARGET;
      this.scores = new Array(numPlayers).fill(0); this.bags = new Array(numPlayers).fill(0);
      this.history = []; this.roundIndex = -1; this.dealer = firstDealer;
      this.presetRounds = presetRounds; this.phase = "idle"; this.hands = []; this.currentTrick = null;
      this.bids = new Array(numPlayers).fill(null); this.won = new Array(numPlayers).fill(0);
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
      this.handSize = this.hands[0].cards.length;
      BACK_CREASE_SEED = (Math.random() * 4294967296) >>> 0;
      this.taken = new Array(n).fill(0); this.won = new Array(n).fill(0); this.tricksWon = this.won;
      this.trickHistory = []; this.playedCards = []; this.tricksPlayed = 0; this.broken = false;
      this.bids = new Array(n).fill(null);
      this.passTo = 0; this.passes = new Array(n).fill(null); this.received = [...Array(n)].map(() => []);
      this.currentTrick = null;
      this.phase = "bid";
      this.turn = this.nextSeat(this.dealer);
    }
    legalBids(seat) { const lo = this.rules.nil ? 0 : 1; return [...Array(this.handSize + 1 - lo)].map((_, i) => i + lo); }
    placeBid(seat, bid) {
      if (this.phase !== "bid" || seat !== this.turn || this.bids[seat] != null || !this.legalBids(seat).includes(bid)) return { ok: false };
      this.bids[seat] = bid;
      if (this.bids.every(b => b != null)) this.beginPlay();
      else this.turn = this.nextSeat(seat);
      return { ok: true };
    }
    beginPlay() {
      this.phase = "play";
      let first = null;
      this.hands.forEach((h, s) => h.cards.forEach(c => { if (c.suit === "C" && (!first || c.rank < first.c.rank)) first = { s, c }; }));
      this.firstCode = first ? code(first.c) : null;
      this.turn = this.rules.lowClubLeads && first ? first.s : this.nextSeat(this.dealer);
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
      if (card.suit === "S" && this.currentTrick.plays[0].card.suit !== "S") this.broken = true;
      if (this.currentTrick.isComplete()) return { ok: true, card, trickComplete: true };
      this.turn = this.nextSeat(seat);
      return { ok: true, card, trickComplete: false };
    }
    resolveCompletedTrick() {
      const t = this.currentTrick, winner = t.winner();
      this.won[winner]++;
      this.trickHistory.push({ leader: t.leader, plays: t.plays.slice(), winner, points: 0 });
      this.tricksPlayed++;
      const plays = t.plays.slice();
      if (this.hands[0].cards.length === 0) { this.finishRound(); return { winner, plays, points: 0, roundOver: true }; }
      this.turn = winner; this.currentTrick = new Trick(winner, this.numPlayers);
      return { winner, plays, points: 0, roundOver: false };
    }
    finishRound() {
      const n = this.numPlayers, points = [], bagsNow = [], penalty = new Array(n).fill(0);
      for (let s = 0; s < n; s++) {
        const r = handScore(this.bids[s], this.won[s], this.rules);
        bagsNow[s] = r.bags; points[s] = r.points;
        if (this.rules.bags) {
          this.bags[s] += r.bags;
          while (this.bags[s] >= 10) { this.bags[s] -= 10; penalty[s] -= 100; }
        }
        points[s] += penalty[s];
        this.scores[s] += points[s];
      }
      this.taken = points.slice();
      this.history.push({ round: this.roundIndex + 1, points, bids: this.bids.slice(), won: this.won.slice(), bagsNow, bagPenalty: penalty,
        bags: this.bags.slice(), totals: this.scores.slice(), sweeper: -1, spiders: new Array(n).fill(0),
        made: this.bids.map((b, s) => b === 0 ? this.won[s] === 0 : this.won[s] >= b) });
      this.currentTrick = null; this.turn = null;
      this.phase = this.scores.some(v => v >= this.target) ? "gameOver" : "roundEnd";
    }
    get leaders() { const hi = Math.max(...this.scores); return this.scores.map((v, s) => v === hi ? s : -1).filter(s => s >= 0); }
  }

  // ---------------------------------------------------------------- the computer players
  //   bidding: counts its sure and likely tricks - high pentagrams, long pentagrams, side aces and guarded kings,
  //            short side suits it can trump; bids Nil with a hand that has nothing to win with
  //   medium: plays to make its bid and then stop - wins cheaply while it still needs tricks, ducks once it has
  //           them (no bags), sheds its winners when void; as Nil it ducks everything; and it lets a Nil bidder
  //           who is winning a trick keep it
  //   easy: bids loosely and now and then plays a careless card
  //   hard: tries each card it may play and plays the hand out many times with guessed hands for the others
  //         (fitting the suits they've shown they lack), scoring the hand for itself as the rules do
  function estimate(hand, n) {
    const by = s => hand.filter(c => c.suit === s).sort((a, b) => b.rank - a.rank);
    const sp = by("S");
    let t = 0;
    sp.forEach((c, i) => { if (c.rank === 14) t += 1; else if (c.rank === 13) t += sp.length >= 2 ? 0.9 : 0.4; else if (c.rank === 12) t += sp.length >= 3 ? 0.7 : 0.25; else if (c.rank === 11) t += sp.length >= 4 ? 0.45 : 0.1; });
    if (sp.length > 3) t += (sp.length - 3) * 0.8;                        // long trumps win late
    for (const s of ["C", "D", "H"]) {
      const cs = by(s);
      cs.forEach(c => { if (c.rank === 14) t += cs.length <= 5 ? 0.95 : 0.7; else if (c.rank === 13) t += cs.length >= 2 && cs.length <= 4 ? 0.55 : 0.2; else if (c.rank === 12) t += cs.length === 3 ? 0.2 : 0; });
      if (sp.length >= 2 && cs.length <= 1) t += (2 - cs.length) * 0.45 * Math.min(1, (sp.length - 1) / 2);   // ruffing
    }
    return t * (n === 3 ? 1.1 : n === 5 ? 0.9 : 1);
  }
  function nilFits(hand) {
    const sp = hand.filter(c => c.suit === "S");
    if (sp.some(c => c.rank >= 11) || sp.length > 3) return false;
    for (const s of ["C", "D", "H"]) { const cs = hand.filter(c => c.suit === s); if (cs.some(c => c.rank >= 13) && cs.length < 4) return false; if (cs.length && Math.min(...cs.map(c => c.rank)) > 7) return false; }
    return estimate(hand, 4) < 1.2;
  }
  function chooseBid(hand, n, rules, difficulty, bids) {
    if (rules.nil && difficulty !== "easy" && nilFits(hand)) return 0;
    let b = Math.round(estimate(hand, n));
    if (difficulty === "easy") b += Math.round(Math.random() * 2 - 1);
    // the bids so far leave fewer tricks than the hand has: shade down a little
    const sum = bids.reduce((a, x) => a + (x || 0), 0);
    if (sum + b > hand.length + 1 && b > 1) b--;
    return Math.max(rules.nil ? (b <= 0 ? 1 : b) : 1, Math.min(hand.length, b));
  }
  function mediumPlay(hand, legal, plays, n, st, me) {
    const bid = st.bids[me], won = st.won[me], nil = bid === 0;
    const needMore = !nil && won < bid;
    const nilOthers = st.bids.map((b, s) => b === 0 && s !== me && st.won[s] === 0);
    if (!plays.length) {
      // leading: wanting tricks, cash a sure winner (an ace, the top pentagram), or else lead low from a long suit;
      // not wanting them, lead the lowest card, never a pentagram
      const score = c => c.rank + (c.suit === "S" ? 8 : 0);
      if (needMore) {
        const aces = legal.filter(i => hand[i].rank === 14 && hand[i].suit !== "S");
        if (aces.length) return aces[0];
        const topS = legal.filter(i => hand[i].suit === "S" && hand[i].rank === st.topSpade);
        if (topS.length) return topS[0];
      }
      return legal.reduce((a, b) => score(hand[b]) < score(hand[a]) ? b : a);
    }
    const cards = plays.map(p => p.card);
    const curW = winnerIndex(cards), curWho = plays[curW].who;
    const beats = c => { const w = cards[curW]; return c.suit === w.suit ? c.rank > w.rank : c.suit === "S"; };
    const winning = legal.filter(i => beats(hand[i])), losing = legal.filter(i => !beats(hand[i]));
    const last = plays.length === n - 1;
    const lowest = arr => arr.reduce((a, b) => (hand[b].suit === "S") - (hand[a].suit === "S") < 0 || ((hand[b].suit === "S") === (hand[a].suit === "S") && hand[b].rank < hand[a].rank) ? b : a);
    const highest = arr => arr.reduce((a, b) => (hand[b].suit !== "S" && hand[a].suit === "S") || ((hand[b].suit === "S") === (hand[a].suit === "S") && hand[b].rank > hand[a].rank) ? b : a);
    // a Nil bidder (not me) is winning this trick: let them keep it
    if (nilOthers[curWho] && losing.length) return highest(losing);
    if (nil || !needMore) {
      // ducking: the highest card that still loses (shedding danger), else the lowest winner
      if (losing.length) return highest(losing);
      return lowest(winning);
    }
    // wanting tricks: win it as cheaply as possible - last, or with a card nobody can beat
    if (winning.length) {
      if (last) return lowest(winning);
      const sure = winning.filter(i => hand[i].suit === "S" ? hand[i].rank === st.topSpade : hand[i].rank === (st.top[hand[i].suit] || 0));
      if (sure.length) return lowest(sure);
      return lowest(winning);
    }
    return lowest(losing);
  }
  // what the table shows: the highest card still out in each suit, who lacks which suit
  function tableState(g, extraPlays) {
    const gone = new Set([...g.playedCards, ...(extraPlays || []).map(p => p.card)].map(code));
    const top = {};
    for (const s of SUITS) { let r = 14; while (r >= 2 && gone.has(s + r)) r--; top[s] = r; }
    return { bids: g.bids, won: g.won, top, topSpade: top.S };
  }
  function voidsOf(g) {
    const v = [...Array(g.numPlayers)].map(() => new Set());
    const tricks = (g.trickHistory || []).concat(g.currentTrick && g.currentTrick.plays.length ? [{ plays: g.currentTrick.plays }] : []);
    for (const t of tricks) { const lead = t.plays[0].card; for (const p of t.plays.slice(1)) if (p.card.suit !== lead.suit) v[p.who].add(lead.suit); }
    return v;
  }
  function dealGuess(unseen, counts, me, mine, voids) {
    const n = counts.length;
    for (let a = 0; a < 20; a++) {
      const pool = shuffle(unseen.slice()), hands = [...Array(n)].map((_, s) => s === me ? mine.slice() : []);
      const order = [...Array(n).keys()].filter(s => s !== me).sort((x, y) => voids[y].size - voids[x].size);
      let ok = true;
      for (const s of order) {
        for (let i = pool.length - 1; i >= 0 && hands[s].length < counts[s]; i--) if (!voids[s].has(pool[i].suit)) hands[s].push(pool.splice(i, 1)[0]);
        if (hands[s].length < counts[s]) { ok = false; break; }
      }
      if (ok) return hands;
    }
    const pool = shuffle(unseen.slice());
    return [...Array(n)].map((_, s) => { if (s === me) return mine.slice(); const h = []; while (h.length < counts[s]) h.push(pool.pop()); return h; });
  }
  function playOut(g, handsIn, me, first) {
    const n = g.numPlayers, rules = g.rules, hands = handsIn.map(h => h.slice());
    let plays = g.currentTrick.plays.map(p => ({ who: p.who, card: p.card }));
    let turn = me, tricksPlayed = g.tricksPlayed, firstMove = true, broken = g.broken;
    const won = g.won.slice(), gone = new Set(g.playedCards.map(code));
    plays.forEach(p => gone.add(code(p.card)));
    const top = {}; const recompute = () => { for (const s of SUITS) { let r = 14; while (r >= 2 && gone.has(s + r)) r--; top[s] = r; } };
    recompute();
    const st = { bids: g.bids, won, top, topSpade: top.S };
    let guard = 0;
    while (guard++ < 300) {
      const h = hands[turn];
      if (!h.length) break;
      const legal = legalIndices(h, { plays, tricksPlayed, broken, firstCode: g.firstCode }, rules);
      st.topSpade = top.S;
      const i = firstMove ? first : legal.length === 1 ? legal[0] : mediumPlay(h, legal, plays, n, st, turn);
      firstMove = false;
      const played = h.splice(i, 1)[0];
      if (played.suit === "S" && plays.length && plays[0].card.suit !== "S") broken = true;
      gone.add(code(played)); recompute();
      plays.push({ who: turn, card: played });
      if (plays.length === n) {
        const w = plays[winnerIndex(plays.map(p => p.card))].who;
        won[w]++; plays = []; tricksPlayed++; turn = w;
      } else turn = (turn + 1) % n;
    }
    const r = handScore(g.bids[me], won[me], rules);
    // bags are worth a little less than they score: 10 of them cost 100
    return r.points - (rules.bags ? r.bags * 8 : 0)
      // and someone else's Nil set is worth something to me
      + g.bids.reduce((a, b, s) => a + (s !== me && b === 0 && won[s] > 0 ? 25 : 0), 0);
  }
  class AI {
    constructor({ difficulty = "medium" } = {}) { this.difficulty = difficulty; }
    setDifficulty(d) { this.difficulty = d; }
    resetMemory() {}
    chooseBid(ctx) { return chooseBid(ctx.hand, ctx.numPlayers, ctx.rules, this.difficulty, ctx.bids); }
    choosePass() { return [0, 1, 2]; }
    choosePlay(ctx) {
      if (ctx.legal.length === 1) return ctx.legal[0];
      const g = ctx.game;
      if (this.difficulty === "easy" && Math.random() < 0.15) return ctx.legal[Math.floor(Math.random() * ctx.legal.length)];
      if (this.difficulty === "hard" && g) return this.lookAhead(ctx);
      return mediumPlay(ctx.hand, ctx.legal, ctx.plays, ctx.numPlayers, tableState(g, ctx.plays), ctx.seat);
    }
    lookAhead(ctx) {
      const g = ctx.game, me = ctx.seat, n = g.numPlayers;
      const inPlay = new Set([...g.playedCards, ...g.currentTrick.plays.map(p => p.card)].map(code));
      const mine = new Set(g.hands[me].cards.map(code));
      const unseen = createDeck(n).filter(c => !inPlay.has(code(c)) && !mine.has(code(c)));
      const counts = g.hands.map(h => h.cards.length), voids = voidsOf(g), score = new Map(ctx.legal.map(i => [i, 0]));
      for (let k = 0; k < 60; k++) {
        const hands = dealGuess(unseen, counts, me, g.hands[me].cards, voids);
        for (const i of ctx.legal) score.set(i, score.get(i) + playOut(g, hands, me, i));
      }
      let best = ctx.legal[0];
      for (const i of ctx.legal) if (score.get(i) > score.get(best)) best = i;
      return best;
    }
  }

  // ---------------------------------------------------------------- cards, words
  const sortCards = (a, b) => (SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit]) || (a.rank - b.rank);
  const ruleNotes = r => ({
    nil: r.nil ? "You may bid Nil: no tricks at all, for 100 (or minus 100 if you take one)." : "No Nil bids: everyone bids at least 1.",
    bags: r.bags ? "Each trick over your bid is a bag, worth 1; every 10 bags you collect cost 100." : "Tricks over your bid score 1 each, with no penalty.",
    spadesBroken: r.spadesBroken ? "Pentagrams can't be led until one has been played on another suit (unless you have nothing else)." : "Pentagrams may be led at any time.",
    lowClubLeads: r.lowClubLeads ? "Whoever holds the 2 of horns (the lowest horn in play) leads it to the first trick." : "The player to the dealer's left leads the first trick.",
    nilBags: r.nilBags ? "Tricks taken by a failed Nil count as bags." : "Tricks taken by a failed Nil aren't bags.",
  });
  const rulesSpec = [
    { key: "nil", label: "Nil bids", options: [[true, "Allowed", "Bid Nil: take no tricks at all, for 100 points (minus 100 if you take any)"], [false, "Not allowed", "Everyone bids at least 1"]] },
    { key: "bags", label: "Bags", options: [[true, "10 cost 100", "Tricks over your bid (bags) score 1 each, but every 10 you collect cost 100"], [false, "No penalty", "Tricks over your bid just score 1 each"]] },
    { key: "spadesBroken", label: "Leading pentagrams", options: [[true, "Once broken", "Pentagrams can't be led until someone has trumped with one"], [false, "Any time", "Pentagrams may be led at any time"]] },
    { key: "lowClubLeads", label: "First card", options: [[false, "Dealer's left", "The player to the dealer's left leads the first trick"], [true, "2 of horns leads", "Whoever holds the 2 of horns leads it to the first trick"]] },
    { key: "nilBags", label: "Failed Nil", options: [[true, "Bags count", "Tricks taken by a failed Nil count as bags"], [false, "No bags", "Tricks taken by a failed Nil don't count as bags"]] },
  ];
  const howTo = r => {
    const n = ruleNotes(r);
    const house = rulesSpec.filter(s => r[s.key] !== DEFAULT_RULES[s.key]).map(s => s.label);
    return `
        <h3>How to play</h3>
        <ul>
          <li>Spades, every player for themselves: spades are always trumps.</li>
          ${SUIT_STYLE === "infernal" ? `<li>With the Infernal cards: spades are <strong>pentagrams</strong>, hearts <strong>flames</strong>, diamonds <strong>tridents</strong> and clubs <strong>horns</strong>.</li>` : ""}
          <li>Each hand, bid how many tricks you'll take - then take exactly that many, or a few more. <strong>Highest score wins.</strong></li>
          <li>The <strong>Tutorial</strong> plays one hand with you, step by step.</li>
        </ul>
        <h3>Rules</h3>
        <ul>
          <li>3 to 5 players. With 3 the 2 of horns is taken out (17 cards each); with 4, 13 each; with 5, the 2s of horns and tridents are out (10 each).</li>
          <li><strong>Bidding</strong><br>In turn from the dealer's left, everyone says how many tricks they expect to take. ${n.nil}</li>
          <li><strong>Playing</strong><br>${n.lowClubLeads} Follow the suit led if you can; if you can't, play anything, a pentagram included. The highest pentagram wins the trick, or if there's none, the highest card of the suit led. The winner leads next. ${n.spadesBroken}</li>
          <li><strong>Scoring</strong><br>Make your bid: 10 points for each trick you bid, and 1 for each extra trick. Miss it: minus 10 for each trick you bid. ${n.bags}</li>
          <li>The game ends when someone reaches ${TARGET} (or ${TARGET / 2} in a short game). Highest total wins.</li>
        </ul>
        <h3>House rules</h3>
        <ul><li>Chosen in the <strong>Rules</strong> tab before a game. ${house.length ? `In use: <strong>${house.join(", ")}</strong>.` : "None in use: these are the standard rules."}</li></ul>
        <h3>Tips</h3>
        <ul>
          <li>Count aces, high pentagrams and long pentagrams for your bid. A short suit lets you trump.</li>
          <li>Once you've made your bid, duck: extra tricks are bags.</li>
          <li>Someone bid Nil? Try to make them win a trick: play low under their cards.</li>
        </ul>`;
  };
  // the tutorial: 4 players, you are seat 0; Persephone (1) bids Nil
  const tutorial = {
    opponents: ["Persephone", "Bub", "Lilith"],
    firstDealer: 3,
    intro: ["Welcome to <b>Spades</b>: bid how many tricks you'll take, then take them. Let's play a hand."],
    rounds: [{
      hands: [
        ["S14", "S13", "S9", "S4", "H14", "H6", "H3", "H9", "D10", "D7", "D2", "D5", "D8"],
        ["S3", "S2", "H5", "H2", "H7", "D3", "D6", "D4", "C2", "C3", "C6", "C7", "C9"],
        ["S12", "S10", "S7", "S5", "H13", "H11", "H8", "D14", "D11", "C12", "C11", "C4", "C5"],
        ["S11", "S8", "S6", "H12", "H10", "H4", "D13", "D12", "D9", "C14", "C13", "C10", "C8"]
      ],
      bids: [4, 0, 4, 3],
      tricks: [
        ["H14", "H5", "H8", "H4"],
        ["D10", "D6", "D14", "D9"],
        ["S4", "C9", "C12", "C14"]
      ],
      coach: {
        start: [{ t: "Your hand. <b>Pentagrams</b> are always trumps: any pentagram beats any other suit.", spot: "#player-hand" }],
        bid: { t: "Bid how many tricks you'll take. Count your winners: the <b>ace and king of pentagrams</b>, the <b>ace of flames</b> - and with no horns, you can trump horns. Bid <b>4</b>." },
        play0: { t: "Persephone bid <b>Nil</b>: she's trying to take no tricks at all. You lead: cash your <b>ace of flames</b>." },
        trick0: ["Your ace wins: 1 trick of your 4."],
        play1: { t: "Lead your <b>10 of tridents</b>." },
        trick1: ["Bub's ace of tridents wins it, and Bub leads next."],
        play2: { t: "Horns are led and you have none: trump with your lowest pentagram, the <b>4</b>." },
        trick2: ["Any pentagram beats any other suit: that's 2 tricks. It also broke pentagrams, so now they can be led. Play the rest yourself: take the tricks you need, then duck - every trick over your bid is a <b>bag</b>, and 10 bags cost 100."],
        end: { t: "That's a hand. Scores add up until someone reaches 500. Highest wins." }
      }
    }],
    outro: ["Bid Nil when your hand has nothing to win with: 100 if you take no tricks at all. Choose your players and press <b>Play</b>. The rules are under the book button."]
  };

  const HC = HEARTS.CardView;           // (the same Infernal faces as Hearts)
  return { id: "spades", get name() { return SUIT_STYLE === "infernal" ? "Spades (Pentagrams)" : "Spades"; }, std: true, tagline: "Bid your tricks, take them, and dodge the bags", players: [3, 4, 5], logo: null, storage: "spades",
    DEFAULT_RULES, cleanRules, Game, AI, CardView: HC, tutorial, code, parse, cardName, shortName, sortCards,
    passOffset: () => 0, passWords: () => "no pass", hasBids: true, highWins: true, handScore,
    target: (n, length) => length === "short" ? TARGET / 2 : TARGET,
    isPrize: () => false, prizeTaken: () => "", prizeColumn: "Bags",
    sweepText: () => "", passName: c => shortName(c),
    cardsEach: n => `${Math.floor(createDeck(n).length / n)} cards each`,
    rulesSpec, ruleNotes, howTo, demo: ["S14", "S12", "H14", "D11", "C2", "S2"] };
})();
