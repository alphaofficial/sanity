Create a standalone, machine-level code sanity checker that can lint staged JavaScript and TypeScript changes in any Git repository without installing or modifying anything in the target repository.

Core behaviour:

- Create a standalone Node.js package for the checker.
- Use ESLint flat config.
- Install and configure:
  - eslint
  - @eslint/js
  - typescript-eslint
  - eslint-plugin-sonarjs
  - eslint-plugin-unicorn
  - eslint-plugin-import-x
- Support:
  - .js
  - .jsx
  - .mjs
  - .cjs
  - .ts
  - .tsx
  - .mts
  - .cts

Project integration:

- Respect the target project's ESLint configuration by default.
- Respect the target project's ESLint ignore rules.
- If the project has no ESLint configuration, the standalone checker must still work.
- Apply the standalone sanity rules in addition to the project's rules.
- Where the same rule exists in both places, the standalone sanity rule should take precedence.
- Do not disable ESLint config lookup.
- Do not modify the target repository.
- Do not install dependencies into the target repository.
- Do not generate temporary config files inside the target repository.
- Do not rely on globally installed npm packages.
- Preserve correct plugin/module resolution for both the target project's configuration and the standalone checker.

Standalone baseline:

- Enable ESLint recommended rules.
- Enable typescript-eslint recommended rules.
- Enable compatible SonarJS recommended rules.
- Register and use Unicorn and import-x where useful.
- Avoid formatting-only rules.
- Avoid unnecessary conflicts with Prettier.

Add explicit maintainability/skimmability rules with sensible defaults:

- cyclomatic complexity: 10
- cognitive complexity: 15
- maximum nesting depth: 3
- maximum lines per function: 80, excluding blank lines and comments
- maximum parameters: 4
- no unnecessary else after return
- no nested ternaries
- duplicate import detection
- imports before executable statements
- useful Unicorn maintainability rules

The goal is to catch code that is difficult to skim, reason about, maintain, or safely modify rather than enforce arbitrary style preferences.

Ignore behaviour:

- Respect the target project's ESLint ignores.
- Also provide fallback ignores for common generated/dependency directories when no project configuration exists, including:
  - node_modules
  - dist
  - build
  - coverage
  - .next
- Do not override explicit project behaviour unnecessarily.

CLI:

- Create a Bash CLI command named `sanity`.
- Use Gum for all user-facing terminal presentation.
- Keep Git/file-selection logic in Bash unless a small helper is genuinely needed.
- The CLI must work from any directory inside a Git repository.
- Resolve the repository root before running.
- Lint only staged files by default with options to lint changed files being tracked
- Use NUL-delimited Git output rather than line-based parsing.
- Propagate ESLint's failure status when violations are found.
- Never run with `--fix`.

Gum output:

Use Gum to make the CLI output polished, compact, and easy to skim.

Do not use tables.

Do not use `gum table`.

Do not render tabular output.

Avoid large banners, excessive borders, or decorative output.

Parse ESLint results using ESLint's JSON formatter rather than printing raw ESLint output directly.

Group issues by file.

Render each file as a visually distinct heading, followed by its issues.

Use a compact format similar or better to:

src/example.ts

  12:8  error  sonarjs/cognitive-complexity
        Refactor this function to reduce its Cognitive Complexity.

  24:3  warning  complexity
        Function has a complexity of 12. Maximum allowed is 10.

src/other.ts

  8:2  error  max-depth
       Blocks are nested too deeply.

The exact spacing may be adjusted for readability, but do not turn it into a table.


Make filenames visually distinct using Gum styling.

Make errors and warnings visually distinguishable.

Keep issue messages readable even when they wrap across multiple lines.

Do not truncate useful ESLint messages unnecessarily.

After all issues, render a concise summary such as:

Checked 6 files
2 files with issues
3 errors
1 warning

Use Gum styling to make the final state obvious:

- success when there are no warnings or errors
- warning when there are warnings but no errors
- failure when errors exist

Keep normal ESLint exit semantics.

If ESLint itself fails because of configuration, parser, plugin, runtime, or another execution problem:

- do not format it as a normal lint issue
- show a clear fatal error heading
- show the real ESLint error message
- preserve the non-zero exit code

Do not dump raw ESLint JSON to the user.

Config composition:

Implement configuration composition carefully.

The effective precedence should conceptually be:

1. target project's ESLint configuration
2. standalone sanity configuration

The standalone sanity rules should act as an additional quality gate and win when the same rule is configured in both places.

Do not simply execute two independent lint passes if that causes:

- duplicate diagnostics
- inconsistent ignores
- incompatible parser behaviour
- conflicting plugin resolution
- different file matching behaviour

Prefer one effective ESLint execution where practical.

Project configuration discovery:

Support common modern ESLint configurations where practical:

- eslint.config.js
- eslint.config.mjs
- eslint.config.cjs
- eslint.config.ts when supported by the installed ESLint/runtime setup

Project ESLint configuration should be discovered relative to the target repository rather than relative to the standalone checker.

If no project ESLint configuration is found:

- use the standalone configuration as the complete configuration
- do not fail just because the project does not use ESLint

Legacy ESLint:

If a project uses legacy eslintrc configuration:

- support it only where ESLint provides a reliable compatibility mechanism
- otherwise report the limitation clearly
- never silently claim the project configuration was respected when it was not

Do not assume all projects use:

- the same parser
- React
- TypeScript
- the same import resolver
- the same module system
- the same framework
- the same source directory layout

Be careful not to override project-specific language or parser settings unless required for the standalone fallback.

Standalone rule configuration:

Use sensible rules aimed at maintainability, performance, readability and skimmability.

Add a small number of useful Unicorn rules only when they clearly improve correctness or maintainability.

Do not enable a huge set of highly opinionated Unicorn rules simply because they exist.

Avoid rules primarily concerned with:

- quote style
- semicolons
- indentation
- trailing commas
- formatting
- stylistic preferences better handled by Prettier

TypeScript:

- Syntax-aware TypeScript linting must work.
- Use typescript-eslint.
- Do not require a tsconfig.json.
- Do not enable rules requiring TypeScript type information.
- Do not use `recommendedTypeChecked` yet.
- Keep the implementation extensible so type-aware linting can be added later.

If the project provides its own TypeScript parser configuration, respect it.

React and JSX:

- `.jsx` and `.tsx` must be accepted.
- If the project's ESLint config provides React-specific parsing/settings, respect them.
- The standalone fallback should support basic JSX syntax.
- Do not install a large React-specific ruleset just for the sake of parsing JSX.

Bash implementation:

- Use Bash.
- Use `set -euo pipefail`.
- Use functions to separate concerns.
- Use descriptive function and variable names.
- Avoid shorthand or cryptic variable names.
- Prefer arrays when building commands.
- Never use `eval`.
- Quote all paths and variable expansions correctly.
- Avoid fragile parsing based on spaces or newlines.
- Use NUL-delimited input from Git.
- Preserve filenames exactly.
- Add comments around non-obvious Git parsing and ESLint config handling.


Git staged-file discovery:

Use Git to determine the repository root.

Use staged changes, not the working-tree diff for now.

Use NUL-delimited Git output.

Do not parse `git status` human-readable output.

Do not assume filenames contain no whitespace.

For renamed files, lint the destination path.

Filter the resulting paths to supported JavaScript and TypeScript extensions.

If no supported staged files exist:

- print a concise Gum-styled success/information message
- exit with status 0

Dependency checks:

Before running linting, validate required commands.

At minimum check:

- git
- gum
- node

Also validate that the standalone ESLint installation exists and can execute.

If a dependency is unavailable:

- fail immediately
- show a concise Gum-styled fatal error
- explain exactly which dependency is missing

Do not install missing dependencies automatically.

ESLint execution:

Use the standalone ESLint installation.

Run from the target repository root so project-relative configuration behaves correctly.

Request JSON output from ESLint for successful lint execution, including runs that contain lint violations.

Capture:

- stdout
- stderr
- exit status

Do not lose ESLint's original status.

Remember that ESLint may use non-zero exit codes for lint violations, so do not treat every non-zero status as an execution crash.

Distinguish normal lint results from actual ESLint execution/configuration failures.

Do not use brittle JSON parsing with grep, sed, or awk.

Do not add jq unless genuinely necessary.

Prefer using Node for JSON parsing since the tool already requires Node.

Spinner behaviour:

Use `gum spin` while ESLint runs.

The spinner should not hide errors or swallow output.

Avoid interleaving spinner output with the final lint report.

Stop the spinner before rendering results.

Repository safety:

Treat the target repository as read-only.

Never:

- modify source files
- modify package.json
- modify lockfiles
- install dependencies
- create ESLint configuration files
- create temporary files inside the repository
- stage files
- unstage files
- commit
- reset Git state
- stash
- run ESLint with `--fix`
- run a formatter
- rewrite imports

Temporary files:

If temporary files are required for ESLint JSON output or intermediate processing:

- use the operating system's temporary directory
- clean them up with a trap
- never create them inside the target repository

Validation:

Do not create temporary Git repositories.

Do not initialize Git anywhere.

Do not make commits.

Do not stage files for testing.

Do not alter Git state as part of validation.

Validate the implementation using non-Git-specific checks only, including:

- Bash syntax validation
- checking command availability
- checking that the standalone ESLint config loads
- invoking ESLint directly against explicit fixture JS files
- invoking ESLint directly against explicit fixture TS files
- validating ESLint JSON parsing
- validating Gum rendering
- validating success, warning, lint-error, and ESLint-execution-error output paths independently where possible

Do not test staged-file discovery by changing Git state.

Implementation quality:

Keep the implementation small and maintainable.

Prefer:

- a Bash CLI for orchestration
- ESLint for lint execution

Avoid introducing a large framework or CLI library.

Make failures actionable.

Add comments for decisions that would otherwise be tempting for another agent to "simplify" incorrectly.

In particular, explain:

- why Git output is NUL-delimited
- why the target repository must remain read-only
- how project ESLint configuration is combined with sanity rules
- why TypeScript type-aware linting is intentionally disabled
- why ESLint JSON output is parsed rather than displayed directly

Deliverables:

Create:

- standalone package configuration
- standalone ESLint sanity configuration
- executable Bash `sanity` CLI
- small Node helper scripts only where justified
- concise README

The README should cover:

- purpose of the checker
- required dependencies
- standalone dependency installation
- how to make the `sanity` command available in the shell
- how staged-file discovery works
- supported file extensions
- project ESLint configuration behaviour
- project ignore behaviour
- sanity-rule precedence
- Gum output behaviour
- exit-code behaviour
- current TypeScript limitation: no type-aware linting
- repository read-only guarantee
- example `sanity` usage

Do not choose, prescribe, or hard-code a filesystem path or installation location.

The entire tool must work regardless of where the standalone package is installed.