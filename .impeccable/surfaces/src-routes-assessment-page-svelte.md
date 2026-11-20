---
version: 1
slug: "src-routes-assessment-page-svelte"
primary_target: "src/routes/assessment/+page.svelte"
related_targets: ["src/routes/unit/+page.svelte","src/lib/components"]
---

## Scope

One class's assessment task: `/assessment?o=&a=`, reached from the home page's class band and from the unit page of each unit the task examines. Mode: Operate. Read-only for now; editing comes with #29. Terms follow GLOSSARY.md.

## Audience and task

The teacher writing or checking a task notification before it is issued (the main moment), then teaching towards it. Success: the due date, weighting, marks and parts are clear at a glance; the notification reads as students get it, its parts where it puts them; the syllabus check is there without taking over.

## Direction contract

THESIS: The notification is the document. The page reads it top to bottom in file order, as students get it, and keeps a side column of contents and syllabus check in reach. It refuses rearranging the notification into a dashboard, repeating the parts in extra places, and a dot point coverage report.

OWN-WORLD: House Colours, unchanged. House header with the details as condensed figures. Paper document with 2px ink section rules; rubric mark ranges as condensed figures in a leading cell; outcome codes in a leading cell. Side column of ink-ruled blocks.

STORY: The teacher sees when it is due, what it is worth and how the marks split; reads the notification in order, parts and marking criteria included; checks the topics match the syllabus (in the teacher notes for an assignment); opens teacher notes only when wanted.

FIRST VIEWPORT: Header: crumbs, title, subject line, examines and syllabus status, Due / Weighting / Marks figures. Below: the document column (first section) and a 290px sticky side column: On this page (current section marked) and Syllabus check. No primary action: the page is for reading. On a phone the side column sits under the header with On this page collapsed.

FORM: document with margin, position 1 of 7 on the ranked list, seed:3e35a7252ef97405. Locked sketch: scratchpad decision/document-margin.html (not committed; it holds school content). After the build the owner removed the sketch's marks bar and Parts list, and the part summary panel chosen in a follow-up round: too many places for the parts.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
