import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("loads eslintrc rules and respects .eslintignore without warning", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sanity-legacy-"));

  try {
    await writeFile(join(directory, ".eslintrc.json"), JSON.stringify({ rules: { "no-console": "error" } }));
    await writeFile(join(directory, ".eslintignore"), "ignored.js\n");
    await writeFile(join(directory, "example.js"), "console.log('checked');\n");
    await writeFile(join(directory, "ignored.js"), "console.log('ignored');\n");

    const result = spawnSync(process.execPath, [join(process.cwd(), "src/run-eslint.js")], {
      cwd: directory,
      encoding: "utf8",
      env: {
        ...process.env,
        SANITY_JSON: "1",
        SANITY_MODE: "all",
        SANITY_REPO_ROOT: directory
      },
      input: "example.js\0ignored.js\0"
    });

    assert.equal(result.status, 1, result.stderr);
    assert.doesNotMatch(result.stderr, /ESLintIgnoreWarning/);

    const output = JSON.parse(result.stdout);
    assert.equal(output.length, 1);
    assert.ok(output[0].messages.some(message => message.ruleId === "no-console"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("continues with standalone checks when an eslintrc dependency is unavailable", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sanity-legacy-missing-"));

  try {
    await writeFile(join(directory, ".eslintrc.json"), JSON.stringify({ extends: ["missing-shareable-config"] }));
    await writeFile(join(directory, "example.js"), "const unused = 1;\n");

    const result = spawnSync(process.execPath, [join(process.cwd(), "src/run-eslint.js")], {
      cwd: directory,
      encoding: "utf8",
      env: {
        ...process.env,
        SANITY_JSON: "1",
        SANITY_MODE: "all",
        SANITY_REPO_ROOT: directory
      },
      input: "example.js\0"
    });

    assert.equal(result.status, 1, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.ok(output[0].messages.some(message => message.ruleId === "no-unused-vars"));

    const defaultOutput = spawnSync(process.execPath, [join(process.cwd(), "src/run-eslint.js")], {
      cwd: directory,
      encoding: "utf8",
      env: {
        ...process.env,
        NO_COLOR: "1",
        SANITY_MODE: "all",
        SANITY_REPO_ROOT: directory
      },
      input: "example.js\0"
    });
    assert.doesNotMatch(defaultOutput.stdout, /Project ESLint config skipped/);

    const verboseOutput = spawnSync(process.execPath, [join(process.cwd(), "src/run-eslint.js")], {
      cwd: directory,
      encoding: "utf8",
      env: {
        ...process.env,
        NO_COLOR: "1",
        SANITY_MODE: "all",
        SANITY_REPO_ROOT: directory,
        SANITY_VERBOSE: "1"
      },
      input: "example.js\0"
    });
    assert.match(verboseOutput.stdout, /Project ESLint config skipped/);
    assert.match(verboseOutput.stdout, /missing-shareable-config/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
