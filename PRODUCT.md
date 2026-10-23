# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A secondary teacher who keeps their lesson plans as JSON in a private git
repo ("lessons as code"). They use the editor in four situations, all
confirmed:

- **Fixing wording mid-term:** they spot a problem in a generated deck or
  workbook, jump to that lesson, reword it, save. Short, targeted visits.
- **Planning a unit ahead:** a longer sitting, working through a unit's
  lessons in order, adjusting run-sheet sections and timings.
- **Checking before teaching:** reading the next lesson for a class (run
  sheet, intentions, resources) shortly before walking into the room.
- **Logging feedback after class:** recording what went wrong and what to
  change next time, straight after the lesson.

Secondary audience: faculty colleagues at the same school who see it in use
and should want to set it up for their own subject.

## Product Purpose

Make the source the easiest place to edit. Decks, workbooks and the Word
document for the head of department are all generated from the data repo;
before this app, fixing wording in the generated output was easier, which is
the wrong place. Success: the teacher reaches the right lesson in a few
seconds, edits it with confidence, and colleagues ask how to get it.

## Positioning

The lesson files are the database: plain JSON in a folder the teacher owns,
byte-identical to what their own scripts write. One source feeds every
output; no other planner a teacher uses works this way. Where the files live
is the teacher's choice: a folder on their computer (the lowest entry point,
no account needed), or a GitHub repo where each save is a commit. Git is
available, never required.

## Operating Context

- Structure: subjects contain units; a unit lists lesson plans, a
  syllabus registry and its assessment tasks (each with a weight, the
  classes that sat it, and the dot points it evidences); an offering is one class (year group, label, year) that
  teaches units in a chosen order and term.
- A lesson plan has a title, description, length, summary, a run sheet of
  timed sections (kind: talk / activity; tier: core / stretch), learning
  intentions, success criteria, syllabus dot points, assessment,
  differentiation, feedback for next time, resources, references (where its
  claims come from), and an optional paired
  Markdown content file.
- Used on a teacher's laptop and on school machines, so sign-in on shared
  machines must stay per-tab by default.

## Capabilities and Constraints

- Static SvelteKit SPA on GitHub Pages; pages take parameters from the query
  string. CSP limits connections to api.github.com; no third-party runtime
  scripts or hosted fonts; never `{@html}` on data.
- Runtime dependencies: Svelte and `@cfworker/json-schema` only.
- Never edits `materials`, a saved plan's curriculum link id/coverage/mode,
  or a resource's url/canvas/file. A new plan picks its links when created. Saves validate against the data repo's schemas and refuse
  on conflict.
- Generic: owner, repo and branch come from Settings.
- New lesson plans are written in the app; existing files are never
  renumbered, because offerings and delivery records name them by path.
- Decided but not built: drag-and-drop, offline queueing, deck preview,
  GitHub App sign-in, custom domain.

## Brand Commitments

Name: Almanac (Almanac Editor). The house palette in the data repo's
`house_style.json` belongs to the decks and workbooks; the editor is free to
have its own look.

## Evidence on Hand

Real units and lessons live only in the private data repo and must never be
committed here. Fixtures in `src/lib/domain/fixtures/` are made up. No
testimonials, users or metrics exist.

## Product Principles

1. The source is the easiest place to fix things: finding a lesson must beat
   opening the generated deck.
2. Never surprise the file: saves are byte-exact and the editor only touches
   what it owns.
3. Never dictate the workflow: a folder is enough, and git (by hand, or
   through GitHub) is the teacher's choice. Make each save's effect visible.
4. Serve the four real moments (fix, plan, check, reflect) without modes the
   teacher has to manage.
