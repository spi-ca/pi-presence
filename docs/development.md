# Development and CI

Use the Bun version declared by `packageManager` for the locked local baseline.

```bash
bun install --frozen-lockfile
bun run ci
bun pm pack --dry-run
```

## Automatic CI compatibility matrix

Push and pull-request CI is provider-free: it runs `bun run ci`, `bun pm pack --dry-run`, and an isolated tarball install/import smoke. The smoke disables lifecycle scripts, removes `KIRO_API_KEY`, sets `PI_OFFLINE=1`, and imports the package without a live acceptance or extension session. Every lane logs the selected Bun version and the path and version of `cc`.

| Lane | Bun | Pi graph | Install |
| --- | --- | --- | --- |
| locked baseline | 1.3.14 (`packageManager`) | none — this package has no Pi dependency | `bun install --frozen-lockfile` |
| current compatibility | 1.4.2 | none — this package has no Pi dependency | `bun install --frozen-lockfile` |

`@pi/presence` is intentionally Bun-only. The matrix validates its declared Bun 1.3.14 baseline and Bun 1.4.2 runtime compatibility without adding an unnecessary Pi package or allowing a wildcard dependency to select a current Pi version. This describes the hosted-CI configuration, not a locally performed reinstall or live integration result.
