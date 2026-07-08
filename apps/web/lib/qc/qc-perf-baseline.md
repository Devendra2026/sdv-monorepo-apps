# QC Performance Marks (baseline)

This file documents the lightweight client-side performance marks/measures added for the QC module.

## How to read these marks

1. Open the browser DevTools.
2. Go to the Performance tab and start a recording.
3. Trigger the relevant QC interaction (navigate to `/qc`, switch registry tabs, open a review, approve).
4. Stop the recording and filter in the Performance timeline for the mark names below.

## Mark names

### Command center

- `qc.command_center.mount`
  - Emitted once when the QC command center page mounts.

### Review page

- `qc.review.content_ready.{id}`
  - Emitted when the `survey` backing the review page becomes available (not `undefined` and not `null`).

### Approve round-trip

- `qc.approve.start`
- `qc.approve.end`
- Measure: `qc.approve.roundtrip` between the start/end marks.
  - Emitted when the QC approve action mutation resolves.

### Registry tab switching

For each tab switch in `/qc/registry`:

- `qc.registry.tab_switch.start.{tab}.{now}`
- `qc.registry.tab_switch.end.{tab}`
- Measure: `qc.registry.tab_switch` between the start/end marks.

## Notes

- These marks are intentionally gated to non-production builds via `NODE_ENV !== "production"` in `qc-perf.ts`.
- Since QC pages are fully client rendered, cold-start targets (100ms) are unrealistic without server preloads; structural work in later phases addresses this.
