---
name: Almanac Editor
description: House Colours. A browser editor for lessons-as-code where every class wears its own flat house colour.
colors:
  chalk: '#f3f4f0'
  paper: '#fcfcfa'
  field-edge: '#7d8089'
  field-on: '#ffffff'
  sunk: '#e9eae4'
  ink: '#15171c'
  ink-2: '#3a3d45'
  muted: '#5f636d'
  rule: '#dcded6'
  rule-strong: '#b6b9af'
  rail: '#15171c'
  rail-ink: '#f3f4f0'
  rail-muted: '#a3a7b0'
  warn: '#c4321d'
  warn-soft: '#fbe5e0'
  warn-deep: '#8a1f10'
  good: '#0b7a55'
  good-soft: '#ddf1e8'
  note-soft: '#fbefd3'
  note-deep: '#6e4b03'
  house-none: '#15171c'
  house-none-soft: '#e7e8e3'
  house-cobalt: '#1e3bb3'
  house-cobalt-soft: '#e3e8fa'
  house-cobalt-deep: '#142a85'
  house-emerald: '#0b7a55'
  house-emerald-soft: '#dcf1e7'
  house-emerald-deep: '#075a3e'
  house-ruby: '#b3263e'
  house-ruby-soft: '#f8e1e5'
  house-ruby-deep: '#861a2d'
  house-saffron: '#e8a317'
  house-saffron-on: '#1e1605'
  house-saffron-soft: '#fbefd3'
  house-saffron-deep: '#7a5304'
  house-plum: '#5e2d91'
  house-plum-soft: '#ece2f7'
  house-plum-deep: '#44206a'
  house-lagoon: '#0e7490'
  house-lagoon-soft: '#dcf0f5'
  house-lagoon-deep: '#0a5568'
  house-tangerine: '#c2410c'
  house-tangerine-soft: '#fde6d8'
  house-tangerine-deep: '#8a2e07'
  house-moss: '#4d7c0f'
  house-moss-soft: '#e6f0d5'
  house-moss-deep: '#365a0a'
  house-on: '#ffffff'
typography:
  numeral:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: 'clamp(64px, 9vw, 112px)'
    fontWeight: 900
    lineHeight: 0.78
    letterSpacing: '-0.04em'
    fontFeature: "'tnum'"
    fontVariation: "'wdth' 70"
  hero:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: 'clamp(40px, 5.4vw, 78px)'
    fontWeight: 900
    lineHeight: 0.92
    letterSpacing: '-0.03em'
    fontVariation: "'wdth' 70"
  display:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: 'clamp(30px, 4.2vw, 52px)'
    fontWeight: 850
    lineHeight: 0.98
    letterSpacing: '-0.02em'
    fontVariation: "'wdth' 75"
  figure:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: '36px'
    fontWeight: 900
    lineHeight: 0.85
    letterSpacing: '-0.03em'
    fontFeature: "'tnum'"
    fontVariation: "'wdth' 70"
  headline:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: '22px'
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: '-0.015em'
    fontVariation: "'wdth' 80"
  title:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: '18px'
    fontWeight: 750
    lineHeight: 1.2
    fontVariation: "'wdth' 88"
  title-sm:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: '16px'
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: '0'
    fontVariation: "'wdth' 90"
  body:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: '15px'
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "'tnum'"
  control:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: '14px'
    fontWeight: 650
    lineHeight: 1.3
  label:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: '13px'
    fontWeight: 700
    lineHeight: 1.3
  micro:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: '11px'
    fontWeight: 600
    lineHeight: 1.2
  mono:
    fontFamily: "ui-monospace, 'Cascadia Mono', Consolas, monospace"
    fontSize: '13px'
    fontWeight: 400
    lineHeight: 1.6
rounded:
  none: '0'
  sm: '2px'
  dot: '50%'
spacing:
  hair: '2px'
  xs: '4px'
  sm: '8px'
  md: '14px'
  lg: '20px'
  xl: '32px'
  section: '40px'
  gutter: 'clamp(16px, 4vw, 48px)'
components:
  button:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    typography: '{typography.label}'
    rounded: '{rounded.sm}'
    padding: '0 14px'
    height: '36px'
  button-primary:
    backgroundColor: '{colors.house-cobalt}'
    textColor: '{colors.house-on}'
    rounded: '{rounded.sm}'
    padding: '0 14px'
    height: '36px'
  button-primary-hover:
    backgroundColor: '{colors.house-cobalt-deep}'
  button-ink:
    backgroundColor: '{colors.ink}'
    textColor: '{colors.chalk}'
    rounded: '{rounded.sm}'
    padding: '0 14px'
    height: '36px'
  button-quiet:
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    padding: '0 14px'
    height: '36px'
  input:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.sm}'
    padding: '8px 10px'
  page-head:
    backgroundColor: '{colors.house-cobalt}'
    textColor: '{colors.house-on}'
    typography: '{typography.display}'
    padding: '22px clamp(16px, 4vw, 48px) 26px'
  class-band:
    backgroundColor: '{colors.house-cobalt}'
    textColor: '{colors.house-on}'
    rounded: '{rounded.none}'
    padding: '11px 16px 11px 20px'
  rail:
    backgroundColor: '{colors.rail}'
    textColor: '{colors.rail-ink}'
    width: '248px'
  lane-seg-talk:
    backgroundColor: '{colors.house-cobalt}'
    textColor: '{colors.house-on}'
    height: '64px'
  lane-seg-activity:
    backgroundColor: '{colors.house-cobalt-soft}'
    textColor: '{colors.house-cobalt-deep}'
    height: '64px'
  lane-seg-stretch:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.house-cobalt-deep}'
    height: '64px'
  lane-seg-late:
    backgroundColor: '{colors.warn-soft}'
    textColor: '{colors.warn-deep}'
    height: '64px'
  feedback-entry:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    padding: '12px 14px 12px 16px'
  msg-warn:
    backgroundColor: '{colors.warn-soft}'
    textColor: '{colors.warn-deep}'
    padding: '12px 14px'
  msg-ok:
    backgroundColor: '{colors.good-soft}'
    textColor: '{colors.ink}'
    padding: '12px 14px'
  msg-note:
    backgroundColor: '{colors.note-soft}'
    textColor: '{colors.note-deep}'
    padding: '12px 14px'
  detail-figure:
    textColor: '{colors.house-on}'
    typography: '{typography.figure}'
    padding: '12px 28px 2px 0'
  detail-figure-wide:
    textColor: '{colors.house-on}'
    typography: '{typography.headline}'
  rubric-mark-range:
    textColor: '{colors.house-cobalt}'
    typography: '{typography.figure}'
    width: '96px'
  rubric-mark-range-top:
    textColor: '{colors.house-cobalt-deep}'
  side-column:
    textColor: '{colors.ink-2}'
    typography: '{typography.control}'
    width: '290px'
  toc-current:
    textColor: '{colors.house-cobalt-deep}'
  topic-id:
    textColor: '{colors.house-cobalt-deep}'
    typography: '{typography.label}'
    width: '112px'
  topic-id-unknown:
    textColor: '{colors.warn-deep}'
  editor-box:
    backgroundColor: '{colors.paper}'
    rounded: '{rounded.sm}'
    padding: '16px 18px 14px'
  band-field:
    textColor: '{colors.house-on}'
    rounded: '{rounded.sm}'
    padding: '7px 10px'
  save-bar:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    padding: '10px clamp(16px, 4vw, 48px)'
  rubric-edit-mark-range:
    textColor: '{colors.house-cobalt}'
    typography: '{typography.figure}'
    width: '84px'
---

# Design System: Almanac Editor

## Overview

**Creative North Star: "House Colours"**

Every class wears its house colour, and the colour is the navigation. A class's rail band, the page header and the lesson lanes all take the same flat colour, so the screen always says whose lesson you are in. It is a school-sports-carnival world: chalk ground, ink type, eight flat house fields that own whole regions, and a run sheet drawn as a lane strip with a finish line. It refuses the neutral grey sidebar workspace with one blue accent.

Density is that of a working tool used between classes: a dark rail on the left, a house-coloured header band with the title at display size, then a chalk page of hairline-ruled lists. Rank comes from type scale, not boxes: heavy condensed Archivo numerals set huge (lesson numbers, minutes, terms) beside small regular labels. Corners are square. Depth is nearly absent; colour fields and rules do the separating.

Motion has one job beyond ordinary state changes: when you move between classes, the new page header starts in the previous class's colour and fades to its own, so the colour visibly changes hands.

**Key Characteristics:**

- Eight flat house colours, one per class, each owning whole regions rather than chips.
- Chalk ground, ink type, hairline rules; the dark rail is the only dark surface in light mode.
- Archivo variable, condensed and heavy for figures and titles, tabular numerals everywhere.
- Square corners (2px at most); flat surfaces, with one soft shadow reserved for raised panels.
- The run sheet is drawn as a lane strip with a finish line at the lesson length.

## Colors

A chalk-and-ink ground carrying eight saturated, flat house colours, each a set of four values (field, on-colour, soft tint, deep text).

### Primary

The primary colour is **the house in force**, not a fixed hue. Pages set `data-house` on `main` (and on each rail band) and everything inside reads `--house`, `--house-on`, `--house-soft` and `--house-deep`. A class can fix its house with an optional `colour` field in its offering file, chosen from the picker on the home page's class band and saved as a commit. Otherwise its house is its position among the repo's offerings sorted by path (numbers compared as numbers, so Year 8 comes before Year 10), cycling through eight houses in this order (moving to the next free house only when a fixed class holds that one), so the same repo gives the same colours on every device:

- **Cobalt** (house-cobalt): deep royal blue, white on.
- **Emerald** (house-emerald): school-field green, white on. Shares its value with `good`.
- **Ruby** (house-ruby): crimson, white on.
- **Saffron** (house-saffron): marigold yellow, the one house with dark on-text (house-saffron-on).
- **Plum** (house-plum): violet, white on.
- **Lagoon** (house-lagoon): deep teal, white on.
- **Tangerine** (house-tangerine): burnt orange, white on.
- **Moss** (house-moss): olive green, white on.

Each house's **soft** tint is the hover ground for rows and tiles, the selected row in the jump dialog and the hatched activity fill. Its **deep** value is house-coloured text on paper (dt labels, syllabus ids, stretch tags, the "Change" lead in feedback). Pages outside any class wear **house none**: ink as the field, a pale grey soft.

### Neutral

- **Chalk** (chalk): the page ground under everything; also text on the ink button and the dark rail.
- **Paper** (paper): raised surfaces on chalk: unit tiles, inputs, buttons, feedback entries, the lane track, panels.
- **Field edge** (field-edge): the edge of anything the teacher can click to change on the edit page: the Edit button at rest, More menus, Where buttons, the dashed Add section button and the undo ghost. It clears 3:1 on paper, where rule-strong doesn't.
- **Field on** (field-on): the fill of a field in use on a house band, white in light mode, so typed text reads as ink.
- **Sunk** (sunk): inline code ground, the hover on plain list rows, the teacher notes' ground on the edit page and the undo ghost.
- **Ink** (ink): body text, the 2px rule that heads every list, the finish line, the ink button and save bar.
- **Ink 2** (ink-2): secondary text, field labels, input hover border.
- **Muted** (muted): metadata, counts, tick labels, placeholders.
- **Rule / Rule strong** (rule, rule-strong): 1px row dividers / control borders and lane track edges.
- **Rail / Rail ink / Rail muted** (rail, rail-ink, rail-muted): the left rail, the mobile top bar and the welcome screen's pitch side.

### Status

- **Warn** (warn, warn-soft, warn-deep): overflow past the finish line, off-length totals, error messages, missing text, destructive hover.
- **Good** (good, good-soft): the success message.
- **Note** (note-soft, note-deep): notice messages and "has feedback" markers in lesson lists.

Dark mode (system preference unless `data-theme='light'`, or forced with `data-theme='dark'`) swaps every neutral and status token and brightens each house field one step; house soft becomes a dark tint and house deep becomes a light tint so it still reads as text. Values are in the sidecar.

### Named Rules

**The Colour Owns Regions Rule.** A house colour fills whole fields: the rail band, the header, talk segments, the class band on home. It never shrinks to a pill, chip or badge.

**The One House Per Page Rule.** A page wears exactly one house, the class in the query string. The rail is the only place several houses appear together, and the jump dialog's row swatches are the only other exception.

**The Stable House Rule.** A class's house is its offering's `colour` when fixed, otherwise its sorted offering path; never a random or hashed value. Fixing one class never moves another class off its own colour unless the two collide.

## Typography

**Display Font:** Archivo variable (self-hosted woff2, weight 100–900, width 62–125%), with -apple-system, BlinkMacSystemFont, Segoe UI, system-ui fallback
**Body Font:** Archivo, same file and stack
**Label/Mono Font:** ui-monospace, Cascadia Mono, Consolas for code and raw JSON only

**Character:** One grotesk doing everything through its width and weight axes: condensed (70–80% width) and very heavy for figures and titles, normal width and regular weight for reading. Tabular numerals are on globally (`font-variant-numeric: tabular-nums` on body), so minutes and counts align in columns.

### Hierarchy

- **Numeral** (900, clamp 64–112px, 0.78, 70% width): the lesson number beside the lesson title in the header, zero-padded ("03").
- **Hero** (900, clamp 40–78px, 0.92, 70% width): the welcome screen headline only.
- **Display** (850, clamp 30–52px, 0.98, 75% width, max 22ch): the page title in the house header.
- **Figure** (900, 34–40px, 0.85, 70% width, tabular): the leading figure of a row: lesson number in the unit lanes (40px), section start minute in the run sheet (36px), term number on unit tiles and total minutes (34px). Set in house colour on paper or ink.
- **Headline** (800, 22px, 1.05, 80% width): section headings (h2). Margin headings drop to 17px at 90% width.
- **Title** (750, 17–18px, 1.2, 88% width): lesson and unit names in lists and tiles.
- **Title small** (800, 16px, 90% width): h3.
- **Body** (400, 15px, 1.55): reading text; summaries at 17px, kept to 62–68ch.
- **Control** (650, 14px): button and tab labels, table cells that carry a status in words (coverage flags), lines in an opened row.
- **Label** (600–700, 13px): field labels, crumbs, header meta, counts.
- **Micro** (600–800, 11–12px): lane segment labels, tick numbers, finish-line flag, term codes, offering ids in bands.

The assessment notification adds sizes the ramp lacks. Each sits under the closest role rather than forming a second ramp:

- **Headline, notification part heading** (850, 20px, 72% width): a `###` heading inside a notification section, such as "Part 2: Ideas and prototype". Condensed like the section head and two pixels under it, so the section head above it still leads.
- **Headline, wide detail value** (800, 22px, 80% width, 1.05): a detail in the header whose leading value runs past 8 characters (a due date), set smaller than the figure beside it.
- **Headline, teacher notes summary** (800, 17px): the folded disclosure at the foot, as the margin headings.
- **Figure, detail lead** (900, 40px, 0.9, 70% width, tabular; 32px below 640px): the leading value of a detail in the header ("30%", "40").
- **Figure, mark range** (900, 34px, 1, 70% width, tabular; 28px below 640px): the marks of a rubric row ("10-9").
- **Title small, notification sub-heading** (750, 15px): a `####` heading in a notification; a spec phase heading under Assessable topics takes the h3 weight at 15px in house deep.
- **Control, criterion row** (14px, ink 2): a criterion named on its own line above its rubric ("**Prototype (10 marks)**"); also outcome lines, the contents list (800 for the current entry) and the side column's status line.
- **Label** (750–800, 13px): side column headings, syllabus ids beside topics, a detail's rest line ("(20% in class, 10% at home)"), topic notes.
- **Micro** (650–750, 12px): detail labels in the header (Due, Weighting, Marks), ids on spec-only topic rows, the source line at the foot.

### Named Rules

**The Scale Contrast Rule.** Rank is made by jumping from a 34–112px condensed figure to a 13px label in the same row, not by colour blocks, boxes or caps. Labels stay small and sentence case.

**The Leading Cell Rule.** Identifiers (lesson number, start minute, term, syllabus id) sit in a fixed leading cell to the left of what they identify, set as a figure or bold label. Nothing sits above a heading as an eyebrow.

**The Self-Hosted Rule.** Archivo ships from `src/lib/assets/fonts/` under its OFL licence. The CSP forbids hosted fonts; never add a font CDN.

## Layout

- **Shell:** a two-column grid: a sticky, full-height dark rail (248px) and the main column. Below 900px the rail becomes an off-canvas drawer (min(320px, 86vw)) behind a dark top bar with the wordmark, jump and menu buttons, and a 50% ink scrim.
- **Page width:** content and header inner both cap at `--page-max`: 1180px, 1560px from 1700px viewports and 1760px from 2200px (where body type also steps to 16px), centred. Prose measure (`--measure`) grows 68ch to 82ch to 88ch, and the lesson margin column (`--margin-col`) 340px to 400px to 440px, with a fluid gutter (`clamp(16px, 4vw, 48px)`). The header field itself bleeds full width; only its contents are capped.
- **Vertical rhythm:** 32px from header to content, 36–40px between sections, 14px under section headings, 14–16px row padding in lists, 96px bottom padding on main.
- **Lists are ruled tables:** each list opens with a 2px ink rule and separates rows with 1px rules. Rows are grids with a fixed leading cell (64px figure column for lessons and run sheet sections; 58px for syllabus ids).
- **Lesson page:** run sheet column plus a 260–340px sticky margin on the right holding syllabus, feedback and resources; the margin drops under the body below 1000px.
- **Home:** each class is a full-width house band: a 180–220px name tag on the left and its units as paper tiles (`auto-fill, minmax(240px, 1fr)`, 4px gaps) inside the band. Below 640px the tag stacks above the tiles.
- **Gaps between colour fields** are tight (2–4px) so fields read as one striped surface; gaps between text blocks are generous.
- **Assessment page:** the document column plus a sticky side column (about 290px, 48px gap, 24px from the top, scrolling on its own when taller than the window) on the right. Notification sections sit 44px apart and the teacher notes 48px below the last. Below 861px the side column moves under the header, above the document, with On this page collapsed. Below 640px the header's details become a two-column grid with a wide value spanning both.
- **Assessment edit page:** the same read page, its document beside a 260px sticky side column (48px gap), with 120px of foot room above the save bar. Sections sit 40px apart; the add-section button 28px below the last. The teacher notes, 48px below, sit on their own sunk ground bled 18px each side. The open editor bleeds 18px each side of the text column (10px below 560px) so its text stays where it was read. Below 900px the side column moves above the document and On this page hides.

## Elevation & Depth

The world is flat. Separation comes from colour fields, the chalk/paper step and rules. One soft two-layer shadow lifts the few panels that float over the page, and the jump dialog gets a deeper one. There are no hard offset shadows and no hover lift.

### Shadow Vocabulary

- **Panel** (`box-shadow: 0 1px 2px rgb(21 23 28 / 0.06), 0 6px 18px -6px rgb(21 23 28 / 0.14)`, token `--shadow`): the lane-strip panel at the top of a lesson, the editor's sticky save bar and its messages, the welcome sample card, the settings card, and on the assessment edit page the open section editor, the Escape prompt and the More menus.
- **Save bar lift** (`box-shadow: 0 -6px 18px -10px rgb(21 23 28 / 0.25)`): the assessment edit page's save bar, cast upward because the bar sits at the foot of the window.
- **Dialog** (`box-shadow: 0 2px 4px rgb(0 0 0 / 0.08), 0 24px 60px -12px rgb(0 0 0 / 0.35)`): the jump dialog only, over a 45% ink backdrop with a 2px blur.

### Named Rules

**The Flat Field Rule.** House colours are flat and unmodulated: no gradients, no shadows on bands or headers. The only patterned fill is the activity hatch.

## Shapes

Square. Controls, code and kbd take a 2px radius; colour fields, tiles, bands, lane segments, panels and dialogs are 0. Circles appear only as status marks (the save-state dot, the success message mark). Form language is rectangles and lines: 2px ink rules head lists, 1px rules divide rows, 3px house rules top feedback entries, 3px ink bars mark the finish line, and small solid squares (9–12px) serve as list bullets, legend keys and message marks (a diamond for warnings). The syllabus check's mark follows the same pair: a 9px circle when the topics match, a 9px diamond when they don't. Notification bullets are smaller house squares (6px), since they sit in running text.

## Components

### Buttons

Plain, firm and square.

- **Shape:** gently squared corners (2px), 36px tall, 14px side padding, 14px label at 650 weight, 7px icon gap.
- **Default:** paper ground with a rule-strong border; hover darkens the border to ink; active presses down 1px.
- **Primary:** the house field with house-on text; hover goes to house deep.
- **Ink:** ink field with chalk text, for the commit action on dark-agnostic pages.
- **Quiet:** transparent; hover lays a 7% ink wash. Icon buttons are 32px square quiet buttons.
- **In the header:** buttons become translucent house-on washes (12% ground, 35% border, 22% on hover); the `solid` variant inverts to a house-on field with house text.
- **Disabled:** 45% opacity.

### Inputs / Fields

- **Style:** paper ground, 1px rule-strong border, 2px radius, 8px 10px padding, caret in house colour. Textareas size to content.
- **Hover / Focus:** hover darkens the border to ink 2; focus sets the border to the house and adds a 3px ring of 22% house.
- **Label:** 13px bold ink 2 above the control. Checkboxes take the house as accent colour.

### Navigation

- **Rail:** dark field with the Almanac wordmark (900, 72% width, 34px), the repo name in 12px muted, a dark jump button with a `/` key, then "Classes" and each subject as 12px muted headings.
- **Class bands:** each class is a full-width house band flush to the rail's left edge, leaving a 12px gap on the right. Year group large (850, 75% width, 20px), class label 13px, offering id 11px under them. Hover widens the band (gap to 4px); the current class fills the rail width, grows taller, enlarges the year to 26px and opens its term list underneath on a 22% house tint of the rail. The current unit row in that list fills with the house.
- **Crumbs:** 13px semibold links with chevron icons, inside the header above the title.
- **Unit views:** tabs hanging from the bottom of the header, a 10% current-colour wash each with a small house swatch; the current tab turns to chalk with ink text so it joins the page.
- **Pager:** previous and next lessons as two house-soft fields at the foot of a lesson, filling with the house on hover.

### Page Header (signature)

A full-bleed flat field in the house colour carrying crumbs, the optional giant numeral, the display title, a lede, actions and a meta row. On mount it starts from the previous page's house (`--from`, captured by an outer wrapper that wears the previous house) using `@starting-style` and transitions background and text over 650ms on the house ease, so moving between classes reads as the colour changing hands. Selection and focus outlines invert to house-on inside it.

### Lane Strip (signature)

The run sheet drawn as a carnival lane: a 64px track on paper between two rule-strong hairlines, one absolutely positioned segment per section sized by its minutes, 2px paper gaps between segments.

- **Talk:** solid house field, house-on text.
- **Activity:** 135° hatch of 30% house over house soft, house-deep text.
- **Unclassified:** plain rule grey.
- **Stretch:** paper with a 2px dashed house outline inset.
- **Finish line:** a 3px ink bar overhanging the track 8px top and bottom at the lesson length, flagged with the minute count on an ink tab. When the plan runs over, the bar and flag turn warn and any segment starting past the line becomes warn-soft with a solid warn outline.
- **Labels:** each segment is a size container. It shows the minutes as a 24px condensed figure plus an 11px label, hides the label below 64px wide and the figure below 22px.
- **Ticks:** a minute scale beneath, minor ticks every 5 minutes and labelled major ticks every 15.
- **Compact:** a 12px strip with no labels or ticks, used in the unit's lesson lanes.
- Segments and the finish line slide (380ms) as timings are edited. A legend (talk, activity, stretch, finish) sits above the unit lanes.

### Class Calendar

A class's year on a month grid (`@event-calendar/core`, restyled through its `--ec-*` variables), under a 2px ink rule, weekdays only, weeks starting Monday.

- **Taught:** a solid house field with house-on text, as a talk segment.
- **Planned:** paper with a 2px dashed house outline inset and house-deep text, as a stretch segment.
- **Not marked taught** (planned for a day already past): warn soft with a dashed warn outline.
- **Days off and holidays:** sunk background on the day; a day off for some periods only is a 135° sunk hatch. Its name sits beside the day number in 11px muted.
- **Term weeks:** the week's label (`T1 W3`, with `A` or `B` for a fortnightly class) in 11px house-deep at the start of each row.
- Each lesson shows its period in bold and its number and name, and links to the lesson in the class's order. Square corners, no shadows. Lessons not marked taught, lessons past their unit's end date and lessons with no period left are listed under the grid as ruled rows led by the date.

### Coverage Table

A unit's dot points as a ruled table per registry phase, capped at 1040px so the flags sit near the words they judge. Above the first table: a toolbar ("Only rows worth a second look" with its count, then Open all and Close all), and a ruled Key disclosure whose summary is the legend in real text and which opens on each flag's meaning.

- **Phase head:** a Headline phase name and a muted count in words, "2 of 4 reached so far · 1 not reached · 2 worth a second look", the not-reached part in warn-deep.
- **Column row:** 12px muted over a 2px ink rule; hidden from screen readers, since each cell carries its own label.
- **Leading cell:** the syllabus id, 13px bold house-deep, in the 58px column. Under the dot point's text, "Assessed in …" in 12px muted names the tasks that link it.
- **Planned and Taught cells:** a hidden "Planned:" or "Taught:" label, a 10px key and a 14px bold label in words ("Developed", "Once", "Never developed", "Only in part", "Not reached", "Not written yet", "Another unit"), then the lesson count in 12px muted, left out at zero. Never a chip. Not reached reads in warn-deep, only in part and never developed in note-deep, not written yet and another unit in muted.
- **Only lessons count.** A task assesses a point and doesn't teach it, so flags, counts and "reached" read lesson links only, and tasks are listed apart.
- **Keys**, all in house-deep so a light house clears 3:1: solid for developed; a solid outline for once; a dashed outline for never developed; a half-filled note-deep square for only in part; a warn-deep diamond for not reached; paper with a dashed muted outline for not written yet; a rule-strong square for another unit. Not written yet and another unit appear in the Key only where a row has them.
- **Still to come:** the Planned key from the calendar (paper with a dashed house-deep outline) and house-deep text, in place of the Taught flag.
- Each row is a `<details>` with a muted chevron in the last column, a 12% house-deep hover and an inset focus ring. Open, it states each flag's meaning in words ("**Planned: Once.** One lesson reaches this in full…"), warns in warn-deep where a task assesses a point no lesson teaches (or has taught yet), then lists the links: the lesson number in a 24px condensed house-deep figure, the linked title sized to its text, the 12px bold status straight after it ("Taught", "Not yet taught", "Assessment", in warn-deep where the links come from today's plan or the lesson was taught without the link), then "In full, developed" in 12px muted. Tasks come next, then any lesson in the unit's `planned` that names the point, titled, with "Planned, not written yet" and no link.
- A class tab adds the class's year where two tabs share a name ("Year 7 Class A · 2025 · Term 2").
- Below 720px the column row hides, each cell stacks under the text with its "Planned" or "Taught" label shown, and the opened row stays aligned with the text column.

### Feedback Entries

Feedback lives in the lesson margin as a stack of paper entries, each topped with a 3px house rule, 14px text, the "Change next time" line in ink 2 led by a house-deep label, and the author in 12px bold muted. No side stripe, no tint block.

### Messages

One tinted block with one mark, never a coloured edge stripe. 12px 14px padding, 14px text, a 10px mark in the leading position: a warn-deep diamond on warn soft for problems, a good-green circle on good soft for success, a note-deep square on note soft for notices.

### Assessment Notification (signature)

The notification is the document: the page draws its Markdown top to bottom in file order, as students get it, on the chalk page. Nothing is rearranged into a dashboard and the parts appear only where the notification puts them.

- **Section heads:** each `##` section opens with its heading as a Headline over a 2px ink rule (10px under the text, 16px above the content). A preface before the first heading sits unheaded.
- **Part headings:** `###` headings at 20px/850, 72% width, 26px above; `####` at 15px/750.
- **Criterion rows:** a paragraph that is only bold text names a criterion above its rubric, in 14px ink 2.
- **Outcome lines:** a line opening with an outcome code puts the code in an 82px leading cell (bold, house deep, tabular) and the outcome in 14px ink 2 beside it; on phones the code stacks above.
- **Rubric tables:** a table whose first column is headed "Marks" becomes a rubric. Its head is 12px muted over a 2px ink rule; each mark range puts its marks in a 96px leading column as a Figure numeral (34px, house colour, the top range in house deep) and its words in body text, rows divided by 1px rules. On phones the column is 76px and the figure 28px.
- **Other tables:** the same ruled head, first column at 650, scrolling sideways inside their own wrapper when too wide.
- **Lists:** unordered items take a 6px house square as bullet.
- **Inline:** strong, emphasis, code and links only, drawn as elements; links open in a new tab.

The made-up sample in `src/lib/demo.ts` (the "Torch redesign" task) shows each pattern.

### Details Figures

The notification's details table (Due, Weighting, Marks and the like) moves into the page header as figures under the title. Each detail is a block topped by a 2px rule of 55% house on, with a 12px label, then its leading value as a 40px Figure numeral in house on and anything after the first bracket, comma or semicolon as a small 13px rest line beneath. A leading value longer than 8 characters (a date) is set smaller, at 22px Headline, and the block widens (260–420px). The meta row under the title names the units examined, each a link, and the syllabus status as a link to the topics.

### Side Column

Contents and the syllabus check, kept in reach beside the document. Each block opens with a 2px ink rule and a 13px/800 heading, 26px apart.

- **On this page:** the notification's sections in order, then Assessable topics when the notification holds no topics list, then Teacher notes. Entries are 14px ink 2 on a 2px rule track down the left; hover turns the text house deep. The section being read (the last whose top has passed a third of the window) thickens its segment to a 3px house rule, with the label at 800 in house deep. This rule marks a position on a navigation track, not a stripe on a content block.
- **Syllabus check:** a status line, not a panel. A 9px good circle and "**Matches**" in good, or a 9px warn-deep diamond and "**3 to fix**" in warn-deep, then the count of units and topics in 14px ink 2. It links to the topics, opening the teacher notes when they hold them.
- **Placement:** sticky at about 290px on wide screens. Below 861px it sits under the header with On this page collapsed behind a chevron.

### Assessable Topics

The topics list in the notification (in the body for an exam, in the teacher notes for an assignment) becomes a ruled list with a 112px leading cell of syllabus ids, one per line, 13px/750 house deep. An id the unit's registry doesn't know is struck through with a 2px line in warn-deep; a topic with no id reads "No id" in muted. A topic's note sits under its text in 13px note-deep. The heading carries a status beside it only when the syllabus check fails ("3 to fix before the data repo's checks pass", warn-deep with a diamond), and the problems sit under it as one warn message (Messages): a single diamond, each problem a row divided by a hairline of 18% warn-deep, no bullets. When the notification has no topics list, the spec's topics are drawn instead, grouped by unit and phase.

### Teacher Notes

Everything after the notification's second `#` heading, folded at the foot of the document under a 2px ink rule. The summary reads "Teacher notes" at 17px/800 with the section names after it in 13px muted, and an 18px chevron that rotates 180° over 180ms on the house ease when opened. Hover and open turn the summary house deep. Opened, its sections take the same section heads as the notification. A link to an id inside them, or to the topics they hold, opens them first.

### Loading

Rows of rule-coloured bars (100%, 80%, 60%) with a slow linear shimmer, never a spinner; the header shows a translucent title-sized block.

### Assessment Edit Page (signature)

Editing an assessment is reading it. The page draws the notification as the assessment page does, section by section in file order, and the teacher opens one section at a time to change it. Nothing on the page looks like a form until it is open, and nothing open looks like the page.

- **Closed section:** the section exactly as the assessment page draws it, under its Headline and 2px ink rule, with an **Edit** button at the right of the heading: paper, a 1px field-edge border, 13px/750 house deep. The whole section is the hit area: hover lays a 55% house-soft wash with a 40% house border (2px corners, bled 14px each side) and fills the Edit button with the house. A changed section says "Changed, not saved yet" beside its heading as a note-soft tag (13px/700 note deep); a section with marking problems shows the status line (a warn-deep diamond and the count) and the problems as one warn message.
- **One open at a time.** Opening a section closes the last one with its changes kept. Escape in a changed section asks first (Escape Prompt); in an unchanged one it just closes.
- **The parts table is made, never typed.** A Task overview table whose columns are Part, Marks and Where is generated from Marking criteria and drawn read-only: plain ink 2 text, 9px row padding, no field boxes, and a 13px muted line under it saying it is made from Marking criteria. The Marks detail reads the same way in the band: a 36px Figure numeral with "Worked out from Marking criteria" under it, never an input. A part heading in What to submit follows its part's name and marks while the part keeps the number it had when the file was opened, drawn as 18px/800 muted text with a line saying to change it in Marking criteria; otherwise it is flagged, never renamed.
- **Add section:** a full-width 38px paper button with a dashed field-edge border and 14px/750 house-deep text, turning solid house on hover.

### Open Editor

The one place notification text is being changed: a paper box with a 2px house border, 2px corners and the Panel shadow, padded 16px 18px 14px and bled 18px into the gutter. Inside it, every field is the app's own field (Inputs / Fields): a paper box, 1px rule-strong edge, 8px 10px padding, ink 2 on hover, a house edge and 3px 22% house ring on focus, caret in the house. Contenteditable text (`.rich`) wears the same box at 1.45 line height, so a field never looks like the page around it.

- **Heading:** "Section heading" label above a 22px/850 input.
- **Format bar:** Bold and Italic as 32px buttons above the blocks; Ctrl/Cmd+B and +I do the same.
- **Foot:** sticky 64px from the window's foot, so it stays in view above the save bar: a 40px/800 primary **Done**, Cancel, the hint "Done keeps your changes here. Save writes them." in 13px muted, then a More menu holding the rarer actions (Edit as plain text, Move section up or down, Remove section). A 1px 35% house rule separates it from the fields.
- Text is formatted, never Markdown: bold, italic, code and links show as themselves. Markdown the editor can't place as blocks is shown as text in a 13px mono textarea with a note saying so.

### Text Blocks

A section's text inside the open editor, one block under the next 6px apart, each with a 13px/700 ink 2 label above ("Paragraph", "List", "Table").

- **Paragraph:** a 15px field at 1.6 line height. **Sub-heading:** an 18px/800 field. **Quote:** italic, 14px inset with a 2px rule-strong line inside the field's left padding (a quote mark, not a stripe on a block).
- **Lists:** each item its own field, square house-deep markers (decimal for numbered lists).
- **Tables:** a grid of cell fields under a 2px ink rule, header cells at 800, 1px rule row dividers, 90px minimum cells, scrolling sideways in its own wrapper. A row's remove button shows on hover or focus (always below 560px).
- **Tools only where you are:** a block's tools (add item, add row or column, remove) appear under it only while focus is inside it, as 30px quiet 13px/750 house-deep buttons; destructive ones in warn deep.
- **Add:** an "Add" row under the last block behind a 1px dashed field-edge rule, offering Paragraph, Sub-heading, Bullet list and Table.
- Enter adds the next paragraph, item or row; Backspace in an empty one removes it.

### Criteria Editor (signature)

Marking criteria edited in place as the rubric it is. Parts are ruled rows (1px rule, 18px over 14px padding).

- **Part heading:** reads as the notification writes it, "Part N: name (marks)", at 22px/850, 72% width (18px below 560px): the name a field filling the row, the marks a 3.4em centred 900 tabular field inside a 15px/650 ink 2 bracket. A More menu sits at the end (Move part up or down, Split into criteria, Remove part).
- **Where:** a row of 32px buttons, "At home" and "In class", paper with field-edge borders; the chosen one fills with the house (`aria-pressed`). A 9em field beside them, placeholder "Other", takes the teacher's own words.
- **Rubric:** the assessment page's rubric with its cells as fields: a 2px ink head at 13px/800, each mark range in an 84px leading cell as a 30px Figure numeral in the house (the top range in house deep; 64px and 22px below 560px), what earns it as a text field beside it.
- **Criteria:** a part split into criteria names each in a 15px/800 field above its own rubric; the part's marks are their sum.
- **Fixes in place:** where a top mark range doesn't match the marks, or criteria don't sum to the part, a warn-soft strip (13px warn deep) states it with a paper button that fixes it.
- A part that can't be read as parts is shown as text with a note, and saved exactly as it came.

### Assessable Topics Editor

The topics as ruled rows (1px rule): the topic's text and its syllabus ids in a right-hand cell (15px 900 condensed house deep, struck through in warn deep when unknown). Selecting a row grounds it in house soft with a house rule beneath and opens its fields: dot point, **Phase**, and a note. The dot point picker is a paper panel (1px rule-strong, max 340px, scrolling) with a find field, the registry's phases as 13px/800 house-deep heads, and each dot point as a row with its id in a 52px leading cell, hovering house soft. Units examined sit above as checkboxes.

### Band Fields

The title and details are edited in the house band, as the header that shows them. A field on the house is a light well at rest (14% house-on fill, 70% house-on edge, house-on text) and becomes a white field with ink text and a 3px house-on outline in use (field-on). Placeholders are examples, never values: italic, at 500, lighter than typed text. The title field is 30px/850 at 75% width; each detail is a 230px block topped with a 2px 55% house-on rule, with its name at 13px/800, its figure as a 22px/850 field, and "+ Small print" opening the line under it. A date detail opens the system date picker. The band's own Done is a 42px house-on button with house-deep text; Cancel and remove are transparent with 60% house-on edges. The band closes with a 4px 70% house-on rule along its foot.

### Save Bar

Sticky at the foot of the window: paper, a 2px house rule along its top, and the Save bar lift. In one row: the save state ("No changes", or "Changed: Task overview, Marking criteria" in bold), Undo when there's something to undo, then in warn deep "Saves with 2 marking problems to fix later", each count an underlined link to its section, then "Leave without saving" ("Back" when nothing changed) as a quiet button and **Save** (**Create** for a new task) as a 42px/800 primary carrying a `Ctrl S` key. Marks and syllabus problems never block a save; only what would write a file the data repo can't read does (no title, no units or topics, a part with no name, a bad file name for a new task), and the bar says so: "Can't save yet: …".

### Undo Ghost

A removal leaves a ghost where the thing was: a sunk strip with a 1px dashed field-edge border, "Removed the table" in 14px ink 2 and an 800 house-deep Undo button. One step of undo only; the save bar offers the same Undo until the next removal, a Cancel or a save. Nothing shifts to make room for it.

### Escape Prompt

Asked in the page, never in a browser dialog: a 460px paper panel fixed 88px above the window's foot, centred, with a 2px house border and the Panel shadow. An 18px heading, a 14px ink 2 line, and two choices: **Keep my changes** (primary) and **Undo my changes** (warn deep text and border). The leave prompt takes the same form.

### More Menus

Rarer actions live behind a "More" summary: a 32–36px paper button with a field-edge border and a chevron. The menu is a paper panel (1px field-edge, 6px padding, 200–220px wide, Panel shadow) of left-aligned quiet buttons, destructive ones last in warn deep. It opens upward from an editor's foot and downward from a part heading.

## Do's and Don'ts

### Do:

- **Do** give every class-scoped page `data-house` and read only `--house`, `--house-on`, `--house-soft` and `--house-deep` inside it.
- **Do** assign houses through `houseMap` / `houseOf`: an offering's fixed `colour` first, then sorted offering path cycling cobalt, emerald, ruby, saffron, plum, lagoon, tangerine, moss.
- **Do** put identifiers (lesson number, start minute, term, syllabus id) in a fixed leading cell as a condensed figure or bold label.
- **Do** head every list with a 2px ink rule and divide rows with 1px rules.
- **Do** set figures in Archivo at 70–75% width and 900 weight, with tabular numerals.
- **Do** present feedback as paper entries topped with a 3px house rule.
- **Do** keep corners at 0 for fields and 2px for controls.
- **Do** honour `prefers-reduced-motion`; every transition collapses to near zero.
- **Do** draw an assessment notification in its own order, its parts only where it puts them.
- **Do** put rubric mark ranges and outcome codes in a leading cell, as a Figure numeral and a bold house-deep label.
- **Do** show the syllabus status beside the topics only when the check fails; elsewhere it stays a status line in the header and side column.
- **Do** let the edit page read like the page it edits; a field appears only in the one open section or band.
- **Do** make every field on the edit page the app's own field (paper box, rule-strong edge, house focus ring), the same as the lesson editor's.
- **Do** draw anything generated (the parts table, marks from the parts) as plain read-only text, never as a disabled field.
- **Do** keep each block's tools hidden until focus is in it, and put rare actions behind More.
- **Do** ask in the page, with two named choices, before discarding changes.

### Don't:

- **Don't** put eyebrow or kicker labels above headings; ids and terms go in leading cells.
- **Don't** use coloured side stripes (a thick border on one edge) on messages, entries, cards or rows.
- **Don't** shrink a house colour to a chip, pill or badge.
- **Don't** shade house fields with gradients, glows or shadows; the activity hatch is the only pattern.
- **Don't** load fonts or any asset from a third-party host; the CSP allows only api.github.com.
- **Don't** round corners beyond 2px, except circular status dots.
- **Don't** use uppercase tracking for labels; labels are small, sentence case and bold.
- **Don't** add a marks bar, a parts list or a part summary panel to the assessment page; the owner retired them, and the notification's own Marking criteria is enough.
- **Don't** render notification Markdown as HTML; parse it and draw each node as an element.
- **Don't** show Markdown marks to the teacher while editing; text is formatted in place.
- **Don't** make an editable field look like the text around it, or a read-only value look like a field.
- **Don't** use browser `confirm`, `alert` or `prompt` dialogs on the edit page.
- **Don't** block a save on a marks or syllabus problem; say what's wrong and save anyway.
