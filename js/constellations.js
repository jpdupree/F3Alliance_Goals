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
      [0.50, 0.34],                              // where the handle meets it
      [0.50, 0.56], [0.50, 0.78], [0.50, 0.94],
      [0.38, 0.94], [0.62, 0.94],                // grip
    ],
    // The head's bottom runs 2–4–3 rather than 2–3, so the handle is joined to
    // the head instead of floating beside it.
    edges: [[0,1],[0,2],[1,3],[2,4],[4,3],[4,5],[5,6],[6,7],[7,8],[7,9]],
  },
  anchor: {
    label: 'the anchor',
    stars: [
      [0.50, 0.06], [0.50, 0.26],                // ring, stock centre
      [0.24, 0.26], [0.76, 0.26],                // stock arms
      [0.50, 0.52], [0.50, 0.72],                // shank
      [0.24, 0.68], [0.12, 0.88],                // left fluke
      [0.76, 0.68], [0.88, 0.88],                // right fluke
    ],
    // The stock crosses *through* the shank (2–1–3) so the whole thing is one
    // connected figure and lights up as one.
    edges: [[0,1],[2,1],[1,3],[1,4],[4,5],[5,6],[6,7],[5,8],[8,9]],
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
  bolt: {
    label: 'the lightning bolt',
    stars: [
      [0.68, 0.02], [0.52, 0.22], [0.24, 0.52],  // top point down the left edge
      [0.46, 0.52],                              // upper notch
      [0.38, 0.70], [0.26, 0.98],                // down to the bottom point
      [0.48, 0.68], [0.70, 0.46],                // back up the right edge
      [0.48, 0.46], [0.60, 0.24],                // lower notch, home
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,0]],
  },
  boot: {
    label: 'the boot',
    stars: [
      [0.32, 0.04], [0.60, 0.04],                // opening
      [0.62, 0.44], [0.66, 0.64],                // ankle
      [0.90, 0.72], [0.92, 0.90],                // toe
      [0.30, 0.90], [0.26, 0.66],                // sole, heel
      [0.28, 0.40], [0.30, 0.20],                // shaft back
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,0]],
  },
  flower: {
    label: 'the bloom',
    stars: [
      [0.50, 0.34],                              // centre
      [0.50, 0.10], [0.72, 0.22], [0.72, 0.48], [0.28, 0.48], [0.28, 0.22],
      [0.50, 0.56], [0.50, 0.76], [0.50, 0.96],  // stem
      [0.76, 0.70],                              // leaf
    ],
    edges: [[0,1],[0,2],[0,3],[0,4],[0,5],[1,2],[2,3],[3,4],[4,5],[5,1],
            [0,6],[6,7],[7,8],[7,9]],
  },
  plane: {
    label: 'the aeroplane',
    stars: [
      [0.50, 0.05], [0.50, 0.45], [0.50, 0.80],  // nose, body, rear
      [0.06, 0.56], [0.94, 0.56],                // wing tips
      [0.40, 0.42], [0.60, 0.42],                // wing roots
      [0.30, 0.92], [0.70, 0.92],                // tailplane
      [0.50, 0.97],                              // fin
    ],
    edges: [[0,1],[1,2],[2,9],[1,5],[5,3],[1,6],[6,4],[2,7],[2,8]],
  },
  train: {
    label: 'the locomotive',
    stars: [
      [0.08, 0.26], [0.62, 0.26],                // cab roof
      [0.62, 0.44], [0.86, 0.44],                // boiler top
      [0.86, 0.66], [0.08, 0.66],                // footplate
      [0.22, 0.82], [0.46, 0.82], [0.70, 0.82],  // wheels
      [0.18, 0.09],                              // stack
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[5,6],[6,7],[7,8],[8,4],[0,9]],
  },
  car: {
    label: 'the racer',
    stars: [
      [0.06, 0.58], [0.28, 0.58], [0.38, 0.36], [0.64, 0.36],
      [0.74, 0.58], [0.94, 0.58], [0.94, 0.74], [0.06, 0.74],
      [0.30, 0.88], [0.70, 0.88],                // wheels
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0],[7,8],[8,9],[9,6]],
  },
  gear: {
    label: 'the cog',
    stars: [
      [0.50, 0.04], [0.67, 0.27], [0.94, 0.36], [0.77, 0.59], [0.77, 0.87],
      [0.50, 0.78], [0.23, 0.87], [0.23, 0.59], [0.06, 0.36], [0.33, 0.27],
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,0]],
  },
  ring: {
    label: 'the ring',
    stars: [
      [0.50, 0.30], [0.73, 0.39], [0.82, 0.62], [0.73, 0.85],
      [0.50, 0.94], [0.27, 0.85], [0.18, 0.62], [0.27, 0.39],
      [0.36, 0.08], [0.64, 0.08],                // the stone
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0],[8,9],[8,0],[9,0]],
  },
  book: {
    label: 'the open book',
    stars: [
      [0.50, 0.20], [0.50, 0.86],                // spine
      [0.08, 0.28], [0.06, 0.80],                // left board
      [0.92, 0.28], [0.94, 0.80],                // right board
      [0.28, 0.22], [0.72, 0.22],                // page tops
      [0.26, 0.84], [0.74, 0.84],                // page bottoms
    ],
    edges: [[0,1],[0,6],[6,2],[2,3],[3,8],[8,1],[0,7],[7,4],[4,5],[5,9],[9,1]],
  },
  drum: {
    label: 'the drum',
    stars: [
      [0.50, 0.16], [0.88, 0.30], [0.50, 0.44], [0.12, 0.30],  // head
      [0.86, 0.66], [0.50, 0.80], [0.14, 0.66],                // shell
      [0.22, 0.04], [0.78, 0.04],                              // sticks
      [0.50, 0.62],
    ],
    edges: [[0,1],[1,2],[2,3],[3,0],[1,4],[3,6],[4,5],[5,6],[2,9],[9,5],[7,2],[8,2]],
  },
  mushroom: {
    label: 'the mushroom cloud',
    stars: [
      [0.50, 0.94], [0.44, 0.74], [0.56, 0.74],  // stem
      [0.40, 0.54], [0.60, 0.54],
      [0.16, 0.42], [0.30, 0.24], [0.50, 0.14], [0.70, 0.24], [0.84, 0.42],
    ],
    edges: [[0,1],[0,2],[1,3],[2,4],[3,4],[3,5],[5,6],[6,7],[7,8],[8,9],[9,4]],
  },
  column: {
    label: 'the column',
    stars: [
      [0.22, 0.08], [0.78, 0.08],                // capital
      [0.28, 0.22], [0.72, 0.22],
      [0.34, 0.76], [0.66, 0.76],                // shaft
      [0.26, 0.86], [0.74, 0.86],
      [0.18, 0.96], [0.82, 0.96],                // base
    ],
    edges: [[0,1],[0,2],[1,3],[2,3],[2,4],[3,5],[4,5],[4,6],[5,7],[6,7],[6,8],[7,9],[8,9]],
  },
  knife: {
    label: 'the knife',
    stars: [
      [0.04, 0.90],                              // point
      [0.24, 0.66], [0.44, 0.42],                // spine
      [0.56, 0.28],                              // heel, top of the bolster
      [0.74, 0.44],                              // heel, bottom of the bolster
      [0.50, 0.68], [0.26, 0.96],                // cutting edge, back to the point
      [0.76, 0.14], [0.96, 0.06], [0.98, 0.30],  // handle
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,0],[3,7],[7,8],[8,9],[9,4]],
  },
  heart: {
    label: 'the heart',
    stars: [
      [0.50, 0.24],                              // notch
      [0.30, 0.10], [0.10, 0.26], [0.10, 0.48],  // left lobe
      [0.50, 0.94],                              // point
      [0.90, 0.48], [0.90, 0.26], [0.70, 0.10],  // right lobe
      [0.28, 0.66], [0.72, 0.66],
    ],
    edges: [[0,1],[1,2],[2,3],[3,8],[8,4],[0,7],[7,6],[6,5],[5,9],[9,4]],
  },
  sandwich: {
    label: 'the sub',
    stars: [
      [0.06, 0.40], [0.50, 0.26], [0.94, 0.40],  // top
      [0.94, 0.58], [0.50, 0.70], [0.06, 0.58],  // bottom
      [0.22, 0.48], [0.44, 0.44], [0.66, 0.46], [0.84, 0.52],  // filling
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[5,6],[6,7],[7,8],[8,9],[9,3]],
  },
  waffle: {
    label: 'the waffle',
    stars: [
      [0.10, 0.12], [0.90, 0.12], [0.90, 0.88], [0.10, 0.88],
      [0.37, 0.12], [0.63, 0.12],
      [0.37, 0.88], [0.63, 0.88],
      [0.10, 0.50], [0.90, 0.50],
    ],
    edges: [[0,4],[4,5],[5,1],[1,9],[9,2],[2,7],[7,6],[6,3],[3,8],[8,0],
            [4,6],[5,7],[8,9]],
  },
  pepper: {
    label: 'the pepper',
    stars: [
      [0.46, 0.05], [0.52, 0.20],                // stem
      [0.30, 0.26], [0.20, 0.44], [0.24, 0.66], [0.40, 0.84], [0.60, 0.93],
      [0.74, 0.76], [0.72, 0.50], [0.66, 0.28],
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,1]],
  },
  candycane: {
    label: 'the candy cane',
    stars: [
      [0.30, 0.30], [0.34, 0.14], [0.50, 0.05], [0.66, 0.14], [0.70, 0.30],
      [0.62, 0.44], [0.60, 0.62], [0.58, 0.80], [0.56, 0.96],
      [0.46, 0.34],
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[0,9],[9,4]],
  },
  spoon: {
    label: 'the spoon',
    stars: [
      [0.50, 0.05], [0.68, 0.16], [0.72, 0.34], [0.60, 0.46],
      [0.40, 0.46], [0.28, 0.34], [0.32, 0.16],
      [0.50, 0.60], [0.50, 0.78], [0.50, 0.96],
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,0],[3,7],[4,7],[7,8],[8,9]],
  },
  paw: {
    label: 'the paw print',
    stars: [
      [0.18, 0.34], [0.38, 0.19], [0.62, 0.19], [0.82, 0.34],  // toes
      [0.26, 0.62], [0.42, 0.52], [0.58, 0.52], [0.74, 0.62],  // pad
      [0.66, 0.87], [0.34, 0.87],
    ],
    edges: [[4,5],[5,6],[6,7],[7,8],[8,9],[9,4],[0,4],[1,5],[2,6],[3,7]],
  },
  house: {
    label: 'the homestead',
    stars: [
      [0.50, 0.05],                              // peak
      [0.08, 0.40], [0.92, 0.40],                // eaves
      [0.08, 0.94], [0.92, 0.94],                // base
      [0.40, 0.94], [0.40, 0.66], [0.60, 0.66], [0.60, 0.94],  // door
      [0.74, 0.12],                              // chimney
    ],
    edges: [[0,1],[0,2],[1,2],[1,3],[3,5],[5,6],[6,7],[7,8],[8,4],[4,2],[0,9]],
  },
  football: {
    label: 'the football',
    stars: [
      [0.02, 0.50], [0.20, 0.22], [0.50, 0.10], [0.80, 0.22],
      [0.98, 0.50], [0.80, 0.78], [0.50, 0.90], [0.20, 0.78],
      [0.50, 0.32], [0.50, 0.68],                // the seam
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0],[2,8],[8,9],[9,6]],
  },
  duck: {
    label: 'the duck',
    stars: [
      [0.02, 0.22], [0.16, 0.20], [0.22, 0.04], [0.32, 0.22],  // bill, head
      [0.36, 0.42],                                            // neck
      [0.30, 0.62], [0.52, 0.88], [0.82, 0.80],                // breast, belly
      [0.98, 0.54], [0.62, 0.44],                              // tail, back
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,4]],
  },
  footprint: {
    label: 'the footprint',
    stars: [
      [0.42, 0.92], [0.30, 0.74], [0.30, 0.50], [0.40, 0.34],
      [0.62, 0.34], [0.70, 0.52], [0.62, 0.76],
      [0.34, 0.15], [0.50, 0.08], [0.66, 0.15],  // toes
    ],
    edges: [[0,1],[1,2],[2,3],[3,7],[7,8],[8,9],[9,4],[4,5],[5,6],[6,0]],
  },
  iceberg: {
    label: 'the iceberg',
    stars: [
      [0.50, 0.05], [0.72, 0.34], [0.28, 0.34],
      [0.10, 0.40], [0.90, 0.40],                // waterline
      [0.06, 0.60], [0.24, 0.84], [0.52, 0.95], [0.80, 0.78], [0.94, 0.56],
    ],
    edges: [[0,1],[1,4],[4,9],[9,8],[8,7],[7,6],[6,5],[5,3],[3,2],[2,0],[3,4]],
  },
  baguette: {
    label: 'the baguette',
    stars: [
      [0.08, 0.78], [0.16, 0.60], [0.40, 0.34], [0.66, 0.13], [0.86, 0.06],
      [0.95, 0.19], [0.78, 0.41], [0.52, 0.65], [0.24, 0.87], [0.11, 0.92],
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,0]],
  },
  skillet: {
    label: 'the skillet',
    stars: [
      [0.14, 0.36], [0.30, 0.23], [0.52, 0.20], [0.68, 0.29],
      [0.74, 0.48], [0.62, 0.65], [0.40, 0.69], [0.20, 0.57],
      [0.86, 0.67], [0.98, 0.84],                // handle
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0],[4,8],[8,9]],
  },
  boomerang: {
    label: 'the boomerang',
    stars: [
      [0.09, 0.13], [0.28, 0.30], [0.46, 0.52], [0.54, 0.72], [0.62, 0.93],
      [0.83, 0.86], [0.70, 0.57], [0.52, 0.33], [0.32, 0.09], [0.16, 0.04],
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,0]],
  },
  cannon: {
    label: 'the cannon',
    stars: [
      [0.02, 0.55], [0.32, 0.42], [0.66, 0.28],  // barrel, breech to muzzle
      [0.70, 0.45], [0.36, 0.59], [0.05, 0.72],  // and back along the underside
      [0.17, 0.92], [0.60, 0.92],                // carriage
      [0.02, 1.00],                              // trail spike
      [0.96, 0.12],                              // and the shot, already gone
    ],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[4,6],[6,7],[7,3],[6,8],[2,9]],
  },
  gavel: {
    label: 'the gavel',
    stars: [
      [0.44, 0.02], [0.74, 0.14], [0.62, 0.38], [0.32, 0.26],  // head
      [0.32, 0.46], [0.16, 0.62],                              // handle
      [0.04, 0.72], [0.96, 0.72], [0.96, 0.94], [0.04, 0.94],  // block
    ],
    edges: [[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,6]],
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

// Names too short to match on safely. Checked whole, before anything else —
// "RC" is an RC car, but 'rc' as a substring would also swallow Arch, March
// and Torch.
const EXACT = {
  rc: 'car',
  tron: 'bolt',
};

// Keyword → shape. Checked as substrings against the lowercased F3 name, so
// "Crawdaddy", "Mudbug" and "Craw" all land on the crawfish.
//
// Order matters: the first row with a hit wins. The block at the top exists
// only to get in front of a broader keyword further down — Bullwinkle is a
// moose, not a bull; Short Horn is cattle, not a ram; Buckshot is shot, not a
// buck; and Old Town Road is a horse before it's a road.
const KEYWORDS = [
  [['bullwinkle'], 'stag'],
  [['short horn', 'shorthorn'], 'bull'],
  [['buckshot'], 'arrow'],
  [['old town road'], 'horse'],

  [['craw', 'mudbug', 'crayfish', 'lobster', 'pinch', 'cajun', 'etouffee', 'boudin'], 'crawfish'],
  [['bear', 'grizzly', 'kodiak', 'yogi', 'honey'], 'bear'],
  [['wolf', 'lobo', 'howl', 'fang', 'coyote', 'fox'], 'wolf'],
  [['eagle', 'hawk', 'falcon', 'talon', 'raven', 'crow', 'osprey', 'wing'], 'eagle'],
  [['hammerhead', 'shark', 'jaws', 'mako', 'reef'], 'shark'],
  [['fish', 'bass', 'trout', 'gill', 'minnow', 'bait', 'angler', 'tuna',
    'flounder', 'castaway', 'cast away', 'snapper', 'crappie', 'bream'], 'fish'],
  [['bull', 'oxen', 'longhorn', 'taurus', 'steer', 'brahma', 'jersey', 'angus',
    'hereford', 'brisket'], 'bull'],
  [['ram', 'goat', 'billy', 'horn'], 'ram'],
  [['scorpion', 'sting', 'scorp', 'venom'], 'scorpion'],
  [['turtle', 'tortoise', 'shell', 'terrapin', 'slow'], 'turtle'],
  [['rabbit', 'bunny', 'hare', 'hopper', 'jackrabbit'], 'rabbit'],
  [['stag', 'deer', 'buck', 'elk', 'antler', 'moose'], 'stag'],
  [['owl', 'hoot', 'nocturnal', 'wise', 'professor'], 'owl'],
  [['snake', 'viper', 'cobra', 'python', 'serpent', 'adder', 'mamba', 'rattle'], 'snake'],
  [['horse', 'mustang', 'stallion', 'colt', 'pony', 'bronco', 'saddle', 'gallop'], 'horse'],
  [['lion', 'leo', 'mane', 'pride', 'tiger', 'panther', 'cat', 'pard'], 'lion'],
  [['frog', 'toad', 'tadpole', 'leap', 'ribbit', 'croak'], 'frog'],
  [['hammer', 'sledge', 'mallet', 'anvil', 'forge', 'thor'], 'hammer'],
  [['anchor', 'navy', 'sail', 'harbor', 'dock', 'skipper', 'buoy'], 'anchor'],
  [['axe', 'chop', 'timber', 'lumber', 'hatchet', 'splitter'], 'axe'],
  [['rocket', 'launch', 'nasa', 'orbit', 'astro', 'apollo', 'booster'], 'rocket'],
  [['oak', 'tree', 'acorn', 'pine', 'cedar', 'branch', 'forest', 'forrest'], 'oak'],
  [['mountain', 'ridge', 'peak', 'summit', 'everest', 'sherpa', 'climb', 'granite', 'boulder'], 'mountain'],
  [['arrow', 'archer', 'quiver', 'dart', 'sling'], 'arrow'],
  [['hound', 'beagle', 'labrador', 'retriever', 'mutt', 'bark', 'puppy',
    'doodle', 'poodle', 'shepherd', 'collie', 'terrier', 'kennel'], 'hound'],

  // ── the second wave: fewer creatures, more of what men actually get named ──
  [['bolt', 'jolt', 'spark', 'circuit', 'lightning', 'volt', 'watt',
    'thunder', 'shock', 'flicker'], 'bolt'],
  [['boot', 'bootleg', 'cleat', 'stirrup', 'wader', 'galosh'], 'boot'],
  [['bluebonnet', 'sweet pea', 'sweetpea', 'jasmine', 'belle', 'rose', 'daisy',
    'petal', 'bloom', 'blossom', 'flower', 'lily', 'tulip', 'magnolia'], 'flower'],
  [['plane', 'layover', 'pilot', 'aviator', 'jet', 'cockpit', 'hangar',
    'boeing', 'cessna', 'mayday', 'tailwind'], 'plane'],
  [['train', 'trayn', 'boxcar', 'caboose', 'locomotive', 'railroad', 'track',
    'freight', 'conductor', 'depot'], 'train'],
  [['racecar', 'nascar', 'hilux', 'roadrash', 'road rash', 'roadkill',
    'road kill', 'wheel', 'grand prix', 'camaro', 'corvette', 'turbo',
    'muffler', 'hubcap', 'chevy', 'jalopy'], 'car'],
  [['gear', 'gasket', 'timing belt', 'cog', 'sprocket', 'clutch', 'piston',
    'drill', 'ratchet', 'camshaft', 'torque'], 'gear'],
  [['frodo', 'baggins', 'tolkien', 'hobbit', 'gandalf', 'gollum', 'loop',
    'bling', 'wedding ring'], 'ring'],
  [['notebook', 'bookie', 'book', 'novel', 'library', 'chapter', 'paperback',
    'librarian'], 'book'],
  [['drum', 'bongo', 'treble', 'cymbal', 'snare', 'tempo', 'metronome',
    'ringo', 'backbeat'], 'drum'],
  [['shroom', 'mushroom', 'fungi', 'morel', 'truffle', 'portobello'], 'mushroom'],
  [['greek', 'socrates', 'plato', 'roman', 'athens', 'sparta', 'pillar',
    'column', 'toga', 'parthenon', 'stoic'], 'column'],
  [['knife', 'blade', 'whittle', 'shred', 'peeler', 'rambo', 'first blood',
    'machete', 'cleaver', 'shiv', 'paring'], 'knife'],
  [['ticker', 'heart', 'cardio', 'pulse', 'valve', 'aorta', 'cupid',
    'sweetheart'], 'heart'],
  [['sandwich', 'hoagie', 'deli', 'hot pocket', 'hotpocket', 'doubledouble',
    'double double', 'panini', 'reuben', 'blt', 'grinder', 'po boy'], 'sandwich'],
  [['waffle', 'flapjack', 'pancake', 'griddle', 'syrup', 'ihop',
    'short stack'], 'waffle'],
  [['candy', 'peppermint', 'lollipop', 'sweet tooth', 'gumdrop',
    'north pole'], 'candycane'],
  [['pepper', 'reaper', 'jalapeno', 'habanero', 'veggie', 'sriracha',
    'chili', 'scoville', 'poblano', 'tabasco'], 'pepper'],
  [['spoon', 'ladle', 'spatula', 'whisk', 'stirrer'], 'spoon'],
  [['paw', 'claw', 'pounce', 'pawprint'], 'paw'],
  [['house', 'shiplap', 'dorothy', 'homeboy', 'dreamhouse', 'cabin', 'porch',
    'shingle', 'bungalow', 'homestead', 'realtor'], 'house'],
  [['wilson', 'gronk', 'man u', 'man utd', 'gridiron', 'touchdown', 'quarterback',
    'pigskin', 'football', 'soccer', 'fumble', 'punter', 'tailgate',
    'hail mary'], 'football'],
  [['duck', 'daffy', 'quack', 'quak', 'goose', 'g00se', 'mallard', 'drake',
    'waddle', 'gander', 'gizzard'], 'duck'],
  [['yeti', 'bigfoot', 'sasquatch', 'footprint', 'twinkle toes', 'barefoot',
    'walk on', 'gump', 'tread', 'trailhead', 'flat foot'], 'footprint'],
  [['iceberg', 'glacier', 'titanic', 'arctic', 'tundra', 'frostbite',
    'permafrost', 'floe'], 'iceberg'],
  [['baguette', 'sourdough', 'ciabatta', 'french bread', 'croissant',
    'boule', 'brioche'], 'baguette'],
  [['skillet', 'huevos', 'fajita', 'cast iron', 'omelet', 'scramble',
    'sizzle', 'hash brown', 'griddy'], 'skillet'],
  [['boomerang', 'outback', 'didgeridoo', 'walkabout', 'down under'], 'boomerang'],
  [['cannon', 'arsenal', 'artillery', 'howitzer', 'gunner', 'musket',
    'mortar', 'broadside'], 'cannon'],
  [['gavel', 'objection', 'judge', 'verdict', 'bailiff', 'subpoena', 'contempt',
    'overrule'], 'gavel'],
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

/**
 * Pick the shape for an F3 name, and say why.
 *
 * `via` is the word that earned it, or null when nothing matched and the name
 * fell through to the hashed creature list. Deterministic — same name, same
 * sky, on every device.
 */
export function shapeMatchFor(f3Name) {
  const n = String(f3Name || '').toLowerCase().trim();
  if (!n) return { key: FALLBACK[0], via: null };
  if (EXACT[n]) return { key: EXACT[n], via: n };
  for (const [words, key] of KEYWORDS) {
    for (const w of words) {
      if (n.includes(w)) return { key, via: w };
    }
  }
  return { key: FALLBACK[hash(n) % FALLBACK.length], via: null };
}

/** Just the shape key for an F3 name. */
export function shapeKeyFor(f3Name) {
  return shapeMatchFor(f3Name).key;
}

/** The full shape record for an F3 name: key, label, stars, edges. */
export function constellationFor(f3Name) {
  const key = shapeKeyFor(f3Name);
  const shape = SHAPES[key];
  return { key, label: shape.label, stars: shape.stars, edges: shape.edges };
}

/**
 * The order a shape's stars light up in.
 *
 * Walks the shape along its own lines (depth-first from the first star), so
 * every star after the first is joined to one already lit. That matters a lot
 * at half done: lighting them in definition order leaves a bull as two
 * disconnected horn tips, whereas walking the edges leaves a connected
 * half-animal that still reads as an animal.
 *
 * Memoized per shape object — the built-ins are constants and a drawn shape is
 * re-created only when it's edited.
 */
const orderCache = new WeakMap();

export function lightingOrder(shape) {
  const hit = orderCache.get(shape);
  if (hit) return hit;

  const n = shape.stars.length;
  const adj = Array.from({ length: n }, () => []);
  for (const [a, b] of shape.edges) {
    if (a < n && b < n && a !== b) { adj[a].push(b); adj[b].push(a); }
  }
  for (const list of adj) list.sort((x, y) => x - y);

  const seen = new Set();
  const order = [];
  const walk = (i) => {
    if (seen.has(i)) return;
    seen.add(i);
    order.push(i);
    for (const j of adj[i]) walk(j);
  };
  walk(0);
  // A drawn shape can have stars joined to nothing; they come last.
  for (let i = 0; i < n; i++) if (!seen.has(i)) order.push(i);

  orderCache.set(shape, order);
  return order;
}

/**
 * Edges in the order they complete, as a star-count each: an edge appears the
 * moment its later star lights. Used to run the completion sweep along the
 * figure in the same order it was built.
 */
const edgeOrderCache = new WeakMap();

export function edgeOrder(shape) {
  const hit = edgeOrderCache.get(shape);
  if (hit) return hit;

  const order = lightingOrder(shape);
  const step = new Array(shape.stars.length).fill(0);
  order.forEach((starIndex, i) => { step[starIndex] = i; });

  const out = shape.edges
    .map((e, i) => ({ i, at: Math.max(step[e[0]] ?? 0, step[e[1]] ?? 0) }))
    .sort((a, b) => a.at - b.at)
    .map((x, rank, all) => ({ index: x.i, t: all.length > 1 ? rank / (all.length - 1) : 0 }));

  // Keyed by edge index so the renderer can look up as it walks shape.edges.
  const byEdge = new Array(shape.edges.length).fill(0);
  for (const { index, t } of out) byEdge[index] = t;

  edgeOrderCache.set(shape, byEdge);
  return byEdge;
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
