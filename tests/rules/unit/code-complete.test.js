// RuleTester-based unit tests for the vendored sanity-code-complete rules.
// Each rule is exercised directly with its canonical violation, including the
// option-bearing ones so a regression in the plugin (or in how we wire it)
// surfaces here before integration tests run.
import tseslint from "typescript-eslint";
import { describeRuleTester } from "../../helpers/ruleTester.js";
import codeComplete from "../../../src/vendor/code-complete/index.js";

describeRuleTester(
  "sanity-code-complete (rule unit tests)",
  {
    "sanity-code-complete/enforce-meaningful-names": {
      valid: [
        "export function compute() { return 1; }",
        "export function loop(i, j) { return i + j; }",
        "export function plot(x, y) { return [x, y]; }"
      ],
      invalid: [
        {
          code: "function t() { return 1; }",
          errors: [{ messageId: "nameTooShort" }]
        },
        {
          code: "function tmp() { return 1; }",
          errors: [{ messageId: "nameDisallowed" }]
        },
        {
          code: "function aaaa() { return 1; }",
          errors: [{ messageId: "nameNotMeaningful" }]
        },
        {
          code: "function ab() { return 1; }",
          options: [{ minLength: 3, allowedNames: [] }],
          errors: [{ messageId: "nameTooShort" }]
        }
      ]
    },

    "sanity-code-complete/no-boolean-params": {
      valid: [
        "export function render() { return 1; }",
        "export function render(isVisible) { return isVisible; }",
        "export function render(hasPermission) { return hasPermission; }",
        {
          code: "export function render(verbose = false) { return verbose; }",
          options: [{ ignoreDefault: true }]
        }
      ],
      invalid: [
        {
          code: "export function render(verbose = false) { return verbose; }",
          errors: [{ messageId: "noBooleanParamWithSuggestion" }]
        },
        {
          languageOptions: { parser: tseslint.parser },
          code: "export function render(verbose: boolean) { return verbose; }",
          errors: [{ messageId: "noBooleanParamWithSuggestion" }]
        }
      ]
    },

    "sanity-code-complete/no-complex-conditionals": {
      valid: [
        "export function run(a, b) { if (a && b) return 1; return 0; }",
        // One OR + one AND inside `a || (b && c)` -> 2 operators at the limit.
        "export function run(a, b, c) { if (a || (b && c)) return 1; return 0; }"
      ],
      invalid: [
        {
          // a && b && c && d -> 3 operators, trips maxOperators:2.
          code: "export function run(a, b, c, d) { if (a && b && c && d) return 1; return 0; }",
          errors: [{ messageId: "complexConditional" }]
        },
        {
          // (a || b) && (c || d) -> 3 operators.
          code: "export function run(a, b, c, d) { if ((a || b) && (c || d)) return 1; return 0; }",
          errors: [{ messageId: "complexConditional" }]
        }
      ]
    },

    "sanity-code-complete/no-late-argument-usage": {
      valid: [
        "export function run(input) { return input; }"
      ],
      invalid: [
        {
          // Rule matches ExpressionStatement<Identifier>; use `payload;` as a
          // bare expression statement on line 12 (11 statements before it).
          code: [
            "export function run(payload) {",
            "  const a = 1;",
            "  const b = 2;",
            "  const c = 3;",
            "  const d = 4;",
            "  const e = 5;",
            "  const f = 6;",
            "  const g = 7;",
            "  const h = 8;",
            "  const i = 9;",
            "  const j = 10;",
            "  payload;",
            "}"
          ].join("\n"),
          errors: [{ messageId: "lateArgumentUsage" }]
        }
      ]
    },

    "sanity-code-complete/prefer-early-return": {
      valid: [
        "export function run(items) { if (!items) return; return items.map(x => x); }"
      ],
      invalid: [
        {
          // Body has exactly one statement — the if — and the if-body
          // exceeds maxLines (default 3).
          code: [
            "export function summarize(report) {",
            "  if (report.isReady) {",
            "    const header = report.title;",
            "    const body = report.body;",
            "    const footer = report.footer;",
            "    return [header, body, footer].join('\\n');",
            "  }",
            "}"
          ].join("\n"),
          errors: [{ messageId: "preferEarlyReturn" }]
        }
      ]
    },

    "sanity-code-complete/high-import-coupling": {
      valid: [
        "import { join } from 'node:path';\nexport const x = join;"
      ],
      invalid: [
        {
          code: [
            "import { basename } from 'node:path';",
            "import { createHash } from 'node:crypto';",
            "import { cwd } from 'node:process';",
            "import { EventEmitter } from 'node:events';",
            "import { format } from 'node:util';",
            "import { homedir } from 'node:os';",
            "import { readFile } from 'node:fs/promises';",
            "import { Readable } from 'node:stream';",
            "import { setTimeout as delay } from 'node:timers/promises';",
            "import { URL } from 'node:url';",
            "import { Worker } from 'node:worker_threads';",
            "export const imports = { basename, createHash, cwd, EventEmitter, format, homedir, readFile, Readable, delay, URL, Worker };"
          ].join("\n"),
          errors: [{ messageId: "tooManyImports" }]
        }
      ]
    }
  },
  { plugins: { "sanity-code-complete": codeComplete } }
);
