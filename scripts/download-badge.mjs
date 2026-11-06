// Writes the README's downloads badge: node scripts/download-badge.mjs <total> <out.svg>
// Run by .github/workflows/download-badge.yml; the drawing is in downloadBadgeLib.mjs.
import { writeFileSync } from "node:fs";
import { downloadsSvg } from "./downloadBadgeLib.mjs";

const [total, out] = process.argv.slice(2);
if (!out) {
  console.error("Usage: node scripts/download-badge.mjs <total> <out.svg>");
  process.exit(2);
}
writeFileSync(out, downloadsSvg(total));
