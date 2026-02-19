# Publishing to npm

## Prerequisites

1. npm account with access to `@whiteclaws` organization
2. Logged in: `npm login`
3. 2FA enabled on npm account

## Build All Packages

```bash
cd White-Rabbit
npm install
npm run build
```

## Test Locally

```bash
# Test white-rabbit
node packages/white-rabbit/dist/bin/cli.js --version

# Test MCP
node packages/mcp/dist/index.js --version
```

## Publishing

### Alpha Release (for testing)

```bash
npm run publish:alpha
```

This publishes with the `alpha` tag:
- `@whiteclaws/white-rabbit@2.0.0-alpha.1`
- `@whiteclaws/mcp-white-rabbit@2.0.0-alpha.1`

Users can install with:
```bash
npm install -g @whiteclaws/white-rabbit@alpha
```

### Latest Release (production)

```bash
npm run publish:latest
```

This publishes as the default version.

## Manual Publishing

If you need more control:

```bash
# Publish white-rabbit
cd packages/white-rabbit
npm publish --access public

# Publish MCP
cd ../mcp
npm publish --access public
```

## Version Bumping

```bash
# Bump all packages
npm version patch --workspaces  # 2.0.0 -> 2.0.1
npm version minor --workspaces  # 2.0.0 -> 2.1.0
npm version major --workspaces  # 2.0.0 -> 3.0.0
```

## Post-Publish Verification

```bash
# Clear npm cache
npm cache clean --force

# Install globally
npm install -g @whiteclaws/white-rabbit

# Test
white-rabbit --version
white-rabbit chains
white-rabbit engines
```

## Troubleshooting

### "You do not have permission"
- Ensure you're a member of the `@whiteclaws` npm organization
- Check: `npm access ls-packages @whiteclaws`

### "Cannot find module"
- Ensure you built before publishing: `npm run build`
- Check `.npmignore` isn't excluding necessary files

### "Version already exists"
- Bump version: `npm version patch --workspaces`
- Or unpublish (within 24h): `npm unpublish @whiteclaws/white-rabbit@version`
