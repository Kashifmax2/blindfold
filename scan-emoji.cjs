const fs = require("fs");
const path = require("path");
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2190}-\u{21FF}\u{2300}-\u{23FF}]/u;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk("src");
let total = 0;
for (const f of files) {
  const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);
  lines.forEach((l, i) => {
    if (EMOJI.test(l)) {
      total++;
      const chars = [...l].filter((c) => EMOJI.test(c)).join("");
      console.log(`${f.replace(/\\/g, "/")}:${i + 1} [${chars}] ${l.trim().slice(0, 120)}`);
    }
  });
}
console.log("TOTAL:", total);
