#!/usr/bin/env node
import js from "@eslint/js";
import { ESLint } from "eslint";
import importX from "eslint-plugin-import-x";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import { createColors } from "tinyrainbow";
import tseslint from "typescript-eslint";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.env.SANITY_REPO_ROOT || process.cwd();
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

function shouldHyperlink() {
  return process.env.FORCE_HYPERLINK !== undefined || process.stdout.isTTY;
}

function hyperlink(text, uri) {
  if (!shouldHyperlink()) {
    return text;
  }

  return `\u001B]8;;${uri}\u0007${text}\u001B]8;;\u0007`;
}

function fileLineUri(filePath, line, column) {
  return `vscode://file/${filePath}:${line ?? 1}${column ? `:${column}` : ""}`;
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

function printIssue(message, locationWidth) {
  const severity = message.severity === 2 ? "error" : "warning";
  const color = message.severity === 2 ? "196" : "214";
  const location = `${message.line ?? 0}:${message.column ?? 0}`.padEnd(locationWidth);
  const rule = message.ruleId || "eslint";
  const messageIndent = "        ";
  const wrapWidth = Math.max(48, Math.min(process.stdout.columns || 100, 120) - messageIndent.length);
  const messageLines = wrapText(message.message, wrapWidth);

  process.stdout.write("  ");
  process.stdout.write(ansi(location, "38;5;244"));
  process.stdout.write("  ");
  process.stdout.write(ansi(severity, `1;38;5;${color}`));
  process.stdout.write(" ".repeat(9 - severity.length));
  process.stdout.write(ansi(rule, "1;38;5;252"));
  process.stdout.write("\n");

  for (const line of messageLines) {
    process.stdout.write(messageIndent);
    process.stdout.write(ansi("→", "38;5;245"));
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

  let printedFile = false;

  for (const result of results) {
    const messages = result.messages.filter(message => message.severity > 0);
    if (messages.length === 0) continue;

    filesWithIssues += 1;
    errorCount += result.errorCount;
    warningCount += result.warningCount;

    const firstMessage = messages[0];
    const displayPath = relative(repoRoot, result.filePath) || result.filePath;
    const displayLink = `${displayPath}:${firstMessage.line ?? 1}:${firstMessage.column ?? 1}`;
    const locationWidth = Math.max(...messages.map(message => `${message.line ?? 0}:${message.column ?? 0}`.length));

    if (printedFile) {
      process.stdout.write("\n");
    }

    process.stdout.write(`${hyperlink(ansi(displayLink, "1;38;5;39"), fileLineUri(result.filePath, firstMessage.line, firstMessage.column))}\n`);
    for (const [index, message] of messages.entries()) {
      if (index > 0) {
        process.stdout.write("");
      }
      printIssue(message, locationWidth);
    }
    printedFile = true;
  }

  const summary = [
    ansi(`Checked ${checkedCount} ${checkedCount === 1 ? "file" : "files"}`, "1;38;5;252"),
    ansi(`${filesWithIssues} ${filesWithIssues === 1 ? "file" : "files"} with issues`, "1;38;5;252"),
    ansi(`${errorCount} ${errorCount === 1 ? "error" : "errors"}`, errorCount > 0 ? "1;38;5;196" : "1;38;5;252"),
    ansi(`${warningCount} ${warningCount === 1 ? "warning" : "warnings"}`, warningCount > 0 ? "1;38;5;214" : "1;38;5;252")
  ].join("\n");

  if (printedFile) {
    process.stdout.write("\n");
  }
  process.stdout.write(`${summary}\n`);
}

function printFatal(error) {
  style("Fatal error\n", "--foreground", "196", "--bold");
  const message = error && typeof error.message === "string" ? error.message : String(error);
  style(`${message}\n`, "--foreground", "252");
}

async function main() {
  if (process.argv.includes("--self-test")) {
    style("sanity runner loaded\n", "--foreground", "34", "--bold");
    return 0;
  }

  const files = parseNulPaths(await readStdinBuffer());
  if (files.length === 0) {
    style("No JavaScript or TypeScript files to check.\n", "--foreground", "34", "--bold");
    return 0;
  }

  const projectConfigPath = findFlatConfig();
  const projectHasFlatConfig = Boolean(projectConfigPath);
  if (!projectHasFlatConfig && hasLegacyConfig()) {
    style("Legacy ESLint config detected\n", "--foreground", "214", "--bold");
    style(
      "This project uses eslintrc configuration. ESLint flat config compatibility is not enabled here, so sanity will run its standalone checks only.\n\n",
      "--foreground",
      "252"
    );
  }

  const eslint = new ESLint(eslintOptions(projectConfigPath));
  const results = await eslint.lintFiles(files);
  const formatter = await eslint.loadFormatter("json");
  const formattedResults = JSON.parse(await formatter.format(results));
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
