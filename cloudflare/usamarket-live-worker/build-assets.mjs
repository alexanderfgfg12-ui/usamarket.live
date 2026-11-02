import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, join, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const output = join(here, "dist");
const excluded = new Set([".git", ".github", "cloudflare", "node_modules", "dist", "coverage"]);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of await readdir(repoRoot, { withFileTypes: true })) {
  if (excluded.has(entry.name)) continue;
  const source = join(repoRoot, entry.name);
  const target = join(output, entry.name);
  await cp(source, target, { recursive: true });
}

console.log("Prepared static site assets in", relative(repoRoot, output).split(sep).join("/"));
