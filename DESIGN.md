---
name: Agente Aviario — Gómez y Crespo
description: Calculadora de ventas y cumplimiento normativo para sistemas de alojamiento avícola
colors:
  forest-green: "#4f764d"
  forest-green-deep: "#234926"
  forest-green-tint: "#eaf5ea"
  ok-text: "#1d6b22"
  ok-icon: "#2E7D4F"
  midnight-ink: "#000823"
  slate-body: "#484e62"
  institutional-white: "#ffffff"
  field-gray: "#F6F7F8"
  hairline: "#dddddd"
  fail-bg: "#fdecea"
  fail-text: "#b5261e"
  amber-warning: "#d4a017"
  amber-bg: "#fffbeb"
  regulation-blue: "#0274BE"
typography:
  display:
    fontFamily: "Montserrat, sans-serif"
    fontSize: "clamp(1.8rem, 4vw, 2.82rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Montserrat, sans-serif"
    fontSize: "1.52rem"
    fontWeight: 800
    lineHeight: 1.1
  title:
    fontFamily: "Montserrat, sans-serif"
    fontSize: "1rem"
    fontWeight: 800
    lineHeight: 1.2
  body:
    fontFamily: "Source Sans Pro, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Montserrat, sans-serif"
    fontSize: "0.68rem"
    fontWeight: 700
    letterSpacing: "0.08em"
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "inherit"
    fontWeight: 700
    lineHeight: 1
rounded:
  sharp: "2px"
  subtle: "4px"
  pill: "30px"
  circle: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "#4f764d"
    textColor: "#ffffff"
    rounded: "30px"
    padding: "12px 28px"
  button-primary-hover:
    backgroundColor: "#234926"
    textColor: "#ffffff"
    rounded: "30px"
    padding: "12px 28px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "#4f764d"
    rounded: "30px"
    padding: "11px 24px"
  field-input:
    backgroundColor: "#ffffff"
    textColor: "#000823"
    rounded: "2px"
    padding: "11px 14px"
  status-ok:
    backgroundColor: "#eaf5ea"
    textColor: "#1d6b22"
    rounded: "30px"
    padding: "2px 10px"
  status-fail:
    backgroundColor: "#fdecea"
    textColor: "#b5261e"
    rounded: "30px"
    padding: "2px 10px"
  mode-card:
    backgroundColor: "#ffffff"
    textColor: "#000823"
    rounded: "2px"
    padding: "20px 24px"
  mode-card-hover:
    backgroundColor: "#eaf5ea"
    textColor: "#000823"
    rounded: "2px"
    padding: "20px 24px"
---

# Design System: Agente Aviario — Gómez y Crespo

## 1. Overview

**Creative North Star: "El Cuaderno de Campo del Ingeniero"**

This is a tool carried into barns and farm offices, shown on a tablet screen to a farmer making a six-figure equipment decision. The visual system earns trust through precision, not through charm. Every element pulls its weight: numbers are displayed in monospace at clear sizes, pass/fail states are unambiguous at arm's length, and the layout guides the eye from input to output without detours.

The aesthetic reference is the field data sheet: a single-column instrument on white stock, dark ink for text, forest green as the one color that carries meaning (active, viable, confirmed), warm amber for warnings, red for failures. Decoration that carries no information does not exist here. The G&C salesperson needs to look competent in front of the client — this interface either helps or hinders that. It helps through density and clarity, never through illustration or embellishment.

This system explicitly rejects the generic SaaS aesthetic: no cream or off-white backgrounds, no floating cards with generous border-radii, no gradient heroes, no icon-heavy onboarding, no modal-first flows. It also rejects the bureaucratic government-portal look: low visual hierarchy, grey-on-grey, zero typographic craft. Agente Aviario is a professional instrument that looks like it was designed by people who understand both animal husbandry regulation and information design.

**Key Characteristics:**
- White canvas with forest green as the sole chromatic accent
- Sharp edges (2px radius) on data surfaces; pill shapes (30px) reserved for action buttons and status badges
- Monospace for all numeric data; no mixing with proportional type
- Strong semantic vocabulary: green = viable/ok, red = fail, amber = warning — applied consistently and never decoratively
- Horizontal hairline dividers, not card stacks, to separate information sections
- Minimal elevation: flat at rest, one diffuse shadow reserved for the final result block

## 2. Colors: The Field Instrument Palette

A controlled, intentional palette with forest green as the single accent. Everything else is neutral. Color signals state, not decoration.

### Primary
- **Forest Green** (`#4f764d`): The active accent. Used for primary buttons, confirmed/viable states, progress fill, focus rings, recommended badges, section dividers. If something is selected, actionable, or passing, it is this color.
- **Forest Green Deep** (`#234926`): The pressed/hover variant of the primary. Used only on `button-primary:hover`, never as a standalone surface color.
- **Forest Green Tint** (`#eaf5ea`): Success background. The light field behind confirmed answers, viable cards, recommended comparison panels. Never used as a page background — only inside semantic containers.

### Secondary
- **Regulation Blue** (`#0274BE`): Reserved for text selection highlight only. Not used as a UI accent, not used on buttons or status.

### Tertiary
- **Amber Warning** (`#d4a017`): Warning indicators. Used as the accent on warning containers and the Pareto reference line. Never as a side-stripe border — always as full border, background tint, or inline accent.
- **Amber Background** (`#fffbeb`): The surface for warning containers.

### Neutral
- **Midnight Ink** (`#000823`): Primary heading color — the dark header bar, H1, H2, progress circles (active). Near-black with the faintest blue cast; do not substitute with pure black.
- **Slate Body** (`#484e62`): Body text, secondary labels, subtitles, descriptions. 7.4:1 contrast on white — use this for body text. Do not use `#808285` for body text; it fails WCAG AA.
- **Institutional White** (`#ffffff`): Page background. Always white, never cream, never tinted.
- **Field Gray** (`#F6F7F8`): Secondary surface. Section headers within result blocks, alternate card backgrounds, the bg-alt layer. Slightly cooler than the canvas to create depth without elevation.
- **Hairline** (`#dddddd`): All borders and dividers. One weight, one color.
- **OK Text** (`#1d6b22`): Text inside success containers. Do not use Forest Green for text on light surfaces — use this darker token.
- **OK Icon** (`#2E7D4F`): Icon/badge fill inside success contexts.
- **Fail Background** (`#fdecea`): Surface inside failure containers.
- **Fail Text** (`#b5261e`): Text inside failure containers.

### Named Rules
**The One Accent Rule.** Forest green appears on fewer than 15% of any screen's surface area. Its presence means something: viable, confirmed, action required. When it appears everywhere, it means nothing.

**The Contrast Minimum Rule.** Body text is `#484e62` on white (7.4:1). `#808285` is forbidden for body text — it reads 3.8:1 on white and fails WCAG AA. Every label, description, and data annotation must clear 4.5:1 against its background.

**The No-Decorative-Color Rule.** Amber and red exist to signal state. A warning box that is amber because something is wrong. An error box that is red because something failed. If the color has no semantic reason, it does not appear.

## 3. Typography

**Display/Heading Font:** Montserrat (800, 700) — geometric sans, high x-height, authoritative at large sizes. Used for headings, progress labels, field labels, status badges.

**Body Font:** Source Sans Pro (300, 400, 600, 700) — humanist sans, excellent legibility at reading sizes. Used for all prose, descriptions, question text, analysis copy.

**Data Font:** JetBrains Mono (400, 700) — monospaced, tabular figures. Used for all numeric data: hen counts, surface areas, densities, module counts. Never used for labels or prose.

**Character:** A tight sans hierarchy that reads as technical literature, not marketing. Montserrat carries the structure; Source Sans Pro carries the meaning; JetBrains Mono carries the numbers. Three voices, three distinct roles. They do not overlap.

### Hierarchy

- **Display** (Montserrat 800, `clamp(1.8rem, 4vw, 2.82rem)`, leading 1, tracking -0.02em): Page title ("Agente Aviario"). One instance per page.
- **Headline** (Montserrat 800, `1.52rem`, leading 1.1): Step titles ("Datos del proyecto", "Capacidad de la nave"). One per step/section.
- **Title** (Montserrat 800, `1rem–1.17rem`, leading 1.2): Card titles, product names within comparison panels.
- **Body** (Source Sans Pro 400, `1rem`, leading 1.65): Descriptions, analysis text, recommendation reasons. Maximum 65–75ch line length.
- **Body Light** (Source Sans Pro 300, `0.95rem`, leading 1.65): Subtitles, supporting descriptions under headlines.
- **Label** (Montserrat 700, `0.65–0.72rem`, tracking 0.08–0.12em, uppercase): Field labels, section headers, badge text, progress step names. Uppercase reserved for labels only — never for body copy.
- **Data** (JetBrains Mono 700, contextual size `0.8rem–2rem`): All numeric values with units. Size scales with the importance of the number: hen totals at 2rem, density values at 0.95rem, Pareto table entries at 0.65rem.

### Named Rules
**The Mono-for-Numbers Rule.** Every numeric value that the client might write down or compare gets JetBrains Mono. No exceptions. Proportional digits in data fields introduce the kind of visual inconsistency that makes a tool feel amateur.

**The No-Display-in-Labels Rule.** Montserrat is the label font. It is not the body font. Sentences, descriptions, and analysis text use Source Sans Pro. Mixing Montserrat into running prose at normal weight makes the interface feel like a PowerPoint, not a professional instrument.

## 4. Elevation

This system is flat by default. Surfaces distinguish themselves through background color (`#ffffff` vs `#F6F7F8`), border weight (1–2px `#dddddd`), and header bands — not through shadows. The one exception is the final result card (`result-wrap`), which uses a single diffuse ambient shadow (`0 2px 16px rgba(0,0,0,0.07)`) to frame the deliverable as the most important element on the page.

### Shadow Vocabulary

- **Ambient Result** (`box-shadow: 0 2px 16px rgba(0,0,0,0.07)`): Applied only to `result-wrap` — the final normative report. Signals "this is the output." Do not apply to cards, inputs, or intermediate steps.
- **Hover Glow** (`box-shadow: 0 2px 12px rgba(79,118,77,0.1)`): The tinted shadow that appears on mode selection cards on hover. Uses the primary green hue to echo the border-color change. Not applied to any other component.

### Named Rules
**The Flat-by-Default Rule.** Data surfaces are flat at rest. Shadows appear only on the final result block and on hover-state mode cards. Any other use of `box-shadow` is a violation. Use border-color changes and background tints to convey depth.

## 5. Components

### Buttons

Three variants. Shape vocabulary is intentionally split: pill (30px) for primary actions the client must click, sharp (2px) would be an error here — pills signal "this is an action," sharp edges signal "this is data."

- **Primary (pill):** Forest Green (`#4f764d`) fill, white text, Source Sans Pro 700 0.9rem, letter-spacing 0.05em, uppercase, 30px radius, 12px 28px padding. Hover darkens to `#234926` in 150ms. Disabled at 0.4 opacity.
- **Outline (pill):** Transparent fill, 2px Forest Green border, Forest Green text. Same shape and padding. Hover fills to Forest Green with white text. Used for secondary actions (Nueva consulta, Modificar datos).
- **Back / Nav:** No background or border. Montserrat 700 0.68rem uppercase, Slate Body color, transitions to Forest Green on hover. Inline with a left-arrow SVG icon. Not a pill — it is a navigation affordance, not a call to action.

### Mode Cards

The opening-screen selector pattern. A large touch target (minimum 52px height) with a 52px circle icon container, heading + description, right-arrow affordance. Sharp border (2px `#dddddd`) at rest; on hover the border transitions to Forest Green and the background to Forest Green Tint. The right-arrow slides 3px right on hover. No shadow at rest. Touch-target friendly for tablet use.

### Form Fields

- **Text input / number input:** 1px `#dddddd` border, 2px radius, white fill, Midnight Ink text at 0.95rem. Padding 11px 14px, unit label anchored to right edge. Focus state: Forest Green border + 3px Forest Green tint ring (`rgba(79,118,77,0.1)`). Placeholder text should use `#6b7280` or darker — never the default browser placeholder color which fails contrast.
- **Select:** Same border/radius/padding. Custom chevron in Slate Body. Appearance reset (`-webkit-appearance: none`).
- **Field label:** Montserrat 700 0.68rem uppercase 0.08em tracking, Midnight Ink. Displayed above the field; never as placeholder text.

### Status Badges / Chips

Pill shape (30px radius). Two semantic variants:
- **OK / Viable:** Forest Green Tint bg, OK Text color, border 1px Forest Green.
- **Fail / No viable:** Fail Background, Fail Text, no border.
- **Neutral:** Field Gray bg, Slate Body text, hairline border.

These are read-only state indicators. Do not use them as interactive filters or toggles.

### Data Cards (Capacidad / Factibilidad)

Sharp (2px) border. Two states:
- **Viable:** 2px Forest Green border, Forest Green Tint background. Gallinas count in JetBrains Mono at 2rem.
- **Non-viable:** 2px Hairline border, Field Gray background, 0.55 opacity.

Internal anatomy from top: header strip (label + badge), numeric data (monospaced, large), stats grid (2-col), layout detail, CTA button. Stats grid uses JetBrains Mono for values, Montserrat label for titles.

### Result Block (Informe)

The final deliverable. `1px #dddddd` border, `box-shadow: 0 2px 16px rgba(0,0,0,0.07)`, `overflow: hidden`. Internal structure:
1. Full-width banner: dark green (`#1E4D2B`) or dark red (`#4D1E1E`) background, white text, 48px circle icon.
2. Meta strip: slightly lighter version of the banner bg, small pill tags.
3. Section blocks with Field Gray header bands (`VERIFICACIÓN DE LA NAVE`, etc.) — the only uppercase section labels permitted inside the result.
4. Check rows: 24px icon circle, parameter name, real/limit values, diff badge.
5. Footer: Field Gray, italic small print with regulation references.

### Progress Bar

4-step horizontal indicator. Circles: 28px diameter. States: inactive (Hairline border), active (Midnight Ink fill, white number), done (Forest Green fill, white checkmark SVG). Label: Montserrat 700 0.68rem uppercase Hairline, transitions to Midnight Ink when active. Connector line: 1px Hairline, full-width between circles.

## 6. Do's and Don'ts

### Do:
- **Do** use `#484e62` (Slate Body) for all body text and secondary descriptions. It clears WCAG AA (7.4:1 on white).
- **Do** use JetBrains Mono for every numeric value the client will read, compare, or write down: hen counts, m² areas, densities, module counts.
- **Do** keep the page background `#ffffff` — pure white, always. Warmth in the palette comes from the forest green, not from the background.
- **Do** use 2px border radius (sharp) for data containers and form fields. Reserve 30px pills for action buttons and status badges only.
- **Do** use full-border or full-background-tint for warning containers. A `border-left` stripe is forbidden.
- **Do** test every screen at tablet viewport (768px–1024px). The primary use context is a sales rep holding an iPad in a barn.
- **Do** apply `prefers-reduced-motion: reduce` to all CSS animations. Every `@keyframes` block needs a reduced-motion override.

### Don't:
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on any container. This is a banned pattern. Replace with full border + background tint.
- **Don't** use `#808285` for body text or descriptions. It fails WCAG AA on white (3.8:1). Use `#484e62` instead.
- **Don't** put Montserrat uppercase tracked labels on every section. Label every section with an uppercase eyebrow only when it provides navigation or disambiguation value. When every section has one, none of them do.
- **Don't** apply `box-shadow` to cards, inputs, mode selectors, or factibilidad boxes. Shadows are reserved for the final result block and mode-card hover.
- **Don't** use Forest Green as a background color for large surface areas. It is an accent — it appears on buttons, status indicators, progress fills, and focused elements.
- **Don't** use Montserrat for body copy or multi-sentence descriptions. It is the label font. Running text in Montserrat reads as a PowerPoint, not as a professional instrument.
- **Don't** design with cream, sand, beige, or warm-tinted off-white backgrounds. The canvas is `#ffffff`. The SaaS cream aesthetic is explicitly rejected.
- **Don't** introduce floating cards, gradient headers, hero sections with large illustrations, or rounded-corner (8px+) containers. This is a data instrument, not a product landing page.
- **Don't** use color as the only distinguisher between pass and fail states. Always pair color with an icon (checkmark / ×) and text so the UI works for color-blind users.
- **Don't** put numeric data (densities, module counts, surface areas) in proportional fonts. If a number matters enough to show, it goes in JetBrains Mono.
