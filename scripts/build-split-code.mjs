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
const GHOST_FADE_IN = 0.6;

const HEY_START = O + 0.3, HEY_DUR = 0.6, HEY_ARC = 0.4;
const IS_START = O + 1.5, IS_STAGGER = 0.1, IS_TRAVEL = 0.4;

const CHURN_START = O;
const JITTER = 1.5, SPREAD = 1.0;
const GHOST_OP = 0.20;

const SN_TYPE_START = O + 3.0;
const SN_INVOKE = O + 4.0;
const SN_TYPE_DUR = +(SN_INVOKE - SN_TYPE_START).toFixed(2);
const SORT_GAP = 1.0;
const SORT_FIRE = +(SN_INVOKE + SORT_GAP).toFixed(2);
const BRIGHTEN = 1.4;
const SORT_TRAVEL = 1.5, SORT_STAGGER = 0.125;

const TYPE_DUR = 1.95;
const RESULT_GAP = 1.25;
const HOLD = 5.0, RESET = 1.0;

const T = 15.6;
let TL = T;

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
  code("sortname", "sortName()"),
  code("invoke", "console.log(getPreferredName())"),
  code("kc", "KC"),
  code("running", "running..."),
  code("sorted", "sorted"),
  code("title", "kc@readme", 11),
]);

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
    dx: (r() - 0.5) * 2 * 165 * SPREAD * JITTER,
    dy: (r() - 0.5) * 2 * 120 * SPREAD * JITTER,
    rot: +((r() - 0.5) * 2 * 24 * JITTER).toFixed(1),
  }));
}
const STATES = [field(20260728), field(8613), field(41099)];
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
const H = Math.round(TERM_BOTTOM + 20);

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

function letters(t) {
  return GLYPHS.map((g, n) => {
    const settle = SORT_FIRE + n * SORT_STAGGER;
    const land = settle + SORT_TRAVEL;
    const mid = CHURN_START + (settle - CHURN_START) * 0.5;
    const isKC = g.line === 0 && KC_CLUSTERS.includes(g.cluster);

    const S0 = fence(g, STATES[0][n]);
    const S1 = fence(g, STATES[1][n]);
    const S2 = fence(g, STATES[2][n]);
    const cx = (g.x + g.advance / 2).toFixed(1);
    const cy = (-cap / 2).toFixed(1);

    const times = [0, CHURN_START, mid, settle, land, TL];
    const keyTimes = times.map(k).join(";");
    const splines = [LIN, CHURN, CHURN, EASE, LIN].join(";");
    const tv = [S0, S0, S1, S2, { dx: 0, dy: 0 }, { dx: 0, dy: 0 }];
    const rv = [S0, S0, S1, S2, { rot: 0 }, { rot: 0 }];

    const fillFrames = isKC
      ? [[0, t.ghost], [settle, t.ghost], [land, t.ink], [RESULT_IN, t.ink], [RESULT_IN + 0.2, t.gold], [TL, t.gold]]
      : [[0, t.ghost], [settle, t.ghost], [land, t.ink], [TL, t.ink]];

    return `
      <g transform="translate(${offsets[g.line]} ${(cap + g.line * step).toFixed(1)})">
        <g>
          <path d="${g.d}" fill="${t.ghost}">
            <animate attributeName="fill" dur="${TL}s" repeatCount="indefinite"
              keyTimes="${fillFrames.map(([s]) => k(s)).join(";")}"
              values="${fillFrames.map(([, c]) => c).join(";")}"/>
          </path>
          <animateTransform attributeName="transform" type="translate" dur="${TL}s"
            repeatCount="indefinite" calcMode="spline" keyTimes="${keyTimes}"
            keySplines="${splines}" values="${tv.map((v) => `${v.dx},${v.dy}`).join(";")}"/>
          <animateTransform attributeName="transform" type="rotate" additive="sum" dur="${TL}s"
            repeatCount="indefinite" calcMode="spline" keyTimes="${keyTimes}"
            keySplines="${splines}" values="${rv.map((v) => `${v.rot} ${cx} ${cy}`).join(";")}"/>
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

function sortLine(t, ns) {
  const g = type.sortname;
  const run = type.running, done = type.sorted;
  const checkX = 0, sortedX = 18;
  const runOut = `<g transform="translate(${textX} ${row1})" opacity="0">
        <animate attributeName="opacity" dur="${TL}s" repeatCount="indefinite"
          keyTimes="0;${k(SN_INVOKE)};${k(SN_INVOKE + 0.01)};${k(CLIMAX - 0.01)};${k(CLIMAX)};1" values="0;0;1;1;0;0"/>
        <path d="${run.d}" fill="${t.term.mut}"/>
      </g>`;
  const doneOut = `<g transform="translate(${textX} ${row1})" opacity="0">
        <animate attributeName="opacity" dur="${TL}s" repeatCount="indefinite"
          keyTimes="0;${k(CLIMAX)};${k(CLIMAX + 0.01)};1" values="0;0;1;1"/>
        <path d="M${checkX},${(-resCap * 0.32).toFixed(1)} l4,4 l7,-9" fill="none"
          stroke="${t.term.prompt}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <g transform="translate(${sortedX} 0)"><path d="${done.d}" fill="${t.term.mut}"/></g>
      </g>`;
  return `
    ${flash(t, row0, SN_INVOKE)}
    ${chevron(t, row0)}
    <g transform="translate(${cmdX} ${row0})">
      <g clip-path="url(#${ns}-sort)"><path d="${g.d}" fill="${t.term.fg}"/></g>
      ${caret(t, g, SN_TYPE_START, SN_TYPE_DUR, 0, CLIMAX)}
    </g>
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
    ${flash(t, row2, invokedAt)}
    ${chevron(t, row2)}
    <g transform="translate(${cmdX} ${row2})">
      <g clip-path="url(#${ns}-invoke)"><path d="${g.d}" fill="${t.term.fg}"/></g>
      ${caret(t, g, CLIMAX, TYPE_DUR, CLIMAX, TL)}
    </g>
    ${out}`;
}

function build(theme) {
  const t = { ...PALETTE[theme], term: TERM[theme] };
  const ns = `f${theme}`;

  return doc(W, H, `
  <defs>
    ${lineClip(ns, "sort", type.sortname, SN_TYPE_START, SN_TYPE_DUR)}
    ${lineClip(ns, "invoke", type.invoke, CLIMAX, TYPE_DUR)}
  </defs>
  <rect width="${W}" height="${H}" fill="${t.bg}"/>

  <g opacity="1">
    <animate attributeName="opacity" dur="${TL}s" repeatCount="indefinite"
      keyTimes="0;${k(END)};1" values="1;1;0"/>

    <g transform="translate(${PAD} ${greetBaseline.toFixed(1)})">
      ${hey(t)}
      ${ripple(t)}
    </g>

    <g transform="translate(${PAD} ${nameTopY.toFixed(1)})" opacity="0">
      <animate attributeName="opacity" dur="${TL}s" repeatCount="indefinite"
        keyTimes="0;${k(O)};${k(O + GHOST_FADE_IN)};${k(SORT_FIRE)};${k(SORT_FIRE + BRIGHTEN)};1"
        values="0;0;${GHOST_OP};${GHOST_OP};1;1"/>
      ${letters(t)}
    </g>

    ${windowFrame(t)}
    ${sortLine(t, ns)}
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
<p class="sub">Blank beat, then the scrambled name fades in and jitters while a macOS terminal waits with a blinking cursor. "Hey," falls in and "my name is" ripples; sortName() types and is invoked, the letters brighten and sort, and the terminal echoes running... then sorted; then console.log(getPreferredName()) prints KC as the K and C take the gold. Reload to replay.</p>
${THEMES.map((th) => `<div class="frame ${th}">${build(th)}</div>`).join("\n")}
`);

console.log(`layout H=${H}  climax=${CLIMAX.toFixed(2)}  result=${RESULT_IN}  loop=${TL}`);
console.log(built.map((b) => `f-split-code-${b.theme}  ${(b.bytes / 1024).toFixed(1)} KB`).join("\n"));
