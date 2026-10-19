import { readFile } from "node:fs/promises";
const manifest = JSON.parse(await readFile("package.json", "utf8")) as Record<string, unknown>;
for (const key of ["dependencies", "optionalDependencies", "peerDependencies"]) {
  if (key in manifest) throw new Error(`Dependency section ${key} is forbidden`);
}
const devDependencies = manifest.devDependencies as Record<string, unknown> | undefined;
if (!devDependencies || Object.keys(devDependencies).length !== 2 || devDependencies.typescript !== "5.9.3" || devDependencies["@types/bun"] !== "1.3.14") throw new Error("The exact TypeScript compiler dependencies are required");
const scripts = manifest.scripts as Record<string, string>;
if (Object.keys(scripts).some(key => /^(pre|post)?install$/.test(key))) throw new Error("Install hooks are forbidden");
const engines = manifest.engines as Record<string, unknown> | undefined;
if ("packageManager" in manifest || engines?.bun !== ">=1.4.2") throw new Error("Bun >=1.4.2 is required without a fixed packageManager pin");
if (manifest.private !== true || manifest.name !== "@pi/presence" || manifest.version !== "0.1.0") throw new Error("Manifest contract mismatch");
