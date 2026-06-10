# Product

## Register

product

## Users

Gómez y Crespo sales representatives, using the tool during farm visits or calls with the client present. The farmer is in the room (or on the line) watching the screen. Decisions are made in real time: "can my nave support an aviario?" gets answered on the spot. The interface must project competence and trust — if it looks sloppy, the salesperson's credibility suffers.

## Product Purpose

A sales and compliance calculator for two poultry egg-production systems (Nidal Colectivo A-Nida and Aviario Industrial). It guides the rep through a short intake (hen count, housing system, nave dimensions), verifies whether the installation is legal under Spanish regulation (RD 3/2002), recommends the best fitting product, sizes it (modules, surface, density), and generates a commercial proposal with a normative analysis. Success means the rep walks out of a farm visit with a signed quote, not a stack of handwritten notes.

## Brand Personality

Experto, cercano, práctico. G&C is the specialist who knows the regulation better than the inspector and explains it without condescension. Warmth comes from competence and directness, not from rounded corners or friendly illustrations.

## Anti-references

- Generic SaaS / startup aesthetic: cream or off-white backgrounds, hero gradients, floating cards with large border-radii, colorful icons, confetti onboarding. This tool is not a productivity app — it lives on a farm office table or a tablet held during a barn walkthrough.
- Overly bureaucratic or government-portal look: dense tables, system fonts, zero visual hierarchy, grey-on-grey.

## Design Principles

1. **Precision over decoration.** Numbers are the product. Monospace data, clear units, stark pass/fail states — these signal expertise. Visual decoration that doesn't carry information should not exist.
2. **The rep should never squint.** Every label, value, and status must be legible at arm's length on a tablet in uneven barn lighting. Contrast is not negotiable.
3. **One decision per screen.** The flow is linear: enter data, see analysis, confirm system, read proposal. Avoid branching menus or information that appears before the user needs it.
4. **Technical credibility.** Typography and layout choices should feel closer to an engineering data sheet than to a marketing brochure. The UI earns trust through rigour, not charm.
5. **Spanish-language first.** All copy, labels, and messages are in Spanish. Tone is direct and professional — not formal bureaucratic, not casual startup.

## Accessibility & Inclusion

- WCAG AA minimum for all text (4.5:1 body, 3:1 large). Current `--foreground: #808285` on white fails — must be corrected.
- Tablet-first responsive (sales reps carry iPads to farm visits). Touch targets minimum 44px.
- No motion-dependent interactions; reduced-motion must be respected.
