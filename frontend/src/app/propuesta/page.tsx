"use client";

import { useEffect, useState } from "react";
import JourneyHeader from "../JourneyHeader";

interface RequisitoCalculado {
  nombre: string;
  valor_minimo: number;
  unidad: string;
  formula: string;
  articulo: string;
}

interface VerificacionNave {
  parametro: string;
  cumple: boolean;
  valor_real: number;
  valor_limite: number;
  unidad: string;
  tipo_limite: "minimo" | "maximo";
  articulo: string;
}

interface InformeIntake {
  sistema: string;
  num_gallinas: number;
  verificaciones_nave: VerificacionNave[];
  requisitos: RequisitoCalculado[];
  cumple_nave: boolean;
  advertencias: string[];
  consulta_rag: string;
}

interface ProposalData {
  informe: InformeIntake;
  argumentario_ventas: string;
  argumentos_producto: string[];
  gallinas: string;
  sistema: string;
  superficie: string;
  altura: string;
  tipo_zona: "nidal_colectivo" | "aviario";
  niveles?: number;
  ancho_nave?: string;
  largo_nave?: string;
}

const SISTEMA_LABEL: Record<string, string> = {
  suelo: "En suelo",
  campero: "Campero",
  ecologico: "Ecológico",
  jaulas: "Jaulas enriquecidas",
};

function renderMd(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>");
}

function GycLogoImg({ size = "md", white = false }: { size?: "sm" | "md" | "lg"; white?: boolean }) {
  return (
    <img
      src="/gyc-logo.png"
      alt="Gomez y Crespo"
      className={["logo-img", `logo-img--${size}`, white ? "logo-img--white" : ""].filter(Boolean).join(" ")}
    />
  );
}

// ── Plano generado por IA ─────────────────────────────────────────────────────

function AiPlanoSection({
  ancho_nave_m, largo_nave_m, gallinas, sistema, tipo_zona, superficie,
}: {
  ancho_nave_m: number; largo_nave_m: number; gallinas: number;
  sistema: string; tipo_zona: "nidal_colectivo" | "aviario"; superficie: number;
}) {
  const [svg, setSvg]       = useState<string | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

    async function fetchPlano() {
      setLoading(true);
      setSvg(null);
      setError(null);
      try {
        // Primero obtenemos el layout real de módulos
        const layoutRes = await fetch(`${backendUrl}/layout-nidal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ancho_nave: ancho_nave_m,
            largo_nave: largo_nave_m,
            sistema,
          }),
        });
        if (!layoutRes.ok) throw new Error("layout error");
        const layout = await layoutRes.json();

        // Luego pedimos el SVG a Gemini con el layout calculado
        const planoRes = await fetch(`${backendUrl}/plano`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ancho_nave_m,
            largo_nave_m,
            filas: layout.filas ?? [],
            tipo_zona,
            gallinas,
            sistema,
            total_modulos: layout.total_modulos ?? 0,
            yacija_interior_m2: layout.yacija_interior_m2 ?? 0,
          }),
        });
        if (!planoRes.ok) throw new Error("plano error");
        const data = await planoRes.json();
        if (data.error || !data.svg) throw new Error(data.error ?? "SVG vacío");
        setSvg(data.svg);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error generando el plano");
      } finally {
        setLoading(false);
      }
    }

    fetchPlano();
  }, [ancho_nave_m, largo_nave_m, gallinas, sistema, tipo_zona, superficie]);

  if (loading) return (
    <div className="ai-plano-loading">
      <div className="ai-plano-dots"><span /><span /><span /></div>
      <p>Generando plano con IA…</p>
    </div>
  );

  if (error || !svg) return (
    <NaveSchematic
      superficie={superficie}
      gallinas={gallinas}
      tipoZona={tipo_zona}
      requisitos={[]}
    />
  );

  return (
    <div
      className="ai-plano-svg"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

// ── Plano esquemático (fallback) ──────────────────────────────────────────────

function NaveSchematic({
  superficie, gallinas, tipoZona, requisitos,
}: {
  superficie: number; gallinas: number;
  tipoZona: "nidal_colectivo" | "aviario"; requisitos: RequisitoCalculado[];
}) {
  const isAviario = tipoZona === "aviario";
  const numModulos = Math.ceil(gallinas / (isAviario ? 60 : 144));
  const modAncho = isAviario ? 3.735 : 1.20;
  const modFondo = isAviario ? 1.20 : 1.40;
  const slotFondo = isAviario ? 1.20 : 3.00;
  const naveAnchoM = numModulos * modAncho;
  const naveFondoM = superficie / naveAnchoM;
  const bloqueM = modFondo + 2 * slotFondo;
  const yacijaM = Math.max(0.3, (naveFondoM - bloqueM) / 2);

  const SVG_W = 300, SVG_H = 190, PAD = 14;
  const drawW = SVG_W - PAD * 2;
  const drawH = SVG_H - PAD * 2 - 18;
  const sx = drawW / naveAnchoM;
  const sy = drawH / naveFondoM;

  const yYac1 = PAD; const hYac1 = yacijaM * sy;
  const ySlot1 = yYac1 + hYac1; const hSlot = slotFondo * sy;
  const yMod = ySlot1 + hSlot; const hMod = modFondo * sy;
  const ySlot2 = yMod + hMod; const yYac2 = ySlot2 + hSlot;
  const hYac2 = yacijaM * sy; const modPx = modAncho * sx;

  const LS = { fontSize: "7", fontFamily: "var(--font-body), sans-serif", fontWeight: "700", letterSpacing: "0.1em" } as const;

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="nave-schematic">
      <rect x={PAD} y={PAD} width={drawW} height={drawH} fill="none" stroke="#dddddd" strokeWidth="1" strokeDasharray="3 2" />
      <rect x={PAD} y={yYac1} width={drawW} height={hYac1} fill="#e8ede8" opacity="0.8" />
      {hYac1 > 11 && <text x={PAD + 5} y={yYac1 + hYac1 / 2} dominantBaseline="middle" fill="#484e62" {...LS}>YACIJA</text>}
      <rect x={PAD} y={ySlot1} width={drawW} height={hSlot} fill="#4f764d" opacity="0.15" />
      {hSlot > 9 && <text x={PAD + 5} y={ySlot1 + hSlot / 2} dominantBaseline="middle" fill="#234926" {...LS}>{isAviario ? "PASILLO" : `SLOT ${slotFondo}m`}</text>}
      {Array.from({ length: numModulos }, (_, i) => (
        <rect key={i} x={PAD + i * modPx + 0.5} y={yMod} width={Math.max(1, modPx - 1)} height={hMod} fill="#000823" rx="1" />
      ))}
      {hMod > 9 && <text x={PAD + drawW / 2} y={yMod + hMod / 2} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.85)" {...LS}>{numModulos} {isAviario ? "aviarios" : "módulos"}</text>}
      <rect x={PAD} y={ySlot2} width={drawW} height={hSlot} fill="#4f764d" opacity="0.15" />
      {hSlot > 9 && <text x={PAD + 5} y={ySlot2 + hSlot / 2} dominantBaseline="middle" fill="#234926" {...LS}>{isAviario ? "PASILLO" : `SLOT ${slotFondo}m`}</text>}
      <rect x={PAD} y={yYac2} width={drawW} height={hYac2} fill="#e8ede8" opacity="0.8" />
      {hYac2 > 11 && <text x={PAD + 5} y={yYac2 + hYac2 / 2} dominantBaseline="middle" fill="#484e62" {...LS}>YACIJA</text>}
      <g transform={`translate(${PAD}, ${PAD + drawH + 6})`}>
        <rect x={0} y={0} width={8} height={8} fill="#000823" rx="1" />
        <text x={11} y={6.5} fill="#484e62" fontSize="6.5" fontFamily="var(--font-body), sans-serif">{isAviario ? "Aviarios" : "Nidales"} ({numModulos})</text>
        <rect x={80} y={0} width={8} height={8} fill="#e8ede8" />
        <text x={91} y={6.5} fill="#484e62" fontSize="6.5" fontFamily="var(--font-body), sans-serif">Yacija</text>
        <rect x={130} y={1} width={8} height={6} fill="#4f764d" opacity="0.4" />
        <text x={141} y={6.5} fill="#484e62" fontSize="6.5" fontFamily="var(--font-body), sans-serif">{isAviario ? "Pasillo" : "Slot"}</text>
      </g>
    </svg>
  );
}

// ── Características por producto ──────────────────────────────────────────────


const FEATURES_GENERIC = [
  { icon: "/icons/galvanizado.svg", titulo: "Rejillas triple galvanizado", desc: "Alambre de ⌀2,8mm con una resistencia a la corrosión tres veces superiro al alambre convencional" },
  { icon: "/icons/Recurso 23.svg", titulo: "Tubos PosMAC®", desc: "Revestimiento de film químico sobre galvanizado Mg-AL que lo hace cinco veces más resistente y duradero al convencional" },
  { icon: "/icons/Recurso 22.svg", titulo: "Chapa DX51D+Z275", desc: "Galvanizado de alta calidad con 20 micras de Zinc según ISO9223 y EN10346:2015" },

]

const FEATURES_NIDAL = [
  { icon: "/icons/recurso-9.svg", titulo: "Slats a medida", desc: " Estructura modilar que permote 1,2 o 3 metros por lado de nidal " },
  { icon: "/icons/Antipiojos.svg", titulo: "Antipiojos", desc: "Diseñado en chapa minimizando zonas ocultas para evitar la proliferación de ácaro rojo" },
  { icon: "/icons/LimpiezaSimple.svg", titulo: "Limpieza simple", desc: "Diseñado para poder desinfectar y limpiar sin desmontar todo el nidal." },
  { icon: "/icons/recurso 21.svg", titulo: "Gallinas Felices", desc: "Diseñado y certificado para sistemas en suelo, campero y ecológico. Cumplimiento garantizado de Directiva 1999/74/CE." },
  { icon: "/icons/Recurso 20.svg", titulo: "Huevo de calidad", desc: "El slot guía a las gallinas al nidal en el momento de la puesta. Drástica reducción de huevos sucios y rotos en suelo." },
  { icon: "/icons/Recurso 15.svg", titulo: "Alfombras higiénicas", desc: "Nido AstroTurf perforado,evita acumulación de residuos" },
  { icon: "/icons/Recurso 17.svg", titulo: "Adaptable ", desc: "Sistema modular que permite buscar solución a cada proyecto individual." },

];

const FEATURES_AVIARIO = [
  { icon: "/icons/recurso-10.svg", titulo: "Hasta 3 niveles", desc: "Multiplica la densidad útil sin ampliar la nave. Cada nivel suma 13,18 m² disponibles para las aves por módulo instalado." },
  { icon: "/icons/galvanizado.svg", titulo: "Acero + polímeros", desc: "Estructura de 532 kg por módulo con polímeros de alta resistencia. Diseñada para más de 20 años de operación continua." },
  { icon: "/icons/recurso-19.svg", titulo: "Densidad certificada", desc: "Superficie disponible validada por el diseñador. Cumple Directiva 1999/74/CE Art. 4.3.a en todos los niveles operativos." },
  { icon: "/icons/gallinas.svg", titulo: "Código 0 y código 1", desc: "Sistema homologado para producción campero y ecológico. Permite el etiquetado de huevo en las categorías de mayor valor." },
  { icon: "/icons/manejo.svg", titulo: "Gestión de estiércol", desc: "Bandejas extractables por nivel con recogida cada 2-3 días. Sin contaminación cruzada entre plantas ni acumulación de amoníaco." },
  { icon: "/icons/suministros.svg", titulo: "ROI en < 3 años", desc: "La superficie extra por metro cuadrado de nave amortiza la inversión en el primer ciclo productivo ampliado." },
];

// ── Página ────────────────────────────────────────────────────────────────────

export default function PropuestaPage() {
  const [data, setData] = useState<ProposalData | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("gc_propuesta");
      if (raw) setData(JSON.parse(raw));
    } catch { }
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (!data) {
    return (
      <div className="empty-state">
<style>{BASE_CSS}</style>
        <GycLogoImg size="lg" />
        <p className="empty-title">Sin datos de propuesta</p>
        <p className="empty-sub">Genera un informe desde la calculadora primero.</p>
        <a href="/" className="btn-pill">← Volver a la calculadora</a>
      </div>
    );
  }

  const { informe, argumentario_ventas, gallinas, sistema, superficie, tipo_zona, niveles, ancho_nave, largo_nave } = data;
  const anchoM  = ancho_nave  ? parseFloat(ancho_nave)  : 0;
  const largoM  = largo_nave  ? parseFloat(largo_nave)  : 0;
  const tieneNaveDims = anchoM > 0 && largoM > 0;
  const sistemaLabel = SISTEMA_LABEL[sistema] ?? sistema;
  const nivelesEfectivos = tipo_zona === "aviario" ? (niveles ?? 2) : 1;
  const isAviario = tipo_zona === "aviario";
  const cumple = informe.cumple_nave;
  const fechaHoy = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  const numModulos = Math.ceil(parseInt(gallinas) / (isAviario ? 60 : 144));
  const densidadVerif = informe.verificaciones_nave.find(v => v.parametro.toLowerCase().includes("densidad"));
  const densidadReal = densidadVerif ? densidadVerif.valor_real.toFixed(1) : "—";
  const densidadLimite = densidadVerif ? densidadVerif.valor_limite : 9;
  const productoNombre = isAviario ? "Aviario Industrial" : "A-Nida";
  const productoCodigo = isAviario ? "COD. 10007 · MULTINIVEL" : "NIDAL COLECTIVO";
  const productoSubtitulo = isAviario
    ? `Sistema aviario de ${nivelesEfectivos} plantas para producción intensiva en altura`
    : "Sistema de nidales colectivos para producción en suelo, campero y ecológico";
  const features = isAviario ? FEATURES_AVIARIO : FEATURES_NIDAL;

  return (
    <>
      <style>{BASE_CSS}</style>

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <JourneyHeader
        activeStep={4}
        actions={
          <button className="hdr-action" onClick={() => window.print()}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 4V1h8v3M2 8H1V5h10v3h-1M3.5 8v3h5V8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Exportar PDF
          </button>
        }
      />

      {/* ── HERO ───────────────────────────────────────────────────── */}
      <section className={`hero ${isAviario ? "hero--aviario" : ""}`}>
        <div className="hero-inner wrap">
          <div className="hero-top">
            <div className="hero-eyebrow-group">
              <span className="hero-tag">{productoCodigo}</span>
              <span className="hero-sep">·</span>
              <span className="hero-date">{fechaHoy}</span>
            </div>
            <span className={`hero-status ${cumple ? "is-ok" : "is-fail"}`}>
              {cumple ? (
                <><svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true"><path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg> Instalación viable</>
              ) : (
                <><svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true"><path d="M2 2l5 5M7 2L2 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg> Revisar parámetros</>
              )}
            </span>
          </div>

          <h1 className="hero-title">{productoNombre}</h1>
          <p className="hero-subtitle">{productoSubtitulo}</p>

          <div className="hero-stats">
            {[
              { val: parseInt(gallinas).toLocaleString("es-ES"), lbl: "Gallinas ponedoras" },
              { val: numModulos.toString(), lbl: isAviario ? `Módulos · ${nivelesEfectivos} niveles` : "Módulos A-Nida" },
              { val: densidadReal, lbl: `Gal/m² · límite ${densidadLimite}` },
              { val: parseFloat(superficie).toLocaleString("es-ES"), lbl: "m² de nave" },
            ].map((s, i) => (
              <div key={i} className="hero-stat">
                <span className="hero-stat-val mono">{s.val}</span>
                <span className="hero-stat-lbl">{s.lbl}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CARACTERÍSTICAS ────────────────────────────────────────── */}
      <section className="section-features">
        <div className="wrap">
          <div className="sec-header">
            <h2 className="sec-title">Características del sistema</h2>
            <span className="sec-rule" />
          </div>
          <div className="features-grid">
            {features.map((f) => (
              <div key={f.titulo} className="feat-card">
                <div className="feat-icon-wrap">
                  <img src={f.icon} alt={f.titulo} className="feat-icon-img" width={36} height={36} />
                </div>
                <div className="feat-content">
                  <h3 className="feat-titulo">{f.titulo}</h3>
                  <p className="feat-desc">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VERIFICACIÓN ───────────────────────────────────────────── */}
      <section className="section-alt">
        <div className="wrap section-inner">
          <div className="sec-header">
            <h2 className="sec-title">Verificación normativa</h2>
            <span className="sec-rule" />
          </div>

          <div className="kpi-row">
            <div className="kpi-card">
              <span className="kpi-label">Normativa</span>
              <span className="kpi-val mono kpi-val--md">RD 3/2002</span>
              <span className={`status-badge ${cumple ? "is-ok" : "is-fail"}`}>{cumple ? "Conforme" : "No conforme"}</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Densidad real</span>
              <span className="kpi-val mono">{densidadReal}<span className="kpi-denom">/{densidadLimite}</span></span>
              <span className="kpi-unit">gallinas/m²</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Verificaciones</span>
              <span className="kpi-val mono">{informe.verificaciones_nave.filter(v => v.cumple).length}<span className="kpi-denom">/{informe.verificaciones_nave.length}</span></span>
              <span className="kpi-unit">parámetros OK</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Sistema</span>
              <span className="kpi-val mono kpi-val--sm">{sistemaLabel}</span>
              <span className="kpi-unit">{parseInt(gallinas).toLocaleString("es-ES")} aves</span>
            </div>
          </div>

          <div className="verif-list">
            {informe.verificaciones_nave.map((v) => (
              <div key={v.parametro} className="verif-item">
                <span className={`verif-dot ${v.cumple ? "is-ok" : "is-fail"}`} />
                <div className="verif-content">
                  <span className="verif-name">{v.parametro}</span>
                  <span className="verif-detail">
                    Real: <strong className="mono">{v.valor_real.toLocaleString("es-ES", { maximumFractionDigits: 2 })} {v.unidad}</strong>
                    {" · "}Límite {v.tipo_limite === "maximo" ? "máx." : "mín."}: <strong className="mono">{v.valor_limite.toLocaleString("es-ES")} {v.unidad}</strong>
                    {" · "}<em>{v.articulo}</em>
                  </span>
                </div>
                <span className={`status-badge ${v.cumple ? "is-ok" : "is-fail"}`}>{v.cumple ? "Cumple" : "Revisar"}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DIMENSIONAMIENTO ───────────────────────────────────────── */}
      <section className="section-white">
        <div className="wrap section-inner">
          <div className="sec-header">
            <h2 className="sec-title">Dimensionamiento de la instalación</h2>
            <span className="sec-rule" />
          </div>
          <div className="dim-grid">
            <div className="dim-panel">
              <div className="dim-panel-head">
                <span className="dim-panel-badge">A</span>
                <span className="dim-panel-title">Datos de la instalación</span>
              </div>
              <div className="dim-panel-body">
                {[
                  { l: "Gallinas", v: parseInt(gallinas).toLocaleString("es-ES") + " aves" },
                  { l: "Sistema", v: sistemaLabel },
                  { l: "Superficie nave", v: parseFloat(superficie).toLocaleString("es-ES") + " m²" },
                  { l: "Alojamiento", v: productoNombre },
                  ...(data.altura ? [{ l: "Altura libre", v: data.altura + " cm" }] : []),
                  { l: "Módulos necesarios", v: numModulos + " uds." },
                ].map(d => (
                  <div key={d.l} className="dim-row">
                    <span className="dim-label">{d.l}</span>
                    <span className="dim-value mono">{d.v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="dim-panel">
              <div className="dim-panel-head">
                <span className="dim-panel-badge">B</span>
                <span className="dim-panel-title">Plano de distribución · vista de planta</span>
              </div>
              <div className="dim-plano">
                {tieneNaveDims ? (
                  <AiPlanoSection
                    ancho_nave_m={anchoM}
                    largo_nave_m={largoM}
                    gallinas={parseInt(gallinas)}
                    sistema={sistema}
                    tipo_zona={tipo_zona}
                    superficie={parseFloat(superficie)}
                  />
                ) : (
                  <NaveSchematic
                    superficie={parseFloat(superficie)}
                    gallinas={parseInt(gallinas)}
                    tipoZona={tipo_zona}
                    requisitos={informe.requisitos}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── EQUIPAMIENTO ───────────────────────────────────────────── */}
      <section className="section-alt">
        <div className="wrap section-inner">
          <div className="sec-header">
            <h2 className="sec-title">Equipamiento mínimo requerido por normativa</h2>
            <span className="sec-rule" />
          </div>
          <div className="eq-grid">
            {informe.requisitos.map((r) => (
              <div key={r.nombre} className="eq-card">
                <span className="eq-name">{r.nombre}</span>
                <span className="eq-val mono">
                  {r.valor_minimo.toLocaleString("es-ES", { maximumFractionDigits: 2 })}
                  <span className="eq-unit">{r.unidad}</span>
                </span>
                <span className="eq-formula">{r.formula}</span>
                <span className="eq-ref">{r.articulo}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ARGUMENTARIO ───────────────────────────────────────────── */}
      {argumentario_ventas && (
        <section className="section-dark">
          <div className="wrap">
            <div className="arg-layout">
              <div className="arg-aside">
                <span className="arg-aside-label">Propuesta comercial</span>
                <h2 className="arg-aside-title">Por qué<br />Gómez y<br />Crespo</h2>
                <p className="arg-aside-desc">Fabricantes de equipamiento avícola con más de 50 años de experiencia.<br />ISO 9001 · ISO 14001.</p>
              </div>
              <div className="arg-body" dangerouslySetInnerHTML={{ __html: `<p>${renderMd(argumentario_ventas)}</p>` }} />
            </div>
          </div>
        </section>
      )}

      {/* ── NEXT STEP: Plano ───────────────────────────────────────── */}
      <section className="section-plano-cta">
        <div className="wrap">
          <div className="plano-cta-inner">
            <div className="plano-cta-text">
              <span className="plano-cta-eyebrow">Paso 6 de 6</span>
              <h2 className="plano-cta-title">Ver plano de instalación</h2>
              <p className="plano-cta-desc">Visualiza la disposición de los módulos en tu nave con dimensiones reales.</p>
            </div>
            <a href="/plano" className="plano-cta-btn">
              Abrir editor de plano
              <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true">
                <path d="M1 5h12M8 1l5 4-5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────── */}
      <section className="section-cta">
        <div className="wrap">
          <div className="cta-layout">
            <div className="cta-text">
              <h2 className="cta-title">¿Solicitar presupuesto?</h2>
              <p className="cta-desc">Nuestro equipo comercial responde en menos de 48 horas.</p>
            </div>
            <div className="cta-actions">
              <a href="mailto:info@gomezycrespo.com" className="btn-pill btn-pill--light">
                Solicitar presupuesto
                <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true">
                  <path d="M1 5h12M8 1l5 4-5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <a href="tel:+34988217754" className="btn-outline btn-outline--light">+34 988 217 754</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────── */}
      <footer className="ftr">
        <div className="wrap ftr-inner">
          <span className="ftr-brand">Gómez y Crespo · Agente Aviario v0.5</span>
          <span className="ftr-norm">RD 3/2002 · Directiva 1999/74/CE · RD 637/2021</span>
          <a href="/" className="ftr-back">
            <svg width="9" height="8" viewBox="0 0 9 8" fill="none">
              <path d="M4 1L1 4m0 0l3 3M1 4h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Calculadora
          </a>
        </div>
      </footer>
    </>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const BASE_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --c-primary:     #4f764d;
    --c-primary-dk:  #234926;
    --c-title:       #000823;
    --c-body:        #484e62;
    --c-bg-alt:      #F6F7F8;
    --c-bg:          #ffffff;
    --c-border:      #dddddd;
    --c-ok-bg:       #eaf5ea;
    --c-ok-text:     #1d6b22;
    --c-fail-bg:     #fdecea;
    --c-fail-text:   #b5261e;
    --font-display:  var(--font-montserrat, 'Montserrat');
    --font-body:     var(--font-source-sans, 'Source Sans Pro');
    --font-mono:     var(--font-jetbrains, 'JetBrains Mono');
  }

  html { scroll-behavior: smooth; }

  body {
    font-family: var(--font-body), sans-serif;
    font-size: 1rem;
    line-height: 1.65;
    background: var(--c-bg);
    color: var(--c-body);
    -webkit-font-smoothing: antialiased;
  }

  .mono { font-family: var(--font-mono), monospace; }

  .wrap { max-width: 1200px; margin: 0 auto; padding: 0 2rem; }

  .nave-schematic { display: block; }

  /* ── Logo ── */
  .logo-img          { display: block; width: auto; height: auto; }
  .logo-img--sm      { height: 32px; }
  .logo-img--md      { height: 40px; }
  .logo-img--lg      { height: 72px; }
  .logo-img--white   { filter: brightness(0) invert(1); }

  /* ── HEADER action (passed into JourneyHeader) ── */
  .hdr-action {
    margin-left: auto; display: inline-flex; align-items: center; gap: 0.45rem;
    background: var(--c-primary); color: #ffffff;
    border: none; border-radius: 30px;
    padding: 0.4rem 1rem; font-family: var(--font-body), sans-serif;
    font-size: 0.72rem; font-weight: 600; cursor: pointer;
    letter-spacing: 0.06em; text-transform: uppercase;
    transition: background 0.15s;
  }
  .hdr-action:hover { background: var(--c-primary-dk); }

  /* ── HERO ── */
  .hero {
    background-color: var(--c-title);
    background-size: cover;
    background-position: center 40%;
    padding: 4rem 0 3.5rem;
    position: relative; overflow: hidden;
  }
  .hero:not(.hero--aviario) {
    background-image: url('/hero-nidal.jpg');
  }
  .hero::before {
    content: "";
    position: absolute; inset: 0;
    background: linear-gradient(
      to right,
      rgba(0,8,35,0.93) 0%,
      rgba(0,8,35,0.78) 50%,
      rgba(0,8,35,0.50) 100%
    );
    pointer-events: none; z-index: 0;
  }
  .hero::after {
    content: "";
    position: absolute; top: 0; right: 0;
    width: 400px; height: 400px;
    background: radial-gradient(ellipse at 100% 0%, rgba(79,118,77,0.18) 0%, transparent 65%);
    pointer-events: none;
  }
  .hero-inner { position: relative; z-index: 1; }
  .hero-top {
    display: flex; align-items: center; gap: 1rem;
    margin-bottom: 2rem;
  }
  .hero-tag {
    font-family: var(--font-display), sans-serif; font-size: 0.6rem; font-weight: 700;
    letter-spacing: 0.22em; text-transform: uppercase; color: var(--c-primary);
  }
  .hero-sep { color: rgba(255,255,255,0.2); font-size: 0.7rem; }
  .hero-date { font-size: 0.62rem; color: rgba(255,255,255,0.52); letter-spacing: 0.08em; text-transform: uppercase; }
  .hero-status {
    margin-left: auto; display: inline-flex; align-items: center; gap: 0.4rem;
    font-family: var(--font-display), sans-serif; font-size: 0.6rem; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    padding: 0.25rem 0.75rem; border-radius: 30px; border: 1px solid transparent;
  }
  .hero-status.is-ok   { background: rgba(79,118,77,0.2); color: #8fd68f; border-color: rgba(79,118,77,0.3); }
  .hero-status.is-fail { background: rgba(181,38,30,0.2); color: #f09090; border-color: rgba(181,38,30,0.3); }
  .hero-title {
    font-family: var(--font-display), sans-serif; font-weight: 800;
    font-size: clamp(2.8rem, 7vw, 5.5rem);
    color: #ffffff; line-height: 0.95; letter-spacing: -0.02em;
    margin-bottom: 1rem;
  }
  .hero-subtitle {
    font-size: 1rem; color: rgba(255,255,255,0.78); font-weight: 400;
    line-height: 1.6; max-width: 500px; margin-bottom: 2.5rem;
  }
  .hero-stats {
    display: grid; grid-template-columns: repeat(4, auto);
    justify-content: start; gap: 0;
    border-top: 1px solid rgba(255,255,255,0.07);
    padding-top: 2rem;
  }
  .hero-stat {
    display: flex; flex-direction: column; gap: 0.3rem;
    padding: 0 2.5rem 0 0; border-right: 1px solid rgba(255,255,255,0.07);
    margin-right: 2.5rem;
  }
  .hero-stat:last-child { border-right: none; margin-right: 0; padding-right: 0; }
  .hero-stat-val { font-size: 2rem; font-weight: 700; color: #ffffff; letter-spacing: -0.04em; line-height: 1; }
  .hero-stat-lbl { font-size: 0.62rem; color: rgba(255,255,255,0.62); letter-spacing: 0.1em; text-transform: uppercase; font-family: var(--font-display), sans-serif; font-weight: 600; }

  /* ── SECTION COMMON ── */
  .sec-header {
    display: flex; align-items: center; gap: 1.25rem;
    margin-bottom: 2rem;
  }
  .sec-title {
    font-family: var(--font-display), sans-serif; font-size: 1.17rem; font-weight: 700;
    color: var(--c-title); white-space: nowrap; letter-spacing: -0.01em;
  }
  .sec-rule { flex: 1; height: 1px; background: var(--c-border); }
  .section-inner { padding-top: 3rem; padding-bottom: 3rem; }

  .section-features { background: var(--c-bg); border-top: 1px solid var(--c-border); padding: 3rem 0; }
  .section-alt    { background: var(--c-bg-alt); border-top: 1px solid var(--c-border); }
  .section-white  { background: var(--c-bg); border-top: 1px solid var(--c-border); }

  /* ── CARACTERÍSTICAS ── */
  .features-grid {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 1px; background: var(--c-border);
    border: 1px solid var(--c-border);
  }
  .feat-card {
    background: var(--c-bg); padding: 1.5rem;
    display: flex; gap: 1rem; align-items: flex-start;
    transition: background 0.2s;
  }
  .feat-card:hover { background: var(--c-bg-alt); }
  .feat-icon-wrap {
    flex-shrink: 0; width: 48px; height: 48px;
    display: flex; align-items: center; justify-content: center;
    background: var(--c-bg-alt); border: 1px solid var(--c-border);
    border-radius: 8px; padding: 9px;
  }
  .feat-icon-img {
    display: block; object-fit: contain;
    filter: brightness(0) saturate(100%) invert(35%) sepia(22%) saturate(500%) hue-rotate(80deg) brightness(90%);
  }
  .feat-titulo { font-family: var(--font-display), sans-serif; font-size: 0.88rem; font-weight: 700; color: var(--c-title); margin-bottom: 0.35rem; line-height: 1.3; }
  .feat-desc   { font-size: 0.82rem; color: var(--c-body); line-height: 1.65; }
  .feat-content { flex: 1; }

  /* ── KPI CARDS ── */
  .kpi-row {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 1rem; margin-bottom: 1.5rem;
  }
  .kpi-card {
    background: var(--c-bg); padding: 1.25rem 1.25rem 1.1rem;
    display: flex; flex-direction: column; gap: 0.2rem;
    border: 1px solid var(--c-border); border-radius: 2px;
    border-top: 3px solid var(--c-primary);
  }
  .kpi-label { font-family: var(--font-display), sans-serif; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--c-body); margin-bottom: 0.25rem; }
  .kpi-val   { font-size: 1.8rem; font-weight: 700; color: var(--c-title); letter-spacing: -0.03em; line-height: 1; }
  .kpi-val--md { font-size: 1.15rem; }
  .kpi-val--sm { font-size: 1rem; }
  .kpi-denom { font-size: 1rem; font-weight: 400; color: var(--c-body); }
  .kpi-unit  { font-size: 0.75rem; color: var(--c-body); margin-top: 0.1rem; }

  /* ── STATUS BADGE ── */
  .status-badge {
    display: inline-block; font-family: var(--font-display), sans-serif;
    font-size: 0.58rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
    padding: 0.18rem 0.6rem; border-radius: 30px; width: fit-content; margin-top: 0.2rem;
  }
  .status-badge.is-ok   { background: var(--c-ok-bg);   color: var(--c-ok-text); }
  .status-badge.is-fail { background: var(--c-fail-bg);  color: var(--c-fail-text); }

  /* ── VERIFICACIONES ── */
  .verif-list { display: flex; flex-direction: column; border: 1px solid var(--c-border); background: var(--c-bg); }
  .verif-item {
    display: grid; grid-template-columns: 12px 1fr auto;
    align-items: center; gap: 1rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--c-border);
    transition: background 0.15s;
  }
  .verif-item:last-child { border-bottom: none; }
  .verif-item:hover { background: var(--c-bg-alt); }
  .verif-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .verif-dot.is-ok   { background: var(--c-ok-text); }
  .verif-dot.is-fail { background: var(--c-fail-text); }
  .verif-content { display: flex; flex-direction: column; gap: 0.15rem; }
  .verif-name   { font-family: var(--font-display), sans-serif; font-size: 0.78rem; font-weight: 700; color: var(--c-title); line-height: 1.3; }
  .verif-detail { font-size: 0.72rem; color: var(--c-body); line-height: 1.5; }
  .verif-detail strong { color: var(--c-title); font-weight: 600; }
  .verif-detail em { font-style: normal; opacity: 0.65; }

  /* ── DIMENSIONAMIENTO ── */
  .dim-grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--c-border); }
  .dim-panel { }
  .dim-panel + .dim-panel { border-left: 1px solid var(--c-border); }
  .dim-panel-head {
    padding: 0.85rem 1.25rem; border-bottom: 1px solid var(--c-border);
    display: flex; align-items: center; gap: 0.75rem;
    background: var(--c-bg-alt);
  }
  .dim-panel-badge {
    font-family: var(--font-display), sans-serif; font-size: 0.7rem; font-weight: 800;
    background: var(--c-primary); color: #ffffff;
    width: 22px; height: 22px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .dim-panel-title { font-family: var(--font-display), sans-serif; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--c-title); }
  .dim-panel-body { padding: 0.5rem 1.25rem 1.25rem; }
  .dim-row { display: flex; justify-content: space-between; align-items: baseline; padding: 0.6rem 0; border-bottom: 1px solid var(--c-border); gap: 1rem; }
  .dim-row:last-child { border-bottom: none; }
  .dim-label { font-size: 0.78rem; color: var(--c-body); font-weight: 400; }
  .dim-value { font-size: 0.85rem; color: var(--c-title); font-weight: 600; text-align: right; }
  .dim-plano { padding: 1.5rem; background: var(--c-bg-alt); display: flex; align-items: center; justify-content: center; min-height: 200px; }

  /* ── AI Plano ── */
  .ai-plano-svg { width: 100%; overflow: auto; }
  .ai-plano-svg svg { width: 100%; height: auto; display: block; }
  .ai-plano-loading {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 1rem; padding: 3rem; color: var(--c-body); font-size: 0.82rem;
  }
  .ai-plano-dots { display: flex; gap: 6px; }
  .ai-plano-dots span {
    width: 7px; height: 7px; border-radius: 50%; background: var(--c-primary);
    animation: dot-bounce 1.2s infinite ease-in-out both;
  }
  .ai-plano-dots span:nth-child(1) { animation-delay: 0s; }
  .ai-plano-dots span:nth-child(2) { animation-delay: 0.2s; }
  .ai-plano-dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes dot-bounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40%           { transform: scale(1);   opacity: 1; }
  }

  /* ── EQUIPAMIENTO ── */
  .eq-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
  .eq-card {
    background: var(--c-bg); padding: 1.25rem;
    border: 1px solid var(--c-border); border-radius: 2px;
    display: flex; flex-direction: column;
    border-top: 3px solid var(--c-primary);
    transition: box-shadow 0.15s;
  }
  .eq-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.07); }
  .eq-name    { font-family: var(--font-display), sans-serif; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--c-body); margin-bottom: 0.75rem; line-height: 1.4; }
  .eq-val     { font-size: 1.7rem; font-weight: 700; color: var(--c-primary); letter-spacing: -0.03em; line-height: 1; margin-bottom: 0.3rem; }
  .eq-unit    { font-size: 0.72rem; color: var(--c-body); font-weight: 400; margin-left: 0.2rem; }
  .eq-formula { font-size: 0.72rem; color: var(--c-body); font-style: italic; line-height: 1.45; margin-bottom: 0.75rem; flex: 1; }
  .eq-ref     { font-family: var(--font-display), sans-serif; font-size: 0.58rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--c-primary); border-top: 1px solid var(--c-border); padding-top: 0.5rem; display: block; }

  /* ── ARGUMENTARIO ── */
  .section-dark { background: var(--c-title); padding: 4rem 0; border-top: 2px solid var(--c-primary); }
  .arg-layout { display: grid; grid-template-columns: 260px 1fr; gap: 4rem; align-items: start; }
  .arg-aside-label {
    display: inline-block; font-family: var(--font-display), sans-serif;
    font-size: 0.58rem; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase;
    color: var(--c-primary); border: 1px solid rgba(79,118,77,0.35);
    padding: 0.2rem 0.7rem; border-radius: 30px; margin-bottom: 1.25rem;
  }
  .arg-aside-title {
    font-family: var(--font-display), sans-serif; font-weight: 800;
    font-size: 2.2rem; color: #ffffff; line-height: 1.05; letter-spacing: -0.02em;
    margin-bottom: 1rem;
  }
  .arg-aside-desc { font-size: 0.85rem; color: rgba(255,255,255,0.62); line-height: 1.7; }
  .arg-body { font-size: 1rem; line-height: 1.85; color: rgba(255,255,255,0.68); font-weight: 400; }
  .arg-body p { margin-bottom: 1rem; }
  .arg-body p:last-child { margin-bottom: 0; }
  .arg-body strong { color: #ffffff; font-weight: 700; }
  .arg-body em { color: #8fd68f; font-style: normal; font-weight: 600; }

  /* ── CTA ── */
  /* ── Plano CTA ── */
  .section-plano-cta { background: var(--c-title); padding: 3rem 0; border-top: 2px solid var(--c-primary); }
  .plano-cta-inner { display: flex; align-items: center; justify-content: space-between; gap: 2rem; flex-wrap: wrap; }
  .plano-cta-eyebrow { display: block; font-family: var(--font-display), sans-serif; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--c-primary); margin-bottom: 0.4rem; }
  .plano-cta-title { font-family: var(--font-display), sans-serif; font-size: 1.52rem; font-weight: 800; color: #ffffff; letter-spacing: -0.01em; margin-bottom: 0.3rem; }
  .plano-cta-desc { font-size: 0.95rem; color: rgba(255,255,255,0.6); }
  .plano-cta-btn {
    display: inline-flex; align-items: center; gap: 0.6rem; flex-shrink: 0;
    background: var(--c-primary); color: #fff; text-decoration: none;
    border-radius: 30px; padding: 0.75rem 1.75rem;
    font-family: var(--font-display), sans-serif; font-size: 0.8rem; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase; transition: background 0.15s;
  }
  .plano-cta-btn:hover { background: var(--c-primary-dk); }

  .section-cta { background: var(--c-primary); padding: 2.5rem 0; }
  .cta-layout { display: flex; align-items: center; justify-content: space-between; gap: 2rem; flex-wrap: wrap; }
  .cta-title { font-family: var(--font-display), sans-serif; font-size: 1.52rem; font-weight: 800; color: #ffffff; letter-spacing: -0.01em; margin-bottom: 0.3rem; }
  .cta-desc  { font-size: 0.95rem; color: rgba(255,255,255,0.75); }
  .cta-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; flex-shrink: 0; }

  /* ── BUTTONS ── */
  .btn-pill {
    display: inline-flex; align-items: center; gap: 0.5rem;
    background: var(--c-primary); color: #ffffff;
    border: none; border-radius: 30px;
    padding: 0.7rem 1.6rem; font-family: var(--font-body), sans-serif;
    font-size: 0.88rem; font-weight: 700; cursor: pointer;
    letter-spacing: 0.06em; text-transform: uppercase; text-decoration: none;
    transition: background 0.15s;
  }
  .btn-pill:hover { background: var(--c-primary-dk); }
  .btn-pill--light {
    background: #ffffff; color: var(--c-primary);
  }
  .btn-pill--light:hover { background: rgba(255,255,255,0.9); }
  .btn-outline {
    display: inline-flex; align-items: center; gap: 0.5rem;
    background: transparent; color: var(--c-primary);
    border: 2px solid var(--c-primary); border-radius: 30px;
    padding: 0.7rem 1.4rem; font-family: var(--font-body), sans-serif;
    font-size: 0.88rem; font-weight: 600; cursor: pointer;
    letter-spacing: 0.04em; text-decoration: none;
    transition: background 0.15s, color 0.15s;
  }
  .btn-outline:hover { background: var(--c-primary); color: #ffffff; }
  .btn-outline--light {
    color: #ffffff; border-color: rgba(255,255,255,0.6);
  }
  .btn-outline--light:hover { background: rgba(255,255,255,0.15); color: #ffffff; }

  /* ── FOOTER ── */
  .ftr { background: var(--c-title); padding: 1.25rem 0; border-top: 1px solid rgba(255,255,255,0.06); }
  .ftr-inner { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; }
  .ftr-brand { font-size: 0.65rem; color: rgba(255,255,255,0.5); letter-spacing: 0.12em; text-transform: uppercase; font-family: var(--font-display), sans-serif; font-weight: 600; }
  .ftr-norm  { font-size: 0.62rem; color: rgba(255,255,255,0.42); letter-spacing: 0.04em; }
  .ftr-back  { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.68rem; color: rgba(255,255,255,0.62); text-decoration: none; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; font-family: var(--font-display), sans-serif; transition: color 0.15s; }
  .ftr-back:hover { color: rgba(255,255,255,0.9); }

  /* ── EMPTY STATE ── */
  .empty-state { min-height: 100vh; background: var(--c-bg-alt); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; font-family: var(--font-body), sans-serif; }
  .empty-title { font-family: var(--font-display), sans-serif; font-size: 1.52rem; font-weight: 800; color: var(--c-title); }
  .empty-sub   { font-size: 1rem; color: var(--c-body); }

  /* ── RESPONSIVE ── */
  @media (max-width: 900px) {
    .features-grid { grid-template-columns: repeat(2, 1fr); }
    .kpi-row { grid-template-columns: repeat(2, 1fr); }
    .arg-layout { grid-template-columns: 1fr; gap: 2rem; }
    .dim-grid { grid-template-columns: 1fr; }
    .dim-panel + .dim-panel { border-left: none; border-top: 1px solid var(--c-border); }
  }
  @media (max-width: 640px) {
    .wrap { padding: 0 1.25rem; }
    .hero { padding: 3rem 0 2.5rem; }
    .hero-stats { grid-template-columns: repeat(2, 1fr); gap: 1.5rem 0; }
    .hero-stat { padding: 0; border-right: none !important; margin-right: 0 !important; }
    .features-grid { grid-template-columns: 1fr; }

    .cta-layout { flex-direction: column; align-items: flex-start; }
    .plano-cta-inner { flex-direction: column; align-items: flex-start; }
  }

  @media print {
    @page {
      size: A4 portrait;
      margin: 12mm 14mm 14mm 14mm;
    }

    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

    /* Ocultar elementos interactivos */
    .jrn-hdr, .section-plano-cta, .section-cta, .ftr, .hdr-action, .ai-plano-loading { display: none !important; }

    body { background: #fff !important; font-size: 0.88rem; }

    .wrap { max-width: 100%; padding: 0; }

    /* Hero compacto */
    .hero {
      padding: 1.8rem 1.2rem 1.5rem;
      background-color: var(--c-title) !important;
      background-image: none !important;
      page-break-after: avoid;
    }
    .hero::before, .hero::after { display: none !important; }
    .hero-inner { position: relative; z-index: 1; }
    .hero-stats { gap: 1.5rem; margin-top: 1.2rem; }
    .hero-stat-val { font-size: 1.6rem; }
    .hero-title { font-size: 1.8rem; }

    /* Secciones */
    .section-features, .section-alt { padding: 1.2rem 1rem; }
    .features-grid { grid-template-columns: repeat(2, 1fr); gap: 0.8rem; }
    .feat-card { padding: 0.7rem; }

    /* Verificación normativa */
    .check-list { gap: 0.4rem; }
    .check-item { padding: 0.5rem 0.7rem; page-break-inside: avoid; }

    /* Dimensionamiento — paneles A y B uno debajo del otro */
    .dim-grid { grid-template-columns: 1fr !important; border: none; }
    .dim-panel { page-break-inside: avoid; border: 1px solid var(--c-border) !important; margin-bottom: 0.6rem; }
    .dim-panel + .dim-panel { border-left: 1px solid var(--c-border) !important; border-top: 1px solid var(--c-border) !important; }
    .dim-plano { padding: 0.8rem; }
    .ai-plano-svg svg { width: 100% !important; height: auto !important; }

    /* Equipamiento */
    .eq-grid { grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
    .eq-card { padding: 0.6rem; page-break-inside: avoid; }

    /* Argumentario */
    .section-dark {
      background: var(--c-title) !important;
      padding: 1.4rem 1.2rem;
      page-break-before: always;
    }
    .arg-layout { gap: 2rem; }
    .arg-aside { min-width: 140px; }
    .arg-aside-title { font-size: 1.4rem; }

    /* Evitar cortes en medio de bloques */
    h2, h3 { page-break-after: avoid; }
    section { page-break-inside: avoid; }
  }

  /* ── TEXT WRAP ── */
  .hero-title  { text-wrap: balance; }
  .cta-title   { text-wrap: balance; }
  .empty-title { text-wrap: balance; }

  /* ── FOCUS VISIBLE ── */
  .hdr-action:focus-visible {
    outline: 2px solid rgba(255,255,255,0.8);
    outline-offset: 3px;
  }
  .btn-pill:focus-visible {
    outline: 2px solid #ffffff;
    outline-offset: 3px;
  }
  .btn-pill--light:focus-visible {
    outline: 2px solid var(--c-primary);
    outline-offset: 3px;
  }
  .btn-outline:focus-visible {
    outline: 2px solid var(--c-primary);
    outline-offset: 3px;
  }
  .btn-outline--light:focus-visible {
    outline: 2px solid rgba(255,255,255,0.8);
    outline-offset: 3px;
  }
  .ftr-back:focus-visible {
    outline: 2px solid rgba(255,255,255,0.7);
    outline-offset: 3px;
    border-radius: 2px;
  }

  /* ── TOUCH TARGETS ── */
  @media (pointer: coarse) {
    .hdr-action { min-height: 44px; padding: 0.6rem 1.25rem; }
  }

  /* ── REDUCED MOTION ── */
  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }

    /* Dot loading animation: show at full opacity, no bounce */
    .ai-plano-dots span {
      animation: none;
      opacity: 1;
      transform: none;
    }

    /* State transitions: instant */
    .feat-card,
    .verif-item,
    .eq-card,
    .hdr-action,
    .btn-pill,
    .btn-outline,
    .ftr-back {
      transition: none;
    }
  }
`;
