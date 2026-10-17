// games/registry.js - the games in Infernal Tricksters, in the order the picker shows them. Each is a module
// (games/<id>.js) with the same shape: id, name, tagline, players, Game, AI, CardView, DEFAULT_RULES, cleanRules,
// tutorial, code/parse/cardName/sortCards, passOffset/passWords, target, isPrize/prizeTaken/prizeColumn, sweepText,
// passName, cardsEach, rulesSpec/ruleNotes/howTo, demo (a few cards to show off the faces).
const GAMES = { blackspider: BLACKSPIDER, hearts: HEARTS, spades: SPADES, nap: NAP, sergeant: SERGEANT };
const GAME_ORDER = ["blackspider", "hearts", "spades", "nap", "sergeant"];
NAP.resultExtra = (g, seat) => g.history.filter(h => h.declarer === seat && h.made).length;
SPADES.resultExtra = (g, seat) => g.bags ? g.bags[seat] : 0;
BLACKSPIDER.demo = ["R7", "P11", "G3", "B9", "K7", "K2"];
HEARTS.demo = ["H14", "S12", "D11", "C2", "H5", "S13"];
HEARTS.sweepText = (who, you, r) => r && r.moon === "minus" ? `${who} shot the moon: −26 for ${you ? "you" : "them"}!` : `${who} shot the moon: 0 for ${you ? "you" : "them"}, 26 for everyone else!`;
// a release of just one game (dist/<id>, made by tools/build-<id>.py, which sets SINGLE_GAME): only that game, no picker
if (typeof SINGLE_GAME !== "undefined" && GAMES[SINGLE_GAME]) {
  for (const k of Object.keys(GAMES)) if (k !== SINGLE_GAME) delete GAMES[k];
  GAME_ORDER.splice(0, GAME_ORDER.length, SINGLE_GAME);
}
