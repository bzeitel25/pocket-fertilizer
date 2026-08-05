# Garden/Plot tab — 2026-08-05 · shipped

This was the plan for the bed screen. **It is all built.** The notes are kept because the
diagnoses are worth having on record — three of the four original complaints turned out to
have a specific, findable cause rather than being missing features.

See `CLAUDE.md` for how the new parts fit together. Everything below is done.

## What was actually wrong

**The snap toggle was two toggles.** Grid snap (`bed.snap_in`) already had a chip. The one
buried in the shape sheet was *companion magnetism* (`CanvasDrag.magnet`) — and it was an
in-memory flag that reset to on at every launch, so even when you found it, it did not
stick. Now a 🧲 Snap chip on the bed toolbar, stored in settings.

**The variety picker was never removed.** It was always at `p8m_canvasui.js:275`, inside
`Garden.plantingSheet`. `Garden.tapAt` *toggled* selection and only opened the sheet on the
tap that selected — and a freshly placed plant is already selected, so the next tap
deselected it and nothing opened. Fixed at the root (a tap on a plant always opens it; bare
soil deselects) and given a dedicated ⋯ button bottom-left of the selected plant, with a
bed-relative transparent hit target behind it.

**The hearts were sized by `Math.max(2.4, rc * 0.42)`** — a hard 2.4-inch *radius* floor in
garden units. On a radish that is a badge wider than the plant. Now a fraction of the bed,
capped against the plant's own canopy, sitting outboard of it rather than on top.

**Zoom works because `Canvas.toIn` reads the live viewBox.** Implemented as a viewBox
change, so pinch, pan, tap, press-and-hold drag, the resize handle and the ⋯ button all
stayed correct with no changes to any of them. A CSS transform would have broken all six.

**Micro-climate did not cover orientation, and could not have.** Its photo bearings
describe the *site* — they build the eight-sector horizon `Solar` reads. Nothing ever told
the app which way the *drawing* pointed. `Recommend.shading` was assuming north-up, and
computing a `north` flag it then never used, so it flagged plants standing on the sunny
side of a tall crop. `beds.north_deg` closes it.

## Also shipped

Undo (remove, move, resize, place, clear, duplicate, template) · multi-select with group
move/remove/duplicate · "Would go well here" built from what is already planted · watering
grouped by need · saved bed layouts stored as fractions · iCalendar export with stable UIDs.

600 smoke checks, 26 camera checks.

## Still on the list

Ranked, from the original plan:

1. **"Where does this go?"** — the inverse of the recommendation list. Pick a crop and the
   bed washes green where it would be happy. All the maths already exists in `Canvas.flags`,
   `Geom.relation` and `Recommend.crowding`; it needs a heatmap render pass.
2. **Succession** — the scrubber already knows when each plant clears. Scrub to September
   and light up ground that is free, with what could still be sown there and beat frost.
3. **Rotation warnings on placement** — `Recommend.recentFamilies` is read for the history
   panel but never warns at the moment you drop a solanaceae where one grew last year.
4. **Export the plan** — a PNG or PDF of the bed at a chosen date, to print for the shed.
   `Gmap.snapshot()` already does this for the plot map.
5. **Measure tool** — tap two points, get the distance. Trivial against `Geom`.
