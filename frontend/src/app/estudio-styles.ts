// Estilos de la pantalla de estudio.
// Fuente de verdad del diseño: design-system/estudio-de-nave/MASTER.md
// (Minimalism & Swiss Style · navy + emerald · Outfit / Work Sans).
export const ESTUDIO_CSS = `
  :root {
    /* ── Paleta (MASTER.md) ── */
    --color-primary:          #1E3A5F;
    --color-on-primary:       #FFFFFF;
    --color-secondary:        #2563EB;
    --color-on-secondary:     #FFFFFF;
    --color-accent:           #059669;
    --color-on-accent:        #000000;
    --color-background:       #F8FAFC;
    --color-foreground:       #0F172A;
    --color-card:             #FFFFFF;
    --color-card-foreground:  #0F172A;
    --color-muted:            #F1F3F5;
    --color-muted-foreground: #475569;
    --color-border:           #E4E7EB;
    --color-input-border:     #E2E8F0;
    --color-destructive:      #DC2626;
    --color-on-destructive:   #FFFFFF;
    --color-ring:             #1E3A5F;

    /* Estados derivados de la paleta (texto ≥ 4,5:1 sobre su fondo) */
    --color-ok-bg:      #ECFDF5;
    --color-ok-text:    #047857;
    --color-fail-bg:    #FEF2F2;
    --color-fail-text:  #B91C1C;
    --color-warn-bg:    #FFFBEB;
    --color-warn-line:  #FDE68A;
    --color-warn-text:  #92400E;
    --color-primary-tint:   #E8EEF5;
    --color-secondary-tint: #DBEAFE;

    /* ── Tipografía ── */
    --font-heading: var(--font-outfit, 'Outfit'), system-ui, sans-serif;
    --font-body:    var(--font-work-sans, 'Work Sans'), system-ui, sans-serif;

    /* ── Espaciado (densidad 6/10) ── */
    --space-xs:  0.25rem;
    --space-sm:  0.5rem;
    --space-md:  1rem;
    --space-lg:  1.5rem;
    --space-xl:  2rem;
    --space-2xl: 3rem;
    --space-3xl: 4rem;

    /* ── Sombras ── */
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
    --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
    --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
    --shadow-xl: 0 20px 25px rgba(0,0,0,0.15);

    --radius-sm: 8px;
    --radius:    12px;
    --t:         200ms ease;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--font-body); font-size: 1rem; line-height: 1.6;
    background: var(--color-background); color: var(--color-foreground);
    -webkit-font-smoothing: antialiased;
  }
  button, input, select { font: inherit; }
  button:not(:disabled), select, [role="button"] { cursor: pointer; }
  :focus-visible { outline: 2px solid var(--color-ring); outline-offset: 2px; }
  .num, .est-kpi-val, .est-input { font-variant-numeric: tabular-nums; }

  /* ── Cabecera ── */
  .est-top {
    position: sticky; top: 0; z-index: 10;
    background: var(--color-card); border-bottom: 1px solid var(--color-border);
    box-shadow: var(--shadow-sm);
  }
  .est-top-inner {
    display: flex; align-items: center; gap: var(--space-md); height: 64px;
    max-width: 1180px; margin: 0 auto; padding: 0 clamp(var(--space-md), 4vw, var(--space-xl));
  }
  .est-logo { height: 44px; width: auto; flex-shrink: 0; }
  .est-top-div { width: 1px; height: 24px; background: var(--color-border); }
  .est-top-title {
    font-family: var(--font-heading); font-size: 1.05rem; font-weight: 600;
    color: var(--color-primary); letter-spacing: -0.01em;
  }
  .est-top-tag {
    font-size: 0.75rem; font-weight: 500; color: var(--color-muted-foreground);
    background: var(--color-muted); border-radius: 999px; padding: 0.15rem 0.6rem;
  }

  /* ── Pestañas de sección ── */
  .est-tabs { display: flex; align-items: center; gap: var(--space-xs); }
  .est-tab {
    display: inline-flex; align-items: center; min-height: 44px; padding: 0 var(--space-md);
    font-family: var(--font-heading); font-size: 0.95rem; font-weight: 500; text-decoration: none;
    color: var(--color-muted-foreground); border-radius: var(--radius-sm); position: relative;
    transition: color var(--t), background var(--t);
  }
  .est-tab:hover { color: var(--color-primary); background: var(--color-muted); }
  .est-tab.is-on { color: var(--color-primary); font-weight: 600; }
  .est-tab.is-on::after {
    content: ""; position: absolute; left: var(--space-md); right: var(--space-md); bottom: -10px;
    height: 2px; border-radius: 2px; background: var(--color-primary);
  }

  /* ── Pasos ── */
  .est-steps { display: flex; align-items: center; gap: var(--space-sm); margin-left: auto; }
  .est-step-item { display: inline-flex; align-items: center; gap: var(--space-sm); }
  .est-step {
    display: inline-flex; align-items: center; gap: var(--space-sm); min-height: 44px;
    font-family: var(--font-heading); font-size: 0.875rem; font-weight: 500;
    color: var(--color-muted-foreground);
    background: none; border: none; padding: 0 var(--space-xs); cursor: default;
    transition: color var(--t);
  }
  .est-step.is-link { cursor: pointer; color: var(--color-foreground); }
  .est-step.is-link:hover { color: var(--color-secondary); }
  .est-step.is-active { color: var(--color-primary); font-weight: 600; }
  .est-step-num {
    width: 24px; height: 24px; border-radius: 50%; display: inline-flex;
    align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600;
    border: 1.5px solid currentColor;
  }
  .est-step.is-done .est-step-num { background: var(--color-accent); border-color: var(--color-accent); color: var(--color-on-accent); }
  .est-step.is-active .est-step-num { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary); }
  .est-step-sep { width: 20px; height: 1.5px; background: var(--color-border); }
  @media (max-width: 767px) {
    .est-top-inner { gap: var(--space-xs) var(--space-sm); height: auto; flex-wrap: wrap; padding-block: var(--space-xs); }
    .est-tab { padding: 0 var(--space-sm); font-size: 0.9rem; }
    .est-tab.is-on::after { bottom: 4px; left: var(--space-sm); right: var(--space-sm); }
    .est-steps { width: 100%; margin-left: 0; border-top: 1px solid var(--color-border); }
    .est-logo { height: 34px; }
    .est-steps, .est-step-item { gap: var(--space-xs); }
    .est-step-sep { width: 10px; }
    .est-top-tag, .est-top-div, .est-top-title { display: none; }
    .est-step-label { display: none; }
    .est-step.is-active .est-step-label { display: inline; }
  }

  /* ── Layout ── */
  .est-main {
    width: 100%; max-width: 1180px; margin: 0 auto;
    padding: var(--space-2xl) clamp(var(--space-md), 4vw, var(--space-xl)) var(--space-3xl);
  }
  @keyframes stepIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  .est-anim { animation: stepIn 300ms ease both; }
  @media (prefers-reduced-motion: reduce) {
    .est-anim { animation: none; }
    *, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; }
  }

  .est-h {
    font-family: var(--font-heading); font-weight: 600; font-size: clamp(1.75rem, 3vw, 2.25rem);
    color: var(--color-foreground); letter-spacing: -0.02em; line-height: 1.15; margin-bottom: var(--space-sm);
  }
  .est-sub { font-size: 1rem; color: var(--color-muted-foreground); max-width: 65ch; margin-bottom: var(--space-xl); }
  .est-eyebrow {
    font-family: var(--font-heading); font-size: 0.8rem; font-weight: 600; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--color-secondary); margin-bottom: var(--space-sm);
  }

  /* ── Tarjetas (MASTER.md · Cards) ── */
  .est-mod-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-lg); }
  .est-mod-card {
    display: flex; flex-direction: column; gap: var(--space-sm); text-align: left; color: inherit;
    background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius);
    padding: var(--space-lg); box-shadow: var(--shadow-md); cursor: pointer;
    transition: box-shadow var(--t), transform var(--t), border-color var(--t);
  }
  .est-mod-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-2px); border-color: var(--color-primary); }
  .est-mod-icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 48px; height: 48px; border-radius: var(--radius-sm); margin-bottom: var(--space-sm);
    background: var(--color-primary-tint); color: var(--color-primary);
  }
  .est-mod-title { font-family: var(--font-heading); font-size: 1.25rem; font-weight: 600; color: var(--color-foreground); }
  .est-mod-desc { font-size: 0.95rem; line-height: 1.55; color: var(--color-muted-foreground); }
  .est-mod-specs { display: flex; flex-wrap: wrap; gap: var(--space-sm); margin-top: var(--space-sm); }
  .est-chip {
    font-size: 0.8rem; font-weight: 500; color: var(--color-primary);
    background: var(--color-muted); border-radius: 999px; padding: 0.15rem 0.65rem;
  }

  /* ── Formulario (MASTER.md · Inputs) ── */
  .est-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-lg); }
  .est-field { display: flex; flex-direction: column; gap: var(--space-sm); }
  .est-label { font-family: var(--font-heading); font-size: 0.9rem; font-weight: 500; color: var(--color-foreground); }
  .est-input-wrap { position: relative; display: flex; align-items: center; }
  .est-input, .est-select {
    width: 100%; min-height: 48px; padding: 12px 16px; font-size: 16px;
    color: var(--color-foreground); background: var(--color-card);
    border: 1px solid var(--color-input-border); border-radius: var(--radius-sm);
    transition: border-color var(--t), box-shadow var(--t);
  }
  .est-input:hover, .est-select:hover { border-color: #CBD5E1; }
  .est-input:focus, .est-select:focus {
    border-color: var(--color-primary); outline: none; box-shadow: 0 0 0 3px #1E3A5F20;
  }
  .est-input--unit { padding-right: 3.25rem; }
  .est-input[type=number] { -moz-appearance: textfield; appearance: textfield; }
  .est-input::-webkit-outer-spin-button, .est-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .est-input::placeholder { color: #64748B; }
  .est-input:disabled { background: var(--color-muted); color: var(--color-muted-foreground); cursor: not-allowed; }
  .est-unit { position: absolute; right: 16px; font-size: 0.875rem; color: var(--color-muted-foreground); pointer-events: none; }
  .est-hint { font-size: 0.85rem; color: var(--color-muted-foreground); line-height: 1.5; }

  /* ── Paneles ── */
  .est-panel {
    background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius);
    padding: var(--space-lg); margin-top: var(--space-xl); box-shadow: var(--shadow-sm);
  }
  .est-panel-title {
    font-family: var(--font-heading); font-size: 1.1rem; font-weight: 600; color: var(--color-foreground);
    margin-bottom: var(--space-xs);
  }
  .est-panel-title + .est-hint { margin-bottom: var(--space-lg); }
  .est-seg { display: flex; gap: var(--space-xs); flex-wrap: wrap; padding: var(--space-xs); background: var(--color-muted); border-radius: var(--radius-sm); }
  .est-seg-btn {
    flex: 1 1 auto; min-width: 56px; min-height: 44px; padding: var(--space-sm);
    font-size: 0.9rem; font-weight: 500; color: var(--color-muted-foreground);
    background: transparent; border: none; border-radius: 6px;
    transition: background var(--t), color var(--t), box-shadow var(--t);
  }
  .est-seg-btn:hover { color: var(--color-foreground); }
  .est-seg-btn.is-on { background: var(--color-card); color: var(--color-primary); font-weight: 600; box-shadow: var(--shadow-sm); }

  /* Selector de versión del estudio (cliente / técnica); no sale en el PDF */
  .est-version { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-sm) var(--space-md); margin-bottom: var(--space-lg); }
  .est-slot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); margin-top: var(--space-md); }
  @media (max-width: 620px) { .est-slot-grid { grid-template-columns: 1fr; } }

  .est-side { border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: var(--space-md); background: var(--color-background); }
  .est-side-title { font-family: var(--font-heading); font-size: 0.95rem; font-weight: 600; color: var(--color-foreground); margin-bottom: var(--space-md); }
  .est-side-paso { margin-top: var(--space-md); }
  .est-paso-row { display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; }
  .est-paso-row .est-input-wrap { flex: 1 1 92px; min-width: 92px; }

  /* ── Encaje del módulo en el ancho de nave ── */
  .est-fit {
    margin-top: var(--space-lg); border: 1px solid var(--color-border); border-left-width: 4px;
    border-radius: var(--radius); background: var(--color-card); padding: var(--space-md) var(--space-lg) var(--space-lg);
  }
  .est-fit.is-ok        { border-left-color: var(--color-accent); }
  .est-fit.is-no        { border-left-color: var(--color-destructive); }
  .est-fit.is-pendiente { border-left-color: var(--color-border); }

  .est-fit-head { display: flex; align-items: flex-start; gap: var(--space-md); margin-bottom: var(--space-md); }
  .est-fit-mark {
    flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; border-radius: 50%;
  }
  .est-fit.is-ok        .est-fit-mark { background: var(--color-ok-bg);   color: var(--color-ok-text); }
  .est-fit.is-no        .est-fit-mark { background: var(--color-fail-bg); color: var(--color-fail-text); }
  .est-fit.is-pendiente .est-fit-mark { background: var(--color-muted);   color: var(--color-muted-foreground); }

  .est-fit-copy { flex: 1 1 auto; min-width: 0; }
  .est-fit-title { display: block; font-family: var(--font-heading); font-size: 1rem; font-weight: 600; line-height: 1.35; color: var(--color-foreground); }
  .est-fit.is-ok .est-fit-title { color: var(--color-ok-text); }
  .est-fit.is-no .est-fit-title { color: var(--color-fail-text); }
  .est-fit-sub { display: block; font-size: 0.875rem; line-height: 1.5; color: var(--color-muted-foreground); margin-top: 2px; }

  .est-fit-nums { flex-shrink: 0; text-align: right; }
  .est-fit-ratio { font-family: var(--font-heading); font-size: 1.15rem; font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .est-fit-slash { color: #94A3B8; margin: 0 var(--space-xs); font-weight: 400; }
  .est-fit-need  { color: var(--color-foreground); }
  .est-fit.is-no .est-fit-need { color: var(--color-fail-text); }
  .est-fit-have  { color: var(--color-muted-foreground); }
  .est-fit-cap {
    display: block; font-size: 0.7rem; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--color-muted-foreground); margin-top: 2px; white-space: nowrap;
  }
  @media (max-width: 620px) {
    .est-fit-head { flex-wrap: wrap; }
    .est-fit-nums { text-align: left; width: 100%; padding-left: calc(32px + var(--space-md)); }
  }

  .est-fit-bar {
    position: relative; display: flex; align-items: stretch; width: 100%;
    height: 48px; border-radius: var(--radius-sm); overflow: hidden; background: var(--color-muted);
  }
  .est-fit-seg {
    position: relative; display: flex; align-items: center; justify-content: center;
    min-width: 0; overflow: hidden; box-shadow: inset -1px 0 0 #FFFFFF;
  }
  .est-fit-seg-in { display: flex; flex-direction: column; align-items: center; line-height: 1.15; padding: 0 2px; white-space: nowrap; }
  .est-fit-seg-name { font-style: normal; font-size: 0.62rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.85; }
  .est-fit-seg-val { font-size: 0.8rem; font-weight: 600; font-variant-numeric: tabular-nums; }
  .est-fit-seg.is-paso    { background: var(--color-muted); color: var(--color-muted-foreground); }
  .est-fit-seg.is-slot    { background: var(--color-secondary-tint); color: #1E40AF; }
  .est-fit-seg.is-cuerpo  { background: var(--color-primary); color: var(--color-on-primary); }
  .est-fit-seg.is-holgura {
    color: var(--color-muted-foreground);
    background: repeating-linear-gradient(45deg, #F8FAFC 0 5px, #EEF1F4 5px 10px);
  }
  .est-fit-over {
    position: absolute; top: 0; bottom: 0; right: 0; pointer-events: none;
    border-left: 2px solid var(--color-destructive);
    background: repeating-linear-gradient(45deg, rgba(220,38,38,0.26) 0 6px, rgba(220,38,38,0.10) 6px 12px);
  }
  .est-fit-over-tag.is-outside { left: auto; right: 100%; margin-right: 5px; }
  .est-fit-over-tag {
    position: absolute; top: 4px; left: 4px; font-size: 0.62rem; font-weight: 600; letter-spacing: 0.04em;
    text-transform: uppercase; color: var(--color-on-destructive); background: var(--color-fail-text);
    border-radius: 4px; padding: 1px 5px; white-space: nowrap;
  }
  .est-fit-axis { margin-top: var(--space-sm); }
  .est-fit-axis-span { position: relative; height: 17px; border-left: 1px solid #94A3B8; border-right: 1px solid #94A3B8; }
  .est-fit-axis-span::before { content: ""; position: absolute; top: 0; left: 0; right: 0; border-top: 1px solid #94A3B8; }
  .est-fit-axis-label {
    position: absolute; top: 3px; left: 50%; transform: translateX(-50%);
    font-size: 0.75rem; color: var(--color-muted-foreground);
    background: var(--color-card); padding: 0 var(--space-sm); white-space: nowrap;
  }

  /* ── Botones (MASTER.md · Buttons) ── */
  .est-actions { display: flex; flex-wrap: wrap; gap: var(--space-md); margin-top: var(--space-xl); }
  .est-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: var(--space-sm);
    min-height: 48px; padding: 12px 24px; border-radius: var(--radius-sm);
    font-family: var(--font-heading); font-size: 0.95rem; font-weight: 600;
    border: 2px solid transparent; transition: all var(--t);
  }
  .est-btn--primary { background: var(--color-accent); color: var(--color-on-accent); }
  .est-btn--primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
  .est-btn--primary:disabled { background: var(--color-muted); color: var(--color-muted-foreground); cursor: not-allowed; }
  .est-btn--ghost { background: transparent; color: var(--color-primary); border-color: var(--color-primary); }
  .est-btn--ghost:hover:not(:disabled) { background: var(--color-primary-tint); }
  .est-btn--ghost:disabled { color: var(--color-muted-foreground); border-color: var(--color-border); cursor: not-allowed; }
  .est-back {
    display: inline-flex; align-items: center; gap: var(--space-sm); background: none; border: none;
    color: var(--color-muted-foreground); font-family: var(--font-heading); font-size: 0.9rem; font-weight: 500;
    min-height: 44px; margin-bottom: var(--space-md); padding: 0; transition: color var(--t);
  }
  .est-back:hover { color: var(--color-primary); }

  /* ── Loading ── */
  .est-loading { display: flex; flex-direction: column; align-items: center; gap: var(--space-md); padding: var(--space-3xl) 0; color: var(--color-muted-foreground); }
  .est-dots { display: flex; gap: var(--space-sm); }
  .est-dots span { width: 8px; height: 8px; border-radius: 50%; background: var(--color-primary); animation: estBounce 1.2s infinite ease-in-out; }
  .est-dots span:nth-child(2) { animation-delay: .15s; }
  .est-dots span:nth-child(3) { animation-delay: .3s; }
  @keyframes estBounce { 0%,80%,100% { opacity:.3; transform: translateY(0);} 40% { opacity:1; transform: translateY(-4px);} }

  /* ── Ficha de resultado ── */
  .est-badge-row { display: flex; flex-wrap: wrap; gap: var(--space-sm); margin-bottom: var(--space-md); }
  .est-badge {
    font-size: 0.8rem; font-weight: 500; color: var(--color-primary);
    background: var(--color-card); border: 1px solid var(--color-border);
    border-radius: 999px; padding: 0.2rem 0.75rem;
  }
  .est-verdict {
    display: flex; align-items: flex-start; gap: var(--space-md); border-radius: var(--radius);
    padding: var(--space-md) var(--space-lg); margin-bottom: var(--space-lg); font-size: 1rem; line-height: 1.55;
  }
  .est-verdict-icon { flex-shrink: 0; margin-top: 3px; }
  .est-verdict.is-ok { background: var(--color-ok-bg); color: var(--color-ok-text); }
  .est-verdict.is-no { background: var(--color-fail-bg); color: var(--color-fail-text); }
  .est-verdict strong { font-weight: 600; }

  /* Módulos del informe: recalcula estudio y plano; no sale en el PDF */
  .est-config {
    display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-md) var(--space-lg);
    margin-bottom: var(--space-lg); padding: var(--space-md) var(--space-lg);
    background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius);
    box-shadow: var(--shadow-sm); transition: opacity var(--t);
  }
  .est-config.is-busy { opacity: 0.6; }
  .est-config-txt { flex: 1 1 240px; }
  .est-config-lbl {
    display: block; font-family: var(--font-heading); font-size: 0.75rem; font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-primary); margin-bottom: var(--space-xs);
  }
  .est-stepper {
    display: inline-flex; align-items: stretch; border: 1px solid var(--color-input-border);
    border-radius: var(--radius-sm); overflow: hidden; background: var(--color-card);
  }
  .est-stepper-btn {
    display: inline-flex; align-items: center; justify-content: center; width: 48px; min-height: 48px;
    background: var(--color-muted); border: none; color: var(--color-primary); transition: background var(--t);
  }
  .est-stepper-btn:hover:not(:disabled) { background: var(--color-primary-tint); }
  .est-stepper-btn:disabled { color: var(--color-muted-foreground); cursor: not-allowed; }
  .est-stepper-input.est-input {
    width: 5.5rem; border: none; border-radius: 0; text-align: center;
    font-family: var(--font-heading); font-size: 1.25rem; font-weight: 600; color: var(--color-primary);
  }
  .est-stepper-input.est-input:focus { box-shadow: inset 0 0 0 2px var(--color-primary); }
  .est-config-opt {
    min-height: 44px; padding: var(--space-sm) var(--space-md); font-size: 0.9rem; font-weight: 500;
    color: var(--color-primary); background: var(--color-primary-tint); border: none;
    border-radius: var(--radius-sm); transition: filter var(--t);
  }
  .est-config-opt:hover:not(:disabled) { filter: brightness(0.96); }

  .est-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-md); }
  .est-kpi {
    background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius);
    padding: var(--space-lg); box-shadow: var(--shadow-md);
  }
  .est-kpi-val {
    font-family: var(--font-heading); font-size: 2.25rem; font-weight: 600;
    color: var(--color-primary); line-height: 1.05; letter-spacing: -0.02em;
  }
  .est-kpi-val--rango { font-size: 1.85rem; white-space: nowrap; }
  .est-kpi-sep { margin: 0 0.12em; color: var(--color-muted-foreground); font-weight: 500; }
  .est-kpi-unit { font-family: var(--font-body); font-size: 0.9rem; font-weight: 500; color: var(--color-muted-foreground); margin-left: var(--space-xs); letter-spacing: 0; }
  .est-kpi-lbl {
    font-family: var(--font-heading); font-size: 0.75rem; font-weight: 600; letter-spacing: 0.06em;
    text-transform: uppercase; color: var(--color-muted-foreground); margin-top: var(--space-sm);
  }
  .est-kpi-sub { font-size: 0.85rem; color: var(--color-muted-foreground); margin-top: var(--space-xs); }
  .est-bar { height: 6px; border-radius: 3px; background: var(--color-muted); overflow: hidden; margin-top: var(--space-sm); }
  .est-bar-fill { height: 100%; background: var(--color-secondary); border-radius: 3px; }
  .est-bar-fill.is-full { background: var(--color-warn-text); }

  /* Factor limitante */
  .est-limit {
    display: grid; grid-template-columns: 1fr auto; gap: var(--space-md) var(--space-xl); align-items: start;
    margin-top: var(--space-md); padding: var(--space-lg); border-radius: var(--radius);
    background: var(--color-warn-bg); border: 1px solid var(--color-warn-line);
  }
  .est-limit .est-kpi-lbl { margin-top: 0; color: var(--color-warn-text); }
  .est-limit-name { font-family: var(--font-heading); font-size: 1.5rem; font-weight: 600; color: var(--color-foreground); margin-top: var(--space-xs); }
  .est-limit-calc { font-size: 0.9rem; color: var(--color-foreground); margin-top: var(--space-sm); font-variant-numeric: tabular-nums; }
  .est-limit-next { text-align: right; padding-left: var(--space-lg); border-left: 1px solid var(--color-warn-line); }
  .est-limit-next-name { font-family: var(--font-heading); font-size: 1.1rem; font-weight: 600; color: var(--color-foreground); margin-top: var(--space-xs); }
  .est-limit-pend { grid-column: 1 / -1; margin: 0; color: var(--color-warn-text); }
  .est-table tr.is-limit td { background: var(--color-warn-bg); color: var(--color-warn-text); }
  .est-table tr.is-limit .est-param { color: var(--color-warn-text); }
  @media (max-width: 640px) {
    .est-limit { grid-template-columns: 1fr; }
    .est-limit-next { text-align: left; padding: var(--space-md) 0 0; border-left: none; border-top: 1px solid var(--color-warn-line); }
  }

  /* ── Bloques ── */
  .est-block { margin-top: var(--space-2xl); }
  .est-block-h {
    font-family: var(--font-heading); font-size: 1.35rem; font-weight: 600; color: var(--color-foreground);
    letter-spacing: -0.01em; padding-bottom: var(--space-sm); border-bottom: 2px solid var(--color-primary);
    margin-bottom: var(--space-md); display: flex; align-items: baseline; flex-wrap: wrap; gap: var(--space-xs) var(--space-md);
  }
  .est-block-h span { font-family: var(--font-body); font-size: 0.875rem; font-weight: 400; color: var(--color-muted-foreground); letter-spacing: 0; }

  .est-table-wrap { overflow-x: auto; background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius); box-shadow: var(--shadow-sm); }
  .est-table-wrap.is-tall { max-height: 460px; overflow-y: auto; }
  .est-table-wrap.is-tall thead th { position: sticky; top: 0; z-index: 1; }
  .est-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; min-width: 560px; }
  .est-table th {
    text-align: left; font-family: var(--font-heading); font-size: 0.75rem; font-weight: 600;
    letter-spacing: 0.05em; text-transform: uppercase; color: var(--color-muted-foreground);
    background: var(--color-muted); padding: 12px 16px; border-bottom: 1px solid var(--color-border);
  }
  .est-table td { padding: 12px 16px; border-bottom: 1px solid var(--color-border); vertical-align: top; }
  .est-table tr:last-child td { border-bottom: none; }
  .est-table .num { white-space: nowrap; }
  .est-param { font-weight: 500; color: var(--color-foreground); }
  .est-detalle { font-size: 0.85rem; color: var(--color-muted-foreground); margin-top: 2px; }
  .est-art { font-size: 0.8rem; color: var(--color-muted-foreground); }
  .est-tag {
    display: inline-flex; align-items: center; gap: var(--space-xs); font-size: 0.75rem; font-weight: 600;
    padding: 2px 10px; border-radius: 999px; white-space: nowrap;
  }
  .est-tag.is-ok { background: var(--color-ok-bg); color: var(--color-ok-text); }
  .est-tag.is-no { background: var(--color-fail-bg); color: var(--color-fail-text); }
  .est-tag.is-warn { background: var(--color-warn-bg); color: var(--color-warn-text); }
  .est-tag.is-info { background: var(--color-primary-tint); color: var(--color-primary); }
  .est-tag.is-neutral { background: var(--color-muted); color: var(--color-muted-foreground); }
  .est-link { color: var(--color-secondary); text-decoration: underline; text-underline-offset: 2px; }
  .est-link:hover { color: var(--color-primary); }

  .est-row-btn { cursor: pointer; transition: background var(--t); }
  .est-row-btn:hover td { background: var(--color-background); }
  .est-row-sel td { background: var(--color-secondary-tint); }
  .est-row-sel .est-param { color: var(--color-primary); }

  /* ── Plano ── */
  .est-plano {
    border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-card);
    padding: var(--space-md); overflow-x: auto; box-shadow: var(--shadow-md);
  }
  .est-plano svg { width: 100%; height: auto; display: block; }

  .est-err {
    background: var(--color-fail-bg); color: var(--color-fail-text); border-radius: var(--radius);
    padding: var(--space-md) var(--space-lg); font-size: 0.95rem; margin-bottom: var(--space-lg);
  }

  .est-footer-bar {
    display: flex; flex-wrap: wrap; gap: var(--space-md); align-items: center;
    margin-top: var(--space-2xl); padding-top: var(--space-lg); border-top: 1px solid var(--color-border);
  }
  .est-footer-note { font-size: 0.9rem; color: var(--color-muted-foreground); flex: 1 1 260px; }

  /* ── Cabecera solo para impresión ── */
  .est-print-head { display: none; }
  .est-solo-papel { display: none; }

  /* ── Exportación a PDF ── */
  /* Margen de página 0: Chrome no tiene dónde imprimir su cabecera y pie (fecha,
     título, URL, nº de página). El margen real lo da el padding de .est-main,
     repetido en cada página con box-decoration-break: clone. */
  @page { size: A4 portrait; margin: 0; }

  @media print {
    html, body { background: #fff !important; }

    .est-top, .est-back, .est-actions,
    .est-footer-bar, .est-version, .est-solo-pantalla { display: none !important; }
    .est-solo-papel { display: inline !important; }
    .est-main {
      padding: 14mm 12mm !important; max-width: none !important;
      -webkit-box-decoration-break: clone; box-decoration-break: clone;
    }
    .est-anim { animation: none !important; }
    /* El scroll reveal no debe dejar bloques invisibles en papel */
    .est-kpis, .est-limit, .est-block, .est-panel { opacity: 1 !important; transform: none !important; visibility: visible !important; }

    .est-print-head {
      display: flex !important; align-items: center; justify-content: space-between;
      gap: 1rem; padding-bottom: 0.7rem; margin-bottom: 1.1rem;
      border-bottom: 2px solid var(--color-primary);
    }
    /* gyc-logo-recortado.png es gyc-logo.png sin el margen transparente: la altura es la de la marca */
    .est-print-logo { height: 26px; width: auto; }
    .est-print-logo--cliente { height: 64px; }
    .est-print-meta { text-align: right; font-size: 8pt; color: var(--color-muted-foreground); line-height: 1.5; }
    .est-print-meta strong {
      display: block; font-family: var(--font-heading); font-size: 11pt; font-weight: 600; color: var(--color-primary);
    }

    body { font-size: 9pt; line-height: 1.45; }
    .est-h { font-size: 17pt; margin-bottom: 0.15rem; }
    .est-sub { font-size: 9pt; margin-bottom: 0.8rem; }
    .est-badge { font-size: 7pt; padding: 0.1rem 0.45rem; }
    .est-verdict { font-size: 8.5pt; padding: 0.55rem 0.8rem; margin-bottom: 0.8rem; }
    .est-block { margin-top: 1.2rem; }
    .est-block-h { font-size: 11pt; margin-bottom: 0.5rem; padding-bottom: 0.3rem; }
    .est-block-h span { font-size: 7.5pt; }
    .est-table { font-size: 8pt; min-width: 0; }
    .est-table th { font-size: 6.5pt; padding: 0.3rem 0.4rem; }
    .est-table td { padding: 0.32rem 0.4rem; }
    .est-detalle { font-size: 7pt; }
    .est-art { font-size: 6.5pt; }
    .est-tag { font-size: 6.5pt; padding: 0.06rem 0.35rem; }
    .est-panel, .est-kpi, .est-plano, .est-table-wrap { box-shadow: none !important; }

    .est-table-wrap { overflow: visible !important; max-height: none !important; }
    .est-table-wrap.is-tall thead th { position: static; }

    .est-kpis { grid-template-columns: repeat(4, 1fr) !important; gap: 0.5rem; }
    .est-kpi { padding: 0.55rem 0.7rem; }
    .est-kpi-val { font-size: 16pt; }
    .est-kpi-val--rango { font-size: 13pt; }
    .est-kpi-lbl { font-size: 6pt; }
    .est-kpi-sub { font-size: 7pt; }
    .est-limit { padding: 0.6rem 0.8rem; }
    .est-limit-name { font-size: 13pt; }
    .est-limit-next-name { font-size: 10pt; }
    .est-limit-calc, .est-limit-pend, .est-limit .est-kpi-sub { font-size: 7.5pt; }
    .est-panel { margin-top: 1.2rem; padding: 0.6rem 0.8rem; }
    .est-panel-title { font-size: 11pt; }
    .est-panel .est-hint { font-size: 7.5pt; }
    .est-panel-title + .est-hint { margin-bottom: 0.5rem; }

    .est-block { break-inside: auto; }
    .est-block-h { break-after: avoid; }
    .est-kpis, .est-verdict, .est-plano, .est-limit { break-inside: avoid; }
    .est-table thead { display: table-header-group; }
    .est-table tr { break-inside: avoid; }
    .est-plano { border-color: #ccc; padding: 0; }

    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
`;
