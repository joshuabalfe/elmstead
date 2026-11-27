# Design

## Context

See proposal.md for why. The current state:

- The skills directory holds the six OpenSpec skills, listed in a table in `AGENTS.md`.
- `docs/` covers each job, but as reference. `docs/modelling.md` alone is 638 lines. The order of
  work and the traps sit in prose across files.
- Some rules are enforced by a test that fails with a clear message: a stale schema, the CI group
  agreement (`tests/ci-config.test.ts`), the plan SVG snapshot. The rest are judgement calls.
- The checklist in `docs/development.md` ("Adding a new element type") stops at the plan. Railings
  (ELM-12) also touched the id walk (`src/schema/ids.ts`), revisions (`src/model/revise.ts`), the
  diff (`COMPARED` in `src/diff/index.ts`), the checks, the IFC and plan colour tables, the viewer's
  storey-owner map and shown bounds (`viewer/main.ts`), and the plan-versus-3D test's ignored colours.
- Colour is subtle. The viewer recognises an element by matching a material's colour against
  `STYLES` within 0.02 (`viewer/style-of.ts`). The plan-versus-3D test classifies pixels as wall,
  room or paper and compares only those (`tests/support/plan-vs-3d.ts`).
- The viewer takes URL parameters: `model`, `view`, `camera`, `storeys`, `style`, `orient`, `ids`,
  `labels`, `constraints`, `diff`, `xray`, `measure`, `walk`, `snapshot`.

## Goals / Non-Goals

**Goals:**
- A skill for each recurring job, so an agent follows the repo's order of work and avoids its traps
  without rediscovering them from the code.
- A complete touch-point checklist in `docs/development.md`, so a person without the skill has it.

**Non-Goals:**
- No new element type, schema change or pipeline change.
- No skill for a rule a test already enforces (schema regeneration, snapshot updates, CI group
  agreement), and none for the OpenSpec lifecycle, which has skills.
- No automated check that every id kind is handled everywhere, or that colours are far enough
  apart. Both are worth having and change behaviour, so each gets its own change.
- No viewer-feature skill. The viewer's own docs cover it and the job is rarer.

## Decisions

**Skills hold order, decisions and verification; docs stay the reference.** Each skill links to the
docs section for detail and restates no rule, so the two cannot drift. Alternative: put everything
in the skills (people reading `docs/` would miss it, and the two would drift).

**Names are verb phrases and match their directory.** `add-support-for-new-element-types` is the
name the user chose; the others follow it. Front matter has `name` and `description` only. The
OpenSpec skills' `license`, `compatibility` and `metadata` come from their generator and are not
needed.

**`add-support-for-new-element-types` decides before it builds.** The agent writes a short treatment
sheet and agrees it with the user before coding, in the spirit of `AGENTS.md`'s "agree the shape
first". It states why no existing type works, then answers:
- *IFC:* entity and `PredefinedType`, spatial containment, geometry, whether a round-trip volume
  check applies, and how it relates to neighbours (cuts or fills an opening, hangs from a wall).
- *Plan:* cut, projected or symbolic; draw order; `class` and `data-id`; whether it extends the
  drawing.
- *Viewer:* how it is recognised (its IFC colour), whether it keeps the IFC colour or takes the
  plan recolour in Top view, which storey hides it, and whether it counts towards the shown bounds.
- *Colour:* one IFC and one plan colour, each checked against its table.
- *Diff and revisions:* editable by a revision, and compared.
Verification is three looks in order: tests and checks; the plan-versus-3D comparison (the element
is compared, or exempted in `isIgnoredColour` or the skip rules with a reason); and looking at the
rendered output through `inspect-the-rendered-output`. The first two passing does not replace the
third. It also covers geometry variants and storey patterns, and says to prefer a pattern or a
variant over a new type when one can express the thing.

**`edit-an-existing-building-model` is the entry point for model work and hands off at its edge.** It
carries the loop (edit, `check`, `build`, `render`, look), the face-not-centreline rule for room
outlines that the plan-versus-3D test catches, where an owner measurement goes (constraints), and a
stop rule: when the schema cannot express what the model needs, stop and use
`add-support-for-new-element-types` instead of bending an existing type. Six of nine sampled
`ELM-X` model pull requests ended up changing `src/`, so this hand-off is the part with the value.

**`record-model-constraints` keeps one rule sharp.** A constraint is a real measurement the user
gave, with its source in `note`; a failure means fix the model. It covers where constraints live
(folder, single file, revision), how points and tolerances are written, and reading the failure
line. Alternative: fold it into `edit-an-existing-building-model`. It stays separate because it fires on a
different trigger (the user gives a measurement, or a constraint fails) and the rule is one agents
tend to break.

**`propose-a-model-revision`** covers writing `revise(base, edits)`, the revision's own constraints,
that a revision has exactly its base's storeys, building and rendering by path, reading the diff,
and when to make the base parametric instead.

**`diagnose-a-failing-check` is only written if the evidence supports it.** Its value depends on
there being distinct, recurring failures with non-obvious causes. Apply starts by listing the
failure modes from the check messages in `src/checks`, the CLI failure fixtures and the
plan-versus-3D failure output. If it finds too few distinct ones to justify a skill, it folds a
short section into `edit-an-existing-building-model` and says so in the pull request.

**`inspect-the-rendered-output` is shared so the verification is written once.** It states how to
produce and look at the plan PNG, the 3D PNGs and each viewer URL state headlessly, and what each
state is for. Every parameter it names is checked against `viewer/main.ts`. Alternative: repeat the
how-to in each skill (six copies to keep right).

**Build the touch-point list from the code, not memory.** Apply greps for `railing` across `src/`,
`viewer/`, `tests/`, `docs/` and `scripts/`, reads the files the ELM-12 commits changed, and reads
how stairs, doors and windows are handled for kinds with parts. Each place becomes a checklist line
or is recorded as not needed.

## Risks / Trade-offs

- [A skill restates the docs and the two drift] → Skills link and restate no rule; apply checks each
  link and symbol with `git grep`.
- [Six skills is a lot to keep right] → Each is short and verified against a real past change,
  and the OpenSpec skills cost the same. The weakest one, diagnose, may fold into another.
- [The traced list misses a place railings did not touch] → Trace stairs, doors and windows too, and
  tell the skill to grep the nearest existing kind, not only railings.
- [Colour rules documented but unenforced] → Accepted for now; see Non-Goals.
- [The change is bigger than one skill] → It is documentation only and changes no output, so the
  review is reading, and each skill has its own task group.
