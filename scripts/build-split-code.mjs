import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  FACE, IMG, KC_CLUSTERS, NAME_LINES, PALETTE, PREVIEW, THEMES,
  doc, justifyBlocks, shape,
} from "./lib/design.mjs";

const W = 900;
const PAD = 40;
const BLOCK_W = W - PAD * 2;

const GREET_SIZE = 34;
const CODE_SIZE = 15;
const LEADING = 1.28;

const O = 0.5;

const HEY_START = O + 0.3, HEY_DUR = 0.6, HEY_ARC = 0.4;
const IS_START = O + 1.5, IS_STAGGER = 0.1, IS_TRAVEL = 0.4;

const CHURN_START = O;
const JITTER = 1.5;
const GHOST_OP = 0.20;

// The pool: same face, weight and size as the name, but never sorted. It keeps
// jumbling across the whole canvas for the length of the loop.
const AMB_COLS = 9, AMB_ROWS = 6, AMB_FILL = 0.87;
const AMB_HOPS = 7;
const AMB_SWAY_X = 175, AMB_SWAY_Y = 122;
const AMB_ROT = 32;
const AMB_DUR = [11, 30];
const AMB_HOP_SKEW = 1.6;
const AMB_OP = 0.30, AMB_DIM = 0.22;
const AMB_SEED = 5140723;

const RES_TYPE_START = O + 3.0;
const RES_INVOKE = O + 4.0;
const RES_TYPE_DUR = +(RES_INVOKE - RES_TYPE_START).toFixed(2);
const SORT_GAP = 1.0;
const SORT_FIRE = +(RES_INVOKE + SORT_GAP).toFixed(2);
const BRIGHTEN = 1.4;
const SORT_TRAVEL = 1.5, SORT_STAGGER = 0.125;

const TYPE_DUR = 1.95;
const RESULT_GAP = 1.25;

// The K and C light one after the other, the way the terminal prints them, and
// each carries a gold bloom that swells and clears.
const GOLD_LEAD = 0.15, GOLD_STEP = 0.19, GOLD_DUR = 0.55;
const GOLD_POP = 1.05, GOLD_POP_DUR = 0.5;
const BLOOM_BLUR = 9, BLOOM_PEAK = 0.85, BLOOM_TAIL = 1.8;

// The landed name never sits perfectly still. A whole line floats on x and y at
// once, and each letter bobs on top of that. Per-letter movement is vertical
// only: the outer lines are justified to the block, so drift on x would show up
// as uneven gaps between the letters.
const LINE_FLOAT_X = 4.6, LINE_FLOAT_Y = 7.4;
const LINE_DUR_X = [6.4, 8.4], LINE_DUR_Y = [4.4, 5.8];
const BREATH_AMP = 2.7;
const BREATH_DUR = [2.8, 4.0];
const BREATH_WAVE = 0.09;
const GREET_BREATH = 4.2, GREET_BREATH_DUR = 5.6;

// Then the name lets go, letter by letter, and drifts back to the scramble it
// started from. That makes t=0 and t=TL the same frame, so the loop closes.
const RELEASE_SPREAD = 1.5;
const RELEASE_DIM = 2.2;
const RELEASE_FADE = 0.6;
const STORY_OUT = 0.9, STORY_IN = 0.9;

const HOLD = 4.0, RESET = 3.6;

let TL = 0;

const k = (sec) => +(sec / TL).toFixed(5);
const EASE = "0.22 1 0.36 1";
const LIN = "0 0 1 1";
const CHURN = "0.45 0 0.55 1";

const TERM = {
  light: { bg: "#F4F1EA", fg: "#2B2A27", bar: "#ECEAE3", border: "#00000019",
           mut: "#8A897F", prompt: "#3FA34D", title: "#7C7A72" },
  dark:  { bg: "#1C1B18", fg: "#E7E6E1", bar: "#26251F", border: "#FFFFFF14",
           mut: "#77766E", prompt: "#4CC85D", title: "#8E8D86" },
};
const DOTS = ["#FF5F57", "#FEBC2E", "#28C840"];


const { paths, meta } = justifyBlocks([
  { key: "name", lines: NAME_LINES, width: BLOCK_W, align: ["justify", "center", "justify"] },
]);

const disp = (id, text) => ({ id, text, size: GREET_SIZE, font: FACE.displayLight.file, axes: FACE.displayLight.axes });
const code = (id, text, size = CODE_SIZE) => ({ id, text, size, font: FACE.mono.file, axes: FACE.mono.axes });
const type = shape([
  disp("hey", "Hey,"),
  disp("is", " my name is"),
  code("resolvename", "resolveName()"),
  code("invoke", "console.log(getPreferredName())"),
  code("kc", "KC"),
  code("running", "running..."),
  code("resolved", "resolved"),
  code("title", "kc@readme", 11),
]);

const AMB_ALPHA = [...new Set(NAME_LINES.join(""))].filter((c) => c !== "-");
const ambType = shape(AMB_ALPHA.map((ch, i) => ({
  id: `a${i}`, text: ch, size: meta.name.base,
  font: FACE.display.file, axes: FACE.display.axes,
})));
const AMB_CAP = ambType.a0.capHeight;

const GLYPHS = NAME_LINES.flatMap((_, li) =>
  paths[`name-${li}`].glyphs.map((g) => ({ ...g, line: li }))
);
const N = GLYPHS.length;
const { cap, offsets } = meta.name;
const step = cap * LEADING;

const CLIMAX = +(SORT_FIRE + (N - 1) * SORT_STAGGER + SORT_TRAVEL).toFixed(2);
const RESULT_IN = +(CLIMAX + TYPE_DUR + RESULT_GAP).toFixed(2);
const END = +(RESULT_IN + HOLD).toFixed(2);
TL = +(END + RESET).toFixed(2);

function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function field(seed) {
  const r = rng(seed);
  return GLYPHS.map(() => ({
    dx: (r() - 0.5) * 2 * 165 * JITTER,
    dy: (r() - 0.5) * 2 * 120 * JITTER,
    rot: +((r() - 0.5) * 2 * 24 * JITTER).toFixed(1),
  }));
}
const STATES = [field(20260728), field(8613), field(41099), field(660231)];

const BREATH = (() => {
  const r = rng(970331);
  return GLYPHS.map((_, n) => ({
    dur: +(BREATH_DUR[0] + r() * (BREATH_DUR[1] - BREATH_DUR[0])).toFixed(2),
    lag: +(n * BREATH_WAVE + r() * 0.9).toFixed(2),
    amp: +(BREATH_AMP * (0.55 + r() * 0.45) * (r() < 0.5 ? -1 : 1)).toFixed(2),
  }));
})();

const LINE_BREATH = (() => {
  const r = rng(31415);
  const swing = (a) => +(a * (0.7 + r() * 0.6) * (r() < 0.5 ? -1 : 1)).toFixed(2);
  return NAME_LINES.map((_, i) => ({
    ax: swing(LINE_FLOAT_X), ay: swing(LINE_FLOAT_Y),
    tx: +(LINE_DUR_X[0] + r() * (LINE_DUR_X[1] - LINE_DUR_X[0])).toFixed(2),
    ty: +(LINE_DUR_Y[0] + r() * (LINE_DUR_Y[1] - LINE_DUR_Y[0])).toFixed(2),
    lx: +(i * 2.3 + r() * 1.6).toFixed(2),
    ly: +(i * 1.7 + r() * 1.2).toFixed(2),
  }));
})();

// The gold pair holds on longest, so the name is last seen as K and C.
const RELEASE_AT = (() => {
  const r = rng(430915);
  return GLYPHS.map((g) => {
    const isKC = g.line === 0 && KC_CLUSTERS.includes(g.cluster);
    const off = isKC ? RELEASE_SPREAD * (0.82 + r() * 0.18) : RELEASE_SPREAD * r() * 0.72;
    return +(END + off).toFixed(2);
  });
})();
const home = { dx: 0, dy: 0, rot: 0 };
const clamp = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));

const greetCap = type.hey.capHeight;
const resCap = type.invoke.capHeight;

const greetBaseline = 38 + greetCap;
const nameTopY = greetBaseline + 30;
const nameBaseline0 = nameTopY + cap;
const nameBaseline2 = nameBaseline0 + step * (NAME_LINES.length - 1);

const TERM_W = 640, TERM_PAD = 8, BAR_H = 30, RADIUS = 12;
const TERM_X = Math.round((W - TERM_W) / 2);
const rowH = Math.round(CODE_SIZE * 1.9);
const termTop = Math.round(nameBaseline2 + 46);
const bodyTop = termTop + BAR_H + TERM_PAD;
const row0 = bodyTop + resCap;
const row1 = row0 + rowH;
const row2 = row1 + rowH;
const row3 = row2 + rowH;
const TERM_BOTTOM = row3 + CODE_SIZE * 0.35 + TERM_PAD;
const TERM_H = +(TERM_BOTTOM - termTop).toFixed(1);
const H = Math.round(TERM_BOTTOM + 60);

const textX = TERM_X + TERM_PAD + 4;
const PROMPT_W = 15;
const cmdX = textX + PROMPT_W;

function fence(g, d) {
  const ax = PAD + offsets[g.line] + g.x;
  const ay = nameTopY + cap + g.line * step;
  return {
    dx: +clamp(d.dx, PAD - ax, W - PAD - g.advance - ax).toFixed(1),
    dy: +clamp(d.dy, greetBaseline + 8 - ay, termTop - resCap - 12 - ay).toFixed(1),
    rot: d.rot,
  };
}

function ambDefs(ns) {
  return AMB_ALPHA.map((_, i) => `<path id="${ns}-a${i}" d="${ambType[`a${i}`].d}"/>`).join("\n    ");
}

// The pool the name is pulled out of. Anchored on a jittered grid over the whole
// canvas, then left on a closed loop of waypoints, so a letter never settles and
// never leaves. It passes behind the terminal rather than stopping at it.
function ambientField(t, ns) {
  const r = rng(AMB_SEED);
  const pick = (lo, hi) => lo + r() * (hi - lo);
  const cellW = W / AMB_COLS, cellH = H / AMB_ROWS;
  const sp = Array(AMB_HOPS).fill(CHURN).join(";");

  // Uneven hop lengths, so one letter speeds up and stalls within its own cycle
  // instead of ticking through the waypoints at a constant rate.
  const hopTimes = () => {
    const w = Array.from({ length: AMB_HOPS }, () => 1 + r() * AMB_HOP_SKEW);
    const total = w.reduce((a, b) => a + b, 0);
    const out = [0];
    let acc = 0;
    for (let j = 0; j < AMB_HOPS - 1; j++) {
      acc += w[j] / total;
      out.push(+acc.toFixed(4));
    }
    out.push(1);
    return out.join(";");
  };

  const out = [];
  for (let col = 0; col < AMB_COLS; col++) {
    for (let row = 0; row < AMB_ROWS; row++) {
      if (r() > AMB_FILL) continue;

      const gi = Math.floor(r() * AMB_ALPHA.length);
      const g = ambType[`a${gi}`];
      const ax = clamp(pick(col * cellW, (col + 1) * cellW), -g.width * 0.3, W - g.width * 0.7);
      const ay = clamp(pick(row * cellH + AMB_CAP, (row + 1) * cellH + AMB_CAP), AMB_CAP * 0.75, H + AMB_CAP * 0.3);
      const cx = (g.width / 2).toFixed(1), cy = (-AMB_CAP / 2).toFixed(1);

      // Sample inside the reachable range rather than clamping after the fact,
      // or waypoints pile up on the edge and the letter slides along it.
      const xLo = Math.max(-AMB_SWAY_X, -g.width * 0.3 - ax);
      const xHi = Math.min(AMB_SWAY_X, W - g.width * 0.7 - ax);
      const yLo = Math.max(-AMB_SWAY_Y, AMB_CAP * 0.75 - ay);
      const yHi = Math.min(AMB_SWAY_Y, H + AMB_CAP * 0.3 - ay);

      const tv = [], rv = [];
      for (let j = 0; j < AMB_HOPS; j++) {
        tv.push(`${pick(xLo, xHi).toFixed(1)},${pick(yLo, yHi).toFixed(1)}`);
        rv.push(`${pick(-AMB_ROT, AMB_ROT).toFixed(1)} ${cx} ${cy}`);
      }
      tv.push(tv[0]);
      rv.push(rv[0]);

      const dur = +pick(...AMB_DUR).toFixed(1);
      const rdur = +pick(...AMB_DUR).toFixed(1);

      out.push(`
      <g transform="translate(${ax.toFixed(1)} ${ay.toFixed(1)})">
        <g>
          <animateTransform attributeName="transform" type="translate" dur="${dur}s"
            begin="-${(r() * dur).toFixed(1)}s" calcMode="spline" repeatCount="indefinite"
            keyTimes="${hopTimes()}" keySplines="${sp}" values="${tv.join("; ")}"/>
          <animateTransform attributeName="transform" type="rotate" additive="sum" dur="${rdur}s"
            begin="-${(r() * rdur).toFixed(1)}s" calcMode="spline" repeatCount="indefinite"
            keyTimes="${hopTimes()}" keySplines="${sp}" values="${rv.join("; ")}"/>
          <use href="#${ns}-a${gi}"/>
        </g>
      </g>`);
    }
  }

  return `
  <g fill="${t.ghost}" opacity="${AMB_OP}">
    <animate attributeName="opacity" dur="${TL}s" repeatCount="indefinite"
      keyTimes="0;${k(SORT_FIRE)};${k(SORT_FIRE + BRIGHTEN)};${k(END)};1"
      values="${AMB_OP};${AMB_OP};${AMB_DIM};${AMB_DIM};${AMB_OP}"/>${out.join("")}
  </g>`;
}

// One letter, from the scramble it starts in to the scramble it goes back to.
function letter(t, ns, g, n) {
  const settle = SORT_FIRE + n * SORT_STAGGER;
  const land = settle + SORT_TRAVEL;
  const mid = CHURN_START + (settle - CHURN_START) * 0.5;
  const go = RELEASE_AT[n];
  const drift = +((go + TL) / 2).toFixed(2);
  const isKC = g.line === 0 && KC_CLUSTERS.includes(g.cluster);
  const b = BREATH[n];

  const S0 = fence(g, STATES[0][n]);
  const S1 = fence(g, STATES[1][n]);
  const S2 = fence(g, STATES[2][n]);
  const S3 = fence(g, STATES[3][n]);
  const cx = (g.x + g.advance / 2).toFixed(1);
  const cy = (-cap / 2).toFixed(1);

  const times = [0, CHURN_START, mid, settle, land, go, drift, TL];
  const keyTimes = times.map(k).join(";");
  const splines = [LIN, CHURN, CHURN, EASE, LIN, CHURN, CHURN].join(";");
  const tv = [S0, S0, S1, S2, home, home, S3, S0];

  const gold = +(RESULT_IN + GOLD_LEAD + KC_CLUSTERS.indexOf(g.cluster) * GOLD_STEP).toFixed(2);
  const fillFrames = isKC
    ? [[0, t.ghost, LIN], [settle, t.ghost, LIN], [land, t.ink, LIN], [gold, t.ink, EASE],
       [gold + GOLD_DUR, t.gold, LIN], [go, t.gold, EASE], [go + RELEASE_FADE, t.ghost, LIN], [TL, t.ghost]]
    : [[0, t.ghost, LIN], [settle, t.ghost, LIN], [land, t.ink, LIN],
       [go, t.ink, EASE], [go + RELEASE_FADE, t.ghost, LIN], [TL, t.ghost]];

  const face = `
            <path d="${g.d}" fill="${t.ghost}">
              <animate attributeName="fill" dur="${TL}s" repeatCount="indefinite" calcMode="spline"
                keyTimes="${fillFrames.map(([s]) => k(s)).join(";")}"
                keySplines="${fillFrames.slice(0, -1).map(([, , e]) => e).join(";")}"
                values="${fillFrames.map(([, c]) => c).join(";")}"/>
            </path>`;

  // The gold pair flares: a blurred copy of the letter swells and clears, and
  // the letter itself takes a short scale pop about its own centre.
  const lit = isKC ? `
          <g transform="translate(${cx} ${cy})">
            <g>
              <animateTransform attributeName="transform" type="scale" dur="${TL}s"
                repeatCount="indefinite" calcMode="spline"
                keyTimes="0;${k(gold)};${k(gold + GOLD_POP_DUR * 0.38)};${k(gold + GOLD_POP_DUR)};1"
                keySplines="${LIN};${EASE};${EASE};${LIN}" values="1;1;${GOLD_POP};1;1"/>
              <g transform="translate(${-cx} ${-cy})">
                <path d="${g.d}" fill="${t.gold}" filter="url(#${ns}-bloom)" opacity="0">
                  <animate attributeName="opacity" dur="${TL}s" repeatCount="indefinite" calcMode="spline"
                    keyTimes="0;${k(gold)};${k(gold + GOLD_DUR * 0.75)};${k(gold + BLOOM_TAIL)};1"
                    keySplines="${LIN};${EASE};${EASE};${LIN}" values="0;0;${BLOOM_PEAK};0;0"/>
                </path>${face}
              </g>
            </g>
          </g>` : face;

  return `
        <g>
          <animateTransform attributeName="transform" type="translate" dur="${b.dur}s"
            begin="-${b.lag}s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1"
            keySplines="${CHURN};${CHURN}" values="0,0; 0,${b.amp}; 0,0"/>
          <g>
            <animateTransform attributeName="transform" type="translate" dur="${TL}s"
              repeatCount="indefinite" calcMode="spline" keyTimes="${keyTimes}"
              keySplines="${splines}" values="${tv.map((v) => `${v.dx},${v.dy}`).join(";")}"/>
            <animateTransform attributeName="transform" type="rotate" additive="sum" dur="${TL}s"
              repeatCount="indefinite" calcMode="spline" keyTimes="${keyTimes}"
              keySplines="${splines}" values="${tv.map((v) => `${v.rot} ${cx} ${cy}`).join(";")}"/>${lit}
          </g>
        </g>`;
}

// Each line rides its own slow float, so the name drifts as three blocks with
// the letters bobbing inside them.
function letters(t, ns) {
  return NAME_LINES.map((_, li) => {
    const f = LINE_BREATH[li];
    const inner = GLYPHS.map((g, n) => (g.line === li ? letter(t, ns, g, n) : "")).join("");
    return `
    <g transform="translate(${offsets[li]} ${(cap + li * step).toFixed(1)})">
      <g>
        <animateTransform attributeName="transform" type="translate" dur="${f.ty}s"
          begin="-${f.ly}s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1"
          keySplines="${CHURN};${CHURN}" values="0,0; 0,${f.ay}; 0,0"/>
        <g>
          <animateTransform attributeName="transform" type="translate" dur="${f.tx}s"
            begin="-${f.lx}s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1"
            keySplines="${CHURN};${CHURN}" values="0,0; ${f.ax},0; 0,0"/>${inner}
        </g>
      </g>
    </g>`;
  }).join("");
}

function hey(t) {
  const g = type.hey;
  const offX = -2.4 * HEY_ARC * GREET_SIZE;
  const offY = -2.8 * HEY_ARC * GREET_SIZE;
  const rot0 = -12 * HEY_ARC;
  const hcx = (g.width / 2).toFixed(1);
  const t0 = HEY_START, t1 = HEY_START + HEY_DUR, tb = HEY_START + HEY_DUR * 0.82;

  return `
    <g>
      <animateTransform attributeName="transform" type="translate" dur="${TL}s" repeatCount="indefinite"
        calcMode="spline" keyTimes="0;${k(t0)};${k(t1)};1"
        keySplines="${LIN};0.16 1 0.3 1;${LIN}" values="${offX.toFixed(1)},0; ${offX.toFixed(1)},0; 0,0; 0,0"/>
      <g>
        <animateTransform attributeName="transform" type="translate" dur="${TL}s" repeatCount="indefinite"
          calcMode="spline" keyTimes="0;${k(t0)};${k(tb)};${k(t1)};1"
          keySplines="${LIN};0.5 0 0.9 0.5;0.2 0.7 0.4 1;${LIN}"
          values="0,${offY.toFixed(1)}; 0,${offY.toFixed(1)}; 0,3; 0,0; 0,0"/>
        <g>
          <animateTransform attributeName="transform" type="rotate" dur="${TL}s" repeatCount="indefinite"
            calcMode="spline" keyTimes="0;${k(t0)};${k(t1)};1"
            keySplines="${LIN};0.16 1 0.3 1;${LIN}"
            values="${rot0} ${hcx} 0; ${rot0} ${hcx} 0; 0 ${hcx} 0; 0 ${hcx} 0"/>
          <path d="${g.d}" fill="${t.muted}" opacity="0">
            <animate attributeName="opacity" dur="${TL}s" repeatCount="indefinite"
              keyTimes="0;${k(t0)};${k(t0 + 0.12)};1" values="0;0;1;1"/>
          </path>
        </g>
      </g>
    </g>`;
}

function ripple(t) {
  const off = type.hey.width;
  const rise = GREET_SIZE * 0.5;
  return type.is.glyphs.map((g, j) => {
    const cue = IS_START + j * IS_STAGGER;
    const tb = cue + IS_TRAVEL * 0.8;
    const end = cue + IS_TRAVEL;
    return `
      <g transform="translate(${off.toFixed(1)} 0)">
        <g opacity="0">
          <animate attributeName="opacity" dur="${TL}s" repeatCount="indefinite"
            keyTimes="0;${k(cue)};${k(cue + 0.1)};1" values="0;0;1;1"/>
          <animateTransform attributeName="transform" type="translate" dur="${TL}s" repeatCount="indefinite"
            calcMode="spline" keyTimes="0;${k(cue)};${k(tb)};${k(end)};1"
            keySplines="${LIN};0.16 1 0.3 1;0.3 0.7 0.4 1;${LIN}"
            values="0,${rise.toFixed(1)}; 0,${rise.toFixed(1)}; 0,-1.5; 0,0; 0,0"/>
          <path d="${g.d}" fill="${t.muted}"/>
        </g>
      </g>`;
  }).join("");
}

function revealFrames(g, start, dur) {
  const n = g.glyphs.length;
  const frames = [[0, 0], [start, 0]];
  for (let i = 0; i <= n; i++) {
    frames.push([start + (dur * i) / n, +(i === n ? g.width : g.glyphs[i].x).toFixed(2)]);
  }
  frames.push([TL, g.width]);
  return frames;
}

function lineClip(ns, id, g, start, dur) {
  const frames = revealFrames(g, start, dur);
  return `<clipPath id="${ns}-${id}">
      <rect x="-1" y="${(-resCap - 3).toFixed(1)}" height="${(resCap * 1.7).toFixed(1)}" width="0">
        <animate attributeName="width" calcMode="discrete" dur="${TL}s" repeatCount="indefinite"
          keyTimes="${frames.map(([s]) => k(s)).join(";")}" values="${frames.map(([, w]) => w).join(";")}"/>
      </rect>
    </clipPath>`;
}

function caret(t, g, start, dur, show0, show1) {
  const frames = revealFrames(g, start, dur).map(([s, w]) => [s, +(w + 2).toFixed(2)]);
  const ay = -CODE_SIZE * 0.5;
  return `<g opacity="0">
        <animate attributeName="opacity" dur="${TL}s" repeatCount="indefinite" calcMode="discrete"
          keyTimes="0;${k(show0)};${k(show1)};1" values="0;1;0;0"/>
        <rect x="0" y="${(ay - CODE_SIZE * 0.55).toFixed(1)}" width="2.4" height="${(CODE_SIZE * 1.2).toFixed(1)}" fill="${t.term.fg}">
          <animate attributeName="x" calcMode="discrete" dur="${TL}s" repeatCount="indefinite"
            keyTimes="${frames.map(([s]) => k(s)).join(";")}" values="${frames.map(([, x]) => x).join(";")}"/>
          <animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;0.49;0.5;0.99;1" dur="1.06s" repeatCount="indefinite"/>
        </rect>
      </g>`;
}

function flash(t, row, at) {
  return `<rect x="${TERM_X + TERM_PAD}" y="${(row - resCap - 2).toFixed(1)}" rx="4"
        width="${TERM_W - TERM_PAD * 2}" height="${(resCap + 8).toFixed(1)}" fill="${t.gold}" opacity="0">
        <animate attributeName="opacity" dur="${TL}s" repeatCount="indefinite"
          keyTimes="0;${k(at)};${k(at + 0.04)};${k(at + 0.24)};1" values="0;0;0.28;0;0"/>
      </rect>`;
}

function chevron(t, row) {
  const y = row - resCap * 0.5;
  return `<path d="M${textX},${(y - 5).toFixed(1)} l6,5 l-6,5" fill="none"
    stroke="${t.term.prompt}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function windowFrame(t) {
  const c = t.term;
  const barBottom = termTop + BAR_H;
  const dots = DOTS.map((col, i) =>
    `<circle cx="${TERM_X + 18 + i * 20}" cy="${termTop + BAR_H / 2}" r="6" fill="${col}"/>`).join("");
  const title = type.title;
  const titleX = (TERM_X + TERM_W / 2 - title.width / 2).toFixed(1);
  const titleY = (termTop + BAR_H / 2 + title.capHeight / 2).toFixed(1);
  return `
    <rect x="${TERM_X}" y="${termTop}" width="${TERM_W}" height="${TERM_H}" rx="${RADIUS}"
      fill="${c.bg}" stroke="${c.border}" stroke-width="1"/>
    <path d="M${TERM_X},${barBottom} v-${BAR_H - RADIUS} a${RADIUS},${RADIUS} 0 0 1 ${RADIUS},-${RADIUS}
      h${TERM_W - 2 * RADIUS} a${RADIUS},${RADIUS} 0 0 1 ${RADIUS},${RADIUS} v${BAR_H - RADIUS} z" fill="${c.bar}"/>
    <line x1="${TERM_X}" y1="${barBottom}" x2="${TERM_X + TERM_W}" y2="${barBottom}" stroke="${c.border}" stroke-width="1"/>
    ${dots}
    <g transform="translate(${titleX} ${titleY})"><path d="${title.d}" fill="${c.title}"/></g>`;
}

function promptRow(t, ns, { id, g, row, at, start, dur, show0, show1 }) {
  return `${flash(t, row, at)}
    ${chevron(t, row)}
    <g transform="translate(${cmdX} ${row})">
      <g clip-path="url(#${ns}-${id})"><path d="${g.d}" fill="${t.term.fg}"/></g>
      ${caret(t, g, start, dur, show0, show1)}
    </g>`;
}

function resolveLine(t, ns) {
  const g = type.resolvename;
  const run = type.running, done = type.resolved;
  const doneX = 18;
  const runOut = `<g transform="translate(${textX} ${row1})" opacity="0">
        <animate attributeName="opacity" dur="${TL}s" repeatCount="indefinite"
          keyTimes="0;${k(RES_INVOKE)};${k(RES_INVOKE + 0.01)};${k(CLIMAX - 0.01)};${k(CLIMAX)};1" values="0;0;1;1;0;0"/>
        <path d="${run.d}" fill="${t.term.mut}"/>
      </g>`;
  const doneOut = `<g transform="translate(${textX} ${row1})" opacity="0">
        <animate attributeName="opacity" dur="${TL}s" repeatCount="indefinite"
          keyTimes="0;${k(CLIMAX)};${k(CLIMAX + 0.01)};1" values="0;0;1;1"/>
        <path d="M0,${(-resCap * 0.32).toFixed(1)} l4,4 l7,-9" fill="none"
          stroke="${t.term.prompt}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <g transform="translate(${doneX} 0)"><path d="${done.d}" fill="${t.term.mut}"/></g>
      </g>`;
  return `
    ${promptRow(t, ns, { id: "resolve", g, row: row0, at: RES_INVOKE,
      start: RES_TYPE_START, dur: RES_TYPE_DUR, show0: 0, show1: CLIMAX })}
    ${runOut}
    ${doneOut}`;
}

function invokeLine(t, ns) {
  const g = type.invoke;
  const invokedAt = +(CLIMAX + TYPE_DUR).toFixed(2);
  const out = `<g transform="translate(${textX} ${row3})" opacity="0">
        <animate attributeName="opacity" dur="${TL}s" repeatCount="indefinite"
          keyTimes="0;${k(RESULT_IN)};${k(RESULT_IN + 0.3)};1" values="0;0;1;1"/>
        <animateTransform attributeName="transform" type="translate" dur="${TL}s" repeatCount="indefinite"
          calcMode="spline" keyTimes="0;${k(RESULT_IN)};${k(RESULT_IN + 0.35)};1" keySplines="${LIN};${EASE};${LIN}"
          values="${textX},${(row3 + 7).toFixed(1)}; ${textX},${(row3 + 7).toFixed(1)}; ${textX},${row3}; ${textX},${row3}"/>
        <path d="${type.kc.d}" fill="${t.gold}"/>
      </g>`;
  return `
    ${promptRow(t, ns, { id: "invoke", g, row: row2, at: invokedAt,
      start: CLIMAX, dur: TYPE_DUR, show0: CLIMAX, show1: TL })}
    ${out}`;
}

function build(theme) {
  const t = { ...PALETTE[theme], term: TERM[theme] };
  const ns = `f${theme}`;

  return doc(W, H, `
  <defs>
    ${lineClip(ns, "resolve", type.resolvename, RES_TYPE_START, RES_TYPE_DUR)}
    ${lineClip(ns, "invoke", type.invoke, CLIMAX, TYPE_DUR)}
    <filter id="${ns}-bloom" x="-80%" y="-60%" width="260%" height="220%">
      <feGaussianBlur stdDeviation="${BLOOM_BLUR}"/>
    </filter>
    ${ambDefs(ns)}
  </defs>
  <rect width="${W}" height="${H}" fill="${t.bg}"/>
  ${ambientField(t, ns)}

  <g transform="translate(${PAD} ${nameTopY.toFixed(1)})" opacity="${GHOST_OP}">
    <animate attributeName="opacity" dur="${TL}s" repeatCount="indefinite"
      keyTimes="0;${k(SORT_FIRE)};${k(SORT_FIRE + BRIGHTEN)};${k(END)};${k(END + RELEASE_DIM)};1"
      values="${GHOST_OP};${GHOST_OP};1;1;${GHOST_OP};${GHOST_OP}"/>
    ${letters(t, ns)}
  </g>

  <g opacity="1">
    <animate attributeName="opacity" dur="${TL}s" repeatCount="indefinite"
      keyTimes="0;${k(STORY_IN)};${k(END)};${k(END + STORY_OUT)};1" values="0;1;1;0;0"/>

    <g transform="translate(${PAD} ${greetBaseline.toFixed(1)})">
      <g>
        <animateTransform attributeName="transform" type="translate" dur="${GREET_BREATH_DUR}s"
          begin="-2.1s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1"
          keySplines="${CHURN};${CHURN}" values="0,0; 0,${GREET_BREATH}; 0,0"/>
        ${hey(t)}
        ${ripple(t)}
      </g>
    </g>

    ${windowFrame(t)}
    ${resolveLine(t, ns)}
    ${invokeLine(t, ns)}
  </g>`, "Kevin-Christian Joseph Giraldo-Barbosa, goes by KC");
}

mkdirSync(IMG, { recursive: true });
mkdirSync(PREVIEW, { recursive: true });

const built = THEMES.map((theme) => {
  const svg = build(theme);
  writeFileSync(join(IMG, `f-split-code-${theme}.svg`), svg);
  return { theme, bytes: Buffer.byteLength(svg) };
});

writeFileSync(join(PREVIEW, "split-code-preview.html"), `<!doctype html>
<meta charset="utf-8">
<title>Banner</title>
<style>
  body { margin:0; padding:40px 32px 80px; background:#100F0D; color:#F2F1EC;
         font:15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  h1 { font-size:20px; margin:0 0 4px; }
  .sub { color:#8E8D86; margin:0 0 30px; max-width:78ch; }
  .frame { border:1px solid #34332E; line-height:0; margin-bottom:16px; }
  .frame svg { display:block; width:100%; height:auto; }
  .frame.light { background:#F7F7F4; } .frame.dark { background:#100F0D; }
</style>
<h1>Banner</h1>
<p class="sub">A pool of letters jumbles across the whole canvas, passing behind the terminal. The name letters start in that pool, at the same weight and size as the rest. resolveName() types and is invoked, and the name is pulled out one letter at a time into the centre. console.log(getPreferredName()) prints KC, and the K then the C light gold with a bloom. The landed name never sits still: each line floats on its own slow path and every letter bobs inside it. Then the name lets go, letter by letter, and drifts back into the pool it came from, so the last frame of the loop is the first. Reload to replay.</p>
${THEMES.map((th) => `<div class="frame ${th}">${build(th)}</div>`).join("\n")}
`);

console.log(`layout H=${H}  climax=${CLIMAX.toFixed(2)}  result=${RESULT_IN}  loop=${TL}`);
console.log(built.map((b) => `f-split-code-${b.theme}  ${(b.bytes / 1024).toFixed(1)} KB`).join("\n"));
