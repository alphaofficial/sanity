// Thin wrapper around ESLint's RuleTester. By default RuleTester relies on
// global mocha-style describe/it; we forward node:test's instead so each case
// runs as a real test picked up by `node --test`.
import { RuleTester } from "eslint";
import { builtinRules } from "eslint/use-at-your-own-risk";
import { after, before, describe, it } from "node:test";

// RuleTester exposes these as static setters in v10; assigning once per process
// is the documented way to point it at any test framework's globals.
RuleTester.afterAll = after;
RuleTester.beforeAll = before;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.itSkip = it.skip;

const DEFAULT_LANGUAGE_OPTIONS = {
  ecmaVersion: "latest",
  sourceType: "module"
};

function lookupRule(plugins, ruleId) {
  const slash = ruleId.indexOf("/");
  if (slash !== -1) {
    const namespace = ruleId.slice(0, slash);
    const name = ruleId.slice(slash + 1);
    const plugin = plugins?.[namespace];
    if (!plugin) {
      throw new Error(`RuleTester unit test has no plugin registered for "${namespace}". Pass it via the shared.plugins option.`);
    }
    const rule = plugin.rules?.[name];
    if (!rule) {
      throw new Error(`Plugin "${namespace}" does not export a rule called "${name}".`);
    }
    return rule;
  }

  // Built-in rule (no namespace): resolve via eslint's own registry.
  const builtin = builtinRules.get(ruleId);
  if (!builtin) {
    throw new Error(`Built-in rule "${ruleId}" not found in eslint.use-at-your-own-risk.builtinRules.`);
  }
  return builtin;
}

/**
 * Register one `describe` per group. Each entry is `{ valid, invalid }` in
 * RuleTester shape. `valid` and `invalid` items may be strings or objects
 * with `code`, `options`, `languageOptions`, etc.
 *
 * Rules are resolved by their full id. Namespaced ids (`<plugin>/<rule>`)
 * resolve out of `shared.plugins`; bare ids resolve out of the built-in ESLint
 * rule registry (via `eslint/use-at-your-own-risk`).
 *
 * @param {string} title
 * @param {Record<string, { valid: unknown[], invalid: unknown[] }>} groups
 * @param {{ plugins?: Record<string, unknown>, languageOptions?: unknown }} [shared]
 */
export function describeRuleTester(title, groups, shared = {}) {
  const testerConfig = {
    languageOptions: { ...DEFAULT_LANGUAGE_OPTIONS, ...(shared.languageOptions ?? {}) }
  };
  if (shared.plugins) {
    testerConfig.plugins = shared.plugins;
  }
  const tester = new RuleTester(testerConfig);

  describe(title, () => {
    for (const [ruleId, cases] of Object.entries(groups)) {
      const ruleDefinition = lookupRule(shared.plugins, ruleId);
      tester.run(ruleId, ruleDefinition, {
        valid: cases.valid,
        invalid: cases.invalid
      });
    }
  });
}
