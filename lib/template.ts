import { readFile } from "node:fs/promises";
import path from "node:path";

let cached: string | null = null;
export async function loadTemplate() {
  cached ??= await readFile(path.join(process.cwd(), "public", "site-template.html"), "utf8");
  return cached;
}
