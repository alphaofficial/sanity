import assert from "node:assert/strict";
import { ESLint } from "eslint";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import tseslint from "typescript-eslint";
import { sanityConfig } from "../../../src/run-eslint.js";

function typescriptConfig(projectHasFlatConfig) {
  return sanityConfig(projectHasFlatConfig).find(config =>
    config.files?.includes("**/*.{ts,tsx,mts,cts}")
  );
}

test("runs rules that require TypeScript type information", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sanity-typescript-"));

  try {
    const sourcePath = join(directory, "example.ts");
    await writeFile(join(directory, "tsconfig.json"), JSON.stringify({ include: ["example.ts"] }));
    await writeFile(sourcePath, "async function example() { await 1; }\n");

    const eslint = new ESLint({
      cwd: directory,
      overrideConfig: sanityConfig(false),
      overrideConfigFile: true
    });
    const [result] = await eslint.lintFiles([sourcePath]);

    assert.ok(result.messages.some(message => message.ruleId === "@typescript-eslint/await-thenable"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

for (const projectHasFlatConfig of [false, true]) {
  test(`enables type-aware TypeScript linting with project config: ${projectHasFlatConfig}`, () => {
    const config = typescriptConfig(projectHasFlatConfig);

    assert.equal(config.languageOptions.parser, tseslint.parser);
    assert.equal(config.languageOptions.parserOptions.projectService, true);
    assert.equal(config.rules["@typescript-eslint/await-thenable"], "error");
    assert.equal(config.rules["@typescript-eslint/no-floating-promises"], "error");
  });
}
