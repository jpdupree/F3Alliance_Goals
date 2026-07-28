// Constellation shapes, and the logic that picks one from an F3 name.
//
// Every shape is a list of stars in a normalized 0..1 box (x right, y down)
// plus the edges that connect them. Shapes are drawn head-up so a name label
// can sit underneath without covering anything.

const SHAPES = {
  crawfish: {
    label: 'the crawfish',
    stars: [
      [0.04, 0.17], [0.23, 0.05], [0.29, 0.31],  // left claw: outer tip, inner tip, wrist
      [0.96, 0.17], [0.77, 0.05], [0.71, 0.31],  // right claw
      [0.37, 0.36], [0.63, 0.36],                // shoulders
      [0.39, 0.57], [0.61, 0.57],                // waist
      [0.43, 0.75], [0.57, 0.75],                // abdomen taper
      [0.27, 0.94], [0.73, 0.94],                // tail fan
    ],
    // Closed pincer triangles up front and a boxed carapace, so it reads as a
    // crustacean instead of a stick figure with its arms up.
    edges: [
      [0,1],[1,2],[2,0],[2,6],
      [3,4],[4,5],[5,3],[5,7],
      [6,7],[6,8],[7,9],[8,9],
      [8,10],[9,11],[10,11],
      [10,12],[11,13],[12,13],
    ],
  },
  bear: {
    label: 'the bear',
    stars: [
      [0.26, 0.14], [0.13, 0.26], [0.10, 0.38],  // ear, brow, snout
      [0.33, 0.31],                               // jaw
      [0.44, 0.24], [0.66, 0.20], [0.85, 0.30],   // shoulder, back, rump
      [0.86, 0.66], [0.84, 0.90],                 // hind leg
      [0.60, 0.55], [0.38, 0.52],                 // belly, chest
      [0.36, 0.72], [0.34, 0.92],                 // fore leg
    ],
    edges: [[0,1],[1,2],[2,3],[3,10],[1,4],[4,5],[5,6],[6,7],[7,8],[6,9],[9,10],[10,11],[11,12]],
  },
  wolf: {
    label: 'the wolf',
    stars: [
      [0.18, 0.16], [0.30, 0.14],                 // ears
      [0.24, 0.28], [0.07, 0.36],                 // head, muzzle
      [0.40, 0.34], [0.62, 0.28], [0.80, 0.34],   // neck, back, haunch
      [0.94, 0.16],                               // tail
      [0.80, 0.66], [0.78, 0.90],
      [0.42, 0.60], [0.40, 0.88],
    ],
    edges: [[0,2],[1,2],[2,3],[2,4],[4,5],[5,6],[6,7],[6,8],[8,9],[4,10],[10,11],[5,10]],
  },
  eagle: {
    label: 'the eagle',
    stars: [
      [0.50, 0.10], [0.50, 0.26],                 // head, chest
      [0.30, 0.20], [0.12, 0.30], [0.03, 0.46],   // left wing
      [0.70, 0.20], [0.88, 0.30], [0.97, 0.46],   // right wing
      [0.50, 0.48], [0.50, 0.70],                 // body
      [0.40, 0.90], [0.60, 0.90],                 // tail
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[1,5],[5,6],[6,7],[1,8],[8,9],[9,10],[9,11],[10,11]],
  },
  fish: {
    label: 'the fish',
    stars: [
      [0.06, 0.48], [0.20, 0.34], [0.44, 0.28],   // snout, brow, back
      [0.66, 0.36], [0.62, 0.16],                 // peduncle, dorsal fin
      [0.90, 0.20], [0.90, 0.78],                 // tail fork
      [0.66, 0.60], [0.42, 0.70], [0.20, 0.62],   // belly
      [0.44, 0.86],                               // ventral fin
    ],
    edges: [[0,1],[1,2],[2,4],[4,3],[2,3],[3,5],[5,6],[6,3],[3,7],[7,8],[8,9],[9,0],[8,10]],
  },
  bull: {
    label: 'the bull',
    stars: [
      [0.10, 0.14], [0.28, 0.10],                 // horns
      [0.19, 0.28], [0.16, 0.44],                 // head, muzzle
      [0.36, 0.32], [0.60, 0.24], [0.84, 0.30],   // withers, back, rump
      [0.86, 0.62], [0.86, 0.90],
      [0.38, 0.62], [0.38, 0.90],
      [0.62, 0.58],
    ],
    edges: [[0,2],[1,2],[2,3],[2,4],[4,5],[5,6],[6,7],[7,8],[4,9],[9,10],[9,11],[11,6]],
  },
  ram: {
    label: 'the ram',
    stars: [
      [0.22, 0.30], [0.10, 0.20], [0.06, 0.38], [0.20, 0.46], // curled horn
      [0.34, 0.24], [0.34, 0.44],                             // head, jaw
      [0.52, 0.28], [0.74, 0.24], [0.90, 0.34],
      [0.90, 0.66], [0.88, 0.90],
      [0.54, 0.60], [0.52, 0.88],
    ],
    edges: [[0,1],[1,2],[2,3],[3,0],[0,4],[4,5],[4,6],[6,7],[7,8],[8,9],[9,10],[6,11],[11,12],[7,11]],
  },
  scorpion: {
    label: 'the scorpion',
    stars: [
      [0.14, 0.20], [0.06, 0.34],                 // left pincer
      [0.44, 0.20], [0.52, 0.34],                 // right pincer
      [0.30, 0.36],                               // head
      [0.32, 0.54], [0.36, 0.70], [0.46, 0.84],   // body
      [0.64, 0.90], [0.80, 0.82], [0.90, 0.64],   // curling tail
      [0.86, 0.46],                               // stinger
    ],
    edges: [[1,0],[0,4],[3,2],[2,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11]],
  },
  turtle: {
    label: 'the turtle',
    stars: [
      [0.50, 0.10], [0.50, 0.28],                 // head, neck
      [0.24, 0.34], [0.14, 0.52], [0.24, 0.72],   // left shell
      [0.76, 0.34], [0.86, 0.52], [0.76, 0.72],   // right shell
      [0.50, 0.84],                               // tail
      [0.18, 0.22], [0.82, 0.22], [0.20, 0.84], [0.80, 0.84], // flippers
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,8],[1,5],[5,6],[6,7],[7,8],[2,9],[5,10],[4,11],[7,12]],
  },
  rabbit: {
    label: 'the rabbit',
    stars: [
      [0.30, 0.06], [0.36, 0.26],                 // left ear
      [0.50, 0.04], [0.48, 0.26],                 // right ear
      [0.40, 0.36],                               // head
      [0.56, 0.50], [0.74, 0.60], [0.86, 0.52],   // back, rump, tail
      [0.72, 0.84], [0.44, 0.62], [0.40, 0.84],
    ],
    edges: [[0,1],[1,4],[2,3],[3,4],[4,9],[4,5],[5,6],[6,7],[6,8],[9,10],[5,9]],
  },
  stag: {
    label: 'the stag',
    stars: [
      [0.14, 0.10], [0.06, 0.24], [0.24, 0.06],   // left antler
      [0.40, 0.10], [0.50, 0.22], [0.36, 0.04],   // right antler
      [0.27, 0.26], [0.24, 0.42],                 // head, muzzle
      [0.44, 0.36], [0.68, 0.30], [0.88, 0.38],
      [0.88, 0.70], [0.86, 0.92],
      [0.46, 0.66], [0.44, 0.92],
    ],
    edges: [[1,0],[0,2],[0,6],[3,5],[3,4],[3,6],[6,7],[6,8],[8,9],[9,10],[10,11],[11,12],[8,13],[13,14]],
  },
  owl: {
    label: 'the owl',
    stars: [
      [0.32, 0.10], [0.68, 0.10],                 // ear tufts
      [0.34, 0.26], [0.66, 0.26],                 // eyes
      [0.50, 0.38],                               // beak
      [0.20, 0.44], [0.16, 0.70],                 // left wing
      [0.80, 0.44], [0.84, 0.70],                 // right wing
      [0.50, 0.76],                               // breast
      [0.38, 0.92], [0.62, 0.92],                 // talons
    ],
    edges: [[0,2],[1,3],[2,3],[2,4],[3,4],[2,5],[5,6],[6,9],[3,7],[7,8],[8,9],[9,10],[9,11]],
  },
  snake: {
    label: 'the serpent',
    stars: [
      [0.08, 0.18], [0.22, 0.10], [0.38, 0.20],
      [0.48, 0.40], [0.38, 0.58], [0.24, 0.70],
      [0.34, 0.86], [0.56, 0.90], [0.76, 0.80],
      [0.88, 0.60], [0.86, 0.38],
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10]],
  },
  horse: {
    label: 'the mustang',
    stars: [
      [0.10, 0.32], [0.20, 0.18], [0.32, 0.30],   // muzzle, ear, jaw
      [0.44, 0.20], [0.66, 0.24], [0.86, 0.32],   // crest, back, rump
      [0.96, 0.54],                               // tail
      [0.84, 0.64], [0.82, 0.90],
      [0.44, 0.56], [0.42, 0.88],
    ],
    edges: [[0,2],[1,2],[1,3],[2,9],[3,4],[4,5],[5,6],[5,7],[7,8],[9,10],[4,9]],
  },
  lion: {
    label: 'the lion',
    stars: [
      [0.22, 0.14], [0.10, 0.28], [0.18, 0.44], [0.34, 0.30], // mane
      [0.20, 0.30],                               // face
      [0.48, 0.30], [0.70, 0.26], [0.88, 0.34],
      [0.94, 0.16],
      [0.86, 0.66], [0.84, 0.90],
      [0.48, 0.58], [0.46, 0.90],
    ],
    edges: [[0,1],[1,2],[2,3],[3,0],[4,3],[3,5],[5,6],[6,7],[7,8],[7,9],[9,10],[5,11],[11,12]],
  },
  shark: {
    label: 'the shark',
    stars: [
      [0.06, 0.44], [0.22, 0.30], [0.46, 0.24],
      [0.44, 0.06],                               // dorsal
      [0.70, 0.34], [0.92, 0.16], [0.90, 0.62],   // tail
      [0.66, 0.56], [0.40, 0.62], [0.18, 0.56],
      [0.36, 0.82],                               // pectoral
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[2,4],[4,5],[5,6],[6,4],[4,7],[7,8],[8,9],[9,0],[8,10]],
  },
  frog: {
    label: 'the frog',
    stars: [
      [0.36, 0.14], [0.64, 0.14],                 // eyes
      [0.50, 0.30],                               // head
      [0.30, 0.44], [0.70, 0.44],                 // shoulders
      [0.50, 0.62],                               // body
      [0.13, 0.51], [0.06, 0.74],                 // left arm
      [0.87, 0.51], [0.94, 0.74],                 // right arm
      [0.24, 0.86], [0.76, 0.86],                 // legs
    ],
    // No shoulder crossbar — it cut straight through the body diamond.
    edges: [[0,2],[1,2],[2,3],[2,4],[3,5],[4,5],[3,6],[6,7],[4,8],[8,9],[5,10],[5,11]],
  },
  hammer: {
    label: 'the hammer',
    stars: [
      [0.18, 0.16], [0.82, 0.16],                 // head top
      [0.18, 0.34], [0.82, 0.34],                 // head bottom
      [0.50, 0.34], [0.50, 0.56], [0.50, 0.78], [0.50, 0.94],
      [0.38, 0.94], [0.62, 0.94],
    ],
    edges: [[0,1],[0,2],[1,3],[2,3],[4,5],[5,6],[6,7],[7,8],[7,9]],
  },
  anchor: {
    label: 'the anchor',
    stars: [
      [0.50, 0.06], [0.50, 0.20],                 // ring
      [0.30, 0.26], [0.70, 0.26],                 // stock
      [0.50, 0.44], [0.50, 0.68],                 // shank
      [0.24, 0.66], [0.14, 0.84],                 // left fluke
      [0.76, 0.66], [0.86, 0.84],
      [0.50, 0.90],
    ],
    edges: [[0,1],[2,3],[1,4],[4,5],[5,6],[6,7],[5,8],[8,9],[5,10]],
  },
  axe: {
    label: 'the axe',
    stars: [
      [0.62, 0.08], [0.86, 0.20], [0.86, 0.44], [0.62, 0.34], // blade
      [0.58, 0.20],
      [0.46, 0.30], [0.36, 0.52], [0.26, 0.74], [0.18, 0.92],
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,0],[4,5],[5,6],[6,7],[7,8]],
  },
  rocket: {
    label: 'the rocket',
    stars: [
      [0.50, 0.04], [0.36, 0.26], [0.64, 0.26],
      [0.36, 0.62], [0.64, 0.62],
      [0.18, 0.82], [0.82, 0.82],
      [0.40, 0.82], [0.60, 0.82],
      [0.50, 0.96],
    ],
    edges: [[0,1],[0,2],[1,3],[2,4],[3,7],[4,8],[3,5],[5,7],[4,6],[6,8],[7,9],[8,9]],
  },
  oak: {
    label: 'the oak',
    stars: [
      [0.50, 0.96], [0.50, 0.72], [0.50, 0.52],
      [0.28, 0.40], [0.14, 0.24],
      [0.72, 0.40], [0.86, 0.24],
      [0.50, 0.28], [0.36, 0.10], [0.64, 0.10],
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[2,5],[5,6],[2,7],[7,8],[7,9]],
  },
  mountain: {
    label: 'the ridge',
    stars: [
      [0.04, 0.86], [0.24, 0.52], [0.36, 0.66],
      [0.52, 0.20], [0.60, 0.34], [0.68, 0.22],
      [0.80, 0.58], [0.96, 0.86],
      [0.44, 0.36], [0.50, 0.08],
    ],
    edges: [[0,1],[1,2],[2,8],[8,9],[9,3],[3,4],[4,5],[5,6],[6,7]],
  },
  arrow: {
    label: 'the arrow',
    stars: [
      [0.50, 0.04], [0.32, 0.24], [0.68, 0.24],
      [0.50, 0.24], [0.50, 0.50], [0.50, 0.74], [0.50, 0.94],
      [0.34, 0.80], [0.66, 0.80],
    ],
    edges: [[1,0],[0,2],[0,3],[3,4],[4,5],[5,6],[6,7],[6,8]],
  },
  hound: {
    label: 'the hound',
    stars: [
      [0.10, 0.40], [0.20, 0.26], [0.14, 0.56],   // muzzle, skull, ear
      [0.34, 0.32],
      [0.54, 0.28], [0.76, 0.32], [0.90, 0.24],   // back, haunch, tail
      [0.78, 0.62], [0.76, 0.88],
      [0.38, 0.60], [0.36, 0.88],
    ],
    edges: [[0,1],[1,2],[1,3],[3,4],[4,5],[5,6],[5,7],[7,8],[3,9],[9,10],[4,9]],
  },
};

// Keyword → shape. Checked as substrings against the lowercased F3 name, so
// "Crawdaddy", "Mudbug" and "Craw" all land on the crawfish.
const KEYWORDS = [
  [['craw', 'mudbug', 'crayfish', 'lobster', 'pinch'], 'crawfish'],
  [['bear', 'grizzly', 'kodiak', 'yogi', 'honey'], 'bear'],
  [['wolf', 'lobo', 'howl', 'fang', 'coyote', 'fox'], 'wolf'],
  [['eagle', 'hawk', 'falcon', 'talon', 'raven', 'crow', 'osprey', 'wing'], 'eagle'],
  [['hammerhead', 'shark', 'jaws', 'mako', 'reef'], 'shark'],
  [['fish', 'bass', 'trout', 'gill', 'minnow', 'bait', 'angler', 'tuna'], 'fish'],
  [['bull', 'oxen', 'longhorn', 'taurus', 'steer', 'brahma'], 'bull'],
  [['ram', 'goat', 'billy', 'horn'], 'ram'],
  [['scorpion', 'sting', 'scorp', 'venom'], 'scorpion'],
  [['turtle', 'tortoise', 'shell', 'terrapin', 'slow'], 'turtle'],
  [['rabbit', 'bunny', 'hare', 'hopper', 'jackrabbit'], 'rabbit'],
  [['stag', 'deer', 'buck', 'elk', 'antler', 'moose'], 'stag'],
  [['owl', 'hoot', 'night', 'wise', 'professor'], 'owl'],
  [['snake', 'viper', 'cobra', 'python', 'serpent', 'adder', 'mamba', 'rattle'], 'snake'],
  [['horse', 'mustang', 'stallion', 'colt', 'pony', 'bronco', 'saddle', 'gallop'], 'horse'],
  [['lion', 'leo', 'mane', 'pride', 'tiger', 'panther', 'cat'], 'lion'],
  [['frog', 'toad', 'tadpole', 'leap', 'ribbit'], 'frog'],
  [['hammer', 'sledge', 'mallet', 'anvil', 'forge', 'thor'], 'hammer'],
  [['anchor', 'navy', 'sail', 'harbor', 'dock', 'skipper', 'buoy'], 'anchor'],
  [['axe', 'chop', 'timber', 'lumber', 'hatchet', 'splitter'], 'axe'],
  [['rocket', 'launch', 'nasa', 'orbit', 'astro', 'apollo', 'booster'], 'rocket'],
  [['oak', 'tree', 'acorn', 'pine', 'cedar', 'branch'], 'oak'],
  [['mountain', 'ridge', 'peak', 'summit', 'everest', 'sherpa', 'climb', 'granite', 'boulder'], 'mountain'],
  [['arrow', 'archer', 'quiver', 'dart', 'sling', 'buckshot'], 'arrow'],
  [['hound', 'beagle', 'labrador', 'retriever', 'mutt', 'bark', 'puppy'], 'hound'],
];

// Shapes eligible for the hash fallback — creatures first, since a guy with a
// name nobody wrote a keyword for would rather be an animal than a hand tool.
const FALLBACK = [
  'bear', 'wolf', 'eagle', 'fish', 'bull', 'ram', 'scorpion', 'turtle',
  'rabbit', 'stag', 'owl', 'snake', 'horse', 'lion', 'shark', 'frog',
  'hound', 'crawfish', 'oak', 'mountain',
];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Pick the shape key for an F3 name. Deterministic — same name, same sky. */
export function shapeKeyFor(f3Name) {
  const n = String(f3Name || '').toLowerCase().trim();
  if (!n) return FALLBACK[0];
  for (const [words, key] of KEYWORDS) {
    for (const w of words) {
      if (n.includes(w)) return key;
    }
  }
  return FALLBACK[hash(n) % FALLBACK.length];
}

/** The full shape record for an F3 name: key, label, stars, edges. */
export function constellationFor(f3Name) {
  const key = shapeKeyFor(f3Name);
  const shape = SHAPES[key];
  return { key, label: shape.label, stars: shape.stars, edges: shape.edges };
}

export function shapeByKey(key) {
  return SHAPES[key] || SHAPES[FALLBACK[0]];
}

export const SHAPE_KEYS = Object.keys(SHAPES);
