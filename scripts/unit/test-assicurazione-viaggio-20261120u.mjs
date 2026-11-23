#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

function ok(label, cond) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok - ${label}`);
}

const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const account = readFileSync("account.js", "utf8");
const ux = readFileSync("ux-suite.js", "utf8");
const access = readFileSync("netlify/functions/_trip-access.mjs", "utf8");
const src = readFileSync("assicurazione.js", "utf8");

ok(
  "stamps 20261120w",
  /ux-suite-20261120w\.js/.test(index) &&
    /assicurazione-20261120w\.js/.test(index) &&
    /assicurazione-20261120w\.js/.test(sw) &&
    /20261120w-postassicura/.test(sw) &&
    /const SHELL_VER = "20261120w"/.test(account) &&
    existsSync("assets/assicurazione-20261120w.js") &&
    existsSync("assets/ux-suite-20261120w.js") &&
    readFileSync("assets/assicurazione-20261120w.js", "utf8") === src
);

ok(
  "layout semplificato",
  /pv-ins-sos/.test(src) &&
    /pv-ins-details/.test(src) &&
    /pv-ins-toolbar/.test(src) &&
    !/pv-ins-chip/.test(src) &&
    !/pv-ins-card/.test(src)
);

ok(
  "tabSectionKey reads data-pv-tab",
  /function tabSectionKey\(tab\)[\s\S]*?fromData = tab\?\.dataset\?\.pvTab/.test(ux)
);

ok(
  "ux tab meta phase both",
  /insurance:\s*\{\s*phase:\s*"both"/.test(ux) &&
    /SECTION_GUIDE[\s\S]*insurance:/.test(ux) &&
    /ICON_SVG[\s\S]*insurance:/.test(ux) &&
    /\["itinerary".*"insurance"/.test(ux)
);

ok(
  "allowedMeta includes insurance",
  /"insurance"/.test(access)
);

ok(
  "module injects tab + panel for both phases",
  /dataset\.pvPhase = "both"/.test(src) &&
    /PANEL_ID = "pv-insurance-panel"/.test(src) &&
    /parseInsuranceCertificate/.test(src) &&
    /trip\.meta = \{[\s\S]*insurance/.test(src)
);

ok(
  "panel hide does not leave permanent display:none",
  /hiddenByInsurance/.test(src) &&
    /restoreHiddenSpaPanels/.test(src) &&
    !/other\.style\.display = "none"/.test(src)
);

// Parser smoke with Heymondo sample PDF (if present) or fixture text
const samplePdf =
  "/home/ubuntu/.cursor/projects/agent-repos-Pronti-VIA-Web/uploads/Certificato_assicurativo_b0f8.pdf";
const fixture = `
Certificato di assicurazione Numero di polizza: HEY2648617
Viaggio Premium
Simone 01/08/2027 Cecire 13/08/2027
Codice fiscale: CCRSMN06L22F205B
Telefono: +393240424816 Destinazione: Ghana
E-mail: simon22ce@gmail.com
Compagnia assicuratrice: IMA Italia Assistance S.p.A.
ASSISTENZA 101.85 € 10.22 € 112.07 €
SPESE MEDICHE IN VIAGGIO 76.37 € 1.89 € 78.26 €
BAGAGLIO 42.42 € 5.32 € 47.74 €
PERDITE PECUNIARIE 190.96 € 40.6 € 231.56 €
INFORTUNI 12.74 € 0.35 € 13.09 €
Premio finale: 410,18 € Totale: 422,08 €
Viaggiatori Assicurati
NOME COGNOME CODICE FISCALE
SIMONE CECIRE CCRSMN06L22F205B
RUBEN GIOVANNI LORUSSO LRSRNG99E09F205D
BEATRICE REBECCA MURA MRUBRC03E55F205M
JOANNA SHARON CALING CLNJNS05A66F205E
ANDREA POZZI PZZNDR00H24E986J
PATRIZIA PANETTA PNTPRZ05T49L781D
REBECCA DE FILIPPO DFLRCC04A42F205A
Certificato di assicurazione
telefonando al numero +39 02 2412 8782
https://www.heymondo.it
https://app.airhelp.com/partners/heymondo_italy?lang=it
Spese mediche (fino a 74 anni) Illimitato
`;

const start = src.indexOf("function cleanDup");
const end = src.indexOf("window.__pvParseInsuranceCertificate");
const fnSrc = src.slice(start, end);
const sandbox = { console, Intl, Number, String, Array, Object, Date, RegExp, Math };
vm.createContext(sandbox);
vm.runInContext(fnSrc + "; this.__parse = parseInsuranceCertificate;", sandbox);

async function parseSample() {
  let text = fixture;
  if (existsSync(samplePdf)) {
    try {
      const { readFileSync: rfs } = await import("node:fs");
      const mod = await import(pathToFileURL(process.cwd() + "/assets/event-pdf.mjs").href);
      text = await mod.readEventPdf(new Blob([rfs(samplePdf)]));
    } catch (err) {
      console.warn("pdf fallback to fixture", err.message);
    }
  }
  const p = sandbox.__parse(text);
  ok("policy HEY2648617", p?.policyNumber === "HEY2648617");
  ok("product Viaggio Premium", /Viaggio Premium/i.test(p?.product || ""));
  ok("destination Ghana", p?.destination === "Ghana");
  ok("dates", p?.startDate === "01/08/2027" && p?.endDate === "13/08/2027");
  ok("emergency phone", /\+39\s*02\s*2412\s*8782/.test(p?.emergencyPhone || ""));
  ok("email", /simon22ce@gmail\.com/i.test(p?.email || ""));
  ok("seven travelers", (p?.travelers?.length || 0) >= 7);
  ok("coverages", (p?.coverages?.length || 0) >= 5);
  ok("portal + airhelp", /heymondo/i.test(p?.portalUrl || "") && /airhelp/i.test(p?.airhelpUrl || ""));
}

await parseSample();

if (process.exitCode) process.exit(process.exitCode);
console.log("assicurazione-viaggio 20261120w ok");
