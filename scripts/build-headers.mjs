import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FACE, IMG, PALETTE, PREVIEW, THEMES, shape } from "./lib/design.mjs";

const SIZE = 22;
const TRACK = 2.4;
const PAD = 4;
const TRAIL = 2;

const HEAD_AXES = { opsz: 36, wght: 600, wdth: 100 };

const SECTIONS = [
  { slug: "about", label: "ABOUT ME" },
  { slug: "stack", label: "BUILDING WITH" },
  { slug: "pets", label: "CO-MAINTAINERS" },
];

const shaped = shape(SECTIONS.map(({ slug, label }) => ({
  id: slug, text: label, size: SIZE, tracking: TRACK,
  font: FACE.display.file, axes: HEAD_AXES,
})));

function header(slug, label, theme) {
  const t = PALETTE[theme];
  const g = shaped[slug];
  const cap = g.capHeight;

  const H = cap + PAD * 2;
  const baseline = cap + PAD;
  const W = g.width + TRAIL;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" width="${Math.round(W)}" height="${Math.round(H)}" role="img" aria-label="${label}">
  <g transform="translate(0 ${baseline.toFixed(1)})"><path d="${g.d}" fill="${t.muted}"/></g>
</svg>`;
}

mkdirSync(IMG, { recursive: true });
mkdirSync(PREVIEW, { recursive: true });

for (const { slug, label } of SECTIONS) {
  for (const theme of THEMES) {
    writeFileSync(join(IMG, `head-${slug}-${theme}.svg`), header(slug, label, theme));
  }
}

writeFileSync(join(PREVIEW, "headers.html"), `<!doctype html>
<meta charset="utf-8">
<title>Section headers</title>
<style>
  body { margin:0; padding:40px 32px 80px;
         font:15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  h1 { font-size:20px; margin:0 0 4px; }
  .sub { margin:0 0 32px; max-width:76ch; }
  .pane { padding:26px 22px; margin-bottom:14px; border:1px solid #8884; }
  .pane svg { display:block; height:auto; margin:22px 0; }
  .pane p { max-width:60ch; }
  .light { background:#F7F7F4; color:#1A1A17; }
  .dark  { background:#100F0D; color:#F2F1EC; }
</style>
<h1>Section headers</h1>
<p class="sub">Sized to the word and rendered 1:1 so each reads as a heading, not
a full-bleed banner. Static by design: motion belongs to the banner. Each is an
image, so it carries no anchor link and no selectable text, which is why these
are used for section labels only and never for body copy. Body text below each
header is real page text at 15px, to check the heading sits at the right scale
next to it.</p>
${THEMES.map((th) => `<div class="pane ${th}">
${SECTIONS.map(({ slug, label }) => `${header(slug, label, th)}
<p>Real body copy sits here so the header can be judged against the text it
introduces, the way it will read in the README.</p>`).join("\n")}
</div>`).join("\n")}
`);

console.log(`${SECTIONS.length * THEMES.length} headers -> img/`);
