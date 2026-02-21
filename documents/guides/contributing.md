# Contributing Guide

## Welcome!

Thanks for your interest in contributing to the Eclipse Timer project. This guide explains how to set up your environment, understand the codebase, and submit changes.

## Prerequisites

- **Node.js**: v18 or later
- **pnpm**: v8 or later (see [setup-and-development.md](setup-and-development.md) for installation)
- **Git**: for version control
- **For mobile development**: EAS CLI (`npm install -g eas-cli`)

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR-ORG/eclipse-timer.git
   cd eclipse-timer
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Read the architecture docs:**
   Start with [high-level/system-overview.md](../high-level/system-overview.md) to understand the monorepo structure.

## Development Workflow

### Selecting an Area to Work On

- **Mobile app UI/UX**: See [high-level/user-flow-and-product-behavior.md](../high-level/user-flow-and-product-behavior.md)
- **Eclipse calculations**: See [low-level/engine-algorithm.md](../low-level/engine-algorithm.md)
- **Catalog or eclipse data**: See [low-level/data-contracts.md](../low-level/data-contracts.md)
- **Wearable companion**: See [high-level/wearable-companion-requirements.md](../high-level/wearable-companion-requirements.md)

### Common Tasks

#### Running the Mobile App Locally
```bash
cd apps/mobile
pnpm dev
```

#### Running Tests
```bash
pnpm test                 # Run all tests
pnpm test:watch         # Run tests in watch mode
```

#### Linting and Type Checking
```bash
pnpm lint
pnpm typecheck
```

#### Building for Release
```bash
pnpm build
```

## Code Style

- Follow the existing conventions in the touched files
- Use clear names over short abbreviations
- Prefer early returns over deep nesting
- Write pure functions where practical
- Keep diffs small and readable

See [AGENTS.md](../../AGENTS.md) in the root for more details.

## Testing

- Add tests for any logic changes
- Add at least one regression test when feasible
- Run the full test suite before submitting a pull request:
  ```bash
  pnpm test
  ```

## Documentation

Update docs in the following cases:
- Setup or environment changes
- New or modified configuration
- Public API or CLI flag changes
- Package boundaries or architecture changes
- Engine algorithm or type definitions change

See [01-documentation-plan.md](../planning/01-documentation-plan.md) for more guidance.

## Submitting Changes

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make small, focused commits:**
   - Aim for one logical change per commit
   - Write clear commit messages

3. **Run checks before pushing:**
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   ```

4. **Push and open a pull request:**
   - Include a brief summary of what changed and why
   - Reference any related issues
   - Note any assumptions or limitations

## Getting Help

- **Questions about architecture?** See the [high-level](../high-level) and [low-level](../low-level) documentation.
- **Stuck on setup?** See [setup-and-development.md](setup-and-development.md) or [troubleshooting.md](troubleshooting.md).
- **Performance concerns?** See [performance-optimization.md](performance-optimization.md).

## Code of Conduct

Be respectful and welcoming to all contributors.

---

For more information, see the full [documentation map](../README.md).
