#!/usr/bin/env node
import js from "@eslint/js";
import { FlatCompat, Legacy } from "@eslint/eslintrc";
import { ESLint } from "eslint";
import { includeIgnoreFile } from "eslint/config";
import importX from "eslint-plugin-import-x";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import { createColors } from "tinyrainbow";
import tseslint from "typescript-eslint";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import codeComplete from "./vendor/code-complete/index.js";

const repoRoot = process.env.SANITY_REPO_ROOT || process.cwd();
const mode = process.env.SANITY_MODE || "staged";
const branchBase = process.env.SANITY_BRANCH_BASE || "";
const jsonOutput = process.env.SANITY_JSON === "1";
const verboseOutput = process.env.SANITY_VERBOSE === "1";
const colors = createColors({
  force: process.env.FORCE_COLOR !== undefined || (process.env.NO_COLOR === undefined && process.stdout.isTTY)
});
const extensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"]);
const fallbackIgnores = ["**/node_modules/**", "**/dist/**", "**/build/**", "**/coverage/**", "**/.next/**"];
const configFiles = [
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts"
];
const legacyConfigFiles = [
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.json",
  ".eslintrc.yaml",
  ".eslintrc.yml"
];

function gum(args, input = undefined) {
  const result = spawnSync("gum", args, {
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"]
  });

  if (result.error) {
    process.stdout.write(input ?? "");
    return;
  }

  process.stdout.write(result.stdout);
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
}

function style(text, ...args) {
  gum(["style", ...args], text);
}

function wrapText(text, width) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    if (line.length === 0) {
      line = word;
    } else if (line.length + word.length + 1 <= width) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines.length > 0 ? lines : [text];
}

function wrapMessage(text, width) {
  return text
    .split(/\r?\n/)
    .flatMap(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 ? wrapText(trimmed, width) : [""];
    });
}

function ansi(text, code) {
  switch (code) {
    case "1;38;5;34":
      return colors.bold(colors.green(text));
    case "1;38;5;39":
      return colors.bold(colors.cyan(text));
    case "1;38;5;196":
      return colors.bold(colors.red(text));
    case "1;38;5;214":
      return colors.bold(colors.yellow(text));
    case "1;38;5;252":
      return colors.bold(colors.white(text));
    case "38;5;39":
      return colors.cyan(text);
    case "38;5;240":
    case "38;5;245":
      return colors.gray(text);
    default:
      return text;
  }
}

function statusLabel(message) {
  return message.severity === 2 ? "×" : "!";
}

function statusColor(message) {
  return message.severity === 2 ? "196" : "214";
}

function readStdinBuffer() {
  const chunks = [];
  return new Promise((resolve, reject) => {
    process.stdin.on("data", chunk => chunks.push(chunk));
    process.stdin.on("error", reject);
    process.stdin.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function parseNulPaths(buffer) {
  return buffer
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter(path => {
      const dot = path.lastIndexOf(".");
      return dot !== -1 && extensions.has(path.slice(dot));
    });
}

function parseChangedRanges(diff) {
  const ranges = [];

  for (const line of diff.split(/\r?\n/)) {
    const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!match) continue;

    const start = Number(match[1]);
    const length = match[2] === undefined ? 1 : Number(match[2]);
    if (length > 0) {
      ranges.push([start, start + length - 1]);
    }
  }

  return ranges;
}

function diffArgsForMode(file) {
  switch (mode) {
    case "staged":
      return ["diff", "--cached", "--unified=0", "--no-ext-diff", "--diff-filter=ACMR", "--", file];
    case "changed":
      return ["diff", "--unified=0", "--no-ext-diff", "--diff-filter=ACMR", "--", file];
    case "branch":
      if (branchBase === "") {
        return undefined;
      }
      return ["diff", "--unified=0", "--no-ext-diff", "--diff-filter=ACMR", `${branchBase}...HEAD`, "--", file];
    default:
      return undefined;
  }
}

function changedRangesForMode(files) {
  if (!["staged", "changed", "branch"].includes(mode)) {
    return undefined;
  }

  const ranges = new Map();

  for (const file of files) {
    const diffArgs = diffArgsForMode(file);
    if (!diffArgs) continue;

    const result = spawnSync("git", ["-C", repoRoot, ...diffArgs], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      const message = result.stderr.trim() || `git diff failed for ${file}`;
      throw new Error(message);
    }

    ranges.set(file, parseChangedRanges(result.stdout));
  }

  return ranges;
}

function messageTouchesChangedLine(message, ranges) {
  if (!message.line) {
    return true;
  }

  const start = message.line;
  const end = message.endLine ?? message.line;
  return ranges.some(([rangeStart, rangeEnd]) => start <= rangeEnd && end >= rangeStart);
}

function withFilteredCounts(result, messages) {
  const errorCount = messages.filter(message => message.severity === 2).length;
  const warningCount = messages.filter(message => message.severity === 1).length;

  return {
    ...result,
    messages,
    errorCount,
    warningCount,
    fatalErrorCount: messages.filter(message => message.fatal === true).length,
    fixableErrorCount: messages.filter(message => message.severity === 2 && message.fix).length,
    fixableWarningCount: messages.filter(message => message.severity === 1 && message.fix).length
  };
}

function isVerboseOnlyMessage(message) {
  return message.fatal === true &&
    message.ruleId === null &&
    message.message.includes("was not found by the project service");
}

function filterResultsToChangedLines(results, rangesByFile) {
  const visibleResults = verboseOutput
    ? results
    : results.map(result =>
        withFilteredCounts(result, result.messages.filter(message => !isVerboseOnlyMessage(message)))
      );

  if (!rangesByFile) {
    return visibleResults;
  }

  return visibleResults.map(result => {
    const relativePath = relative(repoRoot, result.filePath) || result.filePath;
    const ranges = rangesByFile.get(relativePath);
    if (!ranges || ranges.length === 0) {
      return withFilteredCounts(result, []);
    }

    const messages = result.messages.filter(message => messageTouchesChangedLine(message, ranges));
    return withFilteredCounts(result, messages);
  });
}

function findFlatConfig() {
  for (const file of configFiles) {
    const configPath = join(repoRoot, file);
    if (existsSync(configPath)) {
      return configPath;
    }
  }

  return undefined;
}

function findLegacyConfig() {
  for (const file of legacyConfigFiles) {
    const configPath = join(repoRoot, file);
    if (existsSync(configPath)) {
      return configPath;
    }
  }

  return undefined;
}

function normalizeRecommendedConfig(config) {
  if (!config) return [];
  return Array.isArray(config) ? config : [config];
}

function sonarRecommendedRules() {
  const recommended = sonarjs.configs?.recommended;
  if (!recommended) return {};
  if (Array.isArray(recommended)) {
    return Object.assign({}, ...recommended.map(config => config.rules || {}));
  }
  return recommended.rules || {};
}

function typescriptRecommendedTypeCheckedRules() {
  return Object.assign(
    {},
    ...normalizeRecommendedConfig(tseslint.configs.recommendedTypeChecked).map(config => config.rules || {})
  );
}

function sanityConfig(projectHasFlatConfig) {
  const baseLanguageOptions = projectHasFlatConfig
    ? {}
    : {
        parserOptions: {
          ecmaFeatures: {
            jsx: true
          },
          ecmaVersion: "latest"
        }
      };

  return [
    ...(projectHasFlatConfig ? [] : [{ ignores: fallbackIgnores }]),
    js.configs.recommended,
    {
      files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
      languageOptions: baseLanguageOptions,
      plugins: {
        "import-x": importX,
        "sanity-code-complete": codeComplete,
        sonarjs,
        unicorn
      },
      rules: {
        ...sonarRecommendedRules(),
        complexity: ["warn", { max: 10 }],
        "max-depth": ["warn", 3],
        "max-lines-per-function": [
          "warn",
          {
            max: 80,
            skipBlankLines: true,
            skipComments: true
          }
        ],
        "max-params": ["warn", 4],
        "no-else-return": ["warn", { allowElseIf: false }],
        "no-nested-ternary": "warn",
        "import-x/first": "warn",
        "import-x/no-duplicates": "warn",
        "sanity-code-complete/enforce-meaningful-names": "warn",
        "sanity-code-complete/no-boolean-params": "warn",
        "sanity-code-complete/no-complex-conditionals": "warn",
        "sanity-code-complete/no-late-argument-usage": "warn",
        "sanity-code-complete/prefer-early-return": "warn",
        "sonarjs/cognitive-complexity": ["warn", 15],
        "unicorn/consistent-function-scoping": "warn",
        "unicorn/explicit-length-check": "warn",
        "unicorn/no-for-each": "warn",
        "unicorn/no-for-loop": "warn",
        "unicorn/no-useless-spread": "warn",
        "unicorn/prefer-array-find": "warn",
        "unicorn/prefer-array-flat": "warn",
        "unicorn/prefer-array-flat-map": "warn",
        "unicorn/prefer-includes": "warn",
        "unicorn/prefer-logical-operator-over-ternary": "warn",
        "unicorn/prefer-modern-dom-apis": "warn",
        "unicorn/prefer-native-coercion-functions": "warn",
        "unicorn/prefer-node-protocol": "warn",
        "unicorn/prefer-number-properties": "warn",
        "unicorn/prefer-object-from-entries": "warn",
        "unicorn/prefer-optional-catch-binding": "warn",
        "unicorn/prefer-regexp-test": "warn",
        "unicorn/prefer-set-has": "warn",
        "unicorn/prefer-string-replace-all": "warn",
        "unicorn/prefer-string-slice": "warn",
        "unicorn/prefer-string-starts-ends-with": "warn",
        "unicorn/prefer-string-trim-start-end": "warn",
        "unicorn/prefer-type-error": "warn"
      }
    },
    {
      files: ["**/*.{ts,tsx,mts,cts}"],
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
          ecmaFeatures: {
            jsx: true
          },
          ecmaVersion: "latest",
          projectService: true,
          tsconfigRootDir: repoRoot
        }
      },
      plugins: {
        "@typescript-eslint": tseslint.plugin
      },
      rules: typescriptRecommendedTypeCheckedRules()
    }
  ];
}

function legacyConfigOverrides(legacyConfigPath) {
  if (!legacyConfigPath) return { configs: [], error: undefined };

  const compat = new FlatCompat({
    allConfig: js.configs.all,
    baseDirectory: repoRoot,
    recommendedConfig: js.configs.recommended,
    resolvePluginsRelativeTo: repoRoot
  });

  try {
    return {
      configs: compat.config(Legacy.loadConfigFile(legacyConfigPath)),
      error: undefined
    };
  } catch (error) {
    return { configs: [], error };
  }
}

function eslintIgnoreOverride() {
  const ignorePath = join(repoRoot, ".eslintignore");
  return existsSync(ignorePath) ? includeIgnoreFile(ignorePath, "Imported .eslintignore patterns") : undefined;
}

function createEslint(options, handlesEslintIgnore) {
  if (!handlesEslintIgnore) return new ESLint(options);

  const originalEmitWarning = process.emitWarning;
  process.emitWarning = function emitWarning(warning, ...args) {
    const warningType = typeof args[0] === "string" ? args[0] : args[0]?.type;
    if (warningType !== "ESLintIgnoreWarning") {
      return originalEmitWarning.call(process, warning, ...args);
    }
  };

  try {
    return new ESLint(options);
  } finally {
    process.emitWarning = originalEmitWarning;
  }
}

function eslintOptions(projectConfigPath, legacyConfigPath) {
  const legacy = legacyConfigOverrides(legacyConfigPath);
  const projectHasConfig = Boolean(projectConfigPath || legacy.configs.length > 0);
  const ignoreOverride = eslintIgnoreOverride();
  const options = {
    cwd: repoRoot,
    overrideConfig: [
      ...(ignoreOverride ? [ignoreOverride] : []),
      ...legacy.configs,
      ...sanityConfig(projectHasConfig)
    ],
    errorOnUnmatchedPattern: false,
    fix: false,
    warnIgnored: false
  };

  options.overrideConfigFile = projectConfigPath || true;

  return { legacyConfigError: legacy.error, options };
}

function printIssue(message, displayPath) {
  const severity = statusLabel(message);
  const color = statusColor(message);
  const location = `${displayPath}:${message.line ?? 0}:${message.column ?? 0}`;
  const rule = message.ruleId || "eslint";
  const messageIndent = "     ";
  const wrapWidth = Math.max(48, Math.min(process.stdout.columns || 100, 120) - messageIndent.length);
  const messageLines = wrapMessage(message.message, wrapWidth);

  process.stdout.write("   ");
  process.stdout.write(ansi(severity, `1;38;5;${color}`));
  process.stdout.write(" ");
  process.stdout.write(ansi(rule, "1;38;5;252"));
  process.stdout.write("  ");
  process.stdout.write(ansi(location, "38;5;39"));
  process.stdout.write("\n");

  for (const [index, line] of messageLines.entries()) {
    process.stdout.write(messageIndent);
    process.stdout.write(ansi(index === 0 ? "→" : " ", "38;5;245"));
    process.stdout.write(" ");
    process.stdout.write(ansi(line, "38;5;245"));
    process.stdout.write("\n");
  }
}

function countPart(count, singular, colorCode) {
  const label = count === 1 ? singular : `${singular}s`;
  return ansi(`${count} ${label}`, count > 0 ? `1;38;5;${colorCode}` : "38;5;245");
}

function printResults(results, checkedCount) {
  let filesWithIssues = 0;
  let errorCount = 0;
  let warningCount = 0;
  let issueCount = 0;

  let printedFile = false;

  for (const result of results) {
    const messages = result.messages.filter(message => message.severity > 0);
    if (messages.length === 0) continue;

    filesWithIssues += 1;
    errorCount += result.errorCount;
    warningCount += result.warningCount;
    issueCount += messages.length;

    const displayPath = relative(repoRoot, result.filePath) || result.filePath;
    const fileErrorCount = messages.filter(message => message.severity === 2).length;
    const fileWarningCount = messages.filter(message => message.severity === 1).length;
    const fileStatus = fileErrorCount > 0 ? "❯" : "!";
    const fileStatusColor = fileErrorCount > 0 ? "196" : "214";
    const fileSummary = [
      countPart(messages.length, "issue", "252"),
      fileErrorCount > 0 ? countPart(fileErrorCount, "error", "196") : undefined,
      fileWarningCount > 0 ? countPart(fileWarningCount, "warning", "214") : undefined
    ].filter(Boolean).join(ansi(" | ", "38;5;240"));

    if (printedFile) {
      process.stdout.write("\n");
    }

    process.stdout.write(`${ansi(fileStatus, `1;38;5;${fileStatusColor}`)} ${ansi(displayPath, "1;38;5;39")} ${ansi("(", "38;5;245")}${fileSummary}${ansi(")", "38;5;245")}\n`);
    for (const [index, message] of messages.entries()) {
      if (index > 0) {
        process.stdout.write("");
      }
      printIssue(message, displayPath);
    }
    printedFile = true;
  }

  if (printedFile) {
    process.stdout.write("\n");
  }

  const status = errorCount > 0 ? "FAIL" : warningCount > 0 ? "WARN" : "PASS";
  const statusColorCode = errorCount > 0 ? "196" : warningCount > 0 ? "214" : "34";
  const cleanFiles = checkedCount - filesWithIssues;

  process.stdout.write(`${ansi(status, `1;38;5;${statusColorCode}`)}\n\n`);
  process.stdout.write(
    ` ${ansi("Lint Files", "1;38;5;252")}  ${ansi(`${filesWithIssues} with issues`, filesWithIssues > 0 ? "1;38;5;196" : "38;5;245")}${ansi(
      " | ",
      "38;5;240"
    )}${ansi(`${cleanFiles} clean`, cleanFiles > 0 ? "1;38;5;34" : "38;5;245")} ${ansi(`(${checkedCount})`, "38;5;245")}\n`
  );
  process.stdout.write(
    `     ${ansi("Issues", "1;38;5;252")}  ${ansi(
      `${errorCount} ${errorCount === 1 ? "error" : "errors"}`,
      errorCount > 0 ? "1;38;5;196" : "38;5;245"
    )}${ansi(" | ", "38;5;240")}${ansi(
      `${warningCount} ${warningCount === 1 ? "warning" : "warnings"}`,
      warningCount > 0 ? "1;38;5;214" : "38;5;245"
    )} ${ansi(
      `(${issueCount})`,
      "38;5;245"
    )}\n`
  );
}

function printFatal(error) {
  const message = error && typeof error.message === "string" ? error.message : String(error);
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify({ fatal: true, message }, null, 2)}\n`);
    return;
  }

  style("Fatal error\n", "--foreground", "196", "--bold");
  style(`${message}\n`, "--foreground", "252");
}

async function main() {
  if (process.argv.includes("--self-test")) {
    style("sanity runner loaded\n", "--foreground", "34", "--bold");
    return 0;
  }

  const files = parseNulPaths(await readStdinBuffer());
  if (files.length === 0) {
    if (jsonOutput) {
      process.stdout.write("[]\n");
    } else {
      style("No JavaScript or TypeScript files to check.\n", "--foreground", "34", "--bold");
    }
    return 0;
  }

  const projectConfigPath = findFlatConfig();
  const legacyConfigPath = projectConfigPath ? undefined : findLegacyConfig();
  const handlesEslintIgnore = Boolean(eslintIgnoreOverride());
  const { legacyConfigError, options } = eslintOptions(projectConfigPath, legacyConfigPath);

  if (legacyConfigError && verboseOutput && !jsonOutput) {
    style("Project ESLint config skipped\n", "--foreground", "214", "--bold");
    style(
      `${legacyConfigError.message}\nSanity will continue with its built-in checks. Install the project's ESLint dependencies to enable its legacy config.\n\n`,
      "--foreground",
      "252"
    );
  }

  const eslint = createEslint(options, handlesEslintIgnore);
  const rangesByFile = changedRangesForMode(files);
  const results = await eslint.lintFiles(files);
  const formatter = await eslint.loadFormatter("json");
  const formattedResults = filterResultsToChangedLines(JSON.parse(await formatter.format(results)), rangesByFile);

  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(formattedResults, null, 2)}\n`);
    return formattedResults.some(result => result.errorCount > 0) ? 1 : 0;
  }

  printResults(formattedResults, formattedResults.length);

  return formattedResults.some(result => result.errorCount > 0) ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then(code => {
      process.exitCode = code;
    })
    .catch(error => {
      printFatal(error);
      process.exitCode = typeof error.exitCode === "number" ? error.exitCode : 2;
    });
}

export { sanityConfig };
