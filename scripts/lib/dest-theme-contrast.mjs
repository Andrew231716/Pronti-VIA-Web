/**
 * Automatic contrast audit for destination theme templates (light + dark).
 * Used by unit tests and by `scripts/add-dest-theme.mjs` when creating a new template.
 */
const AA_NORMAL = 4.5;
const AA_LARGE = 3;
const DARK_CARD = "#203439";
const DARK_INK = "#edf5f5";
const DARK_MUTED = "#d7e6e8";
const WHITE = "#ffffff";

export function parseHex(input) {
  const s = String(input || "").trim();
  const m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function channel(c) {
  const n = c / 255;
  return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la == null || lb == null) return null;
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

function darkenToward(hex, steps = 12) {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  let { r, g, b } = rgb;
  for (let i = 0; i < steps; i++) {
    r = Math.max(0, Math.round(r * 0.86));
    g = Math.max(0, Math.round(g * 0.86));
    b = Math.max(0, Math.round(b * 0.86));
  }
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

export function ensureReadablePair(fg, bg, minRatio = AA_NORMAL) {
  let ink = fg;
  let ratio = contrastRatio(ink, bg);
  if (ratio == null) return { color: fg, ratio: null, fixed: false };
  let fixed = false;
  let guard = 0;
  while (ratio < minRatio && guard < 18) {
    ink = darkenToward(ink, 1);
    ratio = contrastRatio(ink, bg);
    fixed = true;
    guard += 1;
  }
  return { color: ink, ratio, fixed };
}

/**
 * Extract palette entries from destination-theme.js source.
 * Survives SVG noise inside theme blocks by matching color fields only.
 */
export function parseThemesFromSource(src) {
  const start = src.indexOf("const THEMES = {");
  if (start < 0) throw new Error("THEMES block not found");
  const slice = src.slice(start);
  const themes = [];
  const re =
    /(\w+)\s*:\s*\{[\s\S]*?\bid\s*:\s*["']([^"']+)["'][\s\S]*?\bteal\s*:\s*["'](#[0-9a-fA-F]{3,8})["'][\s\S]*?\btealDeep\s*:\s*["'](#[0-9a-fA-F]{3,8})["'][\s\S]*?\bink\s*:\s*["'](#[0-9a-fA-F]{3,8})["'][\s\S]*?\bmuted\s*:\s*["'](#[0-9a-fA-F]{3,8})["'][\s\S]*?\bsand\s*:\s*["'](#[0-9a-fA-F]{3,8})["'][\s\S]*?\bline\s*:\s*["'](#[0-9a-fA-F]{3,8})["'][\s\S]*?\baccent\s*:\s*["'](#[0-9a-fA-F]{3,8})["']/g;
  let m;
  while ((m = re.exec(slice))) {
    themes.push({
      key: m[1],
      id: m[2],
      teal: m[3],
      tealDeep: m[4],
      ink: m[5],
      muted: m[6],
      sand: m[7],
      line: m[8],
      accent: m[9],
    });
    // Stop before RULES / functions after THEMES closes — heuristic: if we passed 80 themes break
    if (themes.length > 80) break;
  }
  // Deduplicate by id (regex can re-hit nested objects rarely)
  const byId = new Map();
  for (const t of themes) {
    if (!byId.has(t.id)) byId.set(t.id, t);
  }
  return [...byId.values()];
}

/**
 * Audit one theme for light (ink on sand/white) and dark (light ink on dark cards).
 */
export function auditThemeContrast(theme, opts = {}) {
  const minNormal = opts.minNormal ?? AA_NORMAL;
  const minLarge = opts.minLarge ?? AA_LARGE;
  const issues = [];
  const checks = [];

  function check(name, fg, bg, min) {
    const ratio = contrastRatio(fg, bg);
    const ok = ratio != null && ratio >= min;
    checks.push({ name, fg, bg, ratio, min, ok });
    if (!ok) {
      issues.push(
        `${theme.id}/${name}: ${fg} on ${bg} = ${ratio == null ? "n/a" : ratio.toFixed(2)} (need ≥ ${min})`
      );
    }
  }

  // Light: body/panel wash uses sand; cards use white
  check("ink-on-sand", theme.ink, theme.sand, minNormal);
  check("muted-on-sand", theme.muted, theme.sand, minLarge);
  check("ink-on-white", theme.ink, WHITE, minNormal);
  check("muted-on-white", theme.muted, WHITE, minLarge);
  check("tealDeep-on-white", theme.tealDeep, WHITE, minNormal);
  check("teal-on-white", theme.teal, WHITE, minLarge);

  // Dark: destination cards use dark surface + forced light ink (engine CSS)
  check("dark-ink-on-card", DARK_INK, DARK_CARD, minNormal);
  check("dark-muted-on-card", DARK_MUTED, DARK_CARD, minLarge);
  check("white-on-teal", WHITE, theme.teal, minLarge);

  return {
    id: theme.id,
    ok: issues.length === 0,
    issues,
    checks,
    dark: { card: DARK_CARD, ink: DARK_INK, muted: DARK_MUTED },
  };
}

export function auditAllThemes(themes, opts) {
  const results = themes.map((t) => auditThemeContrast(t, opts));
  return {
    ok: results.every((r) => r.ok),
    results,
    failed: results.filter((r) => !r.ok),
  };
}

/** Runtime helper: bump ink/muted until sand contrast passes. */
export function fixThemeInkForSand(theme) {
  const inkFix = ensureReadablePair(theme.ink, theme.sand, AA_NORMAL);
  const mutedFix = ensureReadablePair(theme.muted, theme.sand, AA_LARGE);
  return {
    ...theme,
    ink: inkFix.color,
    muted: mutedFix.color,
    _contrast: {
      inkRatio: inkFix.ratio,
      mutedRatio: mutedFix.ratio,
      fixed: inkFix.fixed || mutedFix.fixed,
    },
  };
}

export const CONTRAST_SURFACES = {
  AA_NORMAL,
  AA_LARGE,
  DARK_CARD,
  DARK_INK,
  DARK_MUTED,
  WHITE,
};
