# Clava

A pnpm monorepo with TypeScript, Vite, and modern tooling.

## Structure

- `packages/clava` - Library package built with Vite in library mode
- `app` - Simple Vite application

## Getting Started

### Prerequisites

- Node.js >= 24.0.0
- pnpm >= 8.0.0

### Installation

```bash
pnpm install
```

### Development

```bash
# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint

# Format code
pnpm format
```

### Working with the app

```bash
cd app
pnpm dev
```

### Working with the library

```bash
cd packages/clava
pnpm dev  # Watch mode
pnpm build
pnpm test
```

## Tools

- **Build**: Vite
- **Test**: Vitest
- **Lint/Format**: oxlint/oxfmt
- **Versioning**: Changesets

## Publishing

This project uses changesets for version management and publishing.

1. Make your changes
2. Run `pnpm changeset` to create a changeset
3. Commit the changeset file
4. On merge to main, a PR will be created to version packages
5. Merge the version PR to publish to npm
