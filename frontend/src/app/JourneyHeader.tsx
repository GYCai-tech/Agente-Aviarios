"use client";

import { Fragment } from "react";

const STEPS = ["Proyecto", "Análisis", "Sistema", "Informe", "Propuesta", "Plano"] as const;

const CSS = `
.jrn-hdr {
  flex: 0 0 auto;
  background: #000823;
  border-bottom: 1px solid #1e2840;
  position: relative;
  z-index: 10;
}
.jrn-hdr-inner {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0 clamp(1rem, 4vw, 3rem);
  height: 52px;
}
.jrn-back {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: none;
  border: none;
  cursor: pointer;
  color: rgba(255,255,255,0.45);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.25rem 0.5rem 0.25rem 0;
  white-space: nowrap;
  transition: color 0.15s;
  flex-shrink: 0;
}
.jrn-back:hover { color: rgba(255,255,255,0.9); }
.jrn-back svg { flex-shrink: 0; }
.jrn-logo {
  height: 28px;
  width: auto;
  display: block;
  filter: brightness(0) invert(1);
  flex-shrink: 0;
}
.jrn-divider {
  width: 1px;
  height: 20px;
  background: rgba(255,255,255,0.12);
  flex-shrink: 0;
}
.jrn-steps {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 0;
}
.jrn-step-outer {
  display: flex;
  align-items: center;
  flex: 1;
}
.jrn-step-outer:last-child {
  flex: 0 0 auto;
}
.jrn-step {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  white-space: nowrap;
}
.jrn-circle {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 700;
  flex-shrink: 0;
  border: 1.5px solid rgba(255,255,255,0.2);
  color: rgba(255,255,255,0.3);
  transition: background 0.2s, border-color 0.2s;
}
.jrn-step.is-done .jrn-circle {
  background: #4F764D;
  border-color: #4F764D;
  color: #fff;
}
.jrn-step.is-active .jrn-circle {
  background: #fff;
  border-color: #fff;
  color: #000823;
}
.jrn-label {
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.25);
  transition: color 0.2s;
}
.jrn-step.is-done .jrn-label {
  color: rgba(255,255,255,0.55);
}
.jrn-step.is-active .jrn-label {
  color: #ffffff;
}
.jrn-line {
  flex: 1;
  height: 1px;
  background: rgba(255,255,255,0.1);
  margin: 0 0.5rem;
}
.jrn-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}
@media (max-width: 680px) {
  .jrn-hdr-inner { padding: 0 1rem; gap: 0.75rem; }
  .jrn-divider { display: none; }
  .jrn-label { display: none; }
  .jrn-line { margin: 0 0.25rem; }
  .jrn-back span { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .jrn-back, .jrn-circle, .jrn-label { transition: none; }
}
`;

export default function JourneyHeader({
  activeStep,
  actions,
}: {
  activeStep: number;
  actions?: React.ReactNode;
}) {
  return (
    <>
      <style>{CSS}</style>
      <header className="jrn-hdr">
        <div className="jrn-hdr-inner">
          {activeStep > 0 && (
            <button
              className="jrn-back"
              onClick={() => window.history.back()}
              aria-label="Volver al paso anterior"
            >
              <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
                <path d="M5 1L1 5m0 0l4 4M1 5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Volver</span>
            </button>
          )}

          <img src="/gyc-logo.png" alt="Gómez y Crespo" className="jrn-logo" />
          <div className="jrn-divider" aria-hidden="true" />

          <nav className="jrn-steps" aria-label="Progreso de la consulta">
            {STEPS.map((label, i) => (
              <Fragment key={label}>
                <div className="jrn-step-outer">
                  <div
                    className={`jrn-step${i < activeStep ? " is-done" : i === activeStep ? " is-active" : ""}`}
                    aria-current={i === activeStep ? "step" : undefined}
                  >
                    <div className="jrn-circle" aria-hidden="true">
                      {i < activeStep ? (
                        <svg width="8" height="7" viewBox="0 0 8 7" fill="none">
                          <path d="M1 3.5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span className="jrn-label">{label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className="jrn-line" aria-hidden="true" />}
                </div>
              </Fragment>
            ))}
          </nav>

          {actions && <div className="jrn-actions">{actions}</div>}
        </div>
      </header>
    </>
  );
}
