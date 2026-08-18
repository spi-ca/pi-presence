import { expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

async function files(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]))).flat();
}

test("contains no legacy channel, runtime dependencies, install hooks, polling, process, or connection APIs", async () => {
  const source = await Promise.all((await files("src")).map(async file => [file, await readFile(file, "utf8")] as const));
  const forbidden = [new RegExp("pi-presence:[^\\\"\\\'`\\\\s]*v" + "1", "i"), /\bsetInterval\b/, /\bsetTimeout\b/, /\bchild_process\b/, /\bnet\b/, /\bdgram\b/, /\bprocess\s*\./];
  for (const [file, text] of source) expect(forbidden.some(pattern => pattern.test(text)), file).toBe(false);
  const manifest = JSON.parse(await readFile("package.json", "utf8")) as Record<string, unknown>;
  expect(manifest.name).toBe("@pi/presence");
  for (const key of ["dependencies", "optionalDependencies", "peerDependencies"]) expect(key in manifest, key).toBe(false);
  expect(manifest.devDependencies).toEqual({ "@types/bun": "1.3.14", typescript: "5.9.3" });
  const scripts = manifest.scripts as Record<string, string>;
  expect(Object.keys(scripts).some(key => /^(pre|post)?install$/.test(key))).toBe(false);
  expect(manifest.exports).toEqual({ ".": "./index.ts", "./fixtures/normative.json": "./fixtures/normative.json" });
  const readme = await readFile("README.md", "utf8");
  expect(readme).toContain("version: 2");
  expect(readme).toContain("emit: (name, event)");
  expect(readme).toContain("install bus listeners");
});
