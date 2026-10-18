import { mkdir, readFile, copyFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateRecords } from "./core.js";

const root = new URL("./", import.meta.url);
const output = new URL("dist/", root);
const data = await readFile(new URL("../../data/liner-codes/_combined.json", root), "utf8");
validateRecords(JSON.parse(data));
await mkdir(new URL("data/", output), { recursive: true });
for (const file of ["index.html", "reviewer.html", "reviewer.js", "workflow.js", "links.js", "styles.css", "app.js", "core.js", "countries.js", "smdg-logo.png"]) {
  await copyFile(new URL(file, root), new URL(file, output));
}
await writeFile(new URL("data/_combined.json", output), data);
console.log(`Built preview-only form: ${fileURLToPath(output)}`);
