#!/usr/bin/env node
/**
 * Scaffold a new destination theme template and run the automatic contrast audit.
 *
 * Usage:
 *   node scripts/add-dest-theme.mjs --id xx --label "Paese" --flag 🏳️ \
 *     --teal '#007d82' --tealDeep '#00656a' --ink '#12343c' --muted '#3f5860' \
 *     --sand '#f3f8f8' --line '#d5e3e6' --accent '#2aa3a8' \
 *     --match 'paese|city'
 *
 * Dry-run (audit only, no write):
 *   node scripts/add-dest-theme.mjs --id xx ... --dry-run
 */
import { readFileSync, writeFileSync } from "node:fs";
import { auditThemeContrast } from "./lib/dest-theme-contrast.mjs";

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  return process.argv[i + 1] || fallback;
}
function has(name) {
  return process.argv.includes(`--${name}`);
}

const id = arg("id").toLowerCase().replace(/[^a-z0-9]/g, "");
const label = arg("label");
const flag = arg("flag", "🌍");
const motif = arg("motif", "globe");
const teal = arg("teal", "#007d82");
const tealDeep = arg("tealDeep", "#00656a");
const ink = arg("ink", "#12343c");
const muted = arg("muted", "#3f5860");
const sand = arg("sand", "#f3f8f8");
const line = arg("line", "#d5e3e6");
const accent = arg("accent", "#2aa3a8");
const wash = arg("wash", "rgba(0,125,130,.1)");
const match = arg("match", id);
const dry = has("dry-run");

if (!id || !label) {
  console.error("Required: --id and --label");
  process.exit(2);
}

const theme = { id, label, teal, tealDeep, ink, muted, sand, line, accent, wash };
const audit = auditThemeContrast(theme);
console.log(audit.ok ? `PASS  contrasto ${id}` : `FAIL  contrasto ${id}`);
for (const issue of audit.issues) console.log(`  - ${issue}`);
if (!audit.ok) {
  console.error("\nCorreggi i colori (ink/muted più scuri o sand più chiaro) e riprova.");
  process.exit(1);
}

if (dry) {
  console.log("Dry-run: nessun file modificato.");
  process.exit(0);
}

const path = "destination-theme.js";
let src = readFileSync(path, "utf8");
if (new RegExp(`\\b${id}\\s*:\\s*\\{`).test(src) || new RegExp(`id:\\s*"${id}"`).test(src)) {
  console.error(`Template "${id}" già presente in THEMES.`);
  process.exit(1);
}

const block = `    ${id}: {
      id: "${id}",
      label: ${JSON.stringify(label)},
      motif: ${JSON.stringify(motif)},
      flag: ${JSON.stringify(flag)},
      stickers: ["✈️", "🧳", "🗺️", "📸", "🧭", "🌴"],
      teal: "${teal}",
      tealDeep: "${tealDeep}",
      ink: "${ink}",
      muted: "${muted}",
      sand: "${sand}",
      line: "${line}",
      accent: "${accent}",
      wash: "${wash}",
      icons: ICO,
    },
`;

const insertAt = src.lastIndexOf("  };\n\n  const RULES = [");
if (insertAt < 0) {
  console.error("Impossibile trovare la chiusura di THEMES.");
  process.exit(1);
}
src = src.slice(0, insertAt) + block + src.slice(insertAt);

const rule = `    { id: "${id}", re: /${match}/ },\n`;
const rulesAt = src.indexOf("  const RULES = [\n");
if (rulesAt < 0) {
  console.error("Impossibile trovare RULES.");
  process.exit(1);
}
const afterRules = rulesAt + "  const RULES = [\n".length;
src = src.slice(0, afterRules) + rule + src.slice(afterRules);

writeFileSync(path, src);
console.log(`OK  aggiunto template "${id}" in ${path}`);
console.log("Ricorda: copia in assets/, bump stamp, e aggiorna RULES/regex se serve.");
