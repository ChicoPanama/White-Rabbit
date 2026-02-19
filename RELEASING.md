# Release Process

This document describes how to release new versions of WhiteRabbit packages.

## Prerequisites

1. **npm access**: Must be a maintainer on the `@whiteclaws` npm organization
2. **GitHub access**: Write access to the repository
3. **GPG key**: For signing commits and tags (recommended)

## Versioning

We follow [Semantic Versioning](https://semver.org/):

- `MAJOR.MINOR.PATCH` for stable releases
- `MAJOR.MINOR.PATCH-alpha.N` for alpha pre-releases
- `MAJOR.MINOR.PATCH-beta.N` for beta pre-releases

Examples:
- `2.0.0` - Stable release
- `2.0.0-alpha.1` - First alpha
- `2.0.0-beta.2` - Second beta

## Automated Releases (Recommended)

### 1. Create and push a tag

```bash
# For core package
git tag -a "v2.0.0" -m "Release version 2.0.0"
git push origin v2.0.0

# For specific package
git tag -a "@whiteclaws/white-rabbit@2.0.0" -m "Release @whiteclaws/white-rabbit@2.0.0"
git push origin @whiteclaws/white-rabbit@2.0.0
```

### 2. GitHub Actions handles the rest

The release workflow will:
1. Run tests
2. Build packages
3. Publish to npm with provenance
4. Create GitHub release

## Manual Releases (Not Recommended)

Only use if automated releases fail:

### 1. Setup npm authentication

```bash
npm login
# Or use npm token
npm config set //registry.npmjs.org/:_authToken=$NPM_TOKEN
```

### 2. Build and test

```bash
cd packages/white-rabbit
npm ci
npm run build
npm test
```

### 3. Version bump

```bash
# Patch version
npm version patch

# Minor version
npm version minor

# Major version
npm version major

# Alpha pre-release
npm version prerelease --preid=alpha

# Beta pre-release
npm version prerelease --preid=beta
```

### 4. Publish

```bash
# Stable
npm publish --access public

# Alpha/Beta tag
npm publish --tag alpha --access public
npm publish --tag beta --access public
```

### 5. Push tags

```bash
git push origin main --tags
```

## Release Checklist

Before releasing:

- [ ] All tests pass
- [ ] CHANGELOG.md updated
- [ ] README.md updated (if needed)
- [ ] API.md updated (if needed)
- [ ] Version bumped correctly
- [ ] No secrets in code
- [ ] Security audit clean

## npm Tags

| Tag | Purpose |
|-----|---------|
| `latest` | Stable releases (default) |
| `alpha` | Early testing, may break |
| `beta` | Feature complete, testing |
| `next` | Next stable preview |

To install from a tag:

```bash
npm install -g @whiteclaws/white-rabbit@alpha
npm install -g @whiteclaws/white-rabbit@beta
```

## Troubleshooting

### Publish fails with 403

- Check npm token has publish access
- Verify package name is correct
- Ensure version doesn't already exist

### Provenance fails

- Requires npm 9.5.0+
- Must use `--provenance` flag
- GitHub Actions automatically handles this

### Tests fail during prepublish

- Run tests locally first: `npm test`
- Check for environment-specific issues
- Verify all dependencies installed

## Post-Release

After releasing:

1. Verify package installs correctly:
   ```bash
   npm install -g @whiteclaws/white-rabbit
   white-rabbit --version
   ```

2. Update documentation site

3. Announce in:
   - Discord
   - Twitter
   - Blog (for major releases)

4. Monitor for issues

## Emergency Releases

For critical security fixes:

1. Create fix branch from latest stable
2. Apply fix
3. Fast-track review
4. Release as patch version
5. Communicate urgency to users
