# Code Health Audit

## Terminology

In development language, this review is a:
- **Code health audit**
- **Technical debt / robustness review**
- **Stability risk assessment**

## Scope

Read-only review of brittle and inconsistent behavior across:
- `src/ui/**` (especially `ui.tsx`, store, navigation/state/effects)
- `src/core/main.ts`
- `src/services/event-handlers.ts`
- Preview/update/snapshot pipelines

No code changes are proposed in this file; this is a risk inventory.

## Executive Summary

The codebase delivers complex behavior but has several **high-risk coupling points**:
- Competing/duplicated state pipelines
- Event-order sensitivity in async flows
- Fragmented naming/snapshot contracts

Most serious regressions are likely to show up as:
- "state got overwritten unexpectedly"
- "preview/canvas out of sync"
- "loading existing specimen behaves inconsistently"

## Findings (By Severity)

### High

1. **Competing style recalculation effects**
   - **Where:** `src/ui/ui.tsx`
   - **Why brittle:** Multiple effects recalculate and set `fineTunedStyles` with overlapping responsibilities.
   - **Impact:** Race-like overwrite behavior, inconsistent override preservation, hard-to-predict restore outcomes.

2. **Stale closure risk in preview update effect**
   - **Where:** `src/ui/ui.tsx`
   - **Why brittle:** Preview emit effect reads values that are not always fully represented in dependencies.
   - **Impact:** Canvas preview can lag behind UI changes (fonts, naming, mode details).

3. **Duplicated transformation pipeline**
   - **Where:** `src/ui/ui.tsx`, `src/ui/components/FooterSection.tsx`, `src/ui/components/StylesGridSection.tsx`, `src/ui/screens/GeneratorScreen.tsx`
   - **Why brittle:** Font-source mapping + rounding chain repeated at many call sites.
   - **Impact:** Drift across paths; one flow applies different transforms than another.

4. **Global mutable runtime state in main thread**
   - **Where:** `src/core/main.ts`, `src/services/event-handlers.ts`
   - **Why brittle:** Shared module-level mutable variables used across async handlers.
   - **Impact:** Ordering hazards when selection, preview, and update events interleave.

5. **Text-generation vs document-change timing hazards**
   - **Where:** `src/core/main.ts`, `src/services/event-handlers.ts`
   - **Why brittle:** Guarding with flags/timestamps is heuristic and timing-sensitive.
   - **Impact:** Occasional text mirroring/overwrite anomalies during or after animated updates.

6. **Naming conversion logic is fragmented**
   - **Where:** `src/ui/naming-conventions.ts`, `src/services/utils.ts`, `src/core/main.ts`
   - **Why brittle:** Same mapping concept implemented in multiple places with different assumptions.
   - **Impact:** Inconsistent behavior across scan/import/create/update paths.

### Medium

7. **Snapshot version exists, migration path is not centralized**
   - **Where:** `src/core/types.ts`, `src/core/main.ts`, `src/ui/ui.tsx`
   - **Why brittle:** Version field present, but compatibility handling is distributed and partial.
   - **Impact:** Older specimen snapshots can restore with partial state mismatch.

8. **Multiple preview update pathways with different semantics**
   - **Where:** `src/services/event-handlers.ts`, `src/preview/preview-manager.ts`, `src/preview/preview-updater.ts`
   - **Why brittle:** Create vs update paths are not fully unified in contracts/processing order.
   - **Impact:** "Works on create, fails on update" class bugs.

9. **Silent fallback patterns can hide correctness issues**
   - **Where:** `src/services/utils.ts`, `src/services/style-creator.ts`, `src/core/main.ts`
   - **Why brittle:** Try/catch + continue/default behavior masks root causes.
   - **Impact:** Wrong-but-non-crashing outcomes become harder to detect and debug.

10. **State duplication/mirroring increases complexity**
    - **Where:** `src/ui/ui.tsx`, `src/ui/store/appStore.ts`
    - **Why brittle:** Local mirrors and layered effects increase synchronization burden.
    - **Impact:** More chances for subtle desync and regressions.

### Low

11. **Legacy route/state artifacts remain**
    - **Where:** `src/ui/ui.tsx`, `SCREENS_AND_STATES.md` references
    - **Why brittle:** Old paths remain partially wired.
    - **Impact:** Cognitive overhead, accidental reactivation risk.

12. **Contracts are partially implicit**
    - **Where:** Cross-file events and payload handling
    - **Why brittle:** Some consumers rely on optional fields without strict validation.
    - **Impact:** Breaks can be silent when payload shape drifts.

## Priority Buckets

- **P0 (stability first):**
  1) Unify style recalculation ownership in UI
  2) Consolidate preview transformation pipeline
  3) Harden event ordering around text generation/document change

- **P1 (consistency):**
  4) Single source of truth for naming conversion
  5) Centralized snapshot validation/migration layer
  6) Align create/update preview pathways

- **P2 (maintainability):**
  7) Reduce mirrored state/effect duplication
  8) Remove/cordon legacy route artifacts
  9) Improve explicit runtime warnings over silent fallback

## Practical Next Step (No Refactor Yet)

Create a short "hardening checklist" and gate every future related change by:
- one canonical data-flow owner per concern,
- one canonical transformation path,
- explicit event contract checks at boundaries.

