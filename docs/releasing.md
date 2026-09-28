# Releasing

1. Update `CHANGELOG.md` and bump `version` in `package.json` (semver).
2. `npm ci && npm run format:check && npm run lint && npm run typecheck && npm run coverage && npm run build && npm run size`
3. `npm pack --dry-run` — check that only `miniprogram_dist/`, READMEs, LICENSE and CHANGELOG are included.
4. Commit `chore(release): vX.Y.Z`, tag `git tag -a vX.Y.Z -m "vX.Y.Z"`, push commits and tag.
5. Publish (owner only, requires npm 2FA): `npm publish --access public`.
6. Create the GitHub release from the tag with the changelog section.
