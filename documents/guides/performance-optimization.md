# Performance Optimization Guide

## Overview

This guide explains how to profile, identify bottlenecks, and optimize the Eclipse Timer app across the engine, mobile app, and catalog.

## Key Metrics

- **Time to Interactive (TTI)**: How long until the user can interact with the app
- **Frame Rate**: Smooth 60 FPS (or 120 FPS on high-refresh devices)
- **Engine Calculation Time**: Sub-second for typical location/date queries
- **Memory Usage**: Keep resident memory under 150MB on low-end devices
- **Bundle Size**: Keep app bundle under 50MB uncompressed

## Engine Performance

### Profiling Calculations

For eclipse calculations, measure computation time:

```javascript
const start = performance.now();
const circumstances = computeCircumstances(...);
const end = performance.now();
console.log(`Calculation took ${end - start}ms`);
```

**Expected times:**
- Single eclipse: <100ms
- Batch of 100 eclipses: <500ms
- Catalog generation: <5s

See [low-level/engine-algorithm.md](../low-level/engine-algorithm.md) for algorithm details.

### Common Bottlenecks

1. **Root solving**: Many iterations for low-latitude eclipses
   - Solution: Use adaptive tolerance based on precision requirements
2. **Catalog lookups**: O(n) search over all eclipses
   - Solution: Index by century or use binary search
3. **Type conversions**: Repeated string/number conversions
   - Solution: Use type-safe pipelines and avoid unnecessary conversions

### Optimization Checklist

- [ ] Use memoization for repeated calculations with same inputs
- [ ] Batch calculations when possible (e.g., compute multiple eclipses at once)
- [ ] Avoid floating-point precision issues with epsilon comparisons
- [ ] Profile critical paths with `performance.now()`

---

## Mobile App Performance

### Frame Rate & Responsiveness

#### Check Frame Rate

```bash
adb shell dumpsys gfxinfo > /tmp/frames.txt
# Look for "Janky frames" stat
```

#### Common Causes of Jank

1. **Main thread blocking**: Long computations during render
   - Solution: Move to background thread or worker
2. **Excessive re-renders**: Components updating unnecessarily
   - Solution: Use `React.memo`, `useMemo`, `useCallback`
3. **Heavy lists**: Rendering large lists without virtualization
   - Solution: Use FlatList with `removeClippedSubviews`

### Memory Optimization

#### Monitor Memory

```bash
adb shell dumpsys meminfo <app-package-id>
```

#### Common Causes of Memory Leaks

1. **Unsubscribed listeners**: Event listeners not cleaned up
   - Solution: Use cleanup in `useEffect` hooks
2. **Circular references**: Objects referencing each other
   - Solution: Use weak references for caches
3. **Large image assets**: Unscaled images in memory
   - Solution: Scale images to display size before rendering

### Bundle Size

#### Check Bundle Size

```bash
cd apps/mobile
pnpm build
# Review the generated APK/IPA size
```

#### Reduce Bundle Size

- Tree-shake unused code in dependencies
- Use dynamic imports for large features
- Compress assets (PNG → WebP)
- Remove unused fonts

### Profiling Tools

#### React Native Debugger

```bash
# Start the debugger
react-native start

# In another terminal
react-native run-android  # or run-ios
```

#### Flipper

```bash
# Flipper provides frame inspection, network monitoring, logs
# Install: https://fbflipper.com/
```

---

## Catalog Performance

### Generation Time

Catalog generation should complete in under 5 seconds:

```bash
cd packages/catalog
pnpm build
# Time the script
time node scripts/generate-catalog.js
```

### Data Size

Monitor generated JSON file sizes:

```bash
ls -lh packages/catalog/generated/
```

**Typical sizes:**
- `catalog.generated.json`: ~10-20MB (uncompressed), ~2-3MB (gzipped)
- Individual overlays: ~5-15MB each

### Optimization Tips

- Use efficient serialization (avoid redundant keys)
- Compress with gzip for transmission
- Lazy-load overlays only when needed
- Index catalog for O(log n) lookups

---

## Testing Performance

### Benchmark Suite

Create simple benchmarks:

```javascript
// benchmark.test.ts
describe('Performance', () => {
  it('should calculate 100 eclipses in under 500ms', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      computeCircumstances(...);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });
});
```

### Run Benchmarks

```bash
pnpm test -- --grep "Performance"
```

---

## Real-World Profiling

### Profile on Real Device

1. **Build for release** (not debug):
   ```bash
   cd apps/mobile
   eas build --platform android --release
   ```
2. **Install on device**
3. **Use Chrome DevTools** or Flipper to inspect performance
4. **Look for**:
   - Slow renders (> 16ms per frame)
   - Memory spikes during interactions
   - Network latency

### Identify Slow Operations

1. Add `console.time()` / `console.timeEnd()` around suspect code
2. Review React component render counts with DevTools
3. Check network requests with Flipper or Chrome DevTools
4. Profile CPU usage with platform-specific tools (Instruments on iOS, Android Studio Profiler on Android)

---

## Optimization Priorities

### High Impact (Do First)

1. Reduce main-thread blocking in engine calculations
2. Memoize expensive calculations and component renders
3. Optimize list rendering with virtualization

### Medium Impact

4. Reduce bundle size by tree-shaking
5. Optimize images and assets
6. Use lazy loading for features

### Low Impact (Polish)

7. Fine-tune animation performance
8. Optimize CSS/styling
9. Profile and optimize edge cases

---

## Monitoring Production

### Error Tracking

- Use Sentry for crash reports and performance monitoring
- Configure in `eas.json` with `SENTRY_AUTH_TOKEN`

### Analytics

- Track slow operations and device-specific issues
- Monitor battery and memory usage patterns

---

## References

- [React Native Performance Documentation](https://reactnative.dev/docs/performance)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)
- [low-level/engine-algorithm.md](../low-level/engine-algorithm.md)
- [deployment.md](deployment.md)

---

For more information, see the main [documentation map](../README.md).
