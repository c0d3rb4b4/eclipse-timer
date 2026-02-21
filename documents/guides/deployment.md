# Deployment Guide

## Overview

This guide covers deploying the Eclipse Timer mobile app to production via EAS (Expo Application Services) and managing releases across platforms.

## Release Channels

- **Production**: Stable, tested releases for end users
- **Beta**: Pre-release testing for internal testers and early adopters
- **Development**: Continuous builds for development and QA

## Prerequisites

- **EAS CLI**: `npm install -g eas-cli`
- **EAS Account**: Sign up at [expo.dev](https://expo.dev)
- **Project credentials**: Already configured in `eas.json`
- **Signing keys**: Managed by EAS (automatic or manual)

See [setup-and-development.md](setup-and-development.md) for full setup instructions.

## Deployment Process

### Step 1: Prepare for Release

1. **Update version numbers** in `apps/mobile/package.json` and `apps/mobile/app.json`
2. **Update CHANGELOG** in `documents/reference/CHANGELOG.md`
3. **Test locally:**
   ```bash
   cd apps/mobile
   pnpm dev
   ```

### Step 2: Build and Submit

#### For Android
```bash
cd apps/mobile
eas build --platform android --auto-submit
```

#### For iOS
```bash
cd apps/mobile
eas build --platform ios --auto-submit
```

#### For Both Platforms
```bash
cd apps/mobile
eas build --auto-submit
```

### Step 3: Monitor the Build

- Check build status at [expo.dev](https://expo.dev)
- Review logs for any warnings or errors
- Once built, the app is automatically submitted to app stores

### Step 4: Release Notes

- Add release notes in app store consoles (Google Play, Apple App Store)
- Reference the CHANGELOG for user-facing changes
- Include any new features or bug fixes

## Environment Configuration

### Build Variables

Critical environment variables are defined in `eas.json`:
- `SENTRY_AUTH_TOKEN`: For error tracking (optional)
- `SEGMENT_WRITE_KEY`: For analytics (optional)

To add new build variables:
1. Update `eas.json` with new environment variables
2. Document in [troubleshooting.md](troubleshooting.md) if they're user-configurable

## Self-Hosted Runner (macOS)

For builds requiring a macOS machine (e.g., custom native code):

See [self-hosted-macos-runner.md](../planning/self-hosted-macos-runner.md) for detailed setup.

## Rollback and Hotfixes

### Emergency Hotfix

If a critical bug is found post-release:

1. Create a hotfix branch from the release tag
2. Fix the issue
3. Increment patch version (e.g., 1.0.0 → 1.0.1)
4. Follow the deployment process above

## Monitoring Post-Deployment

- **Crash reports**: Check Sentry dashboard (if configured)
- **User feedback**: Monitor app store reviews
- **Performance**: Check analytics for any degradation

## Troubleshooting

See [troubleshooting.md](troubleshooting.md) for common build and deployment issues.

## References

- [EAS Build Documentation](https://docs.expo.dev/eas-update/introduction/)
- [release-plan-eas.md](../planning/release-plan-eas.md) – EAS-specific planning notes
- [setup-and-development.md](setup-and-development.md) – Development setup

---

For further help, see the main [documentation map](../README.md).
