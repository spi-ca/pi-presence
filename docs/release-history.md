# Release history

Published tags are immutable historical records. They are never moved or recreated.

| Tag | Status | Notes |
| --- | --- | --- |
| [`v2-20260818-1`](https://github.com/spi-ca/pi-presence/tree/v2-20260818-1) | Published | Initial V2 release record. |
| [`v2-20260818-2`](https://github.com/spi-ca/pi-presence/tree/v2-20260818-2) | Published | Finalized V2 release contract. |
| [`v2-20260820-1`](https://github.com/spi-ca/pi-presence/tree/v2-20260820-1) | Published | Runtime-efficiency release. |
| [`v2-20260828-1`](https://github.com/spi-ca/pi-presence/tree/v2-20260828-1) | Published | Corrected registry release with the ABI4 version-skew fence. |
| [`v2-20260907-1`](https://github.com/spi-ca/pi-presence/tree/v2-20260907-1) | Published | Compatibility and CI validation hardening; the V2 contract and runtime API are unchanged. |
| [`v2-20261001-1`](https://github.com/spi-ca/pi-presence/tree/v2-20261001-1) | Published | Pi 0.99.2 coordinated alias of source commit `78256300e166b40e7a627c321fa0eb9a9e4e2b89`; no protocol, ABI, or runtime API change. |
| [`v2-20261004-1`](https://github.com/spi-ca/pi-presence/tree/v2-20261004-1) | Published | Pi 1.0.2 coordinated alias of the same source commit. |
| [`v2-20261009-1`](https://github.com/spi-ca/pi-presence/tree/v2-20261009-1) | Published | Pi 1.1.0 coordinated alias of the same source commit, with a source package and SHA256SUMS. |
| [`v2-20261013-1`](https://github.com/spi-ca/pi-presence/tree/v2-20261013-1) | Canonical release target | Pi 1.2.0 coordinated batch; release documentation only, with runtime source, protocol, DTOs, API, and private ABI generation unchanged from `v2-20261009-1`. |

`v2-20261013-1` is the canonical coordinated release reference. The target row is not evidence of publication: the GitHub release and its immutable tag record publication after independent review and exact-head PR, merged-head, and triggered tag CI gates pass. Earlier tags remain immutable historical records. All producers and consumers in one runtime must pin the same release.

This dependency-free package's Bun validation does not prove Pi host-version or live terminal acceptance; consumer integration evidence must be evaluated separately.
