import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function run(directory, verbose) {
  return spawnSync(process.execPath, [join(process.cwd(), "src/run-eslint.js")], {
    cwd: directory,
    encoding: "utf8",
    env: {
      ...process.env,
      SANITY_JSON: "1",
      SANITY_MODE: "all",
      SANITY_REPO_ROOT: directory,
      SANITY_VERBOSE: verbose ? "1" : "0"
    },
    input: "excluded.ts\0"
  });
}

test("only shows project-service exclusion errors in verbose mode", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sanity-project-service-"));

  try {
    await writeFile(join(directory, "tsconfig.json"), JSON.stringify({ include: ["included.ts"] }));
    await writeFile(join(directory, "included.ts"), "export const included = true;\n");
    await writeFile(join(directory, "excluded.ts"), "export const excluded = true;\n");

    const defaultResult = run(directory, false);
    assert.equal(defaultResult.status, 0, defaultResult.stderr);
    assert.deepEqual(JSON.parse(defaultResult.stdout)[0].messages, []);

    const verboseResult = run(directory, true);
    assert.equal(verboseResult.status, 1, verboseResult.stderr);
    assert.match(JSON.parse(verboseResult.stdout)[0].messages[0].message, /was not found by the project service/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
