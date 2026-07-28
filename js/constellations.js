// Constellation shapes, and the logic that picks one from an F3 name.
//
// Every shape is a list of stars in a normalized 0..1 box (x right, y down)
// plus the edges that connect them. Shapes are drawn head-up so a name label
// can sit underneath without covering anything.

// Every shape has exactly STARS_PER_CONSTELLATION stars — one per goal you
// knock down. That's what makes the season fair: ten is ten for everybody,
// whether a guy sets ten goals or thirty.
export const STARS_PER_CONSTELLATION = 10;

const SHAPES = {
  crawfish: {
    label: 'the crawfish',
    stars: [
      [0.04, 0.12], [0.27, 0.30],                // left claw: tip, elbow
      [0.96, 0.12], [0.73, 0.30],                // right claw
      [0.38, 0.40], [0.62, 0.40],                // shoulders
      [0.41, 0.62], [0.59, 0.62],                // waist
      [0.28, 0.93], [0.72, 0.93],                // tail fan
    ],
    edges: [[0,1],[1,4],[2,3],[3,5],[4,5],[4,6],[5,7],[6,7],[6,8],[7,9],[8,9]],
  },
  bear: {
    label: 'the bear',
    stars: [
      [0.24, 0.14], [0.08, 0.34], [0.30, 0.30],  // ear, snout, head
      [0.46, 0.26], [0.68, 0.22], [0.88, 0.32],  // shoulder, back, rump
      [0.86, 0.86],                              // hind leg
      [0.60, 0.56], [0.38, 0.52], [0.34, 0.88],  // belly, chest, fore leg
    ],
    edges: [[0,2],[1,2],[2,3],[3,4],[4,5],[5,6],[3,8],[8,9],[8,7],[7,5]],
  },
  wolf: {
    label: 'the wolf',
    stars: [
      [0.20, 0.14], [0.05, 0.34], [0.24, 0.28],  // ear, muzzle, head
      [0.42, 0.34], [0.64, 0.28], [0.82, 0.34],  // neck, back, haunch
      [0.96, 0.18], [0.80, 0.86],                // tail, hind leg
      [0.44, 0.60], [0.42, 0.88],                // chest, fore leg
    ],
    edges: [[0,2],[1,2],[2,3],[3,4],[4,5],[5,6],[5,7],[3,8],[8,9],[8,5]],
  },
  eagle: {
    label: 'the eagle',
    stars: [
      [0.50, 0.08], [0.50, 0.28],                // head, chest
      [0.28, 0.20], [0.04, 0.38],                // left wing
      [0.72, 0.20], [0.96, 0.38],                // right wing
      [0.50, 0.52], [0.50, 0.72],                // body, tail base
      [0.38, 0.92], [0.62, 0.92],                // tail fan
    ],
    edges: [[0,1],[1,2],[2,3],[1,4],[4,5],[1,6],[6,7],[7,8],[7,9],[8,9]],
  },
  fish: {
    label: 'the fish',
    stars: [
      [0.05, 0.48], [0.20, 0.33], [0.45, 0.27],  // snout, brow, back
      [0.60, 0.12], [0.70, 0.38],                // dorsal, peduncle
      [0.94, 0.20], [0.94, 0.76],                // tail fork
      [0.68, 0.60], [0.40, 0.72], [0.42, 0.90],  // belly, ventral fin
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[2,4],[4,5],[5,6],[6,7],[4,7],[7,8],[8,9],[8,0]],
  },
  bull: {
    label: 'the bull',
    stars: [
      [0.08, 0.14], [0.30, 0.10],                // horns
      [0.19, 0.30], [0.15, 0.46],                // head, muzzle
      [0.38, 0.32], [0.62, 0.26], [0.86, 0.32],  // withers, back, rump
      [0.86, 0.88], [0.40, 0.62], [0.38, 0.88],
    ],
    edges: [[0,2],[1,2],[2,3],[2,4],[4,5],[5,6],[6,7],[4,8],[8,9],[8,6]],
  },
  ram: {
    label: 'the ram',
    stars: [
      [0.20, 0.28], [0.06, 0.22], [0.08, 0.44],  // curled horn
      [0.32, 0.26], [0.30, 0.46],                // head, jaw
      [0.56, 0.28], [0.86, 0.32], [0.86, 0.88],
      [0.52, 0.60], [0.50, 0.88],
    ],
    edges: [[0,1],[1,2],[2,0],[0,3],[3,4],[3,5],[5,6],[6,7],[5,8],[8,9],[8,6]],
  },
  scorpion: {
    label: 'the scorpion',
    stars: [
      [0.10, 0.22], [0.46, 0.20],                // pincers
      [0.28, 0.38],                              // head
      [0.30, 0.56], [0.36, 0.72],                // body
      [0.48, 0.86], [0.66, 0.90], [0.82, 0.80],  // curling tail
      [0.92, 0.62], [0.86, 0.44],                // stinger
    ],
    edges: [[0,2],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9]],
  },
  turtle: {
    label: 'the turtle',
    stars: [
      [0.50, 0.08], [0.50, 0.26],                // head, neck
      [0.26, 0.34], [0.12, 0.56], [0.26, 0.80],  // left shell
      [0.74, 0.80], [0.88, 0.56], [0.74, 0.34],  // right shell
      [0.36, 0.94], [0.64, 0.94],                // hind flippers
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,1],[4,8],[5,9]],
  },
  rabbit: {
    label: 'the rabbit',
    stars: [
      [0.28, 0.05], [0.36, 0.28],                // left ear
      [0.50, 0.03], [0.48, 0.28],                // right ear
      [0.40, 0.38],                              // head
      [0.44, 0.60], [0.60, 0.48],                // chest, back
      [0.78, 0.60], [0.90, 0.52], [0.74, 0.86],  // rump, tail, foot
    ],
    edges: [[0,1],[1,4],[2,3],[3,4],[4,5],[4,6],[6,7],[7,8],[7,9],[5,9]],
  },
  stag: {
    label: 'the stag',
    stars: [
      [0.10, 0.06], [0.02, 0.24],                // left antler
      [0.42, 0.06], [0.52, 0.22],                // right antler
      [0.26, 0.28], [0.22, 0.46],                // head, muzzle
      [0.46, 0.36], [0.86, 0.36],                // shoulder, rump
      [0.86, 0.90], [0.46, 0.90],                // legs
    ],
    edges: [[1,0],[0,4],[2,3],[2,4],[4,5],[4,6],[6,7],[7,8],[6,9]],
  },
  owl: {
    label: 'the owl',
    stars: [
      [0.30, 0.10], [0.70, 0.10],                // ear tufts
      [0.32, 0.28], [0.68, 0.28],                // eyes
      [0.50, 0.40],                              // beak
      [0.18, 0.50], [0.82, 0.50],                // wings
      [0.50, 0.72],                              // breast
      [0.38, 0.92], [0.62, 0.92],                // talons
    ],
    edges: [[0,2],[1,3],[2,3],[2,4],[3,4],[2,5],[5,7],[3,6],[6,7],[7,8],[7,9]],
  },
  snake: {
    label: 'the serpent',
    stars: [
      [0.08, 0.16], [0.24, 0.08], [0.42, 0.20],
      [0.48, 0.42], [0.34, 0.60], [0.26, 0.76],
      [0.42, 0.90], [0.64, 0.90], [0.82, 0.76],
      [0.90, 0.54],
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9]],
  },
  horse: {
    label: 'the mustang',
    stars: [
      [0.08, 0.32], [0.20, 0.16], [0.30, 0.32],  // muzzle, ear, jaw
      [0.44, 0.20], [0.66, 0.24], [0.86, 0.32],  // crest, back, rump
      [0.97, 0.56], [0.84, 0.90],                // tail, hind leg
      [0.44, 0.58], [0.42, 0.90],                // chest, fore leg
    ],
    edges: [[0,2],[1,2],[1,3],[3,4],[4,5],[5,6],[5,7],[2,8],[8,9],[4,8]],
  },
  lion: {
    label: 'the lion',
    stars: [
      [0.22, 0.12], [0.08, 0.30], [0.22, 0.48], [0.36, 0.30], // mane
      [0.58, 0.28], [0.86, 0.32], [0.96, 0.16],  // back, rump, tail
      [0.86, 0.88], [0.48, 0.58], [0.46, 0.88],
    ],
    edges: [[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6],[5,7],[4,8],[8,9]],
  },
  shark: {
    label: 'the shark',
    stars: [
      [0.05, 0.44], [0.34, 0.28], [0.46, 0.06],  // snout, back, dorsal
      [0.66, 0.34], [0.94, 0.14], [0.92, 0.62],  // peduncle, tail fork
      [0.64, 0.56], [0.36, 0.62], [0.34, 0.84],  // belly, pectoral
      [0.18, 0.56],
    ],
    edges: [[0,1],[1,2],[2,3],[1,3],[3,4],[4,5],[5,6],[3,6],[6,7],[7,8],[7,9],[9,0]],
  },
  frog: {
    label: 'the frog',
    stars: [
      [0.36, 0.12], [0.64, 0.12],                // eyes
      [0.50, 0.30],                              // head
      [0.30, 0.44], [0.70, 0.44],                // shoulders
      [0.50, 0.64],                              // body
      [0.08, 0.62], [0.92, 0.62],                // hands
      [0.24, 0.90], [0.76, 0.90],                // feet
    ],
    edges: [[0,2],[1,2],[2,3],[2,4],[3,5],[4,5],[3,6],[4,7],[5,8],[5,9]],
  },
  hammer: {
    label: 'the hammer',
    stars: [
      [0.18, 0.16], [0.82, 0.16],                // head top
      [0.18, 0.34], [0.82, 0.34],                // head bottom
      [0.50, 0.34], [0.50, 0.56], [0.50, 0.78], [0.50, 0.94],
      [0.38, 0.94], [0.62, 0.94],
    ],
    edges: [[0,1],[0,2],[1,3],[2,3],[4,5],[5,6],[6,7],[7,8],[7,9]],
  },
  anchor: {
    label: 'the anchor',
    stars: [
      [0.50, 0.06], [0.50, 0.22],                // ring, shank top
      [0.28, 0.28], [0.72, 0.28],                // stock
      [0.50, 0.50], [0.50, 0.70],                // shank
      [0.24, 0.66], [0.12, 0.86],                // left fluke
      [0.76, 0.66], [0.88, 0.86],                // right fluke
    ],
    edges: [[0,1],[2,3],[1,4],[4,5],[5,6],[6,7],[5,8],[8,9]],
  },
  axe: {
    label: 'the axe',
    stars: [
      [0.60, 0.06], [0.88, 0.18], [0.88, 0.44], [0.60, 0.34], // blade
      [0.54, 0.18],                              // eye
      [0.46, 0.32], [0.36, 0.50], [0.28, 0.66], [0.20, 0.82], [0.12, 0.96],
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,0],[4,5],[5,6],[6,7],[7,8],[8,9]],
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
      [0.50, 0.04], [0.30, 0.24], [0.70, 0.24],  // tip, barbs
      [0.50, 0.24],                              // neck
      [0.50, 0.46], [0.50, 0.64], [0.50, 0.80],  // shaft
      [0.50, 0.96],                              // nock
      [0.30, 0.86], [0.70, 0.86],                // fletching
    ],
    edges: [[1,0],[0,2],[0,3],[3,4],[4,5],[5,6],[6,7],[6,8],[6,9]],
  },
  hound: {
    label: 'the hound',
    stars: [
      [0.08, 0.40], [0.20, 0.26], [0.12, 0.56],  // muzzle, skull, ear
      [0.34, 0.32], [0.56, 0.28], [0.78, 0.32],  // neck, back, haunch
      [0.92, 0.20], [0.78, 0.88],                // tail, hind leg
      [0.38, 0.60], [0.36, 0.88],                // chest, fore leg
    ],
    edges: [[0,1],[1,2],[1,3],[3,4],[4,5],[5,6],[5,7],[3,8],[8,9],[8,5]],
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

// Cheap guard so a hand-edited shape with the wrong star count is caught the
// first time the module loads rather than quietly skewing somebody's season.
for (const [key, shape] of Object.entries(SHAPES)) {
  if (shape.stars.length !== STARS_PER_CONSTELLATION) {
    console.error(
      `constellation "${key}" has ${shape.stars.length} stars, expected ${STARS_PER_CONSTELLATION}`,
    );
  }
}

export const SHAPE_KEYS = Object.keys(SHAPES);
