// Clases compartidas (Tailwind + daisyUI) por el estudio y la ficha técnica.
// Los colores salen del tema "gyc" de globals.css; los tamaños con print: son los del PDF.

export const MAIN =
  "w-full max-w-[1180px] mx-auto px-[clamp(1rem,4vw,2rem)] pt-12 pb-16 " +
  // El pie de cada hoja va en el margen inferior de @page (10 mm, ver globals.css)
  "print:max-w-none print:px-[12mm] print:pt-[12mm] print:pb-[4mm] print:box-decoration-clone";

// ── Texto ──
export const EYEBROW = "font-display text-xs font-semibold uppercase tracking-[0.08em] text-secondary mb-2";
export const H1 =
  "font-display text-[clamp(1.75rem,3vw,2.25rem)] font-semibold leading-tight tracking-tight mb-2 " +
  "print:text-[17pt] print:mb-0.5";
export const SUB = "max-w-prose text-base-content/70 mb-8 print:text-[9pt] print:mb-3";
export const HINT = "text-sm leading-normal text-base-content/70 print:text-[7.5pt]";

// ── Bloques y paneles ──
export const BLOCK = "mt-12 print:mt-5";
export const BLOCK_H =
  "font-display text-[1.35rem] font-semibold tracking-tight flex flex-wrap items-baseline gap-x-4 gap-y-1 " +
  "border-b-2 border-primary pb-2 mb-4 break-after-avoid print:text-[11pt] print:pb-1 print:mb-2";
export const BLOCK_NOTE = "font-sans text-sm font-normal tracking-normal text-base-content/70 print:text-[7.5pt]";
export const PANEL = "card card-border bg-base-100 shadow-sm mt-8 print:shadow-none print:mt-5";
export const PANEL_BODY = "card-body gap-0 p-6 print:p-3";
export const PANEL_TITLE = "font-display text-lg font-semibold mb-1 print:text-[11pt]";
export const SIDE = "rounded-field border border-base-300 bg-base-200 p-4";
export const SIDE_TITLE = "font-display text-[0.95rem] font-semibold mb-4";

// ── Formularios ──
export const FORM_GRID = "grid gap-6 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]";
export const FIELD = "flex flex-col gap-2";
export const LABEL = "font-display text-[0.9rem] font-medium";
/** Contenedor daisyUI `input` con la unidad a la derecha; el <input> va dentro con INPUT_IN */
export const INPUT_UNIT = "input w-full text-base tabular-nums";
export const INPUT_IN = "grow tabular-nums";
export const INPUT = "input w-full text-base tabular-nums";
export const UNIT = "text-sm text-base-content/70";
export const SEG = "tabs tabs-box w-full flex-nowrap";
export const SEG_BTN = "tab flex-1 min-h-11 text-[0.9rem]";

// ── Botones ──
export const BTN_PRIMARY = "btn btn-accent font-display";
export const BTN_GHOST = "btn btn-outline btn-primary border-2 font-display";
export const BACK =
  "inline-flex items-center gap-2 min-h-11 mb-4 font-display text-[0.9rem] font-medium " +
  "text-base-content/70 transition-colors hover:text-primary";

// ── Tablas ──
export const TABLE_WRAP =
  "overflow-x-auto rounded-box border border-base-300 bg-base-100 shadow-sm " +
  "print:overflow-visible print:shadow-none";
export const TABLE = "table min-w-[560px] print:min-w-0 print:table-xs print:text-[8pt]";
export const THEAD = "bg-base-200 font-display text-xs uppercase tracking-wide text-base-content/70 print:text-[6.5pt]";
export const PARAM = "font-medium";
export const DETALLE = "mt-0.5 text-[0.85rem] text-base-content/70 print:text-[7pt]";
export const ART = "text-xs text-base-content/70 print:text-[6.5pt]";
export const TAG = "badge badge-soft badge-sm whitespace-nowrap font-semibold print:badge-xs print:text-[6.5pt]";

export const ERR = "alert alert-error alert-soft mb-6";
