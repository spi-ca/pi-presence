# Coordinated completion audit

Date: 2026-08-19

This tracked record replaces the stale untracked workspace audit as the coordinated audit record. Requested implementation, documentation, and test findings are fixed and locally verified. No pull request for this set has been created or merged. Native macOS/cmux live validation remains unavailable, so this record does not claim it.

## Findings and dispositions

| ID | Severity | Repository | Current locations | Disposition |
| --- | --- | --- | --- | --- |
| PRES-001 | High | `pi-presence` | `src/registry.ts`; `test/registry.test.ts` | Fixed on the current branch: stale consumer-fence handling. |
| PRES-002 | Medium | `pi-presence` | `src/types.ts`; `src/schema.ts`; `test/types.test.ts`; `test/protocol.test.ts` | Fixed: type and parser contracts agree. |
| SUB-001 | Medium | `pi-subagent` | `pi-subagent/index.ts`; `pi-subagent/test/entrypoint/index.test.ts` | Fixed: scheduler startup publication is current. |
| SUB-002 | Low | `pi-subagent` | `pi-subagent/test/integration/pi-presence-producer.test.ts` | Fixed: newest-terminal fixture ordering. |
| HERDR-001 | Medium | `pi-herdr-presence` | `pi-herdr-presence/src/runtime.ts`; `pi-herdr-presence/test/runtime-startup-regressions.test.ts`; `pi-herdr-presence/test/runtime-lifecycle-safety.test.ts` | Fixed: startup live notifications are not lost. |
| HERDR-002 | Medium | `pi-herdr-presence` | `pi-herdr-presence/src/todo.ts`; `pi-herdr-presence/src/runtime.ts`; `pi-herdr-presence/test/state.test.ts`; `pi-herdr-presence/test/runtime-startup-regressions.test.ts`; `pi-herdr-presence/test/runtime-lifecycle-safety.test.ts` | Fixed: Todo ownership resets at root-session boundaries while stale callbacks remain fenced. |
| ASK-001 | Low | `pi-ask-user` | `pi-ask-user/README.md` | Fixed: installation references are immutable. |
| ASK-002 | Low | `pi-ask-user` | `pi-ask-user/README.md`; `pi-ask-user/AGENTS.md`; `pi-ask-user/docs/development.md` | Fixed: schema and CI claims match the current project. |
| CMUX-001 | Low | `pi-cmux-presence` | `pi-cmux-presence/test/state.test.ts`; `pi-cmux-presence/test/v2-integration.test.ts` | Fixed: late-consumer handling no longer yields a false positive. |
| AUDIT-001 | Low | Coordinated documentation | `docs/completion-audit.md` | Fixed: lower-severity findings now have stable IDs and locations. |
| NATIVE-001 | Blocker | Native macOS/cmux environment | `pi-subagent/test/fixtures/transport-performance-phase0-live-routine.json`; `pi-subagent/test/fixtures/transport-performance-phase0-live-concurrency.json` | Open external evidence gap, not a code defect. The local Linux `bun run acceptance:dry-run` reaches live-evidence verification and fails because both fixtures remain bound to an older source revision; they must be re-recorded in the authorized native environment rather than fabricated locally. |

Herdr intentionally keeps the fixed `Pi` title. It projects no prompt, current working directory, task, or path; prior rich-title claims are not current behavior.

## Local validation evidence

| Repository | Current command | Observed result |
| --- | --- | --- |
| `pi-presence` | `bun run ci` | TypeScript check and 31 tests passed. |
| `pi-ask-user` | `bun run ci` | 220 passed. |
| `pi-subagent` | `bun run ci` | 1,003 passed; 3 skipped. Local Phase 0/7 evidence verifies; native live evidence remains `NATIVE-001`. |
| `pi-cmux-presence` | `bun run ci` | 185 passed. |
| `pi-herdr-presence` | `bun run ci` | 165 passed. |

These are local/package-level results. They neither create nor merge PRs and do not replace `NATIVE-001`.

## Release sequencing

The `pi-presence` change requires an immutable release or ref before a consumer package updates its dependency. This coordinated set does not move any `pi-presence` pin to a feature branch.
