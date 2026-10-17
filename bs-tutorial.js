// bs-tutorial.js - the scripted first hand: passing, then three coached tricks, then the rest on your own.
// Seats: 0 you, 1 Persephone (left), 2 Bub (across), 3 Lilith (right). The hand passes left.
// rounds[0].tricks[i][seat]: the card each seat plays in trick i (only for the coached tricks; after those, everyone
// plays freely). coach: the coach's words at each point ("pass" and "playN" are prompts; the rest wait for Next).

const TUTORIAL = {
  opponents: ["Persephone", "Bub", "Lilith"],
  firstDealer: 3,
  intro: [
    "Welcome to <b>Black Spider</b>: take as <b>few points</b> as you can. Let's play a hand."
  ],
  rounds: [{
    hands: [
      ["R1", "R3", "R6", "P11", "P1", "G2", "G5", "G10", "K7a", "K1", "K2", "K3", "K7b", "K11", "B11"],
      ["R5", "B2", "P7", "B5", "K4", "K6", "K7d", "R11", "B9", "B1", "P8", "K7c", "R2", "G6", "B6"],
      ["G1", "B8", "P5", "P6", "K5", "G9", "K10", "P4", "K8", "G8", "B3", "P10", "K9", "G4", "B10"],
      ["R9", "B4", "P3", "G11", "R10", "P9", "R8", "G3", "K7", "R7", "R4", "K7e", "P2", "B7", "G7"]
    ],
    passes: [["K7b", "K11", "B11"], ["K7d", "K7c", "K6"], ["K10", "K9", "K8"], ["G11", "R10", "P9"]],
    tricks: [
      ["R1", "R5", "G1", "R9"],
      ["K7a", "B2", "B8", "B4"],
      ["P11", "P7", "P5", "P3"]
    ],
    coach: {
      start: [
        { t: "Your hand. The small number under each card is what it scores if you take it: black cards are bad, and a <b>Black Spider</b> (black 7) is 10. Coloured 7s are <b>−5</b>: good to take.", spot: "#player-hand" }
      ],
      pass: { t: "First everyone passes three cards, this hand to the <b>left</b>. Pass a <b>Black Spider</b>, the <b>black 11</b> and the <b>blue 11</b> (your only blue: with none left, you can throw anything on blue). Then press <b>Pass these three</b>." },
      passed: [
        { t: "The lifted cards are the three Lilith passed you.", spot: "#player-hand" }
      ],
      play0: { t: "The <b>red 1</b> leads the first trick. Play it." },
      trick0: [
        "Follow the colour led if you can, or play the <b>same number</b> instead (Bub's green 1). The highest card of the colour led wins: Lilith's red 9. No black on the first trick."
      ],
      play1: { t: "Blue is led and you have none, so play anything: drop your <b>Black Spider</b>!" },
      trick1: [
        "Bub's blue 8 wins, so he takes your Black Spider: 10 points. That also <b>broke</b> black: black can't be led until someone plays it on another colour."
      ],
      play2: { t: "Purple is led. Win it with your <b>purple 11</b>: if anyone plays a coloured 7 on it (−5), it's yours." },
      trick2: [
        "Persephone played her <b>purple 7</b>: <b>−5</b> for you. Now play the rest yourself: follow when you must, duck under the winning card, and dump black when you can't follow."
      ],
      end: { t: "That's a hand. Scores add up until someone reaches the target. Lowest wins." }
    }
  }],
  outro: [
    "Take all 16 black cards (the <b>sweep</b>) and you score 0, everyone else 60. Choose your players and press <b>Play</b>. The rules are under the book button."
  ]
};
