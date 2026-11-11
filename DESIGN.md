---
name: Almanac Editor
description: House Colours. A browser editor for lessons-as-code where every class wears its own flat house colour.
colors:
  chalk: '#f3f4f0'
  paper: '#fcfcfa'
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
- **Sunk** (sunk): inline code ground and the hover on plain list rows.
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
- **Label** (600–700, 13px): field labels, crumbs, header meta, counts.
- **Micro** (600–800, 11–12px): lane segment labels, tick numbers, finish-line flag, term codes, offering ids in bands.

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

## Elevation & Depth

The world is flat. Separation comes from colour fields, the chalk/paper step and rules. One soft two-layer shadow lifts the few panels that float over the page, and the jump dialog gets a deeper one. There are no hard offset shadows and no hover lift.

### Shadow Vocabulary

- **Panel** (`box-shadow: 0 1px 2px rgb(21 23 28 / 0.06), 0 6px 18px -6px rgb(21 23 28 / 0.14)`, token `--shadow`): the lane-strip panel at the top of a lesson, the editor's sticky save bar and its messages, the welcome sample card, the settings card.
- **Dialog** (`box-shadow: 0 2px 4px rgb(0 0 0 / 0.08), 0 24px 60px -12px rgb(0 0 0 / 0.35)`): the jump dialog only, over a 45% ink backdrop with a 2px blur.

### Named Rules

**The Flat Field Rule.** House colours are flat and unmodulated: no gradients, no shadows on bands or headers. The only patterned fill is the activity hatch.

## Shapes

Square. Controls, code and kbd take a 2px radius; colour fields, tiles, bands, lane segments, panels and dialogs are 0. Circles appear only as status marks (the save-state dot, the success message mark). Form language is rectangles and lines: 2px ink rules head lists, 1px rules divide rows, 3px house rules top feedback entries, 3px ink bars mark the finish line, and small solid squares (9–12px) serve as list bullets, legend keys and message marks (a diamond for warnings).

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

### Feedback Entries

Feedback lives in the lesson margin as a stack of paper entries, each topped with a 3px house rule, 14px text, the "Change next time" line in ink 2 led by a house-deep label, and the author in 12px bold muted. No side stripe, no tint block.

### Messages

One tinted block with one mark, never a coloured edge stripe. 12px 14px padding, 14px text, a 10px mark in the leading position: a warn-deep diamond on warn soft for problems, a good-green circle on good soft for success, a note-deep square on note soft for notices.

### Loading

Rows of rule-coloured bars (100%, 80%, 60%) with a slow linear shimmer, never a spinner; the header shows a translucent title-sized block.

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

### Don't:

- **Don't** put eyebrow or kicker labels above headings; ids and terms go in leading cells.
- **Don't** use coloured side stripes (a thick border on one edge) on messages, entries, cards or rows.
- **Don't** shrink a house colour to a chip, pill or badge.
- **Don't** shade house fields with gradients, glows or shadows; the activity hatch is the only pattern.
- **Don't** load fonts or any asset from a third-party host; the CSP allows only api.github.com.
- **Don't** round corners beyond 2px, except circular status dots.
- **Don't** use uppercase tracking for labels; labels are small, sentence case and bold.
