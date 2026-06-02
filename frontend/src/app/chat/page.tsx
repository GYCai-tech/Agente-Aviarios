"use client";

import { useState, useRef, useEffect } from "react";
import {
  pedirFactibilidad,
  pedirRecomendacionConRespuestas,
  solicitarIntake,
  pedirCapacidad,
  type TipoZona,
  type Sistema,
  type FactibilidadResponse,
  type Recomendacion,
  type OpcionCapacidad,
} from "../actions";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Bubble { id: number; from: "bot" | "user"; text: string; }

type InputMode =
  | { type: "idle" }
  | { type: "options"; choices: { id: string; label: string }[] }
  | { type: "number"; unit: string; placeholder: string; min?: number }
  | { type: "dims"; isCap: boolean }
  | { type: "loading"; text: string }
  | { type: "cap_choices"; opciones: OpcionCapacidad[] }
  | { type: "done" };

type Step =
  | "modo" | "gallinas" | "sistema" | "ancho_largo" | "altura"
  | "dyn_q" | "rec"
  | "cap_sistema" | "cap_ancho_largo" | "cap_altura";

const SISTEMAS = [
  { id: "suelo" as Sistema,     label: "En suelo" },
  { id: "campero" as Sistema,   label: "Campero" },
  { id: "ecologico" as Sistema, label: "Ecológico" },
  { id: "jaulas" as Sistema,    label: "Jaulas enriquecidas" },
];

const MODO_OPTS = [
  { id: "compliance", label: "Verificar mi instalación" },
  { id: "capacidad",  label: "Calcular capacidad de la nave" },
];

const WELCOME = "Hola, soy el asesor de Gómez y Crespo. ¿En qué puedo ayudarte hoy?";

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [bubbles, setBubbles]       = useState<Bubble[]>([]);
  const [imode, setImode]           = useState<InputMode>({ type: "idle" });
  const [numVal, setNumVal]         = useState("");
  const [anchoV, setAnchoV]         = useState("");
  const [largoV, setLargoV]         = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Mutable flow state — changes don't trigger re-renders
  const step         = useRef<Step>("modo");
  const uploadCapRef = useRef(false);
  const fileRef      = useRef<HTMLInputElement>(null);
  const data    = useRef({ gallinas: 0, sistema: "" as Sistema, ancho: 0, largo: 0, altura: 0 });
  const factRes = useRef<FactibilidadResponse | null>(null);
  const dynAns  = useRef<Record<string, string>>({});
  const dynIdx  = useRef(0);
  const recRes  = useRef<Recomendacion | null>(null);
  const idc     = useRef(0);
  const bottom  = useRef<HTMLDivElement>(null);

  function addBot(text: string) {
    setBubbles(b => [...b, { id: ++idc.current, from: "bot", text }]);
  }
  function addUser(text: string) {
    setBubbles(b => [...b, { id: ++idc.current, from: "user", text }]);
  }

  function reset() {
    idc.current = 0;
    step.current = "modo";
    data.current = { gallinas: 0, sistema: "" as Sistema, ancho: 0, largo: 0, altura: 0 };
    factRes.current = null;
    dynAns.current = {};
    dynIdx.current = 0;
    recRes.current = null;
    setNumVal(""); setAnchoV(""); setLargoV("");
    setBubbles([{ id: ++idc.current, from: "bot", text: WELCOME }]);
    setImode({ type: "options", choices: MODO_OPTS });
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reset(); }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [bubbles, imode]);

  // ── Option select ─────────────────────────────────────────────────────────

  async function onOpt(id: string, label: string) {
    addUser(label);
    setImode({ type: "idle" });

    switch (step.current) {
      case "modo":
        if (id === "compliance") {
          step.current = "gallinas";
          addBot("¿Cuántas gallinas tienes en tu granja?");
          setImode({ type: "number", unit: "aves", placeholder: "500", min: 1 });
        } else {
          step.current = "cap_sistema";
          addBot("¿Qué sistema de producción utilizas?");
          setImode({ type: "options", choices: SISTEMAS });
        }
        break;

      case "sistema":
        data.current.sistema = id as Sistema;
        if (id === "jaulas") {
          await doIntake("nidal_colectivo");
        } else {
          step.current = "ancho_largo";
          addBot("¿Cuánto mide la nave? Indícame el ancho y el largo en metros.");
          setImode({ type: "dims", isCap: false });
        }
        break;

      case "cap_sistema":
        data.current.sistema = id as Sistema;
        step.current = "cap_ancho_largo";
        addBot("¿Cuánto mide la nave? Ancho y largo en metros.");
        setImode({ type: "dims", isCap: true });
        break;

      case "dyn_q": {
        const qs = factRes.current!.preguntas;
        const q  = qs[dynIdx.current];
        dynAns.current[q.id] = id;
        dynIdx.current++;
        if (dynIdx.current < qs.length) {
          askDynQ();
        } else {
          await doRec();
        }
        break;
      }

      case "rec":
        if (id === "confirm")  await doIntake(recRes.current!.tipo_zona);
        else if (id === "nidal")   await doIntake("nidal_colectivo");
        else if (id === "aviario") await doIntake("aviario");
        else reset();
        break;
    }
  }

  // ── Number submit ─────────────────────────────────────────────────────────

  function onNumSubmit() {
    if (!numVal) return;
    const val = numVal;
    setNumVal("");
    setImode({ type: "idle" });

    if (step.current === "gallinas") {
      const n = parseInt(val);
      data.current.gallinas = n;
      addUser(`${n.toLocaleString("es-ES")} aves`);
      step.current = "sistema";
      addBot("¿Qué sistema de producción utilizas?");
      setImode({ type: "options", choices: SISTEMAS });

    } else if (step.current === "altura") {
      const h = parseFloat(val);
      data.current.altura = h;
      addUser(`${h} cm`);
      doFact();

    } else if (step.current === "cap_altura") {
      const h = parseFloat(val);
      data.current.altura = h;
      addUser(`${h} cm`);
      doCap();
    }
  }

  // ── Dims submit ───────────────────────────────────────────────────────────

  function onDimsSubmit(isCap: boolean) {
    if (!anchoV || !largoV) return;
    const a = parseFloat(anchoV);
    const l = parseFloat(largoV);
    setAnchoV(""); setLargoV("");
    data.current.ancho = a;
    data.current.largo = l;
    addUser(`${a} × ${l} m`);
    setImode({ type: "idle" });

    if (isCap) {
      step.current = "cap_altura";
      addBot("¿Cuál es la altura libre de la nave?");
      setImode({ type: "number", unit: "cm", placeholder: "320", min: 50 });
    } else {
      step.current = "altura";
      addBot("¿Cuál es la altura libre de la nave?");
      setImode({ type: "number", unit: "cm", placeholder: "300", min: 50 });
    }
  }

  // ── Plan image upload ─────────────────────────────────────────────────────

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const isCap = uploadCapRef.current;

    setIsUploading(true);
    setImode({ type: "loading", text: "Analizando el plano…" });

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/analizar-plano", { method: "POST", body: fd });
      const data: { ancho_m?: number; largo_m?: number; altura_cm?: number; confianza?: number; notas?: string } = await res.json();

      setIsUploading(false);

      if (data.ancho_m && data.largo_m) {
        setAnchoV(String(data.ancho_m));
        setLargoV(String(data.largo_m));
        const conf = data.confianza ?? 0;
        const confLabel = conf >= 0.8 ? "alta" : conf >= 0.5 ? "media" : "baja";
        addBot(
          `He detectado ${data.ancho_m} × ${data.largo_m} m (confianza ${confLabel}).` +
          (data.notas ? ` ${data.notas}` : "") +
          " Confirma o ajusta las medidas antes de continuar."
        );
      } else {
        addBot("No he podido detectar las dimensiones. Por favor introdúcelas manualmente.");
      }
    } catch {
      setIsUploading(false);
      addBot("Error al analizar la imagen. Por favor introduce las medidas manualmente.");
    }

    setImode({ type: "dims", isCap });
  }

  // ── Backend calls ─────────────────────────────────────────────────────────

  async function doFact() {
    const d = data.current;
    setImode({ type: "loading", text: "Analizando la nave…" });
    try {
      const fact = await pedirFactibilidad({
        num_gallinas:       d.gallinas,
        sistema:            d.sistema,
        superficie_nave_m2: d.ancho * d.largo,
        altura_nave_cm:     d.altura,
        ancho_nave_m:       d.ancho,
        largo_nave_m:       d.largo,
      });
      factRes.current = fact;
      setImode({ type: "idle" });

      const f = fact.factibilidad;
      if (!f.factible) {
        addBot(`La nave no es viable: ${f.mensaje}`);
        if (f.gallinas_max_nidal && f.gallinas_max_nidal > 0) {
          addBot(`Con esta nave puedes alojar como máximo ${f.gallinas_max_nidal.toLocaleString("es-ES")} gallinas con nidal colectivo.`);
        }
        step.current = "rec";
        setImode({ type: "options", choices: [{ id: "restart", label: "Nueva consulta" }] });
        return;
      }

      const f2 = f;
      const nidalOk = f2.densidad_actual <= f2.densidad_max;
      if (nidalOk) {
        addBot(`Nave analizada. Densidad con nidal: ${f2.densidad_actual.toFixed(1)} gal/m² — dentro del límite de ${f2.densidad_max} gal/m².`);
      } else {
        addBot(`Con nidal colectivo la densidad sería ${f2.densidad_actual.toFixed(1)} gal/m² — supera el límite de ${f2.densidad_max} gal/m².`);
        if (f2.niveles_posibles >= 2) {
          addBot(`Con aviario multinivel (${f2.niveles_posibles} niveles) bajaría a ${f2.densidad_min_aviario.toFixed(1)} gal/m².`);
        }
      }

      if (fact.preguntas.length > 0) {
        step.current = "dyn_q";
        dynIdx.current = 0;
        askDynQ();
      } else {
        await doRec();
      }
    } catch {
      setImode({ type: "idle" });
      addBot("Error al conectar con el servidor. Por favor inténtalo de nuevo.");
      step.current = "rec";
      setImode({ type: "options", choices: [{ id: "restart", label: "Nueva consulta" }] });
    }
  }

  function askDynQ() {
    const q = factRes.current!.preguntas[dynIdx.current];
    addBot(q.texto);
    setImode({ type: "options", choices: q.opciones.map(o => ({ id: o.id, label: o.texto })) });
  }

  async function doRec() {
    const d = data.current;
    setImode({ type: "loading", text: "Calculando recomendación…" });
    try {
      const rec = await pedirRecomendacionConRespuestas({
        num_gallinas:       d.gallinas,
        sistema:            d.sistema,
        superficie_nave_m2: d.ancho * d.largo,
        altura_nave_cm:     d.altura,
        ancho_nave_m:       d.ancho,
        largo_nave_m:       d.largo,
      }, dynAns.current);
      recRes.current = rec;
      setImode({ type: "idle" });

      const nombre = rec.tipo_zona === "aviario"
        ? `Aviario multinivel (${rec.niveles} niveles)`
        : "Nidal colectivo A-Nida";
      addBot(`Recomendación: ${nombre}\n${rec.razon}`);

      step.current = "rec";
      const choices: { id: string; label: string }[] = [
        { id: "confirm", label: `Generar propuesta · ${nombre}` },
      ];
      if (rec.tipo_zona === "aviario") {
        choices.push({ id: "nidal", label: "Prefiero nidal colectivo" });
      } else if (d.altura >= 300) {
        choices.push({ id: "aviario", label: "Prefiero aviario multinivel" });
      }
      choices.push({ id: "restart", label: "Empezar de nuevo" });
      setImode({ type: "options", choices });
    } catch {
      setImode({ type: "idle" });
      addBot("Error al calcular la recomendación.");
      step.current = "rec";
      setImode({ type: "options", choices: [{ id: "restart", label: "Nueva consulta" }] });
    }
  }

  async function doIntake(tipoZona: TipoZona) {
    const d = data.current;
    setImode({ type: "loading", text: "Generando propuesta comercial…" });
    try {
      const res = await solicitarIntake({
        num_gallinas:       d.gallinas,
        sistema:            d.sistema,
        superficie_nave_m2: d.ancho * d.largo,
        altura_nave_cm:     d.altura,
        tipo_zona:          tipoZona,
      });
      if (typeof window !== "undefined") {
        localStorage.setItem("gc_propuesta", JSON.stringify({
          informe:             res.informe,
          argumentario_ventas: res.argumentario_ventas,
          argumentos_producto: res.argumentos_producto ?? [],
          objeciones:          res.objeciones ?? [],
          gallinas:            String(d.gallinas),
          sistema:             d.sistema,
          superficie:          String(d.ancho * d.largo),
          altura:              String(d.altura),
          tipo_zona:           tipoZona,
          niveles:             recRes.current?.niveles ?? (tipoZona === "aviario" ? 2 : 1),
          ancho_nave:          String(d.ancho),
          largo_nave:          String(d.largo),
        }));
      }
      setImode({ type: "idle" });
      addBot("¡Tu propuesta comercial está lista!");
      setImode({ type: "done" });
    } catch {
      setImode({ type: "idle" });
      addBot("Error al generar la propuesta. Por favor inténtalo de nuevo.");
      step.current = "rec";
      setImode({ type: "options", choices: [{ id: "restart", label: "Nueva consulta" }] });
    }
  }

  async function doCap() {
    const d = data.current;
    setImode({ type: "loading", text: "Calculando capacidad de la nave…" });
    try {
      const res = await pedirCapacidad({
        num_gallinas:       0,
        sistema:            d.sistema,
        superficie_nave_m2: d.ancho * d.largo,
        altura_nave_cm:     d.altura,
        ancho_nave_m:       d.ancho,
        largo_nave_m:       d.largo,
      });
      setImode({ type: "idle" });
      const viables = res.opciones.filter(o => o.viable);
      if (!viables.length) {
        addBot("No es posible instalar ningún sistema que cumpla la normativa con estas dimensiones.");
        step.current = "rec";
        setImode({ type: "options", choices: [{ id: "restart", label: "Nueva consulta" }] });
        return;
      }
      addBot(`Con tu nave de ${d.ancho} × ${d.largo} m (${(d.ancho * d.largo).toFixed(0)} m²) puedes alojar:`);
      setImode({ type: "cap_choices", opciones: res.opciones });
    } catch {
      setImode({ type: "idle" });
      addBot("Error al calcular la capacidad.");
      step.current = "rec";
      setImode({ type: "options", choices: [{ id: "restart", label: "Nueva consulta" }] });
    }
  }

  async function onCapChoice(op: OpcionCapacidad) {
    addUser(`${op.label} — ${op.max_gallinas.toLocaleString("es-ES")} aves`);
    setImode({ type: "idle" });
    const zona: TipoZona = op.sistema.startsWith("aviario") ? "aviario" : "nidal_colectivo";
    recRes.current = { tipo_zona: zona, niveles: op.sistema === "aviario_3" ? 3 : 2, razon: "" };
    data.current.gallinas = op.max_gallinas;
    await doIntake(zona);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{CSS}</style>

      <header className="cv-hdr">
        <div className="cv-hdr-inner">
          <img src="/gyc-logo.png" alt="Gómez y Crespo" className="cv-logo" />
          <div className="cv-hdr-right">
            <a href="/" className="cv-hdr-link">Panel técnico</a>
            <a href="/propuesta" target="_blank" className="cv-hdr-link">
              Ver propuesta
              <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                <path d="M1 3.5h7M4 1l3.5 2.5L4 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </div>
        </div>
      </header>

      <div className="cv-root">
        {/* ── Thread ── */}
        <div className="cv-thread">
          {bubbles.map(b => (
            <div key={b.id} className={`cv-bbl cv-bbl--${b.from}`}>
              {b.from === "bot" && (
                <div className="cv-ava">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <circle cx="6.5" cy="6.5" r="5.5" stroke="white" strokeWidth="1.3"/>
                    <path d="M4 6.5l2 2 3.5-3.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
              <div className={`cv-msg cv-msg--${b.from}`}>
                {b.text.split("\n").map((line, i, arr) => (
                  <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
                ))}
              </div>
            </div>
          ))}

          {imode.type === "loading" && (
            <div className="cv-bbl cv-bbl--bot">
              <div className="cv-ava">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="5.5" stroke="white" strokeWidth="1.3"/>
                </svg>
              </div>
              <div className="cv-msg cv-msg--bot cv-msg--loading">
                <span className="cv-ldots"><span/><span/><span/></span>
                <span className="cv-ltxt">{imode.text}</span>
              </div>
            </div>
          )}

          <div ref={bottom} />
        </div>

        {/* ── Input area ── */}
        <div className="cv-input">

          {imode.type === "options" && (
            <div className="cv-opts">
              {imode.choices.map(c => (
                <button key={c.id} className="cv-opt" onClick={() => onOpt(c.id, c.label)}>
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {imode.type === "number" && (
            <form className="cv-nform" onSubmit={e => { e.preventDefault(); onNumSubmit(); }}>
              <div className="cv-nwrap">
                <input
                  autoFocus
                  type="number"
                  className="cv-ninput"
                  placeholder={imode.placeholder}
                  min={imode.min}
                  step="any"
                  value={numVal}
                  onChange={e => setNumVal(e.target.value)}
                />
                <span className="cv-nunit">{imode.unit}</span>
              </div>
              <button type="submit" className="cv-send" disabled={!numVal}>
                <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
                  <path d="M1 7h14M8 1l7 6-7 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </form>
          )}

          {imode.type === "dims" && (
            <div className="cv-dims-wrap">
              <form className="cv-dform" onSubmit={e => { e.preventDefault(); onDimsSubmit((imode as { isCap: boolean }).isCap); }}>
                <div className="cv-dinputs">
                  <div className="cv-nwrap">
                    <input
                      autoFocus type="number" className="cv-ninput"
                      placeholder="Ancho" min={1} step="0.1"
                      value={anchoV} onChange={e => setAnchoV(e.target.value)}
                    />
                    <span className="cv-nunit">m</span>
                  </div>
                  <span className="cv-dx">×</span>
                  <div className="cv-nwrap">
                    <input
                      type="number" className="cv-ninput"
                      placeholder="Largo" min={1} step="0.1"
                      value={largoV} onChange={e => setLargoV(e.target.value)}
                    />
                    <span className="cv-nunit">m</span>
                  </div>
                </div>
                <button type="submit" className="cv-send" disabled={!anchoV || !largoV}>
                  <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
                    <path d="M1 7h14M8 1l7 6-7 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </form>
              <button
                className="cv-upload-btn"
                disabled={isUploading}
                onClick={() => { uploadCapRef.current = (imode as { isCap: boolean }).isCap; fileRef.current?.click(); }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v8M4 4l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M1 10v1.5A1.5 1.5 0 0 0 2.5 13h9A1.5 1.5 0 0 0 13 11.5V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Subir plano o foto
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.pdf"
                style={{ display: "none" }}
                onChange={handleFileUpload}
              />
            </div>
          )}

          {imode.type === "cap_choices" && (
            <div className="cv-caps">
              {imode.opciones.map(op =>
                op.viable ? (
                  <button key={op.sistema} className="cv-cap" onClick={() => onCapChoice(op)}>
                    <div className="cv-cap-lbl">{op.label}</div>
                    <div className="cv-cap-n">
                      {op.max_gallinas.toLocaleString("es-ES")}
                      <span> aves</span>
                    </div>
                    <div className="cv-cap-d">
                      {op.num_modulos} módulos · {op.densidad_real.toFixed(1)} gal/m²
                    </div>
                    <div className="cv-cap-cta">Generar propuesta →</div>
                  </button>
                ) : (
                  <div key={op.sistema} className="cv-cap cv-cap--no">
                    <div className="cv-cap-lbl">{op.label}</div>
                    <div className="cv-cap-no-txt">No viable · altura insuficiente</div>
                  </div>
                )
              )}
              <button className="cv-restart" onClick={reset}>Nueva consulta</button>
            </div>
          )}

          {imode.type === "done" && (
            <div className="cv-done">
              <a href="/propuesta" target="_blank" className="cv-done-btn">
                Ver propuesta comercial
                <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
                  <path d="M1 6h12M7 1l6 5-6 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
              <button className="cv-restart" onClick={reset}>Nueva consulta</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;600;700&family=Montserrat:wght@700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Source Sans Pro', sans-serif;
    background: #f0f2f5;
    -webkit-font-smoothing: antialiased;
  }

  /* ── HEADER ── */
  .cv-hdr {
    background: #000823;
    position: sticky; top: 0; z-index: 100;
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }
  .cv-hdr-inner {
    max-width: 600px; margin: 0 auto; padding: 0 1.25rem;
    height: 52px; display: flex; align-items: center; justify-content: space-between;
  }
  .cv-logo { height: 26px; filter: brightness(0) invert(1); display: block; }
  .cv-hdr-right { display: flex; align-items: center; gap: 1.25rem; }
  .cv-hdr-link {
    display: inline-flex; align-items: center; gap: 0.35rem;
    font-size: 0.65rem; font-weight: 700; text-decoration: none;
    color: rgba(255,255,255,0.38); letter-spacing: 0.08em; text-transform: uppercase;
    transition: color 0.15s; white-space: nowrap;
  }
  .cv-hdr-link:hover { color: rgba(255,255,255,0.85); }

  /* ── ROOT ── */
  .cv-root {
    max-width: 600px; margin: 0 auto;
    height: calc(100vh - 52px);
    display: flex; flex-direction: column;
    background: #f0f2f5;
  }

  /* ── THREAD ── */
  .cv-thread {
    flex: 1; overflow-y: auto; scroll-behavior: smooth;
    padding: 1.25rem 1rem 0.75rem;
    display: flex; flex-direction: column; gap: 0.55rem;
  }

  .cv-bbl { display: flex; align-items: flex-end; gap: 0.4rem; }
  .cv-bbl--bot  { align-self: flex-start; }
  .cv-bbl--user { align-self: flex-end; flex-direction: row-reverse; }

  @keyframes cvPop {
    from { opacity: 0; transform: scale(0.96) translateY(5px); }
    to   { opacity: 1; transform: none; }
  }
  .cv-bbl { animation: cvPop 0.16s ease forwards; }

  .cv-ava {
    width: 26px; height: 26px; border-radius: 50%;
    background: #4f764d; flex-shrink: 0; margin-bottom: 1px;
    display: flex; align-items: center; justify-content: center;
  }

  .cv-msg {
    max-width: 74%;
    padding: 0.58rem 0.85rem;
    font-size: 0.94rem; line-height: 1.55;
    border-radius: 14px;
    word-break: break-word;
  }
  .cv-msg--bot {
    background: #fff; color: #000823;
    border-bottom-left-radius: 4px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.08);
  }
  .cv-msg--user {
    background: #4f764d; color: #fff;
    border-bottom-right-radius: 4px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.12);
  }

  .cv-msg--loading {
    display: flex; align-items: center; gap: 0.55rem;
    padding: 0.65rem 0.9rem;
  }
  .cv-ldots { display: flex; gap: 3px; align-items: center; }
  .cv-ldots span {
    width: 6px; height: 6px; border-radius: 50%;
    background: #4f764d; opacity: 0.35;
    animation: cvDot 1.2s ease infinite;
  }
  .cv-ldots span:nth-child(2) { animation-delay: 0.18s; }
  .cv-ldots span:nth-child(3) { animation-delay: 0.36s; }
  @keyframes cvDot {
    0%,80%,100% { opacity: 0.25; transform: scale(0.82); }
    40% { opacity: 1; transform: scale(1.05); }
  }
  .cv-ltxt { font-size: 0.78rem; color: #888; font-style: italic; }

  /* ── INPUT AREA ── */
  .cv-input {
    background: #fff;
    border-top: 1px solid #e5e7eb;
    padding: 0.85rem 1rem 1rem;
    max-height: 55vh; overflow-y: auto;
  }

  /* Options */
  .cv-opts { display: flex; flex-direction: column; gap: 0.38rem; }
  .cv-opt {
    padding: 0.68rem 1rem; text-align: left; width: 100%;
    border: 1.5px solid #e0e2e6; background: #fff;
    border-radius: 10px; cursor: pointer;
    font-size: 0.93rem; color: #000823; font-family: inherit;
    transition: border-color 0.15s, background 0.12s;
  }
  .cv-opt:hover { border-color: #4f764d; background: #f2f6f2; }

  /* Number input */
  .cv-nform { display: flex; align-items: center; gap: 0.5rem; }
  .cv-nwrap { position: relative; flex: 1; display: flex; align-items: center; }
  .cv-ninput {
    width: 100%;
    padding: 0.68rem 2.8rem 0.68rem 0.85rem;
    border: 1.5px solid #e0e2e6; border-radius: 10px;
    font-size: 1rem; color: #000823; background: #fff;
    outline: none; font-family: inherit;
    transition: border-color 0.15s;
    -moz-appearance: textfield;
  }
  .cv-ninput::-webkit-outer-spin-button,
  .cv-ninput::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .cv-ninput:focus { border-color: #4f764d; }
  .cv-nunit {
    position: absolute; right: 0.75rem;
    font-size: 0.76rem; color: #aaa; pointer-events: none;
  }

  /* Dims input */
  .cv-dims-wrap { display: flex; flex-direction: column; gap: 0.5rem; }
  .cv-dform { display: flex; align-items: center; gap: 0.45rem; }
  .cv-dinputs { flex: 1; display: flex; align-items: center; gap: 0.35rem; }
  .cv-dx { font-size: 1rem; color: #aaa; flex-shrink: 0; font-weight: 700; }

  /* Upload button */
  .cv-upload-btn {
    display: flex; align-items: center; justify-content: center; gap: 0.45rem;
    padding: 0.55rem 1rem;
    border: 1.5px dashed #c9d5c9; border-radius: 10px;
    background: #f8fbf8; color: #4f764d;
    font-size: 0.82rem; font-weight: 600; font-family: inherit;
    cursor: pointer; transition: border-color 0.15s, background 0.12s;
    width: 100%;
  }
  .cv-upload-btn:hover:not(:disabled) { border-color: #4f764d; background: #eef5ee; }
  .cv-upload-btn:disabled { opacity: 0.4; cursor: default; }

  /* Send button */
  .cv-send {
    width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
    background: #4f764d; color: #fff; border: none;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background 0.15s;
  }
  .cv-send:hover { background: #234926; }
  .cv-send:disabled { opacity: 0.38; cursor: default; }

  /* Capacidad cards */
  .cv-caps { display: flex; flex-direction: column; gap: 0.45rem; }
  .cv-cap {
    padding: 0.8rem 1rem; border: 1.5px solid #4f764d;
    background: #f2f6f2; border-radius: 10px;
    text-align: left; cursor: pointer; width: 100%; font-family: inherit;
    transition: background 0.13s;
  }
  .cv-cap:hover { background: #e5ede5; }
  .cv-cap--no {
    border-color: #e0e2e6; background: #f8f8f8; opacity: 0.6; cursor: default;
  }
  .cv-cap-lbl {
    font-size: 0.64rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; color: #6b7280; margin-bottom: 0.2rem;
  }
  .cv-cap-n {
    font-size: 1.45rem; font-weight: 700; color: #000823;
    line-height: 1.1; margin-bottom: 0.12rem;
  }
  .cv-cap-n span { font-size: 0.82rem; font-weight: 400; color: #6b7280; }
  .cv-cap-d { font-size: 0.75rem; color: #6b7280; }
  .cv-cap-cta {
    font-size: 0.74rem; font-weight: 700; color: #4f764d; margin-top: 0.38rem;
  }
  .cv-cap-no-txt { font-size: 0.8rem; color: #aaa; margin-top: 0.18rem; }

  /* Restart / done */
  .cv-restart {
    background: none; border: none; color: #9ca3af;
    font-size: 0.76rem; cursor: pointer; text-decoration: underline;
    padding: 0.2rem 0; font-family: inherit;
    text-align: center; width: 100%; margin-top: 0.2rem;
  }
  .cv-done { display: flex; flex-direction: column; gap: 0.5rem; }
  .cv-done-btn {
    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
    padding: 0.82rem 1.5rem; background: #4f764d; color: #fff;
    border-radius: 10px; font-weight: 700; font-size: 0.95rem;
    text-decoration: none; transition: background 0.15s; letter-spacing: 0.02em;
  }
  .cv-done-btn:hover { background: #234926; }

  /* ── Responsive ── */
  @media (max-width: 480px) {
    .cv-msg { max-width: 84%; font-size: 0.9rem; }
    .cv-hdr-link:first-child { display: none; }
  }
`;
