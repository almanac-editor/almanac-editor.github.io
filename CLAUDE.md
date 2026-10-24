# CLAUDE.md

A browser editor for the lesson plans in a data repo such as
`MrBev02/subject-almanac`. The idea is "lessons as code": edit the source once
and let every output (decks, workbooks, Riker's Word document) flow from it.
Before this app, the easiest place to fix wording was the generated output,
which is the wrong place.

## Shape

- **Two repos.** This one is public and holds app code only. The data repo is
  private and holds the lesson content: units, lessons, offerings and delivery
  records. That content is typically the school's intellectual property. Never
  commit any of it here, not even as test fixtures or examples. Fixtures in
  `src/lib/domain/fixtures/` and the sample in `demo.ts` are made up. The
  starter schemas in `src/lib/domain/starter/` are Almanac's own and generic.
- **The files are the database.** The teacher chooses where they live:
  - a folder on their computer, through the File System Access API (Chrome and
    Edge). A save writes the file and nothing else; git is optional and is the
    teacher's business, never the app's.
  - or a GitHub repo, through the API, where each save is a commit.
    Both sit behind `Store`; pages never know which they have. Don't add a
    feature that only works with one of them without saying so in the UI.
- **Static SPA on GitHub Pages.** SvelteKit 3, Svelte 5 runes,
  `adapter-static`, `ssr = false`, and every route prerendered as a shell.
  Pages take their parameters from the query string (`/lesson?u=&l=&o=&t=`),
  the same as the data repo's `scripts/view.py`, which this app replaces.
- **Generic.** The folder, or owner, repo and branch, come from the teacher.
  Nothing hard-codes this teacher.

## Layout

```
src/lib/domain/   plain TypeScript, no Svelte, unit-tested
  store.ts        Store: what the app needs from wherever the files live
  repo.ts         the only code that talks to GitHub (trees, blobs, contents PUT)
  folder.ts       FolderStore: a local folder (subjects/, offerings/, schemas/)
  format.ts       dump(): the house JSON format
  lessonEdit.ts   toDraft / fromDraft: editing without disturbing the file
  offerings.ts    port of the data repo's scripts/offering_lessons.py
  deliveries.ts   delivery records: what a class was taught, and its feedback
  versions.ts     a lesson's history: each distinct plan classes were taught
  planDiff.ts     what changed between two versions of a plan, field by field
  materials.ts    links to what a class saw, and where the plan's outputs land
  offeringEdit.ts withColour(), and the class editor's toClassDraft / fromClassDraft
  newOffering.ts  copyOffering / blankOffering: a new class, and its id and path
  newLesson.ts    a new plan: its file name, and the unit's index
  newUnit.ts      a new unit, and a new subject: where they go, what they hold
  unitEdit.ts     a unit's own fields and dot points; a subject's outcome.json
  tasks.ts        a unit's assessment tasks: which a class sat, and editing them
  layout.ts       where units, offerings, schemas and content files are
  validate.ts     the data repo's own schemas/*.schema.json, at run time
  starter.ts      starter schemas, written into a folder that starts empty
src/lib/data.ts   per-sign-in cache over Repo
src/lib/session.svelte.ts   token and target, or the sample repo
src/lib/folderAccess.ts   choosing a folder, remembering it in IndexedDB
src/lib/chooseFolder.ts   pick, check it holds lesson plans, open
src/lib/house.ts  which house colour each class wears
src/lib/demo.ts   made-up sample repo behind a fake fetch, for trying the app
src/lib/components/, src/routes/   UI
```

## Rules that matter

- **Byte-exact saves.** The data repo writes JSON with Python's
  `json.dumps(indent=2, ensure_ascii=False) + "\n"`, and `dump()` matches it.
  Saving an untouched draft must give back identical bytes:
  - Keys keep the order the file had. A new key goes in at its schema position.
  - An optional field cleared to empty is removed, unless the file already held
    it empty.
  - Check against a real clone with `DATA_REPO=../subject-almanac npm test`.
    Run it after any change to `format.ts`, `lessonEdit.ts`, `offeringEdit.ts`,
    `offerings.ts`, `tasks.ts` or `deliveries.ts`.
  - Numbers are whole. A task's `weight` is a `number` in the schema, but
    Python writes `12.0` where JavaScript writes `12`, so the editor takes
    whole weights only.
- **The editor never touches** a plan's `materials` (derived; the data repo's
  `materials.yml` Action regenerates it), a saved plan's curriculum link
  id/coverage/mode/framework, or a resource's url/canvas/file. A new plan's
  links are chosen from the unit's registry before it is first saved. On an
  offering it never touches `canvas`, `differentiation` or the class's name;
  `colour` changes only through the home page's picker.
- **Validation uses the files' own `schemas/`**, read at run time, through
  `@cfworker/json-schema`. Not Ajv: Ajv compiles with `new Function`, which the
  CSP blocks. Don't add `'unsafe-eval'`. A folder that starts empty gets the
  starter schemas with its first unit. Files that already hold plans but no
  `schemas/` save unchecked; the app never adds schemas to them. The starter
  schemas must never be stricter than a real repo's (a `DATA_REPO` test checks).
- **Duplicated logic.** `offerings.ts`, `tasks.ts` (`tasksForOffering`) and
  `deliveries.ts` duplicate Python in the data repo (`offering_lessons.py`,
  `deliveries.py`). The `DATA_REPO`
  parity tests compare them; keep them passing.
- **Feedback lives on delivery records**
  (`offerings/<class>/taught/<lesson path>.json`), never on the lesson. Items
  are applied or declined, never deleted. Read a lesson's records on demand,
  never every record on every page.

## Security

- **The token:**
  - A fine-grained PAT scoped to one repo, Contents read/write, 90-day expiry.
  - Kept in `sessionStorage` by default. "Remember on this device" moves it to
    `localStorage`.
  - Never logged, never put in a URL, only sent to `api.github.com`.
- **The CSP** (in `vite.config.ts`) limits `connect-src` to `api.github.com`.
  No third-party scripts at run time. Never `{@html}` on data.
- **Dependencies:** pinned exactly (`save-exact=true` in `.npmrc`). Runtime
  dependencies are Svelte and the validator only.
- **The origin:** every Pages site on an account shares `<owner>.github.io`
  storage and folder access. The app is the only Pages site of the
  `almanac-editor` org (repo `almanac-editor/almanac-editor.github.io`,
  served at the root). Publish no other Pages site from that org.

## Decided but not built

These were agreed in planning, each to become an issue:

- drag-and-drop
- offline editing: an installable app with commits queued until back online
- a Pyodide test: can the data repo's Python run in the browser and replace the
  TypeScript ports?
- deck preview
- GitHub App sign-in through a Cloudflare Worker with an httpOnly cookie,
  replacing the pasted token (when a second teacher uses the app)
- a custom domain

The visual design ("House Colours") is recorded in `DESIGN.md`, and product
context in `PRODUCT.md`. Read both before changing the UI.

## Tooling

```sh
npm run dev | npm test | npm run check | npm run lint | npm run build
```

SvelteKit 3 imports local modules with explicit extensions:
`#lib/domain/repo.ts`, `#lib/session.svelte.ts`.

Prettier ignores `src/lib/domain/fixtures/`, because those files must stay in
the house JSON format byte for byte.
