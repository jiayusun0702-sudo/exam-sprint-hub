// Writes the demo course site to out/demo.html (used by the browser check).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { renderSite } from "../lib/site";
import { demoInput } from "../tests/fixtures/demo";

const template = readFileSync("public/site-template.html", "utf8");
mkdirSync("out", { recursive: true });
writeFileSync("out/demo.html", renderSite(template, { ...demoInput, planStartIso: new Date().toISOString(), examIso: new Date(Date.now() + 5 * 86400000).toISOString() }));
console.log("wrote out/demo.html");
