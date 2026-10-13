export const ESTUDIO_CSS = `
  :root {
    --c-primary:    #4f764d;
    --c-primary-dk: #234926;
    --c-title:      #000823;
    --c-body:       #484e62;
    --c-bg-alt:     #F6F7F8;
    --c-bg:         #ffffff;
    --c-border:     #dddddd;
    --c-ok-bg:      #eaf5ea;
    --c-ok-text:    #1d6b22;
    --c-fail-bg:    #fdecea;
    --c-fail-text:  #b5261e;
    --c-warn-bg:    #fff6e5;
    --c-warn-text:  #8a5a00;
    --font-display: var(--font-plex-sans, 'IBM Plex Sans');
    --font-body:    var(--font-plex-sans, 'IBM Plex Sans');
    --font-mono:    var(--font-plex-mono, 'IBM Plex Mono');
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--font-body), sans-serif; font-size: 1rem; line-height: 1.65;
    background: var(--c-bg); color: var(--c-body); -webkit-font-smoothing: antialiased;
  }

  /* ── Topbar interna ── */
  .est-top { background: var(--c-title); border-bottom: 1px solid #1e2840; }
  .est-top-inner {
    display: flex; align-items: center; gap: 1rem; height: 56px;
    padding: 0 clamp(1rem, 4vw, 3rem);
  }
  .est-logo { height: 64px; width: auto; filter: brightness(0) invert(1); flex-shrink: 0; }
  .est-top-tag {
    font-family: var(--font-display), sans-serif; font-size: 0.62rem; font-weight: 700;
    letter-spacing: 0.14em; text-transform: uppercase; color: #ffc857;
    border: 1px solid rgba(255,200,87,0.4); border-radius: 3px; padding: 0.18rem 0.5rem;
  }
  .est-top-title {
    font-family: var(--font-display), sans-serif; font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase; color: rgba(255,255,255,0.75);
  }

  /* ── Barra de pasos ── */
  .est-steps {
    display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;
    padding: 0.85rem clamp(1rem, 4vw, 3rem); background: var(--c-bg-alt);
    border-bottom: 1px solid var(--c-border);
  }
  .est-step {
    display: inline-flex; align-items: center; gap: 0.4rem;
    font-family: var(--font-display), sans-serif; font-size: 0.68rem; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase; color: #a3a8b5;
    background: none; border: none; padding: 0; cursor: default;
  }
  .est-step.is-link { cursor: pointer; }
  .est-step.is-link:hover { color: var(--c-title); }
  .est-step.is-active { color: var(--c-title); }
  .est-step.is-done { color: var(--c-primary); }
  .est-step-num {
    width: 18px; height: 18px; border-radius: 50%; display: inline-flex;
    align-items: center; justify-content: center; font-size: 0.58rem;
    border: 1.5px solid currentColor;
  }
  .est-step.is-done .est-step-num { background: var(--c-primary); border-color: var(--c-primary); color: #fff; }
  .est-step.is-active .est-step-num { background: var(--c-title); border-color: var(--c-title); color: #fff; }
  .est-step-sep { color: #ccd0d8; font-size: 0.7rem; }

  /* ── Layout ── */
  .est-main { padding: 2.25rem clamp(1rem, 4vw, 3rem) 4rem; max-width: 1180px; margin: 0 auto; }
  @keyframes stepIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .est-anim { animation: stepIn 0.22s ease forwards; }

  .est-h {
    font-family: var(--font-display), sans-serif; font-size: 1.7rem; font-weight: 600;
    color: var(--c-title); letter-spacing: -0.01em; line-height: 1.15; margin-bottom: 0.3rem;
  }
  .est-sub { font-size: 0.92rem; font-weight: 400; margin-bottom: 1.6rem; }
  .est-eyebrow {
    font-family: var(--font-display), sans-serif; font-size: 0.64rem; font-weight: 700;
    letter-spacing: 0.15em; text-transform: uppercase; color: var(--c-primary);
    margin-bottom: 0.45rem;
  }

  /* ── Paso 1: elección de módulo ── */
  .est-mod-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }
  .est-mod-card {
    display: flex; flex-direction: column; gap: 0.6rem; text-align: left;
    background: var(--c-bg); border: 1px solid var(--c-border); border-radius: 8px;
    padding: 1.4rem 1.3rem; cursor: pointer; transition: border-color .15s, box-shadow .15s, transform .15s;
  }
  .est-mod-card:hover {
    border-color: var(--c-title); box-shadow: 0 6px 20px rgba(0,8,35,0.08); transform: translateY(-2px);
  }
  .est-mod-icon { color: var(--c-title); }
  .est-mod-title {
    font-family: var(--font-display), sans-serif; font-size: 1.1rem; font-weight: 700; color: var(--c-title);
  }
  .est-mod-desc { font-size: 0.86rem; font-weight: 400; line-height: 1.55; }
  .est-mod-specs {
    display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.35rem;
  }
  .est-chip {
    font-family: var(--font-mono), monospace; font-size: 0.68rem; color: var(--c-body);
    background: var(--c-bg-alt); border: 1px solid var(--c-border);
    border-radius: 3px; padding: 0.1rem 0.4rem;
  }

  /* ── Formulario ── */
  .est-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 1rem 1.1rem; }
  .est-field { display: flex; flex-direction: column; gap: 0.3rem; }
  .est-label {
    font-family: var(--font-display), sans-serif; font-size: 0.7rem; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase; color: var(--c-title);
  }
  .est-input-wrap { position: relative; display: flex; align-items: center; }
  .est-input, .est-select {
    width: 100%; padding: 0.6rem 0.75rem; font-size: 0.95rem; font-family: var(--font-body), sans-serif;
    color: var(--c-title); background: var(--c-bg); border: 1px solid var(--c-border); border-radius: 5px;
  }
  .est-input:focus, .est-select:focus { outline: none; border-color: var(--c-title); }
  .est-input--unit { padding-right: 3rem; }
  .est-unit {
    position: absolute; right: 0.75rem; font-size: 0.78rem; color: #9aa0ad;
    font-family: var(--font-mono), monospace; pointer-events: none;
  }
  .est-hint { font-size: 0.76rem; font-weight: 400; color: #7d8492; }

  /* ── Selector de slots ── */
  .est-panel {
    background: var(--c-bg-alt); border: 1px solid var(--c-border); border-radius: 8px;
    padding: 1.2rem 1.25rem; margin-top: 1.4rem;
  }
  .est-panel-title {
    font-family: var(--font-display), sans-serif; font-size: 0.74rem; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase; color: var(--c-title); margin-bottom: 0.25rem;
  }
  .est-seg { display: flex; gap: 0.35rem; flex-wrap: wrap; }
  .est-seg-btn {
    flex: 1 1 auto; min-width: 54px; padding: 0.5rem 0.4rem; cursor: pointer;
    font-family: var(--font-mono), monospace; font-size: 0.85rem; color: var(--c-body);
    background: var(--c-bg); border: 1px solid var(--c-border); border-radius: 5px;
    transition: all .12s;
  }
  .est-seg-btn:hover { border-color: var(--c-title); }
  .est-seg-btn.is-on {
    background: var(--c-title); border-color: var(--c-title); color: #fff; font-weight: 600;
  }
  .est-slot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; }
  @media (max-width: 620px) { .est-slot-grid { grid-template-columns: 1fr; } }

  /* Configuración por lado (slot + paso a pared) */
  .est-side {
    border: 1px solid var(--c-border); border-radius: 6px; padding: 0.8rem 0.85rem;
    background: var(--c-bg);
  }
  .est-side-title {
    font-family: var(--font-display), sans-serif; font-size: 0.7rem; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase; color: var(--c-title);
    margin-bottom: 0.7rem;
  }
  .est-side-paso { margin-top: 0.75rem; }
  .est-paso-row { display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; }
  .est-paso-row .est-input-wrap { flex: 1 1 92px; min-width: 92px; }
  .est-input:disabled { background: #f1f2f4; color: #9aa0ad; cursor: not-allowed; }

  .est-wall-btn {
    display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer;
    flex: 0 0 auto; padding: 0.46rem 0.6rem; border-radius: 5px;
    font-family: var(--font-display), sans-serif; font-size: 0.72rem; font-weight: 600;
    color: var(--c-body); background: var(--c-bg); border: 1px solid var(--c-border);
    transition: all .12s; white-space: nowrap;
  }
  .est-wall-btn svg { flex-shrink: 0; opacity: 0.75; }
  .est-wall-btn:hover { border-color: var(--c-title); }
  .est-wall-btn.is-on {
    background: var(--c-title); border-color: var(--c-title); color: #fff;
  }
  .est-wall-btn.is-on svg { opacity: 1; }

  /* ── Encaje del módulo en el ancho de nave ── */
  .est-fit {
    margin-top: 1.1rem; border: 1px solid var(--c-border); border-left: 3px solid var(--c-border);
    border-radius: 7px; background: var(--c-bg); padding: 0.95rem 1rem 1.05rem;
    transition: border-color .15s;
  }
  .est-fit.is-ok        { border-left-color: var(--c-ok-text); }
  .est-fit.is-no        { border-left-color: var(--c-fail-text); }
  .est-fit.is-pendiente { border-left-color: #c2c7d0; }

  .est-fit-head { display: flex; align-items: flex-start; gap: 0.7rem; margin-bottom: 1rem; }
  .est-fit-mark {
    flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
    width: 26px; height: 26px; border-radius: 50%; margin-top: 1px;
  }
  .est-fit.is-ok        .est-fit-mark { background: var(--c-ok-bg);   color: var(--c-ok-text); }
  .est-fit.is-no        .est-fit-mark { background: var(--c-fail-bg); color: var(--c-fail-text); }
  .est-fit.is-pendiente .est-fit-mark { background: #eef0f3;          color: #8b92a0; }

  .est-fit-copy { flex: 1 1 auto; min-width: 0; }
  .est-fit-title {
    display: block; font-family: var(--font-display), sans-serif; font-size: 0.98rem;
    font-weight: 700; line-height: 1.3; color: var(--c-title);
  }
  .est-fit.is-ok .est-fit-title { color: var(--c-ok-text); }
  .est-fit.is-no .est-fit-title { color: var(--c-fail-text); }
  .est-fit-sub { display: block; font-size: 0.8rem; line-height: 1.45; color: var(--c-body); margin-top: 0.15rem; }

  .est-fit-nums { flex-shrink: 0; text-align: right; }
  .est-fit-ratio { font-family: var(--font-mono), monospace; font-size: 1.05rem; font-weight: 600; white-space: nowrap; }
  .est-fit-slash { color: #b9bec8; margin: 0 0.2rem; font-weight: 400; }
  .est-fit-need  { color: var(--c-title); }
  .est-fit.is-no .est-fit-need { color: var(--c-fail-text); }
  .est-fit-have  { color: var(--c-body); }
  .est-fit-cap {
    display: block; font-size: 0.63rem; letter-spacing: 0.05em; text-transform: uppercase;
    color: #9aa0ad; margin-top: 0.1rem; white-space: nowrap;
  }
  @media (max-width: 620px) {
    .est-fit-head { flex-wrap: wrap; }
    .est-fit-nums { text-align: left; width: 100%; padding-left: calc(26px + 0.7rem); }
  }

  /* Barra de sección a escala */
  .est-fit-bar {
    position: relative; display: flex; align-items: stretch; width: 100%;
    height: 46px; border-radius: 5px; overflow: hidden; background: #f1f2f4;
  }
  .est-fit-seg {
    position: relative; display: flex; align-items: center; justify-content: center;
    min-width: 0; overflow: hidden; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.75);
  }
  .est-fit-seg-in {
    display: flex; flex-direction: column; align-items: center; line-height: 1.15;
    padding: 0 2px; white-space: nowrap;
  }
  .est-fit-seg-name {
    font-style: normal; font-size: 0.6rem; letter-spacing: 0.06em; text-transform: uppercase;
    opacity: 0.75; font-family: var(--font-display), sans-serif; font-weight: 600;
  }
  .est-fit-seg-val { font-family: var(--font-mono), monospace; font-size: 0.76rem; font-weight: 600; }
  .est-fit-seg.is-paso    { background: #e6ebf2; color: #4a5568; }
  .est-fit-seg.is-slot    { background: #f6dfc4; color: #7a4a12; }
  .est-fit-seg.is-cuerpo  { background: var(--c-primary); color: #fff; }
  .est-fit-seg.is-holgura {
    color: #7d8492;
    background: repeating-linear-gradient(45deg, #fafbfc 0 5px, #eef0f3 5px 10px);
  }

  /* Zona del módulo que se sale del ancho de nave */
  .est-fit-over {
    position: absolute; top: 0; bottom: 0; right: 0; pointer-events: none;
    border-left: 2px solid var(--c-fail-text);
    background: repeating-linear-gradient(45deg,
      rgba(181,38,30,0.30) 0 6px, rgba(181,38,30,0.13) 6px 12px);
  }
  .est-fit-over-tag.is-outside { left: auto; right: 100%; margin-right: 5px; }
  .est-fit-over-tag {
    position: absolute; top: 4px; left: 4px; font-family: var(--font-display), sans-serif;
    font-size: 0.58rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
    color: #fff; background: var(--c-fail-text); border-radius: 2px; padding: 0.08rem 0.28rem;
    white-space: nowrap;
  }

  /* Cota del ancho de nave bajo la barra */
  .est-fit-axis { margin-top: 0.4rem; }
  .est-fit-axis-span { position: relative; height: 17px; border-left: 1px solid #c2c7d0; border-right: 1px solid #c2c7d0; }
  .est-fit-axis-span::before {
    content: ""; position: absolute; top: 0; left: 0; right: 0; border-top: 1px solid #c2c7d0;
  }
  .est-fit-axis-label {
    position: absolute; top: 3px; left: 50%; transform: translateX(-50%);
    font-family: var(--font-mono), monospace; font-size: 0.66rem; color: #7d8492;
    background: var(--c-bg); padding: 0 0.4rem; white-space: nowrap;
  }

  /* ── Botones ── */
  .est-actions { display: flex; flex-wrap: wrap; gap: 0.7rem; margin-top: 1.8rem; }
  .est-btn {
    display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer;
    font-family: var(--font-display), sans-serif; font-size: 0.8rem; font-weight: 700;
    letter-spacing: 0.04em; padding: 0.7rem 1.4rem; border-radius: 999px; border: 1px solid transparent;
    transition: all .15s;
  }
  .est-btn--primary { background: var(--c-title); color: #fff; }
  .est-btn--primary:hover:not(:disabled) { background: #1a2440; }
  .est-btn--primary:disabled { background: #c6cad3; cursor: not-allowed; }
  .est-btn--ghost { background: transparent; color: var(--c-title); border-color: var(--c-border); }
  .est-btn--ghost:hover { border-color: var(--c-title); }
  .est-back {
    display: inline-flex; align-items: center; gap: 0.35rem; background: none; border: none;
    cursor: pointer; color: #8a909d; font-size: 0.72rem; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 1rem; padding: 0;
  }
  .est-back:hover { color: var(--c-title); }

  /* ── Loading ── */
  .est-loading { display: flex; flex-direction: column; align-items: center; gap: 0.9rem; padding: 4rem 0; }
  .est-dots { display: flex; gap: 0.35rem; }
  .est-dots span {
    width: 7px; height: 7px; border-radius: 50%; background: var(--c-primary);
    animation: estBounce 1.2s infinite ease-in-out;
  }
  .est-dots span:nth-child(2) { animation-delay: .15s; }
  .est-dots span:nth-child(3) { animation-delay: .3s; }
  @keyframes estBounce { 0%,80%,100% { opacity:.3; transform: translateY(0);} 40% { opacity:1; transform: translateY(-5px);} }

  /* ── Ficha de resultado ── */
  .est-badge-row { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.9rem; }
  .est-badge {
    font-family: var(--font-mono), monospace; font-size: 0.72rem; color: var(--c-body);
    background: var(--c-bg-alt); border: 1px solid var(--c-border);
    border-radius: 4px; padding: 0.22rem 0.55rem;
  }
  .est-verdict {
    display: flex; align-items: flex-start; gap: 0.7rem; border-radius: 8px;
    padding: 0.9rem 1.1rem; margin-bottom: 1.5rem; font-size: 0.9rem; line-height: 1.55;
  }
  .est-verdict.is-ok { background: var(--c-ok-bg); color: var(--c-ok-text); }
  .est-verdict.is-no { background: var(--c-fail-bg); color: var(--c-fail-text); }
  .est-verdict strong { font-family: var(--font-display), sans-serif; }

  .est-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.8rem; }
  .est-kpi {
    background: var(--c-bg); border: 1px solid var(--c-border); border-radius: 8px; padding: 1rem 1.1rem;
  }
  .est-kpi-val {
    font-family: var(--font-display), sans-serif; font-size: 1.75rem; font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--c-title); line-height: 1.05; letter-spacing: -0.02em;
  }
  .est-kpi-unit { font-size: 0.85rem; font-weight: 600; color: #8a909d; margin-left: 0.2rem; }
  .est-kpi-lbl {
    font-family: var(--font-display), sans-serif; font-size: 0.62rem; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase; color: #8a909d; margin-top: 0.35rem;
  }
  .est-kpi-sub { font-size: 0.76rem; font-weight: 400; margin-top: 0.3rem; }
  .est-bar { height: 5px; border-radius: 3px; background: #eceef2; overflow: hidden; margin-top: 0.55rem; }
  .est-bar-fill { height: 100%; background: var(--c-primary); border-radius: 3px; }
  .est-bar-fill.is-full { background: var(--c-fail-text); }

  .est-block { margin-top: 2.4rem; }
  .est-block-h {
    font-family: var(--font-display), sans-serif; font-size: 0.72rem; font-weight: 700;
    letter-spacing: 0.13em; text-transform: uppercase; color: var(--c-title);
    padding-bottom: 0.5rem; border-bottom: 2px solid var(--c-title); margin-bottom: 1rem;
    display: flex; align-items: baseline; gap: 0.6rem;
  }
  .est-block-h span { font-weight: 400; letter-spacing: 0.02em; text-transform: none; color: #8a909d; font-size: 0.72rem; }

  .est-table-wrap { overflow-x: auto; }
  .est-table-wrap.is-tall { max-height: 440px; overflow-y: auto; border: 1px solid var(--c-border); border-radius: 6px; }
  .est-table-wrap.is-tall thead th { position: sticky; top: 0; background: var(--c-bg); z-index: 1; }
  .est-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; min-width: 560px; }
  .est-table th {
    text-align: left; font-family: var(--font-display), sans-serif; font-size: 0.63rem;
    font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #8a909d;
    padding: 0.5rem 0.7rem; border-bottom: 1px solid var(--c-border);
  }
  .est-table td { padding: 0.65rem 0.7rem; border-bottom: 1px solid #eef0f3; vertical-align: top; }
  .est-table tr:last-child td { border-bottom: none; }
  .est-table .num { font-family: var(--font-mono), monospace; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .est-param { font-weight: 600; color: var(--c-title); }
  .est-detalle { font-size: 0.78rem; font-weight: 400; color: #7d8492; margin-top: 0.15rem; }
  .est-art { font-size: 0.72rem; font-family: var(--font-mono), monospace; color: #9aa0ad; }
  .est-tag {
    display: inline-block; font-family: var(--font-display), sans-serif; font-size: 0.62rem;
    font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
    padding: 0.15rem 0.5rem; border-radius: 3px; white-space: nowrap;
  }
  .est-tag.is-ok { background: var(--c-ok-bg); color: var(--c-ok-text); }
  .est-tag.is-no { background: var(--c-fail-bg); color: var(--c-fail-text); }
  .est-tag.is-warn { background: var(--c-warn-bg); color: var(--c-warn-text); }

  .est-row-btn { cursor: pointer; }
  .est-row-btn:hover td { background: var(--c-bg-alt); }
  .est-row-sel td { background: #eef2f7; }
  .est-row-sel .est-param { color: var(--c-title); }

  /* ── Plano ── */
  .est-plano {
    border: 1px solid var(--c-border); border-radius: 8px; background: #fafafa;
    padding: 0.5rem; overflow-x: auto;
  }
  .est-plano svg { width: 100%; height: auto; display: block; }

  /* ── Notas ── */
  .est-notas { list-style: none; display: flex; flex-direction: column; gap: 0.55rem; }
  .est-notas li {
    font-size: 0.86rem; font-weight: 400; line-height: 1.55; padding-left: 1rem;
    position: relative;
  }
  .est-notas li::before {
    content: ''; position: absolute; left: 0; top: 0.62em;
    width: 5px; height: 5px; border-radius: 50%; background: var(--c-primary);
  }

  .est-err {
    background: var(--c-fail-bg); color: var(--c-fail-text); border-radius: 6px;
    padding: 0.85rem 1.05rem; font-size: 0.88rem; margin-bottom: 1.2rem;
  }

  .est-footer-bar {
    display: flex; flex-wrap: wrap; gap: 0.7rem; align-items: center;
    margin-top: 2.75rem; padding-top: 1.5rem; border-top: 1px solid var(--c-border);
  }
  .est-footer-note { font-size: 0.8rem; font-weight: 400; color: #7d8492; flex: 1 1 240px; }

  /* ── Cabecera solo para impresión ── */
  .est-print-head { display: none; }

  /* ── Exportación a PDF ── */
  @page { size: A4 portrait; margin: 14mm 12mm; }

  @media print {
    :root { --c-bg-alt: #f7f8fa; }
    html, body { background: #fff !important; }

    /* Fuera todo lo que no es el informe */
    .est-top, .est-steps, .est-back, .est-actions,
    .est-footer-bar, .est-row-btn .est-tag.is-warn { display: none !important; }
    .est-main { padding: 0 !important; max-width: none !important; }
    .est-anim { animation: none !important; }

    /* Cabecera impresa */
    .est-print-head {
      display: flex !important; align-items: flex-start; justify-content: space-between;
      gap: 1rem; padding-bottom: 0.6rem; margin-bottom: 1.1rem;
      border-bottom: 2px solid var(--c-title);
    }
    .est-print-logo { height: 34px; width: auto; }
    .est-print-meta {
      text-align: right; font-family: var(--font-mono), monospace;
      font-size: 8pt; color: #5b6270; line-height: 1.5;
    }
    .est-print-meta strong {
      display: block; font-family: var(--font-display), sans-serif;
      font-size: 10pt; font-weight: 600; color: var(--c-title); letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    /* Tipografía de documento */
    body { font-size: 9pt; line-height: 1.45; color: #23262f; }
    .est-h { font-size: 16pt; margin-bottom: 0.15rem; }
    .est-sub { font-size: 9pt; margin-bottom: 0.8rem; }
    .est-block { margin-top: 1.1rem; }
    .est-block-h { font-size: 8pt; margin-bottom: 0.5rem; padding-bottom: 0.3rem; }
    .est-table { font-size: 8pt; min-width: 0; }
    .est-table th { font-size: 6.5pt; padding: 0.3rem 0.4rem; }
    .est-table td { padding: 0.32rem 0.4rem; }
    .est-detalle { font-size: 7pt; }
    .est-art { font-size: 6.5pt; }
    .est-tag { font-size: 6.5pt; padding: 0.08rem 0.35rem; }
    .est-notas li { font-size: 8pt; }

    /* Los contenedores con scroll deben desplegarse enteros en papel */
    .est-table-wrap, .est-table-wrap.is-tall {
      overflow: visible !important; max-height: none !important; border: none !important;
    }
    .est-table-wrap.is-tall thead th { position: static !important; }

    /* KPIs en una sola línea */
    .est-kpis { grid-template-columns: repeat(4, 1fr) !important; gap: 0.5rem; }
    .est-kpi { padding: 0.55rem 0.6rem; }
    .est-kpi-val { font-size: 15pt; }
    .est-kpi-lbl { font-size: 6pt; }
    .est-kpi-sub { font-size: 7pt; }

    /* Cortes de página */
    .est-block { break-inside: auto; }
    .est-block-h { break-after: avoid; }
    .est-kpis, .est-verdict, .est-plano { break-inside: avoid; }
    .est-table thead { display: table-header-group; }
    .est-table tr { break-inside: avoid; }
    .est-plano { border-color: #ccc; background: #fff; padding: 0; }

    /* Que los fondos de color salgan impresos */
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
`;
