// Reads public GitHub contribution totals (the numbers on the profile's contribution graph)
// and writes them to data/contributions.json for the chart on the page.
// Runs daily from .github/workflows/update-contributions.yml. Node 18+, no dependencies.
import { writeFileSync, mkdirSync } from "node:fs";

const USER = "abozaralizadeh";
const FIRST_YEAR = 2020;
const now = new Date();

async function total(query = "") {
  const url = `https://github.com/users/${USER}/contributions${query}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (contributions chart)" } });
    if (res.ok) {
      const html = await res.text();
      const m = html.match(/id="js-contribution-activity-description"[^>]*>\s*([\d,]+)\s*contributions?/);
      if (m) return Number(m[1].replace(/,/g, ""));
    }
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  throw new Error(`no contribution total found at ${url}`);
}

const years = [];
for (let y = FIRST_YEAR; y <= now.getUTCFullYear(); y++) {
  years.push({ year: y, count: await total(`?from=${y}-01-01&to=${y}-12-31`) });
}
const lastYear = await total();

mkdirSync("data", { recursive: true });
const out = { user: USER, updated: now.toISOString().slice(0, 10), years, lastYear };
writeFileSync("data/contributions.json", JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out));
