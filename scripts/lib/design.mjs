import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const IMG = join(ROOT, "img");
export const PREVIEW = join(ROOT, "mvp");
const PY = join(ROOT, ".venv/bin/python");
const T2P = join(ROOT, "scripts/text2path.py");

export const PALETTE = {
  light: {
    bg: "#F7F7F4",
    panel: "#ECEBE5",
    ink: "#1A1A17",
    muted: "#6E6D67",
    gold: "#D4A02B",
    bronze: "#8A897F",
    ghost: "#D6D5CE",
    photoA: "#CFCEC8",
    photoB: "#9B9A92",
  },
  dark: {
    bg: "#100F0D",
    panel: "#1C1B18",
    ink: "#F2F1EC",
    muted: "#8E8D86",
    gold: "#EFBC55",
    bronze: "#77766E",
    ghost: "#34332E",
    photoA: "#4A493F",
    photoB: "#2A2924",
  },
};

export const THEMES = ["light", "dark"];

export const DESIGN_W = 900;
export const OUT_W = 1200;
const SCALE = OUT_W / DESIGN_W;

export const FACE = {
  display: { file: "fonts/BricolageGrotesque.ttf", axes: { opsz: 96, wght: 800, wdth: 100 } },
  displayLight: { file: "fonts/BricolageGrotesque.ttf", axes: { opsz: 96, wght: 500, wdth: 100 } },
  mono: { file: "fonts/SpaceMono-Regular.ttf", axes: {} },
};

export const NAME_LINES = ["KEVIN-CHRISTIAN", "JOSEPH", "GIRALDO-BARBOSA"];
export const KC_CLUSTERS = [0, 6];

const MEASURE = 100;

export function shape(spec) {
  if (!spec.length) return {};
  return JSON.parse(
    execFileSync(PY, [T2P, "build", "/dev/stdin"], {
      input: JSON.stringify(spec),
      maxBuffer: 1 << 28,
    })
  );
}

export function justifyBlocks(blocks) {
  const measureSpec = blocks.flatMap((b) =>
    b.lines.map((text, i) => ({
      id: `${b.key}-${i}`, text, size: MEASURE,
      font: (b.face ?? FACE.display).file, axes: (b.face ?? FACE.display).axes,
    }))
  );
  const measured = shape(measureSpec);

  const finalSpec = [];
  const meta = {};
  for (const b of blocks) {
    const face = b.face ?? FACE.display;
    const base = MEASURE * (b.width / measured[`${b.key}-0`].width);
    const offsets = [];

    b.lines.forEach((text, i) => {
      const align = b.align?.[i] ?? "justify";
      const natural = measured[`${b.key}-${i}`].width * (base / MEASURE);
      const gaps = measured[`${b.key}-${i}`].glyphs.length - 1;
      const justified = align === "justify" && gaps > 0;

      offsets.push(
        justified || align === "left" ? 0
          : align === "center" ? (b.width - natural) / 2
          : b.width - natural
      );
      finalSpec.push({
        id: `${b.key}-${i}`, text, size: base, font: face.file, axes: face.axes,
        tracking: justified ? (b.width - natural) / gaps : 0,
      });
    });

    meta[b.key] = {
      base,
      cap: measured[`${b.key}-0`].capHeight * (base / MEASURE),
      width: b.width,
      offsets,
    };
  }

  return { paths: shape(finalSpec), meta };
}

export function nameBlock(paths, meta, key, t, { lines = NAME_LINES, tint = true, leading = 1.3 } = {}) {
  const { cap, offsets } = meta[key];
  const step = cap * leading;
  const out = [];

  lines.forEach((_, i) => {
    const g = paths[`${key}-${i}`];
    const hi = i === 0 && tint ? new Set(KC_CLUSTERS) : new Set();
    const base = g.glyphs.filter((gl) => !hi.has(gl.cluster)).map((gl) => gl.d).join(" ");
    const lit = g.glyphs.filter((gl) => hi.has(gl.cluster)).map((gl) => gl.d).join(" ");

    out.push(`<g transform="translate(${offsets[i]} ${cap + i * step})">`);
    out.push(`  <path d="${base}" fill="${t.ink}"/>`);
    if (lit) out.push(`  <path d="${lit}" fill="${t.gold}"/>`);
    out.push(`</g>`);
  });

  return { svg: out.join("\n    "), height: cap + step * (lines.length - 1), cap, step };
}

export function loadPhotos() {
  const file = join(ROOT, "build/photos.json");
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
}

export function photoImage(uri, { x, y, w, h }) {
  return `<image href="${uri}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>`;
}

export function photoDefs(ns, t, { a = t.photoA, b = t.photoB } = {}) {
  return `<linearGradient id="${ns}-pg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${a}"/>
      <stop offset="1" stop-color="${b}"/>
    </linearGradient>
    <filter id="${ns}-grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.02 0.05" numOctaves="5" seed="7" stitchTiles="stitch" result="n"/>
      <feColorMatrix in="n" type="saturate" values="0"/>
    </filter>`;
}

export function photo(ns, w, h) {
  return `<rect width="${w}" height="${h}" fill="url(#${ns}-pg)"/>
      <rect width="${w}" height="${h}" filter="url(#${ns}-grain)" opacity="0.5" style="mix-blend-mode:overlay"/>`;
}

export function doc(w, h, body, label = "Kevin-Christian Joseph Giraldo-Barbosa") {
  const vh = Math.round(h);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${vh}" width="${Math.round(w * SCALE)}" height="${Math.round(vh * SCALE)}" role="img" aria-label="${label}">
${body}
</svg>`;
}
