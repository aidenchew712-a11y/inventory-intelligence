import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

// Local node_modules can hide missing assets in a serverless deployment bundle.
const tracePath = path.resolve(".next/server/app/api/reports/route.js.nft.json");
const trace = JSON.parse(readFileSync(tracePath, "utf8"));
const tracedFiles = new Set(trace.files.map((file) => path.resolve(path.dirname(tracePath), file)));
const requirePdf = createRequire(path.resolve("node_modules/pdfkit/js/pdfkit.node.mjs"));
for (const font of ["Helvetica", "HelveticaBold"]) {
  const requiredAsset = requirePdf.resolve("#standard-fonts/" + font);
  assert(tracedFiles.has(requiredAsset), "Report deployment is missing " + path.basename(requiredAsset));
}
assert([...tracedFiles].some((file) => /standard-fonts[\\/]chunks[\\/].*\.cjs$/.test(file)), "Report deployment is missing CommonJS font glyph data.");
console.log("PDF font assets are included in the report deployment trace.");
