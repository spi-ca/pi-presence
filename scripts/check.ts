import { readFile } from "node:fs/promises";
const manifest = JSON.parse(await readFile("package.json", "utf8")) as Record<string, unknown>;
for (const key of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
  if (key in manifest) throw new Error(`Dependency section ${key} is forbidden`);
}
const scripts = manifest.scripts as Record<string, string>;
if (Object.keys(scripts).some(key => /^(pre|post)?install$/.test(key))) throw new Error("Install hooks are forbidden");
if (manifest.private !== true || manifest.name !== "@pi/presence" || manifest.version !== "0.1.0" || manifest.packageManager !== "bun@1.3.14") throw new Error("Manifest contract mismatch");
