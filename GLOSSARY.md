# Glossary

The words this project uses, so code, UI copy, issues and conversation mean
the same thing. Use these words. When a new term is needed, or one is in doubt,
agree it with the project owner and add it here first.

## Assessment page

| Term            | Means                                                                                                                                                                                | Not                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| **Part**        | One of a task's numbered parts, as the notification names them: "Part 1: Survey", "Part 5: Presentation of findings".                                                                |                          |
| **Criterion**   | A marked item inside a part, with its own marks and rubric: Part 2 has "Structured dataset (5 marks)" and "Summary statistics (10 marks)". A part with one rubric has one criterion. | sub-criterion, component |
| **Mark range**  | One row of a rubric table: the marks ("10-9") and what earns them.                                                                                                                   | band, rubric band, level |
| **Side column** | The narrow right-hand column beside the document: On this page and the syllabus check. On a phone it sits under the header.                                                          | margin                   |

## Proposed, not yet confirmed

Terms already in the code. Confirm or correct them, then move them up.

| Term                | Means                                                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Notification**    | The task's Markdown file as students get it (`<offering>/assessments/<name>.md`).                                                                                    |
| **Assessment spec** | The task's JSON beside the notification: offering, units, and the assessable topics with their syllabus ids.                                                         |
| **Teacher notes**   | Everything after the notification's second `#` heading. Never shown to students; collapsed at the page foot. In an assignment it holds the Assessable topics.        |
| **Syllabus check**  | Whether the spec's topics match the notification's Assessable topics list (in the body for an exam, in the teacher notes for an assignment) and the unit registries. |

## Retired

Removed from the assessment page on 2026-11-21; don't bring them back without agreeing it.

- **Marks bar**: the header strip of parts sized by marks. It made the task look like a lesson.
- **Part summary**: a part's What to submit beside its marking criteria, in a panel. The notification's own Marking criteria is enough.
