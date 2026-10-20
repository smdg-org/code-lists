import { mkdir, readFile, copyFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateRecords } from "./core.js";

const root = new URL("./", import.meta.url);
const output = new URL("dist/", root);
const data = await readFile(new URL("../../data/liner-codes/_combined.json", root), "utf8");
validateRecords(JSON.parse(data));
await mkdir(new URL("data/", output), { recursive: true });
for (const file of ["index.html", "liner-codes.html", "liner-codes.js", "excel-export.js", "liner-codes-template.xlsx", "reviewer.html", "reviewer.js", "workflow.js", "links.js", "styles.css", "app.js", "core.js", "countries.js", "smdg-logo.png"]) {
  await copyFile(new URL(file, root), new URL(file, output));
}
await mkdir(new URL("vendor/", output), { recursive: true });
await copyFile(new URL("node_modules/fflate/esm/browser.js", root), new URL("vendor/fflate.js", output));
await copyFile(new URL("node_modules/fflate/LICENSE", root), new URL("vendor/fflate-LICENSE.txt", output));
await writeFile(new URL("data/_combined.json", output), data);
console.log(`Built liner-code list, form and reviewer demo: ${fileURLToPath(output)}`);
