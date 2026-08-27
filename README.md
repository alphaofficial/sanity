# sanity

Standalone JavaScript and TypeScript sanity checker for staged Git changes.

It runs from this package, uses this package's dependencies, and does not install or write anything inside the target repository.

## Requirements

- Node.js 20.19 or newer
- Git
- Gum

Install Gum if needed:

```bash
brew install gum
```

Install this package's dependencies from this directory:

```bash
npm install
```

## Add To PATH

Add this package's `bin` directory to your shell PATH:

```bash
export PATH="/Users/albert/Developer/sanity/bin:$PATH"
```

For zsh, put that line in:

```bash
~/.zshrc
```

Then reload:

```bash
source ~/.zshrc
```

Check that the command resolves:

```bash
command -v sanity
```

It should print:

```bash
/Users/albert/Developer/sanity/bin/sanity
```

## Usage

From any directory inside another Git repository:

```bash
sanity
```

That checks staged JavaScript and TypeScript files.

To check tracked files changed in the working tree:

```bash
sanity --changed
```

Supported files:

- `.js`
- `.jsx`
- `.mjs`
- `.cjs`
- `.ts`
- `.tsx`
- `.mts`
- `.cts`

## Behaviour

- Uses the target repository's flat ESLint config when present.
- Adds the standalone sanity rules after the project config, so sanity rules win on conflicts.
- Respects project ESLint ignores.
- Uses fallback ignores when no project flat config exists: `node_modules`, `dist`, `build`, `coverage`, `.next`.
- Does not run `--fix`.
- Does not install dependencies into the target repository.
- Does not generate temporary config files inside the target repository.

Legacy `.eslintrc` configs are detected, but not merged. In that case, `sanity` reports the limitation and runs the standalone checks.
