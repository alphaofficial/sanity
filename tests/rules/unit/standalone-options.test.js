// RuleTester-based unit tests for the standalone core rules whose sanity
// config supplies non-default options. These tests pin down the threshold
// behaviour and option overrides, so a regression in the rule itself (or in
// how sanityConfig() wires it) fails here first.
import { describeRuleTester } from "../../helpers/ruleTester.js";

describeRuleTester(
  "standalone core rules (option-pinned unit tests)",
  {
    complexity: {
      valid: [
        // 9 branches -> complexity 10 (1 base + 9 branches); rule fires on `>` 10.
        {
          code: [
            "function branchy(value) {",
            "  if (value === 1) return 1;",
            "  if (value === 2) return 2;",
            "  if (value === 3) return 3;",
            "  if (value === 4) return 4;",
            "  if (value === 5) return 5;",
            "  if (value === 6) return 6;",
            "  if (value === 7) return 7;",
            "  if (value === 8) return 8;",
            "  if (value === 9) return 9;",
            "  return 0;",
            "}"
          ].join("\n"),
          options: [{ max: 10 }]
        },
        {
          // The same shape (11 branches) is fine under a generous max:20.
          code: [
            "function branchy(value) {",
            ...Array.from({ length: 11 }, (_, i) => `  if (value === ${i + 1}) return ${i + 1};`),
            "  return 0;",
            "}"
          ].join("\n"),
          options: [{ max: 20 }]
        }
      ],
      invalid: [
        {
          // 10 branches -> complexity 11; trips max:10.
          code: [
            "function branchy(value) {",
            "  if (value === 1) return 1;",
            "  if (value === 2) return 2;",
            "  if (value === 3) return 3;",
            "  if (value === 4) return 4;",
            "  if (value === 5) return 5;",
            "  if (value === 6) return 6;",
            "  if (value === 7) return 7;",
            "  if (value === 8) return 8;",
            "  if (value === 9) return 9;",
            "  if (value === 10) return 10;",
            "  return 0;",
            "}"
          ].join("\n"),
          options: [{ max: 10 }],
          errors: [{ messageId: "complex" }]
        }
      ]
    },

    "max-depth": {
      valid: [
        // 3 levels of nesting is the configured ceiling.
        {
          code: [
            "function deep(values) {",
            "  if (values.first) {",
            "    if (values.second) {",
            "      if (values.third) {",
            "        return true;",
            "      }",
            "    }",
            "  }",
            "  return false;",
            "}"
          ].join("\n"),
          options: [3]
        }
      ],
      invalid: [
        {
          code: [
            "function deep(values) {",
            "  if (values.first) {",
            "    if (values.second) {",
            "      if (values.third) {",
            "        if (values.fourth) {",
            "          return true;",
            "        }",
            "      }",
            "    }",
            "  }",
            "  return false;",
            "}"
          ].join("\n"),
          options: [3],
          errors: [{ messageId: "tooDeeply" }]
        }
      ]
    },

    "max-lines-per-function": {
      valid: [
        // Function declaration + 77 statements + return + closing brace = 80 lines.
        {
          code: ["function verbose() {", ...Array.from({ length: 77 }, (_, i) => `  const step${i} = ${i};`), "  return step0;", "}"].join("\n") + "\n",
          options: [{ max: 80, skipBlankLines: true, skipComments: true }]
        },
        // Blank lines and comment lines are excluded from the count. 40 comment
        // lines + 40 statement lines + return + decl + closing brace = 83 raw
        // lines, but with skipBlankLines + skipComments the effective count is 42.
        {
          code: ["function verbose() {", ...Array.from({ length: 40 }, (_, i) => `  // commentary\n  const step${i} = ${i};\n`), "  return step0;", "}"].join("\n") + "\n",
          options: [{ max: 80, skipBlankLines: true, skipComments: true }]
        }
      ],
      invalid: [
        {
          // 78 statements + return + decl + closing brace = 81 lines; trips max:80.
          code: ["function verbose() {", ...Array.from({ length: 78 }, (_, i) => `  const step${i} = ${i};`), "  return step0;", "}"].join("\n") + "\n",
          options: [{ max: 80, skipBlankLines: true, skipComments: true }],
          errors: [{ messageId: "exceed" }]
        }
      ]
    },

    "max-params": {
      valid: [
        {
          code: "function allowed(a, b, c, d) { return [a, b, c, d]; }",
          options: [4]
        }
      ],
      invalid: [
        {
          code: "function tooMany(a, b, c, d, e) { return [a, b, c, d, e]; }",
          options: [4],
          errors: [{ messageId: "exceed" }]
        }
      ]
    },

    "no-else-return": {
      valid: [
        // `if` returns directly with no else.
        {
          code: "function pick(value) { if (value) return 'yes'; return 'no'; }",
          options: [{ allowElseIf: false }]
        },
        // With allowElseIf:true, the chained if/else if form is fine. (The
        // final `else` after the second return is still flagged - that is the
        // trailing-else case covered by the invalid set below.)
        {
          code: "function pick(value) { if (value === 1) return 'one'; if (value === 2) return 'two'; }",
          options: [{ allowElseIf: true }]
        }
      ],
      invalid: [
        {
          // allowElseIf:false means a plain if/else still trips; fixer strips the `else` (keeps surrounding spaces).
          code: "function pick(value) { if (value) { return 'yes'; } else { return 'no'; } }",
          output: "function pick(value) { if (value) { return 'yes'; }  return 'no';  }",
          options: [{ allowElseIf: false }],
          errors: [{ messageId: "unexpected" }]
        },
        {
          // Trailing else after a return trips no matter what allowElseIf is.
          code: "function pick(value) { if (value === 1) return 'one'; else return 'other'; }",
          output: "function pick(value) { if (value === 1) return 'one'; return 'other'; }",
          options: [{ allowElseIf: true }],
          errors: [{ messageId: "unexpected" }]
        }
      ]
    },

    "no-nested-ternary": {
      valid: [
        "function grade(score) { return score > 90 ? 'a' : 'c'; }"
      ],
      invalid: [
        {
          code: "function grade(score) { return score > 90 ? 'a' : score > 80 ? 'b' : 'c'; }",
          errors: [{ messageId: "noNestedTernary" }]
        }
      ]
    }
  }
);
