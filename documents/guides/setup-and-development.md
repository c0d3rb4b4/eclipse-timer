# Setup and Development Guide

## Prerequisites

- **Node.js**: v18 or later
- **pnpm**: v8 or later
- **Git**: for version control
- **Expo CLI**: `npm install -g eas-cli` (for mobile deployment)
- **Android Studio** or **Xcode** (for mobile emulator, optional)

## Installation

### 1. Clone and Install

```bash
git clone https://github.com/YOUR-ORG/eclipse-timer.git
cd eclipse-timer
pnpm install
```

### 2. Verify Installation

```bash
pnpm typecheck
pnpm lint
pnpm test
```

## Common Development Commands

Run these from the repository root:

```bash
# Install dependencies
pnpm install

# Start mobile app in development mode
pnpm dev:mobile

# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Type check all packages
pnpm typecheck

# Lint all code
pnpm lint

# Build all packages
pnpm build

# Clean build artifacts
pnpm clean
```

### Package-Specific Commands

```bash
# Run engine dev script (prints sample eclipse circumstances)
pnpm -C packages/engine dev:one

# Build catalog
pnpm -C packages/catalog build

# Run shared package tests
pnpm -C packages/shared test
```

## Monorepo Structure

The project is organized as a pnpm workspace:

- **`apps/mobile/`**: React Native mobile app (Expo)
- **`packages/catalog/`**: Eclipse catalog data and generation scripts
- **`packages/engine/`**: Core eclipse calculation logic
- **`packages/shared/`**: Shared TypeScript types and utilities
- **`documents/`**: Project documentation (this folder)

### Key Configuration Files

- **`pnpm-workspace.yaml`**: Workspace package definitions
- **`tsconfig.base.json`**: Shared TypeScript compiler options
- **`vitest.config.ts`**: Shared test runner configuration
- **`biome.json`**: Linting and formatting rules

## Working with the Monorepo

### Sharing Code Between Packages

1. Define types in `packages/shared/src/`
2. Export from `packages/shared/src/index.ts`
3. Import in other packages: `import { Type } from '@eclipse-timer/shared'`

### Building for Mobile

The mobile app includes special bundling configuration:

- **`metro.config.js`**: Custom Metro bundler configuration
  - Watches the workspace root for changes
  - Resolves modules from workspace `node_modules`
  - Includes TypeScript source for workspace packages

### Adding a New Package

1. Create a folder in `packages/` with `package.json` and `tsconfig.json`
2. Add to `pnpm-workspace.yaml`
3. Export public API from `src/index.ts`
4. Update `tsconfig.base.json` paths if needed

## Quality Gates

### Before Committing

```bash
pnpm typecheck    # Must pass
pnpm lint         # Must pass
pnpm test         # Should pass
```

### Before Pushing

```bash
pnpm build        # Verify builds complete
pnpm test         # Run full test suite
```

### Recommended Team Workflow

1. Create a feature branch from `main`
2. Make changes and run quality checks frequently
3. Update documentation in `documents/` when changing:
   - Algorithms or types
   - User-visible flows
   - Development setup or scripts
   - Catalog data
4. Submit a pull request with clear commit messages

## Development Setup by Role

### Mobile App Developer

```bash
# Install and start
pnpm install
pnpm dev:mobile

# Watch for changes
pnpm typecheck --watch

# Run tests
pnpm test --watch
```

**Relevant docs:**
- [high-level/user-flow-and-product-behavior.md](../high-level/user-flow-and-product-behavior.md)
- [low-level/mobile-app-internals.md](../low-level/mobile-app-internals.md)

### Wear OS Companion on Local Emulator

Use this flow when working on the native watch companion under `apps/mobile/android/wear`.

1. In Android Studio `SDK Manager`, install a Wear OS system image.
2. In Android Studio `Device Manager`, create and start a Wear OS virtual device.
3. Build the watch debug APK from the Android project root:

```bash
cd apps/mobile/android

# macOS/Linux
./gradlew :wear:assembleDebug

# Windows PowerShell
.\gradlew.bat :wear:assembleDebug
```

4. Install to the Wear emulator (use the watch serial from `adb devices`):

```bash
adb devices
adb -s <wear-emulator-serial> install -r wear/build/outputs/apk/debug/wear-debug.apk
```

5. Launch the watch app:

```bash
adb -s <wear-emulator-serial> shell am start -n com.lallimaven.eclipsetimer.wear/com.lallimaven.eclipsetimer.wear.MainActivity
```

6. Optional phone/watch bridge check:
   - Start an Android phone emulator.
   - Run the phone app: `pnpm -C apps/mobile android`
   - Pair phone + watch emulators in Android Studio Device Manager.
   - Re-open the watch app and confirm it changes from "Sent test message. Waiting for phone..." to a "Phone reply: ..." status.

### Engine Developer

```bash
# Build and test engine
pnpm -C packages/engine build
pnpm -C packages/engine test --watch

# Run dev script
pnpm -C packages/engine dev:one
```

**Relevant docs:**
- [low-level/engine-algorithm.md](../low-level/engine-algorithm.md)
- [low-level/data-contracts.md](../low-level/data-contracts.md)

### Catalog Developer

```bash
# Build and generate catalog
pnpm -C packages/catalog build
pnpm -C packages/catalog generate

# Verify catalog data
pnpm -C packages/catalog test
```

**Relevant docs:**
- [low-level/data-contracts.md](../low-level/data-contracts.md)
- [reference/store-metadata.md](../reference/store-metadata.md)

## Troubleshooting

See [troubleshooting.md](../guides/troubleshooting.md) for:
- Installation issues
- Build and type-checking errors
- Mobile app crashes
- Test failures

## Performance Optimization

See [performance-optimization.md](../guides/performance-optimization.md) for:
- Profiling the engine
- Optimizing mobile app performance
- Reducing bundle size
- Benchmarking

## Deployment

See [deployment.md](../guides/deployment.md) for:
- Building for release
- Submitting to app stores
- Managing EAS credentials

## Contributing

See [contributing.md](../guides/contributing.md) for:
- Code style guidelines
- How to submit changes
- Testing expectations

---

For more information, see the full [documentation map](../README.md).
