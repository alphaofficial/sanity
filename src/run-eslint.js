#!/usr/bin/env node
import js from "@eslint/js";
import { ESLint } from "eslint";
import importX from "eslint-plugin-import-x";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = process.env.SANITY_REPO_ROOT || process.cwd();
const jsonOutput = process.env.SANITY_JSON === "1";
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

function shouldColor() {
  return process.env.FORCE_COLOR !== undefined || (process.env.NO_COLOR === undefined && process.stdout.isTTY);
}

function ansi(text, code) {
  if (!shouldColor()) {
    return text;
  }

  return `\u001B[${code}m${text}\u001B[0m`;
}

function statusLabel(message) {
  return message.severity === 2 ? "ERROR" : "WARN";
}

function statusColor(message) {
  return message.severity === 2 ? "196" : "214";
}

function conciseMessage(message) {
  const rule = message.ruleId || "";
  const text = message.message;

  if (rule === "complexity") {
    const match = text.match(/(?:method|function) '([^']+)' has a complexity of (\d+)\. Maximum allowed is (\d+)\./i);
    if (match) {
      return `${match[1]}() complexity is ${match[2]}; limit is ${match[3]}`;
    }
  }

  if (rule === "max-lines-per-function") {
    const match = text.match(/Function '([^']+)' has too many lines \((\d+)\)\. Maximum allowed is (\d+)\./i);
    if (match) {
      return `${match[1]}() is ${match[2]} lines; limit is ${match[3]}`;
    }
  }

  if (rule === "sonarjs/assertions-in-tests") {
    return "Test has no assertion";
  }

  if (rule === "sonarjs/no-fixed-wait-in-tests") {
    return "Fixed wait should synchronize on an observable condition";
  }

  return text;
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

function findFlatConfig() {
  for (const file of configFiles) {
    const configPath = join(repoRoot, file);
    if (existsSync(configPath)) {
      return configPath;
    }
  }

  return undefined;
}

function hasLegacyConfig() {
  return legacyConfigFiles.some(file => existsSync(join(repoRoot, file)));
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

function typescriptRecommendedRules() {
  return Object.assign({}, ...normalizeRecommendedConfig(tseslint.configs.recommended).map(config => config.rules || {}));
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
      languageOptions: projectHasFlatConfig
        ? {}
        : {
            parser: tseslint.parser,
            parserOptions: {
              ecmaFeatures: {
                jsx: true
              },
              ecmaVersion: "latest"
            }
          },
      plugins: {
        "@typescript-eslint": tseslint.plugin
      },
      rules: typescriptRecommendedRules()
    }
  ];
}

function eslintOptions(projectConfigPath) {
  const projectHasFlatConfig = Boolean(projectConfigPath);
  const options = {
    cwd: repoRoot,
    overrideConfig: sanityConfig(projectHasFlatConfig),
    errorOnUnmatchedPattern: false,
    fix: false,
    warnIgnored: false
  };

  options.overrideConfigFile = projectConfigPath || true;

  return options;
}

function printIssue(message, displayPath) {
  const severity = statusLabel(message);
  const color = statusColor(message);
  const location = `${displayPath}:${message.line ?? 0}:${message.column ?? 0}`;
  const rule = message.ruleId || "eslint";
  const messageIndent = "         ";
  const wrapWidth = Math.max(48, Math.min(process.stdout.columns || 100, 120) - messageIndent.length);
  const messageLines = wrapText(conciseMessage(message), wrapWidth);

  process.stdout.write("  ");
  process.stdout.write(ansi(severity.padEnd(5), `1;38;5;${color}`));
  process.stdout.write("  ");
  process.stdout.write(ansi(rule, "1;38;5;252"));
  process.stdout.write("  ");
  process.stdout.write(ansi(location, "38;5;39"));
  process.stdout.write("\n");

  for (const line of messageLines) {
    process.stdout.write(messageIndent);
    process.stdout.write(ansi(line, "38;5;245"));
    process.stdout.write("\n");
  }
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

    if (printedFile) {
      process.stdout.write("\n");
    }

    process.stdout.write(`${ansi(displayPath, "1;38;5;39")}\n`);
    for (const [index, message] of messages.entries()) {
      if (index > 0) {
        process.stdout.write("\n");
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

  process.stdout.write(`${ansi("Summary", "1;38;5;252")}\n`);
  process.stdout.write(`  ${ansi("Status  ", "38;5;245")} ${ansi(status, `1;38;5;${statusColorCode}`)}\n`);
  process.stdout.write(`  ${ansi("Errors  ", "38;5;245")} ${ansi(String(errorCount), errorCount > 0 ? "1;38;5;196" : "38;5;245")}\n`);
  process.stdout.write(`  ${ansi("Warnings", "38;5;245")} ${ansi(String(warningCount), warningCount > 0 ? "1;38;5;214" : "38;5;245")}\n`);
  process.stdout.write(`  ${ansi("Files   ", "38;5;245")} ${ansi(`${filesWithIssues} affected / ${checkedCount} checked`, "1;38;5;252")}\n`);
}

function printFatal(error) {
  const message = error && typeof error.message === "string" ? error.message : String(error);
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify({ fatal: true, message })}\n`);
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
  const projectHasFlatConfig = Boolean(projectConfigPath);
  if (!projectHasFlatConfig && hasLegacyConfig()) {
    if (!jsonOutput) {
      style("Legacy ESLint config detected\n", "--foreground", "214", "--bold");
      style(
        "This project uses eslintrc configuration. ESLint flat config compatibility is not enabled here, so sanity will run its standalone checks only.\n\n",
        "--foreground",
        "252"
      );
    }
  }

  const eslint = new ESLint(eslintOptions(projectConfigPath));
  const results = await eslint.lintFiles(files);
  const formatter = await eslint.loadFormatter("json");
  const json = await formatter.format(results);
  const formattedResults = JSON.parse(json);

  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(formattedResults, null, 2)}\n`);
    return formattedResults.some(result => result.errorCount > 0) ? 1 : 0;
  }

  printResults(formattedResults, formattedResults.length);

  return formattedResults.some(result => result.errorCount > 0) ? 1 : 0;
}

main()
  .then(code => {
    process.exitCode = code;
  })
  .catch(error => {
    printFatal(error);
    process.exitCode = typeof error.exitCode === "number" ? error.exitCode : 2;
  });
