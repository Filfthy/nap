// games/blackspider.js - Black Spider as one of Infernal Tricksters' games: its rules, AI, cards and tutorial are
// bs-core.js, bs-ai.js and bs-tutorial.js; this gathers them, with its words (Rules tab, How to play, messages),
// into the shape every game has (see games/registry.js).

// (the shared screen asks each game why a card is refused)
BlackSpiderGame.prototype.refusalReason = function (seat, idx) { return refusalReason(this.hands[seat].cards, idx, this.playState, this.rules); };

const BLACKSPIDER = (() => {
  const passingWords = (cycle) => {
    const names = { l: "left", r: "right", a: "across", n: "no passing" };
    const list = c => c.map(x => names[x]).join(", ");
    const four = list(passCycle(cycle, 4)), other = list(passCycle(cycle, 3));
    return four === other ? `${four}, and round again` : `${four}, and round again (with 3 or 5 players: ${other})`;
  };
  const ruleNotes = r => ({
    passing: `Passing goes ${passingWords(r.passing)}.`,
    redOne: r.redOne ? "Whoever holds the red 1 leads it to the first trick." : "The player to the dealer's left leads the first trick, with any card.",
    followNumber: r.followNumber ? "Having the colour led, you play that colour - or a card of the same number instead (any 7 on a 7)."
                                 : "Having the colour led, you must play that colour: a matching number doesn't count.",
    noBlackFirst: r.noBlackFirst ? "No black cards on the first trick, unless you have nothing else you may play." : "Black cards may be played on the first trick.",
    blackBroken: r.blackBroken ? "Black can't be led until it's broken: someone plays a black card on a trick where another colour was led. (With nothing but black, you may lead it.)"
                               : "Black may be led at any time.",
    sweep: r.sweep ? "Take all 16 black cards in a hand and you score 0 for it, and everyone else scores 60." : "No sweep: taking every black card just scores their points.",
  });
  const rulesSpec = [
    { key: "passing", label: "Passing", options: [
      ["lr", "Left, right", "Pass three cards to the left one hand, to the right the next, and so on"],
      ["lrn", "Left, right, none", "Left, then right, then a hand with no passing at all"],
      ["lra", "Left, right, across", "Left, right, then across the table (4 players only: with 3 or 5 it's just left, right)"],
      ["lran", "Left, right, across, none", "Left, right, across, then a hand with no passing (4 players only: with 3 or 5 it's left, right, none)"]] },
    { key: "redOne", label: "First card", options: [
      [true, "Red 1 leads", "Whoever holds the red 1 must lead it to the first trick"],
      [false, "Any card", "The player to the dealer's left leads the first trick with any card"]] },
    { key: "followNumber", label: "Following", options: [
      [true, "Colour or number", "If you have the colour led, play that colour - or a card of the same number instead"],
      [false, "Colour only", "If you have the colour led, you must play that colour"]] },
    { key: "noBlackFirst", label: "First trick", options: [
      [true, "No black", "No black cards on the first trick, unless you have nothing else you may play"],
      [false, "Black allowed", "Black cards may be played on the first trick"]] },
    { key: "blackBroken", label: "Leading black", options: [
      [true, "Once broken", "As hearts in Hearts: black can't be led until someone has played a black card on a trick where another colour was led"],
      [false, "Any time", "Black may be led at any time"]] },
    { key: "sweep", label: "The sweep", options: [
      [true, "On", "Take all 16 black cards in a hand: you score 0 for it, and everyone else 60"],
      [false, "Off", "No sweep: taking every black card just scores their points"]] },
  ];
  const howTo = r => {
    const n = ruleNotes(r), std = DEFAULT_RULES;
    const house = rulesSpec.filter(s => s.key !== "passing" && r[s.key] !== std[s.key]).map(s => s.label);
    return `
        <h3>How to play</h3>
        <ul>
          <li>Everyone is dealt the whole pack. Each hand you pass three cards, then play tricks.</li>
          <li>Taking points is bad: they come from the black cards, and the Black Spiders most of all. Lowest total wins.</li>
          <li>The <strong>Tutorial</strong> plays one hand with you, step by step.</li>
        </ul>
        <h3>The cards</h3>
        <ul>
          <li>60 cards: red, blue, purple and green, each numbered 1 to 11, and black 1 to 11 plus five more black 7s.</li>
          <li>The six black 7s are the <strong>Black Spiders</strong>.</li>
          <li>The small number under a card's number is what it scores if you take it in a trick.</li>
        </ul>
        <h3>Rules</h3>
        <ul>
          <li>3 to 5 players, and every card is dealt: 20 each with 3 players, 15 with 4, 12 with 5.</li>
          <li><strong>Passing</strong><br>Before each hand everyone passes three cards, face down. ${n.passing}</li>
          <li><strong>Playing</strong><br>${n.redOne} ${r.followNumber ? `If you have the colour led, you must follow it: play a card of that colour, or a card of the <strong>same number</strong> instead.` : `If you have the colour led, you must play a card of that colour.`} If you have none of the colour led, play anything.${r.noBlackFirst ? ` <strong>No black on the first trick</strong>, unless you have nothing else.` : ""}${r.blackBroken ? ` <strong>Black can't be led until it's broken</strong>: until someone has played black on a trick led with another colour.` : ""}</li>
          <li>The highest card of the colour led wins the trick. Other colours never win, so a black card only wins when black was led. If black is led and several Black Spiders are played, the first one wins. The winner leads the next trick.</li>
          <li><strong>Scoring</strong><br>Points are bad. Black 1 to 6 score 1 each, black 8 to 11 score 2 to 5, and each Black Spider scores 10. The coloured 7s are <strong>−5</strong> each: good to take. Every hand adds up to 60.</li>
          <li><strong>The sweep</strong><br>${n.sweep}</li>
          <li>The game ends when someone reaches 200 (3 players), 150 (4) or 120 (5). Lowest total wins.</li>
        </ul>
        <h3>House rules</h3>
        <ul><li>Chosen in the <strong>Rules</strong> tab before a game. ${house.length ? `In use: <strong>${house.join(", ")}</strong>.` : "None in use: these are the standard rules."}</li></ul>
        <h3>Tips</h3>
        <ul>
          <li>Pass your Black Spiders and high black cards if you can, or keep low black cards to duck under them.</li>
          ${r.followNumber ? `<li>Any 7 can be played on a 7. Lead a 7 and someone may drop a Black Spider on you.</li>` : ""}
          <li>When you can't follow, it's your chance to get rid of a Black Spider.</li>
        </ul>`;
  };
  return {
    id: "blackspider", name: "Black Spider", tagline: "Shed the black cards, above all the six Black Spiders",
    players: [3, 4, 5], logo: "logo-blackspider.webp", storage: "bs",
    Game: BlackSpiderGame, AI: BlackSpiderAI, CardView, DEFAULT_RULES, cleanRules, tutorial: TUTORIAL,
    code: cardCode, parse: parseCard, cardName,
    sortCards: (a, b) => (COLOUR_ORDER[a.suit] - COLOUR_ORDER[b.suit]) || (a.rank - b.rank),
    passOffset, passWords,
    target: (n, length) => Math.round(TARGETS[n] * (length === "short" ? 0.5 : 1)),
    isPrize: c => c.isBlackSpider, prizeTaken: k => k === 1 ? "a Black Spider" : `${k} Black Spiders`, prizeColumn: "Black Spiders",
    sweepText: (who, you) => `${who} took every black card: 0 for ${you ? "you" : "them"}, 60 for everyone else!`,
    passName: c => c.isBlackSpider ? "Black Spider" : `${COLOUR_NAME[c.suit]} ${c.rank}`,
    cardsEach: n => `${60 / n} cards each`,
    rulesSpec, ruleNotes, howTo,
  };
})();
