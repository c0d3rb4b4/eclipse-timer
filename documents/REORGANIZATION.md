# Documentation Reorganization Summary

## What Changed

The `/documents` folder has been reorganized from a flat structure into a logical, category-based hierarchy. This improves discoverability and makes it easier for contributors to find relevant documentation.

### Old Structure
```
documents/
├── README.md
├── 01-documentation-plan.md
├── CHANGELOG.md
├── in-app-alarm-rework-plan.md
├── release-plan-eas.md
├── self-hosted-macos-runner.md
├── store-metadata.md
├── store-privacy-declarations.md
├── tech-debt.md
├── testing-scenarios.md
├── wearable-companion-implementation-plan.md
├── high-level/
└── low-level/
```

### New Structure
```
documents/
├── README.md (updated with new organization)
├── guides/                              (NEW)
│   ├── setup-and-development.md        (NEW)
│   ├── contributing.md                 (NEW)
│   ├── deployment.md                   (NEW)
│   ├── troubleshooting.md              (NEW)
│   └── performance-optimization.md     (NEW)
├── high-level/                          (existing)
│   ├── development-workflow.md
│   ├── system-overview.md
│   ├── user-flow-and-product-behavior.md
│   └── wearable-companion-requirements.md
├── low-level/                           (existing)
│   ├── data-contracts.md
│   ├── engine-algorithm.md
│   ├── mobile-app-internals.md
│   └── wearable-companion-technical-design.md
├── planning/                            (NEW)
│   ├── 01-documentation-plan.md
│   ├── in-app-alarm-rework-plan.md
│   ├── release-plan-eas.md
│   ├── self-hosted-macos-runner.md
│   ├── tech-debt.md
│   └── wearable-companion-implementation-plan.md
└── reference/                           (NEW)
    ├── CHANGELOG.md
    ├── store-metadata.md
    ├── store-privacy-declarations.md
    └── testing-scenarios.md
```

## New Folders

### 📖 `guides/` - How-To Documentation
Practical guides for developers, maintainers, and contributors:

- **setup-and-development.md** – Installation, common commands, monorepo workflow
- **contributing.md** – Code style, testing, and submission guidelines
- **deployment.md** – Building for release, EAS, app store submission
- **troubleshooting.md** – Common issues and solutions
- **performance-optimization.md** – Profiling, bottlenecks, and optimization tips

### 📋 `planning/` - Planning & Proposals
Project planning documents, proposals, and tracking:

- **01-documentation-plan.md** – Documentation goals and standards
- **in-app-alarm-rework-plan.md** – Alarm system redesign proposal
- **wearable-companion-implementation-plan.md** – Wearable integration phases
- **release-plan-eas.md** – EAS build and release strategy
- **self-hosted-macos-runner.md** – CI/CD setup for native builds
- **tech-debt.md** – Known issues and improvement areas

### 📚 `reference/` - Reference Material
Metadata, release notes, and compliance documentation:

- **CHANGELOG.md** – Release history and version notes
- **store-metadata.md** – App store descriptions and keywords
- **store-privacy-declarations.md** – Privacy policy and data handling
- **testing-scenarios.md** – QA test cases and edge cases

## New Stub Documents Created

The following new documents were created as starting points and should be refined over time:

1. **guides/setup-and-development.md** – Refactored from high-level/development-workflow.md
2. **guides/contributing.md** – New contributor guide with code style and workflow
3. **guides/deployment.md** – Complete guide for building and releasing
4. **guides/troubleshooting.md** – Comprehensive troubleshooting for all layers
5. **guides/performance-optimization.md** – Profiling and optimization strategies

## Benefits

✅ **Better Organization** – Documents are grouped by purpose, not just type  
✅ **Faster Discovery** – Readers find what they need by category  
✅ **Clear Paths** – README now provides role-based reading paths  
✅ **Easier Maintenance** – Related docs live together  
✅ **Scalable** – New guides/reference docs fit naturally into existing structure  
✅ **Comprehensive** – Filled gaps in documentation (setup, deployment, troubleshooting)

## What Didn't Change

- **high-level/** – All architecture and behavior docs remain as-is
- **low-level/** – All implementation and algorithm docs remain as-is
- **Document content** – No existing content was modified (only organization)

## Next Steps

1. **Review** the new guides to ensure they meet your team's needs
2. **Update** guides/setup-and-development.md if development workflow differs
3. **Customize** guides/deployment.md with your team's specific deployment process
4. **Link** the main README in your root repo if there's one
5. **Communicate** the new structure to your team

---

For questions or updates to the documentation structure, see [README.md](README.md) and [planning/01-documentation-plan.md](planning/01-documentation-plan.md).
