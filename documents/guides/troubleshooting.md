# Troubleshooting Guide

## Common Issues and Solutions

### Development & Setup

#### `pnpm install` Fails

**Symptom:** Installation hangs or exits with dependency resolution errors.

**Solutions:**
1. Clear the pnpm cache:
   ```bash
   pnpm store prune
   ```
2. Delete lockfile and retry:
   ```bash
   rm pnpm-lock.yaml
   pnpm install
   ```
3. Ensure Node.js version is v18 or later:
   ```bash
   node --version
   ```

#### Module Not Found Errors

**Symptom:** `Cannot find module 'X'` during build or runtime.

**Solutions:**
1. Verify the package is installed:
   ```bash
   pnpm list <package-name>
   ```
2. Check imports are using correct paths (relative or absolute)
3. Ensure the package is exported from `index.ts` or `package.json` exports field
4. Reinstall dependencies:
   ```bash
   pnpm install
   ```

#### Type Errors in IDE

**Symptom:** TypeScript errors in VS Code even though `pnpm typecheck` passes.

**Solutions:**
1. Restart the TypeScript language server: `Cmd+Shift+P` → "TypeScript: Restart TS Server"
2. Ensure `tsconfig.json` paths are correctly configured
3. Rebuild the project:
   ```bash
   pnpm build
   ```

---

### Mobile App (React Native)

#### App Crashes on Startup

**Symptom:** App immediately closes after launch, possibly with a red error screen.

**Solutions:**
1. Check the logs:
   ```bash
   adb logcat --pid=$(adb shell pidof -s host.exp.exponent)
   ```
2. Verify the engine package is building correctly:
   ```bash
   cd packages/engine
   pnpm build
   ```
3. Clear the app cache on the device:
   ```bash
   adb shell pm clear <app-package-id>
   ```
4. Reinstall the app:
   ```bash
   cd apps/mobile
   pnpm dev
   ```

#### Map or Location Issues

**Symptom:** Map doesn't load, or location permission is always denied.

**Solutions:**
1. Check location permissions in device settings
2. On emulator: Set a mock location via Android Studio / Xcode
3. Verify GPS coordinates are valid (latitude: -90 to 90, longitude: -180 to 180)
4. Restart the emulator or device

#### Performance Issues

**Symptom:** App is sluggish, scrolling is janky, or calculations are slow.

**Solutions:**
1. Profile the app: See [performance-optimization.md](performance-optimization.md)
2. Check if heavy computations are running on the main thread
3. Reduce render count: Memoize components with `React.memo`
4. Clear app data and rebuild:
   ```bash
   adb shell pm clear <app-package-id>
   cd apps/mobile
   pnpm dev
   ```

---

### Engine (Eclipse Calculations)

#### Incorrect Eclipse Times or Coordinates

**Symptom:** Calculated eclipse times don't match NASA or other references.

**Solutions:**
1. Verify the input catalog data is correct: `packages/catalog/generated/catalog.generated.json`
2. Check that the location coordinates are correctly formatted (degrees, not radians)
3. Ensure time zones are handled correctly (use UTC internally)
4. Review the algorithm: See [low-level/engine-algorithm.md](../low-level/engine-algorithm.md)
5. Run the unit tests:
   ```bash
   cd packages/engine
   pnpm test
   ```

#### Build or Import Errors in Engine

**Symptom:** `pnpm build` fails or runtime errors occur when importing engine functions.

**Solutions:**
1. Ensure the shared package is built:
   ```bash
   cd packages/shared
   pnpm build
   ```
2. Check the type exports in `packages/shared/src/index.ts`
3. Verify the catalog package is generated:
   ```bash
   cd packages/catalog
   pnpm build
   ```

---

### Deployment & EAS

#### EAS Build Fails

**Symptom:** Build fails on EAS servers.

**Solutions:**
1. Check the build logs on [expo.dev](https://expo.dev)
2. Verify `eas.json` configuration is correct
3. Ensure all environment variables are set:
   ```bash
   eas env:pull
   ```
4. Test locally first:
   ```bash
   cd apps/mobile
   pnpm build
   ```

#### App Submission to Store Fails

**Symptom:** EAS Build succeeds, but submission fails.

**Solutions:**
1. Check Google Play or Apple App Store rejection reasons
2. Verify signing certificates are valid and not expired
3. Review app store metadata (description, screenshots, privacy policy)
4. See [deployment.md](deployment.md) for submission checklist

---

### Testing

#### Tests Fail Unexpectedly

**Symptom:** `pnpm test` fails with cryptic errors.

**Solutions:**
1. Run tests in verbose mode:
   ```bash
   pnpm test -- --reporter=verbose
   ```
2. Run a single test file:
   ```bash
   pnpm test <test-file-path>
   ```
3. Clear test cache:
   ```bash
   pnpm test -- --clearCache
   ```

#### Flaky Tests

**Symptom:** Tests pass sometimes, fail other times.

**Solutions:**
1. Check for timing issues: Use `vi.useFakeTimers()` if needed
2. Isolate external dependencies with mocks
3. Increase timeout for long-running tests:
   ```javascript
   vi.setConfig({ testTimeout: 10000 });
   ```

---

### General

#### Clean Build

If you encounter strange errors, try a clean build:

```bash
pnpm clean       # Remove all build artifacts
pnpm install
pnpm build
pnpm test
```

#### Check Environment

Verify your system is properly configured:

```bash
node --version          # Should be v18+
pnpm --version         # Should be v8+
npm list -g eas-cli   # Should be installed if doing deployment
```

#### Enable Debug Logging

For detailed debugging:

```bash
# Enable verbose logging for pnpm
pnpm --loglevel warn install

# Enable Node.js debugging
NODE_DEBUG=* pnpm dev
```

---

## Still Stuck?

1. **Search existing issues**: Check the project's GitHub issues
2. **Review documentation**: See the full [documentation map](../README.md)
3. **Check logs carefully**: Most issues have hints in error messages or logs
4. **Ask for help**: Open an issue or reach out to the team

---

For more information, see [setup-and-development.md](setup-and-development.md) and [performance-optimization.md](performance-optimization.md).
