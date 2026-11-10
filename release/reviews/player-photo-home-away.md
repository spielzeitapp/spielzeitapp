# Home/away photo motifs

Existing `matchday`/`celebration` records are retained as home images. Two new purpose values add away images without changing the primary key, RLS, grants, existing rows, or storage authorization. The shared player profile remains separate.

TEST acbaecjzoabafbsjrzvr: migration rehearsed with rollback, applied, then authenticated synthetic SQL assertions rerun with rollback. Allowed trainer insert of all four motifs; unauthorized insert/read/update, invalid purpose/layout, cross-season write, duplicate, archived write, and stale revision rejected. Storage helper accepts away paths. Existing profile untouched. Advisors contain no findings for the affected table; unrelated baseline findings remain.

UI: five-step series, clearly labelled home/away on camera and controller, gallery editing of four additional images; feed image selector derives labels from PHOTO_LABELS and therefore lists both kits. Existing automatic posts keep current motif/home default; no kit inferred solely from match venue.

Validation: five-step capture/accept/next-player regression, device export regression, remote away capture plus cross-kit/stale-draft checks, Vite build and scoped typecheck passed. Physical two-device test remains.

LIVE schema reads timed out twice. No LIVE changes performed and no release/live-plan.json hash approved. Before LIVE release, verify current LIVE structure and run the same tests in an isolated LIVE-equivalent schema.
