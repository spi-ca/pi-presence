# Coordinated completion audit

Date: 2026-08-28

**Canonical published release:** [`v2-20260907-1`](https://github.com/spi-ca/pi-presence/tree/v2-20260907-1) is the immutable canonical release with compatibility and CI validation hardening. The private registry ABI-generation fence detects known ABI3/ABI4 version skew only; public protocol version `2`, V2 channels, DTOs, and runtime API are unchanged. Published and historical tags are preserved in [`release-history.md`](release-history.md).

This tracked record replaces the stale untracked workspace audit. Historical pull requests are merged. Native macOS/cmux live validation remains unavailable, so this record does not claim it.

## Findings and dispositions

| ID | Severity | Repository | Current locations | Disposition |
| --- | --- | --- | --- | --- |
| PRES-001 | High | `pi-presence` | `src/registry.ts`; `test/registry.test.ts` | Fixed: stale consumer-fence handling. |
| PRES-002 | Medium | `pi-presence` | `src/types.ts`; `src/schema.ts`; `test/types.test.ts`; `test/protocol.test.ts` | Fixed: type and parser contracts agree. |
| PRES-003 | High | `pi-presence` | `src/registry.ts`; `test/registry.test.ts`; `test/fixtures/registry-abi3-v2-20260820-1.ts` | Fixed in `v2-20260828-1` and retained by canonical `v2-20260907-1`: ABI4 rejects ABI3 registry authority in either load order using the executable immutable-tag-derived fixture; proxied facade methods also fail closed. |
| SUB-001 | Medium | `pi-subagent` | `pi-subagent/index.ts`; `pi-subagent/test/entrypoint/index.test.ts` | Fixed: scheduler startup publication is current. |
| SUB-002 | Low | `pi-subagent` | `pi-subagent/test/integration/pi-presence-producer.test.ts` | Fixed: newest-terminal fixture ordering. |
| HERDR-001 | Medium | `pi-herdr-presence` | `pi-herdr-presence/src/runtime.ts`; `pi-herdr-presence/test/runtime-startup-regressions.test.ts`; `pi-herdr-presence/test/runtime-lifecycle-safety.test.ts` | Fixed: startup live notifications are not lost. |
| HERDR-002 | Medium | `pi-herdr-presence` | `pi-herdr-presence/src/todo.ts`; `pi-herdr-presence/src/runtime.ts`; `pi-herdr-presence/test/state.test.ts`; `pi-herdr-presence/test/runtime-startup-regressions.test.ts`; `pi-herdr-presence/test/runtime-lifecycle-safety.test.ts` | Fixed: Todo ownership resets at root-session boundaries while stale callbacks remain fenced. |
| ASK-001 | Low | `pi-ask-user` | `pi-ask-user/README.md` | Fixed: installation references are immutable. |
| ASK-002 | Low | `pi-ask-user` | `pi-ask-user/README.md`; `pi-ask-user/AGENTS.md`; `pi-ask-user/docs/development.md` | Fixed: schema and CI claims match the current project. |
| CMUX-001 | Low | `pi-cmux-presence` | `pi-cmux-presence/test/state.test.ts`; `pi-cmux-presence/test/v2-integration.test.ts` | Fixed: late-consumer handling no longer yields a false positive. |
| AUDIT-001 | Low | Coordinated documentation | `docs/completion-audit.md` | Fixed: lower-severity findings have stable IDs and locations. |
| NATIVE-001 | Blocker | Native macOS/cmux environment | `pi-subagent/test/fixtures/transport-performance-phase0-live-routine.json`; `pi-subagent/test/fixtures/transport-performance-phase0-live-concurrency.json` | Open external evidence gap, not a code defect. The local Linux `bun run acceptance:dry-run` reaches live-evidence verification and fails because both fixtures remain bound to an older source revision; they must be re-recorded in the authorized native environment rather than fabricated locally. |

Herdr intentionally keeps the fixed `Pi` title. It projects no prompt, current working directory, task, or path; prior rich-title claims are not current behavior.

## Validation evidence

| Repository | Command / record | Observed result and scope |
| --- | --- | --- |
| `pi-presence` | `bun run ci` | Current canonical-package validation: lint, TypeScript check, and 35 tests passed. |
| `pi-ask-user` | Historical `bun run ci` | 220 passed. |
| `pi-subagent` | Historical `bun run ci` | 1,004 passed; 3 skipped. Local Phase 0/7 evidence verifies; native live evidence remains `NATIVE-001`. |
| `pi-cmux-presence` | Historical consumer `bun run ci` | 185 passed as ABI3 evidence; it is not ABI4 coordinated-validation evidence. |
| `pi-herdr-presence` | Historical consumer `bun run ci` | 165 passed as ABI3 evidence; it is not ABI4 coordinated-validation evidence. |

Historical package-level evidence does not replace `NATIVE-001` and does not prove ABI4 coordination.

## Historical merged pull requests

- `pi-presence` [#2](https://github.com/spi-ca/pi-presence/pull/2)
- `pi-ask-user` [#7](https://github.com/spi-ca/pi-ask-user/pull/7)
- `pi-subagent` [#14](https://github.com/spi-ca/pi-subagent/pull/14)
- `pi-cmux-presence` [#5](https://github.com/spi-ca/pi-cmux-presence/pull/5)
- `pi-herdr-presence` [#7](https://github.com/spi-ca/pi-herdr-presence/pull/7)

These are merged historical records, not newly created PRs or evidence of a new consumer ABI4 validation.

## Release sequencing

`v2-20260907-1` is the immutable canonical published release. Producers and consumers that share a runtime must pin the same `@pi/presence` release as coordinated release policy. Same-realm code is trusted; the registry does not authenticate it. The ABI-generation fence detects known ABI3/ABI4 skew and fails closed, but cannot prove coordinated same-release pinning. This durable policy does not move a `pi-presence` pin to a feature branch.
