# sanity

A standalone ESLint quality gate for JavaScript and TypeScript changes in any Git repository.

`sanity` checks staged files by default, presents compact diagnostics grouped by file, and leaves the target repository untouched. It brings its own ESLint installation and rules while incorporating a project's modern ESLint configuration when available.

## Requirements

- Node.js 20.19 or newer
- Git
- [Gum](https://github.com/charmbracelet/gum) for interactive terminal output

On macOS, install Gum with Homebrew:

```bash
brew install gum
```

Gum is not required when using `--json`.

## Installation

Clone or download this package, then install its dependencies from the package directory:

```bash
npm install
```

Add the package's `bin` directory to your `PATH`. For zsh, add the following to `~/.zshrc`, replacing the example path with the directory where you installed this package:

```bash
export PATH="/path/to/sanity/bin:$PATH"
```

Reload your shell and verify the command:

```bash
source ~/.zshrc
command -v sanity
sanity --help
```

## Usage

Run the command from any directory inside the Git repository you want to check:

```bash
sanity
```

By default, it checks files staged in the Git index. This makes it suitable for running before a commit.

### Options

- `--staged` checks staged files and is the default.
- `--changed` checks tracked files changed in the working tree but not yet staged.
- `--branch` checks files changed on the current branch since it forked from the repository's default branch.
- `--branch <base-ref>` checks files changed on the current branch since it forked from a specific base ref.
- `--json` writes ESLint's machine-readable JSON results and does not require Gum.
- `--clipboard` copies the printed output to the system clipboard.
- `--help` prints command help.

Examples:

```bash
sanity --changed
sanity --branch
sanity --branch main
sanity --json
sanity --changed --json
sanity --branch --json
sanity --clipboard
sanity --json --clipboard
```

The command exits with `0` when there are no lint errors, `1` when lint errors are found, and `2` for usage, dependency, configuration, or execution failures. Warnings are reported but do not produce a failing exit status.

## Supported Files

- `.js`
- `.jsx`
- `.mjs`
- `.cjs`
- `.ts`
- `.tsx`
- `.mts`
- `.cts`

File discovery uses NUL-delimited Git output, so filenames containing spaces and other unusual characters are handled safely. Added, copied, modified, and renamed files are considered; deleted files are skipped. Renames use the destination path.

## ESLint Configuration

When a project contains `eslint.config.js`, `eslint.config.mjs`, `eslint.config.cjs`, or `eslint.config.ts`, `sanity` loads it and then adds its own rules. The sanity rules take precedence when both configurations define the same rule.

Project flat-config ignore rules are respected. If no flat config exists, these common generated directories are ignored:

- `node_modules`
- `dist`
- `build`
- `coverage`
- `.next`

Legacy `.eslintrc` files are detected but cannot be merged into the flat configuration. A warning is shown and the standalone rules are used instead.

TypeScript syntax is supported without requiring a `tsconfig.json`. Type-aware linting is intentionally not enabled, so rules that require TypeScript type information are not included.

## Built-in Checks

The standalone configuration combines recommended ESLint, typescript-eslint, and SonarJS checks with focused maintainability rules, including:

- Cyclomatic complexity: 10
- Cognitive complexity: 15
- Maximum nesting depth: 3
- Maximum function length: 80 lines, excluding blanks and comments
- Maximum function parameters: 4
- Duplicate and misplaced imports
- Nested ternaries and unnecessary `else` blocks
- Selected Unicorn correctness and modernisation rules

It avoids formatting rules better handled by tools such as Prettier.

## Repository Safety

The target repository is treated as read-only. `sanity` never:

- Installs dependencies in the target repository
- Creates configuration or temporary files in it
- Runs ESLint with `--fix`
- Modifies, stages, unstages, or formats source files
- Changes commits, branches, stashes, or other Git state

Any intermediate data is stored in the operating system's temporary directory and removed after the command exits.

## Development

Run the package checks from this directory:

```bash
npm run check
npm run lint
```
