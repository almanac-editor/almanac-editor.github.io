---
version: 1
slug: "src-routes-assessment-edit-page-svelte"
primary_target: "src/routes/assessment-edit/+page.svelte"
related_targets: ["src/routes/assessment/+page.svelte","src/routes/+page.svelte"]
---

## Scope

Editing one class's assessment task: its notification and its spec together, and making a new one. `/assessment-edit?o=&a=` (edit) and `/assessment-edit?o=` (new), from the assessment page's Edit button and the home page's class band. Mode: Operate. Terms follow GLOSSARY.md. Issue #29.

## Audience and task

The teacher writing and managing the task itself, equally in a long drafting sitting and a quick fix. The content is the work: details, sections, parts and their marking criteria. Assessable topics is one section among many, with its dot points. Feels wrong: a database form, a Markdown wall, or topics taking over the page. Syllabus problems warn but never block a save. The owner rejected a first build that put the topics and dot points at the centre (2026-11-21).

## Direction contract

THESIS: The notification is written where it reads. The issued half fills the wide column; the teacher notes sit beside it in a chalk column, so what students get and what only the teacher sees are never confused. It refuses a form of fields, one Markdown textarea, and a topics-first page.

OWN-WORLD: House Colours, unchanged. House header: title at display size and the details (Due, Weighting, Marks, Teacher) as editable condensed figures. Paper issued column with 2px ink section rules and headings edited in place; parts as condensed figures in a leading cell, mark ranges as condensed figures. Chalk teacher column, ruled the same.

STORY: The teacher edits the title and details in the header; writes and rearranges the issued sections; builds Marking criteria as parts, criteria and mark ranges that must add up to the Marks; maps topics to dot points where the topics section sits (teacher notes for an assignment, issued for an exam); saves both files at once.

FIRST VIEWPORT: Header: crumbs, title, subject line, unsaved count, Discard, Save; Due / Weighting / Marks / Teacher figures. Below: left, issued sections in order, each heading with move, rename and remove; right, a 400px chalk column "Teacher notes · never issued" with its sections and the topics with ids. On a phone the teacher column follows the issued one.

FORM: students' half beside teacher's half, position 5 of 7 on the re-rolled list, seed:7c8fbce2086c7a76. Locked sketch: .impeccable/mocks/decision/halves.html (made-up sample content, not committed).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
