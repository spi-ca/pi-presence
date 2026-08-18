import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

async function files(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]));
  return nested.flat();
}
const sourceFiles = (await files("src")).filter(file => file.endsWith(".ts"));
const forbidden = [/\bsetInterval\b/, /\bsetTimeout\b/, /\bchild_process\b/, /\bnet\b/, /\bdgram\b/, /\bprocess\s*\./, new RegExp("pi-presence:[^\"\'`\\s]*v" + "1", "i")];
for (const file of sourceFiles) {
  const text = await readFile(file, "utf8");
  if (forbidden.some(pattern => pattern.test(text))) throw new Error(`Forbidden runtime pattern in ${file}`);
}
