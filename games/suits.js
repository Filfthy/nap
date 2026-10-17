// games/suits.js - how the ordinary deck looks, for the games that use it (Hearts, Spades, Nap, Sergeant Major).
// The Style (Look & feel, remembered for each game; Nap starts Napoleonic):
//   "standard"   - hearts, diamonds, clubs and spades, with the standard court cards
//   "napoleonic" - the same suits with the Napoleonic court cards (art/napoleonic-courts), on better-kept paper
//   "painted"    - the same suits with painted single-figure court cards (art/standard-courts, img/std)
//   "infernal"   - flames, tridents, horns and pentagrams (Oh Hell's Infernal deck)
// The ordinary suits come in four colours (hearts red, diamonds blue, clubs green, spades black) or red and black
// (Colours, remembered for all games). The card stock - white or parchment - follows the back (below).
let SUIT_STYLE = "standard", SUIT_COLOURS = 4, DECK_STYLE = "standard";
const DECK_STYLES = ["standard", "napoleonic", "painted", "infernal"];
try { if (localStorage.getItem("it_suits") === "two") SUIT_COLOURS = 2; } catch (e) { /* ignore */ }
function applySuitLook() {
  document.body.classList.toggle("suit-style-standard", SUIT_STYLE === "standard");
  document.body.classList.toggle("suit-colours-2", SUIT_STYLE === "standard" && SUIT_COLOURS === 2);
  document.body.classList.toggle("deck-napoleonic", DECK_STYLE === "napoleonic");
}
function setDeckStyle(v) {
  DECK_STYLE = DECK_STYLES.includes(v) ? v : "standard";
  SUIT_STYLE = DECK_STYLE === "infernal" ? "infernal" : "standard";
  applySuitLook();
}
function setSuitColours(n) {
  SUIT_COLOURS = n === 2 ? 2 : 4;
  try { localStorage.setItem("it_suits", SUIT_COLOURS === 2 ? "two" : "four"); } catch (e) { /* ignore */ }
  applySuitLook();
}
// the standard suits' card faces follow the card back: a white-based back (BugVictim, Classic) gives "plain" faces (a
// clean white card, as an ordinary pack), a parchment one "parchment" (aged paper, like the Infernal deck); the
// Infernal suits are always on parchment
let FACE_STYLE = "parchment";
const WHITE_BACKS = ["bugvictim", "classic-blue", "classic-red"];
function setFaceStyle(back) {
  FACE_STYLE = WHITE_BACKS.includes(back) ? "plain" : "parchment";
  document.body.classList.toggle("faces-plain", FACE_STYLE === "plain");
}

const SUIT_WORDS = {
  standard: { S: "spades", H: "hearts", D: "diamonds", C: "clubs" },
  infernal: { S: "pentagrams", H: "flames", D: "tridents", C: "horns" },
};
const SUIT_ONES = {
  standard: { S: "spade", H: "heart", D: "diamond", C: "club" },
  infernal: { S: "pentagram", H: "flame", D: "trident", C: "horn" },
};
// the suit names in the style in use (the games' texts read these as they're shown)
const SUIT_WORD_NOW = new Proxy({}, { get: (_, k) => SUIT_WORDS[SUIT_STYLE][k] });
const SUIT_ONE_NOW = new Proxy({}, { get: (_, k) => SUIT_ONES[SUIT_STYLE][k] });

// the games' texts are written with the Infernal names: in the standard style they read with the usual ones
// ("the queen of pentagrams" -> "the queen of spades"), capitals kept
const INF_TO_STD = { flame: "heart", flames: "hearts", pentagram: "spade", pentagrams: "spades", trident: "diamond", tridents: "diamonds", horn: "club", horns: "clubs" };
function suitText(t) {
  if (SUIT_STYLE === "infernal" || typeof t !== "string") return t;
  return t.replace(/\b(flames?|pentagrams?|tridents?|horns?)\b/gi, w => {
    const r = INF_TO_STD[w.toLowerCase()];
    return w[0] === w[0].toUpperCase() ? r[0].toUpperCase() + r.slice(1) : r;
  });
}
// a suit's symbol, as HTML: the usual one, or the Infernal drawing
const SUIT_GLYPH = { S: "♠", H: "♥", D: "♦", C: "♣" };
const SUIT_ICON_ID = { S: "s-pentagram", H: "s-flame", D: "s-trident", C: "s-horns" };
const SUIT_CLASS = { S: "s-spade", H: "s-heart", D: "s-diamond", C: "s-club" };
function suitSymbol(s) {
  return SUIT_STYLE === "infernal" ? `<svg class="sg" viewBox="0 0 100 100" aria-hidden="true"><use href="#${SUIT_ICON_ID[s]}"/></svg>` : `<span class="sg-std">${SUIT_GLYPH[s]}</span>`;
}
function suitIcon(s) { return `<span class="suit-inline ${SUIT_CLASS[s]}">${suitSymbol(s)}</span>`; }
