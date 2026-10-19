# Development and CI

Use the latest stable Bun release, with Bun >=1.4.2 required by `engines.bun`. There is no fixed `packageManager` version pin; dependency installs remain locked.

```bash
bun install --frozen-lockfile
bun run ci
bun pm pack --dry-run
```

## Automatic CI toolchain policy

Push and pull-request CI is provider-free: it runs `bun run ci`, `bun pm pack --dry-run`, and an isolated tarball install/import smoke. The smoke disables lifecycle scripts, removes `KIRO_API_KEY`, sets `PI_OFFLINE=1`, and imports the package without a live acceptance or extension session. The single lane checks that the running Bun version matches the setup action's resolved version, enforces Bun >=1.4.2 using `Bun.semver`, and logs the selected Bun version and the path and version of `cc`.

| Lane | Bun | Pi graph | Install |
| --- | --- | --- | --- |
| latest stable Bun | `latest` (>=1.4.2) | none — this package has no Pi dependency | `bun install --frozen-lockfile` |

`@pi/presence` is intentionally Bun-only. CI follows the latest stable Bun release without adding an unnecessary Pi package or allowing a wildcard dependency to select a current Pi version. The former Bun-only matrix is collapsed into this single lane without removing install/import coverage. This describes the hosted-CI configuration, not a locally performed reinstall or live integration result.
