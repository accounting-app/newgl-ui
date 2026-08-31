---
name: New GL (quickslike)
description: A QuickBooks-familiar accounting workspace over a plain-text ledger you fully own
colors:
  action-primary: "#00892E"
  action-primary-hover: "#2CA01C"
  link: "#0365AC"
  text-global: "#21262A"
  text-primary: "#393A3D"
  text-disabled: "#8D9096"
  text-inverse: "#FFFFFF"
  surface-primary: "#FFFFFF"
  surface-secondary: "#ECEEF1"
  surface-accent: "#F4F5F8"
  border-primary: "#8D9096"
  divider: "#D4D7DC"
  sidebar-background: "#F0F4F6"
typography:
  body:
    fontFamily: "Avenir Next forINTUIT, Avenir Next, Avenir, Helvetica, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
  label:
    fontFamily: "Avenir Next forINTUIT, Avenir Next, Avenir, Helvetica, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 600
rounded:
  xs: "2px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  sm: "12px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.action-primary}"
    textColor: "{colors.text-inverse}"
    rounded: "{rounded.full}"
    padding: "0 20px"
  button-primary-hover:
    backgroundColor: "{colors.action-primary-hover}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.full}"
  card:
    backgroundColor: "{colors.surface-primary}"
    rounded: "{rounded.xl}"
    padding: "24px"
---

# Design System: New GL (quickslike)

## Overview

**Creative North Star: "QBO-Familiar, Plain-Text-Honest"**

New GL deliberately mirrors QuickBooks Online's professional-SaaS visual
language -- Intuit's own brand green, its `Avenir Next forINTUIT` font
stack, and its rounded-pill button shape -- so a small-business owner who
has ever touched QuickBooks feels instantly oriented on day one. The design
does not try to look distinctive for its own sake; familiarity is the whole
point, because the differentiator lives underneath the UI, not on top of
it: every company's ledger is a real, plain-text Beancount file the user can
download, diff, and run outside this app, unlike the black-box database a
QBO-style interface usually hides.

The interface stays calm and gets out of the way of the numbers: flat
surfaces, hairline borders instead of shadows, and a single green accent
used sparingly for the one primary action on a screen. Nothing here should
surprise a bookkeeping-averse small-business owner or make the software feel
like it's asking for attention it hasn't earned.

**Key Characteristics:**
- Intuit-green primary action color, used sparingly
- Flat surfaces with hairline borders, not shadows, as the default depth cue
- Rounded-full (pill) buttons, `8-12px` radius on cards and containers
- Five swappable themes (light default, dark, modern, america250, pretty) share the exact same token names, so the identity survives a full palette swap

## Colors

Trust and legibility over expression -- almost every screen is text and numbers, so the palette stays quiet except for the one green accent.

### Primary
- **Intuit Green** (`#00892E`, hover `#2CA01C`): the single primary-action color -- submit/save buttons, the active nav state, positive financial indicators. Used on the smallest possible surface area of any given screen; it is not a background color.

### Neutral
- **Charcoal Ink** (`#21262A`): primary heading/global text color.
- **Slate Text** (`#393A3D`): body text, secondary to the global heading color.
- **Steel Border** (`#8D9096`): default border color for inputs, buttons, and dividers between sections.
- **Hairline Divider** (`#D4D7DC`): the lightest divider, used between list rows and inside cards.
- **Paper White** (`#FFFFFF`): card/surface background.
- **Cool Mist** (`#ECEEF1` / `#F4F5F8`): the page's own background, one step darker than the cards sitting on it, so cards read as raised without needing a shadow.
- **Sidebar Mist** (`#F0F4F6`): the settings/nav sidebar's own background, distinct from the page background.

### Named Rules
**The One Green Rule.** The primary accent color is reserved for the single primary action per screen (submit, save, the active nav item). It never becomes a background fill or a decorative accent -- its rarity is what makes it legible as "the button to press."

## Typography

**Body Font:** Avenir Next forINTUIT (with Avenir Next, Avenir, Helvetica, Arial, sans-serif fallbacks)

**Character:** A humanist sans-serif chosen specifically to match Intuit's own product typography -- warm enough not to feel like enterprise software, precise enough not to feel casual.

### Hierarchy
- **Title** (600, 18px / `text-lg font-semibold`): card and section headers (`Card.Header`).
- **Body** (400, 16px): default body text and form values.
- **Label** (600, 13px): input labels, table headers, small metadata text (`--font-size-input-text`).

### Named Rules
**The No-Inter Rule.** Never fall back to a generic system/AI-default sans (Inter, system-ui) as the primary face -- the `Avenir Next forINTUIT` stack is a deliberate brand-matching choice, not a placeholder.

## Layout

Content-dense, form- and table-heavy layouts typical of an accounting back office rather than a marketing surface. Settings pages use a fixed left sidebar (`Sidebar Mist` background) plus a content column; the register and reports use full-width tables. Spacing runs on a loose 4px-multiple rhythm (`gap-1.5`, `gap-2`, `p-4/6/8`) rather than a strict numeric scale token set.

## Elevation & Depth

Flat by default. The light and dark themes carry no default shadow tokens at all -- depth between the page background and a card comes from a one-step background tint difference (`Cool Mist` page vs `Paper White` card) plus a hairline border, not a shadow. A couple of the alternate decorative themes (`modern`, `america250`, `pretty`) introduce soft shadows for accent elements, but that is theme-specific flourish, not the system's default behavior.

### Named Rules
**The Tint-Not-Shadow Rule.** Default depth cue is a background-tint step plus a hairline border. Reach for a shadow only inside a theme that has explicitly opted into one -- never add one to the light/dark base theme.

## Shapes

Two radius families, used consistently by role: **pill** (`rounded-full`, `9999px`) for every button regardless of variant, and a **small-to-medium radius scale** (`2px` inputs' corner accents, `8px` general containers, `12px` cards) for everything that isn't a button. Borders are 1px hairlines in `Steel Border` or `Hairline Divider`, never thicker.

## Components

### Buttons
- **Shape:** full pill (`rounded-full`, `9999px`), never a rectangle.
- **Sizes:** `sm` (32px tall), `md` (34px, the default), `lg` (40px) -- all with a generous horizontal padding relative to height so short labels never look cramped.
- **Primary:** `Intuit Green` background, white text, 1px border in the same green family; hover shifts to the lighter `#2CA01C`.
- **Secondary:** transparent background, `Slate Text` color, 1px `Steel Border`; hover fills with a translucent green tint (`rgba(0,137,46,0.1)`).
- **Ghost:** transparent background and border; hover fills with a translucent neutral tint, for the lowest-emphasis actions (icon buttons, row actions).
- **Destructive:** red border/text, filled solid red with white text on hover -- the only place red carries the same weight as the primary green.
- **Focus:** every variant shares one blue focus ring (`#3B82F6`, 2px, 1px offset) regardless of variant color -- focus visibility is never themed.

### Cards / Containers
- **Corner Style:** `12px` radius (`rounded-xl`).
- **Background:** `Paper White`, sitting on the page's `Cool Mist` background.
- **Shadow Strategy:** none by default -- see Elevation & Depth's tint-not-shadow rule.
- **Border:** 1px `Hairline Divider`.
- **Internal Padding:** `sm` 16px / `md` 24px / `lg` 32px, selected per context rather than one fixed value.

### Inputs / Fields
- **Style:** 1px `Steel Border`, `Paper White` background, `2px` radius at the `sm` size / default `4px`(`rounded`) at `md`.
- **Focus:** border and a 1px matching box-shadow both switch to the shared focus-blue -- never a glow, always a crisp border-plus-ring.
- **Disabled:** flattens to light-gray background/border/text (`#F3F4F6` / `#E5E7EB` / `#9CA3AF`), never just a lowered opacity.

### Navigation
- Left icon rail plus a bottom-pinned Settings entry; the active item uses the `Intuit Green`-adjacent hover accent (`--gbsg-nav-bar-action-color-hover`, a darker teal-green, `#005244`), not the same exact green as buttons -- navigation and action share a family, not a single value.

## Do's and Don'ts

### Do:
- **Do** reserve `Intuit Green` for the one primary action or the active nav state per screen.
- **Do** use a pill shape (`rounded-full`) for every button, no exceptions.
- **Do** default to a hairline border plus a background-tint step for depth, not a shadow.
- **Do** keep the same token names across all five themes so a theme swap never requires touching component code.

### Don't:
- **Don't** fall back to Inter or system-ui as the primary typeface -- it breaks the deliberate Intuit-brand match.
- **Don't** add a default drop shadow to a card or button in the light/dark base theme.
- **Don't** use the primary green as a background fill or large decorative block -- it stays rare.
- **Don't** invent a second focus-ring color per button variant -- focus is one shared blue, always.
