#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";

const ok = (name, cond) => {
  if (!cond) {
    console.error("FAIL", name);
    process.exitCode = 1;
  } else {
    console.log("ok", name);
  }
};

const ux = readFileSync("ux-suite.js", "utf8");
const css = readFileSync("travel-diary.css", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const account = readFileSync("account.js", "utf8");

ok(
  "import paste/file use dark ink on light paper",
  /\.pv-import-paste\{[^}]*color:#12343c/.test(ux) &&
    /\.pv-import-paste::placeholder\{color:#5b7076/.test(ux) &&
    /\.pv-import-file\{[^}]*color:#12343c/.test(ux) &&
    /input\[type=file\]\{[^}]*color:#12343c/.test(ux)
);

ok(
  "ghost/close buttons keep dark ink",
  /\.pv-ux-ghost\{background:#eef5f5;color:#12343c\}/.test(ux) &&
    /\.pv-ux-close\{[^}]*color:#12343c/.test(ux)
);

ok(
  "dark theme diary overrides for import modal",
  /html\[data-pv-theme="dark"\] #pv-ux-modal \.pv-import-paste/.test(css) &&
    /html\[data-pv-theme="dark"\] #pv-ux-modal :is\(\.pv-ux-ghost, \.pv-ux-close\)/.test(css) &&
    /#pv-ux-modal \.pv-import-paste::placeholder/.test(css)
);

ok(
  "stamps 20261120e",
  /ux-suite-20261120d\.js/.test(index) &&
    /20261120t-assicura/.test(sw) &&
    /const SHELL_VER = "20261120t"/.test(account) &&
    /const STYLE_VER = "20261120d"/.test(ux) &&
    existsSync("assets/ux-suite-20261120d.js")
);

if (process.exitCode) process.exit(process.exitCode);
console.log("all ok");
