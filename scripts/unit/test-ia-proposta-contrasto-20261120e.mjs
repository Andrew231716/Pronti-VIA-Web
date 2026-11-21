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

const magic = readFileSync("magic-extras.js", "utf8");
const css = readFileSync("travel-diary.css", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const account = readFileSync("account.js", "utf8");

ok(
  "chat import lead forces dark ink",
  /pv-chat-import :is\(\.pv-lead/.test(magic) &&
    /color:#12343c !important/.test(magic)
);

ok(
  "dark theme diary override for chat import",
  /html\[data-pv-theme="dark"\] #pv-magic-root \.pv-chat-import/.test(css) &&
    /#pv-magic-root \.pv-chat-import :is\(/.test(css) &&
    /\.pv-lead,/.test(css)
);

ok(
  "stamps 20261120e",
  /magic-extras-20261120l\.js/.test(index) &&
    /20261120l-layout/.test(sw) &&
    /const SHELL_VER = "20261120l"/.test(account) &&
    existsSync("assets/magic-extras-20261120l.js") &&
    /dataset\.pvReady = "20261120l"/.test(magic)
);

if (process.exitCode) process.exit(process.exitCode);
console.log("all ok");
