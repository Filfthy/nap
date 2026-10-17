// bs-ai.js - Black Spider's computer players (tuned by duplicate-deal simulation: the same deals replayed with each
// version in each seat; see the TUNE values below).
//   easy (Lost souls): plays like medium without watching the table, passes naively, and now and then plays at random
//   medium (Imps): rules of thumb - passes its highest coloured cards and Black Spiders, leads low from short colours
//           (and low black), not a 7 or a colour someone has run out of, ducks, dumps its worst card when it can't
//           follow, and stops a sweep
//   hard (Hellhounds): tries each card it may play and plays the rest of the hand out 80 times with guessed hands for
//           the others (fitting what they've shown: a colour someone couldn't follow, the cards it passed), everyone
//           playing as medium, and keeps the card that cost it least on average (a sweep counted in full)

const TUNE = Object.assign({ samples: 80, poVoids: 1, easyRandom: 0.15, easyPassRandom: 0, newPass: 1, voidLead: 14, sweepAt: 9, sweepPts: 12, freeShed: 0, freeShedRank: 8,
  lead7: 25, dSpider: 60, dBlack: 20, dBlackPts: 6, d7: -10, dRank: 1, leadBlack: 0, pass7: -40, passVoid: 18, passLow: 15, passHighBlack: 20, passRank: 15, leadBlackPts: 5, leadLen: -2, shortBonus: 4, lowBlackPass: 6 }, typeof TUNE_OVERRIDE !== "undefined" ? TUNE_OVERRIDE : {});

// what the table has shown so far: who can't follow which colour, and the black cards each player has taken
function tableInfo(g) {
  const n = g.numPlayers, void_ = [...Array(n)].map(() => new Set()), black = new Array(n).fill(0);
  const tricks = (g.trickHistory || []).concat(g.currentTrick && g.currentTrick.plays.length ? [{ plays: g.currentTrick.plays, winner: -1 }] : []);
  for (const t of tricks) {
    const lead = t.plays[0].card;
    for (const p of t.plays.slice(1)) {
      // not the colour led, and not its number either: they have none of that colour
      if (!follows(p.card, lead, g.rules || DEFAULT_RULES)) void_[p.who].add(lead.suit);
    }
    if (t.winner >= 0) black[t.winner] += t.plays.filter(p => p.card.suit === "K").length;
  }
  return { void_, black, sweep: !g.rules || g.rules.sweep };
}

// how much a card in hand is a worry: it may end up winning a trick full of points, or be points itself
function danger(c, hand) {
  let d = c.rank * TUNE.dRank;
  if (c.suit === "K") d = c.isBlackSpider ? TUNE.dSpider : TUNE.dBlack + c.points * TUNE.dBlackPts + c.rank;
  else if (c.rank === 7) d = TUNE.d7;                 // a coloured 7 is worth having: -5 if you take it
  const same = hand.filter(x => x.suit === c.suit).length;
  if (c.suit !== "K" && same <= 2) d += TUNE.shortBonus;        // a short colour can't be ducked for long
  return d;
}

// the three cards to pass
function passChoice(hand) {
  const left = hand.slice(), out = [];
  const count = s => left.filter(c => c.suit === s).length;
  const take = c => { out.push(c); left.splice(left.indexOf(c), 1); };
  const lowBlack = () => left.filter(c => c.suit === "K" && c.rank <= 4).length;
  while (out.length < 3) {
    let best = null, bestV = -Infinity;
    for (const c of left) {
      let v;
      if (c.isBlackSpider) v = 100 - lowBlack() * TUNE.lowBlackPass;            // with low black cards to duck under, a spider is less of a worry
      else if (c.suit === "K") v = c.rank >= 8 ? TUNE.passHighBlack + c.rank * 2 - lowBlack() * 4 : 10 - c.rank * 3;
      else if (c.rank === 7) v = TUNE.pass7;                             // keep the coloured 7s
      else {
        v = c.rank * TUNE.passRank;
        const k = count(c.suit);
        if (k <= 3) v += (4 - k) * TUNE.passVoid;                             // emptying a short colour lets you dump later
        if (c.rank <= 3) v -= TUNE.passLow;                                 // low cards are your ducks
      }
      if (v > bestV) { bestV = v; best = c; }
    }
    take(best);
  }
  return out.map(c => hand.indexOf(c));
}

class BlackSpiderAI {
  constructor({ difficulty = "medium" } = {}) { this.setDifficulty(difficulty); }
  setDifficulty(d) { this.difficulty = d; }
  resetMemory() {}

  choosePass(hand) {
    const idx = hand.map((c, i) => i);
    if (this.difficulty === "easy") return Math.random() < TUNE.easyPassRandom ? shuffle(idx.slice()).slice(0, 3)
      : idx.sort((a, b) => danger(hand[b], hand) - danger(hand[a], hand)).slice(0, 3);
    return TUNE.newPass ? passChoice(hand) : idx.sort((a, b) => danger(hand[b], hand) - danger(hand[a], hand)).slice(0, 3);
  }

  // ctx: { hand, legal, plays, numPlayers, seat, game }
  choosePlay(ctx) {
    if (ctx.legal.length === 1) return ctx.legal[0];
    if (this.difficulty === "easy") {
      if (Math.random() < TUNE.easyRandom) return ctx.legal[Math.floor(Math.random() * ctx.legal.length)];
      return mediumPlay(ctx.hand, ctx.legal, ctx.plays, ctx.numPlayers, null, ctx.seat);
    }
    if (this.difficulty === "hard" && ctx.game) return this.lookAhead(ctx);
    return mediumPlay(ctx.hand, ctx.legal, ctx.plays, ctx.numPlayers, ctx.game ? tableInfo(ctx.game) : null, ctx.seat);
  }

  lookAhead(ctx) {
    const g = ctx.game, me = ctx.seat, n = g.numPlayers;
    const info = tableInfo(g);
    const inPlay = new Set([...g.playedCards, ...g.currentTrick.plays.map(p => p.card)].map(cardCode));
    const mineSet = new Set(g.hands[me].cards.map(cardCode));
    // what I passed and haven't seen played: I know who has them
    const to = (me + g.passTo) % n;
    const passed = (g.passes[me] || []).filter(c => !inPlay.has(cardCode(c)));
    const passedSet = new Set(passed.map(cardCode));
    const unseen = createDeck().filter(c => { const k = cardCode(c); return !inPlay.has(k) && !mineSet.has(k) && !passedSet.has(k); });
    const counts = g.hands.map(h => h.cards.length);
    const cost = new Map(ctx.legal.map(i => [i, 0]));
    for (let k = 0; k < TUNE.samples; k++) {
      const hands = dealGuess(unseen, counts, me, g.hands[me].cards, to, passed, info.void_);
      for (const i of ctx.legal) cost.set(i, cost.get(i) + playOut(g, hands, me, i, info.black, TUNE.poVoids ? info.void_ : null));
    }
    let best = ctx.legal[0];
    for (const i of ctx.legal) if (cost.get(i) < cost.get(best)) best = i;
    return best;
  }
}

// share the unseen cards among the others, respecting what they've shown (no cards of a colour they couldn't follow)
function dealGuess(unseen, counts, me, myCards, to, passed, voids) {
  const n = counts.length;
  for (let attempt = 0; attempt < 20; attempt++) {
    const pool = shuffle(unseen.slice());
    const hands = [...Array(n)].map((_, s) => s === me ? myCards.slice() : (s === to ? passed.slice() : []));
    // the most constrained players first
    const order = [...Array(n).keys()].filter(s => s !== me).sort((a, b) => voids[b].size - voids[a].size);
    let ok = true;
    for (const s of order) {
      for (let i = pool.length - 1; i >= 0 && hands[s].length < counts[s]; i--) {
        if (!voids[s].has(pool[i].suit)) hands[s].push(pool.splice(i, 1)[0]);
      }
      if (hands[s].length < counts[s]) { ok = false; break; }
    }
    if (ok) return hands;
  }
  // couldn't fit them all: ignore the voids
  const pool = shuffle(unseen.slice());
  return [...Array(n)].map((_, s) => {
    if (s === me) return myCards.slice();
    const h = s === to ? passed.slice() : [];
    while (h.length < counts[s]) h.push(pool.pop());
    return h;
  });
}

// the medium player's choice of card (indices into hand). info: what the table has shown (or null)
function mediumPlay(hand, legal, plays, n, info, me) {
  const voidAnyone = s => info ? info.void_.some((v, p) => p !== me && v.has(s)) : false;
  if (!plays.length) {
    // lead: something low that's unlikely to collect points - not a 7 (any 7 may be played on it, a Black Spider
    // included), not a colour someone has run out of (they'd dump on it), and black only when it's cheap
    const score = c => c.rank + (c.rank === 7 ? TUNE.lead7 : 0) + (c.suit === "K" ? TUNE.leadBlack + c.points * TUNE.leadBlackPts : 0)
      + (voidAnyone(c.suit) ? TUNE.voidLead : 0) - hand.filter(x => x.suit === c.suit).length * TUNE.leadLen;
    return legal.reduce((a, b) => score(hand[b]) < score(hand[a]) ? b : a);
  }
  const lead = plays[0].card;
  const bestRank = Math.max(...plays.filter(p => p.card.suit === lead.suit).map(p => p.card.rank));
  const trickPts = plays.reduce((a, p) => a + p.card.points, 0);
  const last = plays.length === n - 1;
  const wins = c => c.suit === lead.suit && c.rank > bestRank;
  const safe = legal.filter(i => !wins(hand[i])), winning = legal.filter(i => wins(hand[i]));
  const pts = i => hand[i].points;
  const cheapest = (arr, highFirst) => arr.reduce((a, b) => (pts(b) < pts(a) || (pts(b) === pts(a) && (highFirst ? hand[b].rank > hand[a].rank : hand[b].rank < hand[a].rank))) ? b : a);
  // stopping a sweep: someone has every black card taken so far, and plenty of them - take a black card off them
  if (info && info.sweep !== false && winning.length) {
    const taken = info.black.reduce((a, b) => a + b, 0);
    const leader = info.black.findIndex(b => b === taken);
    const blackHere = plays.some(p => p.card.suit === "K") || winning.some(i => hand[i].suit === "K");
    if (TUNE.sweepAt < 99 && taken >= TUNE.sweepAt && leader >= 0 && leader !== me && blackHere && trickPts <= TUNE.sweepPts) {
      const w = winning.filter(i => plays.some(p => p.card.suit === "K") || hand[i].suit === "K");
      if (w.length) return cheapest(w, true);
    }
  }
  // a trick worth having (a coloured 7 in it and nothing bad): take it if last, with the card that costs least
  if (winning.length && trickPts < 0 && last) return cheapest(winning, true);
  if (safe.length) {
    // last, and the trick costs nothing: take it with a high card that's free (shedding it), if there is one
    if (TUNE.freeShed && last && trickPts === 0) {
      const free = winning.filter(i => pts(i) <= 0 && hand[i].rank >= TUNE.freeShedRank);
      if (free.length) return cheapest(free, true);
    }
    // can't (or won't) win: dump the most worrying card that loses
    return safe.reduce((a, b) => danger(hand[b], hand) > danger(hand[a], hand) ? b : a);
  }
  // every card wins: last to play - the highest cheap card (shed it now); otherwise the lowest
  return cheapest(winning, last);
}

// play the rest of the hand out from now, `me` playing hand index `first` next, everyone else as medium; my points
// for the hand (a sweep counted in full: 0 for the sweeper, 60 for everyone else)
function playOut(g, handsIn, me, first, blackTaken, knownVoids = null) {
  const n = g.numPlayers;
  const hands = handsIn.map(h => h.slice());
  let plays = g.currentTrick.plays.map(p => ({ who: p.who, card: p.card }));
  let turn = me, tricksPlayed = g.tricksPlayed, firstMove = true, broken = !!g.blackBroken;
  const rules = g.rules || DEFAULT_RULES;
  const pts = g.taken.slice(), black = blackTaken.slice();
  const voids = [...Array(n)].map((_, s) => new Set(knownVoids ? knownVoids[s] : []));   // who can't follow what (known, and seen as it goes)
  const info = { void_: voids, black, sweep: rules.sweep };
  const legalFor = (h) => legalIndices(h, { plays, tricksPlayed, blackBroken: broken }, rules);
  let guard = 0;
  while (guard++ < 400) {
    const h = hands[turn];
    if (!h.length) break;
    const legal = legalFor(h);
    let i;
    if (firstMove) { i = first; firstMove = false; }
    else i = legal.length === 1 ? legal[0] : mediumPlay(h, legal, plays, n, info, turn);
    const played = h.splice(i, 1)[0];
    if (knownVoids && plays.length && !follows(played, plays[0].card, rules)) voids[turn].add(plays[0].card.suit);
    if (played.suit === "K" && plays.length && plays[0].card.suit !== "K") broken = true;   // (on a trick led with another colour)
    plays.push({ who: turn, card: played });
    if (plays.length === n) {
      const w = plays[trickWinnerIndex(plays.map(p => p.card))].who;
      pts[w] += plays.reduce((a, p) => a + p.card.points, 0);
      black[w] += plays.filter(p => p.card.suit === "K").length;
      plays = []; tricksPlayed++; turn = w;
    } else turn = (turn + 1) % n;
  }
  const sweeper = rules.sweep ? black.findIndex(b => b === 16) : -1;
  if (sweeper >= 0) return sweeper === me ? -20 : 60;   // (a sweep of my own is better than the 0 it scores: it hurts everyone)
  return pts[me];
}
