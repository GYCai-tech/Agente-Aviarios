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

// ── Plano de distribución (determinista) ──────────────────────────────────────

function PlanoEmbed({
  ancho_nave_m, largo_nave_m, gallinas, sistema, tipo_zona, niveles,
}: {
  ancho_nave_m: number; largo_nave_m: number; gallinas: number;
  sistema: string; tipo_zona: "nidal_colectivo" | "aviario"; niveles?: number;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true); setSvg(null); setError(null);
      try {
        const res = await fetch("/api/plano-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ancho_nave_m, largo_nave_m,
            tipo_zona, sistema, gallinas,
            niveles: niveles ?? 2,
            num_filas: 0, mods_por_fila: 0,
            clearance_pared_m: 0.85, pasillo_m: 1.20,
            clearance_lateral_m: 4.00, ancho_alero_m: 0,
          }),
        });
        const data = await res.json();
        if (data.svg) setSvg(data.svg);
        else setError(data.error ?? "Sin plano");
      } catch {
        setError("Error al generar el plano");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [ancho_nave_m, largo_nave_m, gallinas, sistema, tipo_zona, niveles]);

  if (loading) return (
    <div className="ai-plano-loading">
      <div className="ai-plano-dots"><span /><span /><span /></div>
      <p>Calculando distribución de módulos…</p>
    </div>
  );

  if (error || !svg) return (
    <div className="plano-fallback">
      <p>No se pudo generar el plano. <a href="/plano">Abrir editor →</a></p>
    </div>
  );

  return <div className="plano-svg" dangerouslySetInnerHTML={{ __html: svg }} />;
}

// ── Plano esquemático ─────────────────────────────────────────────────────────

function NaveSchematic({
  superficie, gallinas, tipoZona,
}: {
  superficie: number; gallinas: number;
  tipoZona: "nidal_colectivo" | "aviario";
}) {
  const isAv = tipoZona === "aviario";
  const numMods = isAv
    ? Math.ceil(gallinas / Math.floor(9 * 13.18))
    : Math.ceil(gallinas / 144);
  const W = 460, H = 210;
  const modW = Math.min(47, Math.floor((W - 20) / numMods) - 2);
  const modH = 74;
  const yYac = 10, hYac = 36;
  const yPas1 = yYac + hYac, hPas = 22;
  const yMod = yPas1 + hPas;
  const yPas2 = yMod + modH;
  const yYac2 = yPas2 + hPas;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: `${W}px`, display: "block" }}>
      <rect x="10" y="10" width={W - 20} height={H - 20} rx="3" fill="none" stroke="#d0d3dc" strokeWidth="1" strokeDasharray="4 2.5" />
      <rect x="10" y={yYac} width={W - 20} height={hYac} fill="#eef6ed" />
      <text x="22" y={yYac + hYac / 2 + 3} fill="#3d6b3a" fontSize="8" fontFamily="Montserrat,sans-serif" fontWeight="700" letterSpacing=".08em">YACIJA NORTE</text>
      <rect x="10" y={yPas1} width={W - 20} height={hPas} fill="#f3f4f7" />
      <text x="22" y={yPas1 + hPas / 2 + 3} fill="#a0a5b8" fontSize="7" fontFamily="Montserrat,sans-serif" fontWeight="700" letterSpacing=".1em">PASILLO</text>
      {Array.from({ length: numMods }, (_, i) => {
        const x = 10 + i * (modW + 3);
        return (
          <g key={i}>
            <rect x={x} y={yMod} width={modW} height={modH} rx="2" fill="#000823" />
            <text x={x + modW / 2} y={yMod + modH / 2 + 3} textAnchor="middle" fill="rgba(255,255,255,.6)" fontSize="7" fontFamily="JetBrains Mono,monospace">M{i + 1}</text>
          </g>
        );
      })}
      <rect x="10" y={yPas2} width={W - 20} height={hPas} fill="#f3f4f7" />
      <text x="22" y={yPas2 + hPas / 2 + 3} fill="#a0a5b8" fontSize="7" fontFamily="Montserrat,sans-serif" fontWeight="700" letterSpacing=".1em">PASILLO</text>
      <rect x="10" y={yYac2} width={W - 20} height={hYac} fill="#eef6ed" />
      <text x="22" y={yYac2 + hYac / 2 + 3} fill="#3d6b3a" fontSize="8" fontFamily="Montserrat,sans-serif" fontWeight="700" letterSpacing=".08em">YACIJA SUR</text>
      <g transform={`translate(${W - 180}, ${H - 17})`}>
        <rect x="0" y="2" width="9" height="9" rx="1" fill="#000823" />
        <text x="13" y="10" fill="#8b91a3" fontSize="7.5" fontFamily="Source Sans 3,sans-serif">Módulos ({numMods})</text>
        <rect x="85" y="2" width="9" height="9" fill="#eef6ed" stroke="#9fc89d" strokeWidth=".8" />
        <text x="98" y="10" fill="#8b91a3" fontSize="7.5" fontFamily="Source Sans 3,sans-serif">Yacija</text>
        <rect x="135" y="3" width="9" height="7" fill="#f3f4f7" stroke="#d0d3dc" strokeWidth=".8" />
        <text x="148" y="10" fill="#8b91a3" fontSize="7.5" fontFamily="Source Sans 3,sans-serif">Pasillo</text>
      </g>
    </svg>
  );
}

// ── Feature data ──────────────────────────────────────────────────────────────

const FEATS_AVIARIO = [
  { icon: "/icons/gallinas.svg", name: "Modular y escalable", desc: "Configuración adaptable a cada proyecto. Número de módulos ajustable a la superficie y censo disponibles." },
  { icon: "/icons/Recurso 20.svg", name: "Huevo de calidad", desc: "Su diseño garantiza la obtención de huevo limpio y sin roturas. Tasa de huevo sucio inferior al 1%." },
  { icon: "/icons/gallinas felices.svg", name: "Gallinas con bienestar", desc: "Diseño que respeta los estándares de bienestar animal, mejorando la calidad de vida de las ponedoras y la producción." },
  { icon: "/icons/Recurso 17.svg", name: "Suministros adaptados", desc: "Alimentación y bebida regulada en función de la raza ponedora. Drinkers nipple y comedero en cadena configurables." },
  { icon: "/icons/Sin plagas.svg", name: "Sin plagas", desc: "Diseñado para dificultar la proliferación de insectos y parásitos, reduciendo costes de tratamientos sanitarios." },
  { icon: "/icons/manejo_sencillop.svg", name: "Manejo sencillo", desc: "Pensado para el trabajo diario del operario: revisión del nidal y control de suministros simplificados y accesibles." },
  { icon: "/icons/Recurso 14.svg", name: "Nidos confort AstroTurf", desc: "Alta suavidad para las patas, privacidad y temperatura óptima. Estructura de acero galvanizado con PosMAC®." },
  { icon: "/icons/Recurso 23.svg", name: "Llave en mano", desc: "Gómez y Crespo coordina fabricación, transporte e instalación. Un único interlocutor para toda la obra." },
];

const FEATS_NIDAL = [
  { icon: "/icons/recurso-9.svg", name: "Slats a medida", desc: "Estructura modular que permite 1, 2 o 3 metros por lado de nidal, adaptable a cualquier proyecto." },
  { icon: "/icons/Antipiojos.svg", name: "Antipiojos", desc: "Diseñado en chapa minimizando zonas ocultas para evitar la proliferación de ácaro rojo." },
  { icon: "/icons/LimpiezaSimple.svg", name: "Limpieza simple", desc: "Diseñado para poder desinfectar y limpiar sin desmontar todo el nidal." },
  { icon: "/icons/recurso 21.svg", name: "Gallinas felices", desc: "Diseñado y certificado para sistemas en suelo, campero y ecológico. Directiva 1999/74/CE garantizada." },
  { icon: "/icons/Recurso 20.svg", name: "Huevo de calidad", desc: "El slot guía a las gallinas al nidal en el momento de la puesta. Drástica reducción de huevos sucios y rotos." },
  { icon: "/icons/Recurso 15.svg", name: "Alfombras higiénicas", desc: "Nido AstroTurf perforado, evita acumulación de residuos y facilita la recogida de huevos." },
  { icon: "/icons/Recurso 17.svg", name: "Adaptable", desc: "Sistema modular que permite buscar solución a cada proyecto individual, sin obras ni grúas." },
  { icon: "/icons/Recurso 22.svg", name: "Materiales premium", desc: "Chapa DX51D+Z275. Galvanizado de alta calidad con 20 micras de Zinc según ISO 9223 y EN 10346:2015." },
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
        <p className="empty-title">Sin datos de propuesta</p>
        <p className="empty-sub">Genera un informe desde la calculadora primero.</p>
        <a href="/" className="btn btn-primary">← Volver a la calculadora</a>
      </div>
    );
  }

  const {
    informe, argumentario_ventas, gallinas, sistema, superficie,
    tipo_zona, niveles, ancho_nave, largo_nave,
  } = data;

  const anchoM = ancho_nave ? parseFloat(ancho_nave) : 0;
  const largoM = largo_nave ? parseFloat(largo_nave) : 0;
  const tieneNaveDims = anchoM > 0 && largoM > 0;
  const sistemaLabel = SISTEMA_LABEL[sistema] ?? sistema;
  const nivelesEfectivos = tipo_zona === "aviario" ? (niveles ?? 2) : 1;
  const isAviario = tipo_zona === "aviario";
  const cumple = informe.cumple_nave;
  const fechaHoy = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  const densMax = sistema === "ecologico" ? 6 : 9;
  const supDispPorMod = nivelesEfectivos === 3 ? 16.194 : 13.18;
  const numModulos = isAviario
    ? Math.ceil(parseInt(gallinas) / Math.floor(densMax * supDispPorMod))
    : Math.ceil(parseInt(gallinas) / 144);
  const densidadVerif = informe.verificaciones_nave.find(v => v.parametro.toLowerCase().includes("densidad"));
  const densidadReal = densidadVerif ? densidadVerif.valor_real : 0;
  const densidadLimite = densidadVerif ? densidadVerif.valor_limite : densMax;
  const productoNombre = isAviario ? "Aviario Industrial" : "A-Nida";
  const productoCodigo = isAviario ? "COD. 10007 · MULTINIVEL" : "NIDAL COLECTIVO";
  const productoSubtitulo = isAviario
    ? `Sistema aviario de ${nivelesEfectivos} plantas para producción intensiva en altura`
    : "Sistema de nidales colectivos para producción en suelo, campero y ecológico";
  const feats = isAviario ? FEATS_AVIARIO : FEATS_NIDAL;

  // Beneficios dinámicos
  const gallinasInt = parseInt(gallinas);
  const supFloat = parseFloat(superficie);
  const supeloConvencional = Math.round(supFloat * 4);
  const incrementoPct = Math.round(((gallinasInt - supeloConvencional) / supeloConvencional) * 100);
  const benes = isAviario
    ? [
        { num: `+${incrementoPct}%`, title: "Más aves, misma nave", desc: `Frente a una instalación en suelo convencional (≈${supeloConvencional.toLocaleString("es-ES")} aves a 4 gal/m²), el aviario aloja ${gallinasInt.toLocaleString("es-ES")} aves en los mismos ${Math.round(supFloat).toLocaleString("es-ES")} m² sin obras ni ampliación de parcela.` },
        { num: "<1%", title: "Huevo sucio", desc: "Los nidos AstroTurf con recolección automática reducen el porcentaje de huevo sucio y roto por debajo del 1%, mejorando la categoría del producto desde el primer ciclo." },
        { num: "20+", title: "Años de vida útil", desc: "Estructura de acero galvanizado con recubrimiento PosMAC® diseñada para ambientes de corral intensivo. Mantenimiento mínimo y retorno de inversión acelerado." },
      ]
    : [
        { num: "144", title: "Gallinas por módulo", desc: `Con ${numModulos} módulos A-Nida cubres perfectamente las ${gallinasInt.toLocaleString("es-ES")} aves. Instalación modular sin obra civil, sin grúa, sin días de parada productiva.` },
        { num: "<2%", title: "Huevo sucio", desc: "El slot de acceso guía a las gallinas al nidal en el momento de la puesta, reduciendo drásticamente los huevos sucios y rotos en suelo." },
        { num: "CE", title: "Bienestar certificado", desc: "Diseñado y certificado para sistemas en suelo, campero y ecológico. Cumplimiento garantizado de la Directiva 1999/74/CE y RD 3/2002." },
      ];

  // Argumentario en párrafos para gyc-points
  const argParrafos = argumentario_ventas
    ? argumentario_ventas.split(/\n\n+/).filter(p => p.trim())
    : [];

  // Barra densidad hero (%)
  const densBarPct = Math.min(100, (densidadReal / densidadLimite) * 100);
  // Barra módulos (relativo a un máximo razonable)
  const modMaxRef = isAviario ? 20 : 30;
  const modBarPct = Math.min(100, (numModulos / modMaxRef) * 100);
  // Barra gallinas (relativo a 10.000 referencia)
  const galBarPct = Math.min(100, (gallinasInt / 10000) * 100);

  return (
    <>
      <style>{BASE_CSS}</style>

      <JourneyHeader
        activeStep={4}
        actions={
          <button className="topbar-btn" onClick={() => window.print()}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 4V1h8v3M2 8H1V5h10v3h-1M3.5 8v3h5V8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Exportar PDF
          </button>
        }
      />

      <div className="doc">

        {/* ── HERO ── */}
        <section className="hero">
          <div className="hero-dot-grid" />
          <div className="hero-accent" />
          <div className="hero-inner">
            <div className="hero-left">
              <div className="hero-eyebrow">
                <span className="hero-cod">{productoCodigo}</span>
                <span className="hero-date">{fechaHoy}</span>
                <span className={`hero-badge ${cumple ? "is-ok" : "is-fail"}`}>
                  {cumple ? (
                    <><svg width="8" height="7" viewBox="0 0 8 7" fill="none"><path d="M1 3.5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg> Instalación viable</>
                  ) : (
                    <><svg width="8" height="7" viewBox="0 0 8 7" fill="none"><path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg> Revisar parámetros</>
                  )}
                </span>
              </div>
              <h1 className="hero-title">
                {isAviario ? <>Aviario<br /><span className="accent">Industrial</span></> : <>A-Nida<br /><span className="accent">Colectivo</span></>}
              </h1>
              <p className="hero-sub">{productoSubtitulo} — nave de {Math.round(supFloat).toLocaleString("es-ES")} m²</p>
            </div>
            <div className="hero-right">
              <div className="hero-stats-box">
                <div className="hero-stat">
                  <span className="hs-val">{gallinasInt.toLocaleString("es-ES")}</span>
                  <span className="hs-lbl">Gallinas ponedoras</span>
                  <div className="hs-bar"><div className="hs-fill" style={{ width: `${galBarPct}%` }} /></div>
                </div>
                <div className="hero-stat">
                  <span className="hs-val">{numModulos}</span>
                  <span className="hs-lbl">{isAviario ? `Módulos · ${nivelesEfectivos} niveles` : "Módulos A-Nida"}</span>
                  <div className="hs-bar"><div className="hs-fill" style={{ width: `${modBarPct}%` }} /></div>
                </div>
                <div className="hero-stat">
                  <span className="hs-val">{densidadReal.toFixed(1)}<span className="hs-den">/{densidadLimite}</span></span>
                  <span className="hs-lbl">gal/m² · normativa</span>
                  <div className="hs-bar"><div className={`hs-fill${densBarPct >= 95 ? " is-warn" : ""}`} style={{ width: `${densBarPct}%` }} /></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── BENEFICIOS ── */}
        <section className="section section-tint">
          <div className="s-hdr">
            <span className="s-tag">Por qué este sistema</span>
            <span className="s-rule" />
          </div>
          <div className="bene-grid">
            {benes.map((b) => (
              <div key={b.title} className="bene-card">
                <div className="bene-num"><span>{b.num}</span></div>
                <div className="bene-title">{b.title}</div>
                <div className="bene-desc">{b.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CARACTERÍSTICAS ── */}
        <section className="section">
          <div className="s-hdr">
            <span className="s-tag">Características</span>
            <span className="s-title">El sistema · {productoNombre}{isAviario ? ` ${nivelesEfectivos} niveles` : ""}</span>
            <span className="s-rule" />
          </div>
          <div className="feat-grid">
            {feats.map((f) => (
              <div key={f.name} className="feat-item">
                <div className="feat-icon">
                  <img src={f.icon} alt={f.name} width={18} height={18} className="feat-icon-img" />
                </div>
                <div>
                  <div className="feat-name">{f.name}</div>
                  <div className="feat-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── VERIFICACIÓN NORMATIVA ── */}
        <section className="section section-tint">
          <div className="s-hdr">
            <span className="s-tag">Normativa</span>
            <span className="s-title">Verificación · RD 3/2002</span>
            <span className="s-rule" />
          </div>
          <div className="norm-layout">
            <div className="norm-kpis">
              <div className="nkpi">
                <div className="nkpi-lbl">Densidad real</div>
                <div className="nkpi-val">{densidadReal.toFixed(1)}<span className="nkpi-den">/{densidadLimite}</span></div>
                <div className="nkpi-sub">gal/m² · {densidadReal <= densidadLimite ? "cumple" : "excede"}</div>
              </div>
              <div className="nkpi">
                <div className="nkpi-lbl">Verificaciones</div>
                <div className="nkpi-val">
                  {informe.verificaciones_nave.filter(v => v.cumple).length}
                  <span className="nkpi-den">/{informe.verificaciones_nave.length}</span>
                </div>
                <div className="nkpi-sub">parámetros OK</div>
              </div>
              <div className={`nkpi nkpi-estado ${cumple ? "is-ok" : "is-fail"}`}>
                <div className="nkpi-lbl">{cumple ? "Estado" : "Atención"}</div>
                <div className="nkpi-val-sm">{cumple ? <>Instalación<br />viable</> : <>Revisar<br />parámetros</>}</div>
              </div>
            </div>
            <div className="norm-list">
              {informe.verificaciones_nave.map((v) => (
                <div key={v.parametro} className="norm-row">
                  <div className={`norm-dot ${v.cumple ? "is-ok" : "is-fail"}`} />
                  <div>
                    <div className="norm-name">{v.parametro}</div>
                    <div className="norm-detail">
                      Real <b>{v.valor_real.toLocaleString("es-ES", { maximumFractionDigits: 2 })} {v.unidad}</b>
                      {" · "}Límite {v.tipo_limite === "maximo" ? "máx." : "mín."} <b>{v.valor_limite.toLocaleString("es-ES")} {v.unidad}</b>
                      {" · "}<i>{v.articulo}</i>
                    </div>
                  </div>
                  <span className={`ok-pill ${v.cumple ? "is-ok" : "is-fail"}`}>{v.cumple ? "Cumple" : "Revisar"}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── INSTALACIÓN / DIMENSIONAMIENTO ── */}
        <section className="section">
          <div className="s-hdr">
            <span className="s-tag">Instalación</span>
            <span className="s-title">Dimensionamiento · vista de planta</span>
            <span className="s-rule" />
          </div>
          <div className="inst-grid">
            <div className="inst-panel">
              <div className="inst-head">
                <span className="inst-badge">A</span>
                <span className="inst-panel-title">Datos de la instalación</span>
              </div>
              <div className="inst-body">
                {[
                  { l: "Gallinas", v: gallinasInt.toLocaleString("es-ES") + " aves" },
                  { l: "Sistema", v: sistemaLabel },
                  { l: "Superficie nave", v: Math.round(supFloat).toLocaleString("es-ES") + " m²" },
                  { l: "Alojamiento", v: isAviario ? `Aviario · ${nivelesEfectivos} niveles` : "A-Nida" },
                  ...(data.altura ? [{ l: "Altura libre", v: data.altura + " cm" }] : []),
                  { l: "Módulos", v: numModulos + " uds." },
                  { l: "Densidad", v: densidadReal.toFixed(1) + " gal/m²" },
                ].map(d => (
                  <div key={d.l} className="inst-row">
                    <span className="inst-lbl">{d.l}</span>
                    <span className="inst-val">{d.v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="inst-panel">
              <div className="inst-head">
                <span className="inst-badge">B</span>
                <span className="inst-panel-title">Vista de planta</span>
              </div>
              <div className="inst-plano">
                <NaveSchematic
                  superficie={supFloat}
                  gallinas={gallinasInt}
                  tipoZona={tipo_zona}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── EQUIPAMIENTO ── */}
        <section className="section section-tint">
          <div className="s-hdr">
            <span className="s-tag">Equipamiento</span>
            <span className="s-title">Mínimos normativos requeridos</span>
            <span className="s-rule" />
          </div>
          <div className="eq-grid">
            {informe.requisitos.map((r) => (
              <div key={r.nombre} className="eq-card">
                <div className="eq-name">{r.nombre}</div>
                <div className="eq-val">
                  {r.valor_minimo.toLocaleString("es-ES", { maximumFractionDigits: 2 })}
                  <span className="eq-unit"> {r.unidad}</span>
                </div>
                <div className="eq-formula">{r.formula}</div>
                <span className="eq-norm">{r.articulo}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── POR QUÉ GYC ── */}
        {argumentario_ventas && (
          <section className="section section-dark">
            <div className="gyc-layout">
              <div>
                <div className="gyc-overline">Sobre Gómez y Crespo</div>
                <h2 className="gyc-title">50 años<br />fabricando<br />resultados</h2>
                <p className="gyc-sub">Fabricantes de equipamiento avícola con presencia internacional. ISO 9001 · ISO 14001.</p>
              </div>
              <div className="gyc-points">
                {argParrafos.length > 0
                  ? argParrafos.map((p, i) => (
                    <div key={i} className="gyc-point">
                      <p dangerouslySetInnerHTML={{ __html: renderMd(p) }} />
                    </div>
                  ))
                  : (
                    <div className="gyc-point">
                      <p dangerouslySetInnerHTML={{ __html: `<p>${renderMd(argumentario_ventas)}</p>` }} />
                    </div>
                  )
                }
              </div>
            </div>
          </section>
        )}

        {/* ── PLANO EMBEBIDO ── */}
        <section className="section section-plano">
          <div className="s-hdr">
            <span className="s-tag">Plano</span>
            <span className="s-title">Distribución de módulos en planta</span>
            <span className="s-rule" />
          </div>
          {tieneNaveDims ? (
            <>
              <PlanoEmbed
                ancho_nave_m={anchoM}
                largo_nave_m={largoM}
                gallinas={gallinasInt}
                sistema={sistema}
                tipo_zona={tipo_zona}
                niveles={nivelesEfectivos}
              />
              <div className="plano-edit-row">
                <a href="/plano" className="plano-edit-link">
                  Abrir editor interactivo
                  <svg width="12" height="9" viewBox="0 0 12 9" fill="none"><path d="M1 4.5h10M7 1l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </a>
              </div>
            </>
          ) : (
            <div className="plano-no-dims">
              <p>Introduce el ancho y largo de la nave en la calculadora para ver el plano de distribución.</p>
              <a href="/plano" className="plano-edit-link">
                Abrir editor de plano
                <svg width="12" height="9" viewBox="0 0 12 9" fill="none"><path d="M1 4.5h10M7 1l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </a>
            </div>
          )}
        </section>

        {/* ── CTA ── */}
        <section className="section section-green">
          <div className="cta-inner">
            <div>
              <h2 className="cta-h">¿Solicitar presupuesto?</h2>
              <p className="cta-p">Nuestro equipo comercial responde en menos de 48 horas.</p>
            </div>
            <div className="cta-btns">
              <a href="mailto:info@gomezycrespo.com" className="btn btn-white">
                Solicitar presupuesto
                <svg width="12" height="9" viewBox="0 0 14 10" fill="none"><path d="M1 5h12M8 1l5 4-5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </a>
              <a href="tel:+34988217754" className="btn btn-ghost">+34 988 217 754</a>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="ftr">
          <span className="ftr-brand">Gómez y Crespo · Agente Aviario v0.5</span>
          <span className="ftr-norms">RD 3/2002 · Directiva 1999/74/CE · RD 637/2021</span>
          <a href="/" className="ftr-link">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M3.5 1L1 4m0 0l2.5 3M1 4h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Calculadora
          </a>
        </footer>

      </div>{/* .doc */}
    </>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const BASE_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --navy:     #000823;
    --green:    #3d6b3a;
    --green-dk: #1e3d1b;
    --green-lt: #eef6ed;
    --green-mid:#4f764d;
    --body:     #3d4354;
    --muted:    #7b8197;
    --faint:    #b0b5c5;
    --border:   #e2e4ec;
    --bg:       #ffffff;
    --bg-alt:   #f7f8fb;
    --ok:       #1d6b22;
    --ok-bg:    #e8f5e8;
    --fail:     #b5261e;
    --fail-bg:  #fdecea;
    --fd: 'Montserrat', sans-serif;
    --fb: 'Source Sans 3', 'Source Sans Pro', sans-serif;
    --fm: 'JetBrains Mono', monospace;
  }

  html { scroll-behavior: smooth; }
  body {
    font-family: var(--fb);
    background: var(--bg);
    color: var(--body);
    -webkit-font-smoothing: antialiased;
  }

  /* ── DOC WRAPPER ── */
  .doc {
    width: 100%;
    background: var(--bg);
  }

  /* ── TOPBAR BTN (passed to JourneyHeader) ── */
  .topbar-btn {
    display: inline-flex; align-items: center; gap: .4rem;
    background: rgba(255,255,255,.1); color: rgba(255,255,255,.85);
    border: 1px solid rgba(255,255,255,.15); border-radius: 4px;
    padding: .32rem .8rem;
    font-family: var(--fb); font-size: .68rem; font-weight: 600; cursor: pointer;
  }
  .topbar-btn:hover { background: rgba(255,255,255,.18); }

  /* ── HERO ── */
  .hero {
    background: var(--navy);
    padding: 3.5rem max(2.5rem, calc((100% - 860px) / 2)) 3rem;
    position: relative; overflow: hidden;
  }
  .hero-dot-grid {
    position: absolute; inset: 0; pointer-events: none;
    background-image: radial-gradient(circle, rgba(255,255,255,.06) 1px, transparent 1px);
    background-size: 28px 28px;
  }
  .hero-accent {
    position: absolute; bottom: -60px; right: -80px;
    width: 380px; height: 380px; border-radius: 50%;
    background: radial-gradient(circle, rgba(61,107,58,.35) 0%, transparent 65%);
    pointer-events: none;
  }
  .hero-inner {
    position: relative; z-index: 1;
    display: grid; grid-template-columns: 1fr auto; gap: 2rem; align-items: start;
  }
  .hero-eyebrow {
    display: flex; align-items: center; gap: .6rem;
    margin-bottom: 1.4rem; flex-wrap: wrap;
  }
  .hero-cod {
    font-family: var(--fd); font-size: .55rem; font-weight: 700;
    letter-spacing: .2em; text-transform: uppercase;
    color: var(--green-mid); border: 1px solid rgba(79,118,77,.35);
    padding: .2rem .65rem; border-radius: 3px;
  }
  .hero-date { font-size: .6rem; color: rgba(255,255,255,.38); letter-spacing: .06em; }
  .hero-badge {
    display: inline-flex; align-items: center; gap: .35rem;
    font-family: var(--fd); font-size: .55rem; font-weight: 700;
    letter-spacing: .1em; text-transform: uppercase;
    padding: .18rem .65rem; border-radius: 3px;
  }
  .hero-badge.is-ok  { background: rgba(61,107,58,.25); color: #8fd68f; border: 1px solid rgba(61,107,58,.35); }
  .hero-badge.is-fail { background: rgba(181,38,30,.2); color: #f09090; border: 1px solid rgba(181,38,30,.3); }
  .hero-title {
    font-family: var(--fd); font-weight: 800;
    font-size: clamp(2.4rem, 6vw, 4rem);
    color: #fff; line-height: .92; letter-spacing: -.03em; margin-bottom: .6rem;
    text-wrap: balance;
  }
  .hero-title .accent { color: var(--green-mid); }
  .hero-sub { font-size: .9rem; color: rgba(255,255,255,.58); line-height: 1.6; max-width: 400px; }

  /* Hero stats box (right) */
  .hero-stats-box {
    background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1);
    border-radius: 6px; padding: 1.25rem 1.5rem;
    display: flex; flex-direction: column; gap: .9rem; min-width: 190px;
  }
  .hero-stat {
    display: flex; flex-direction: column; gap: .2rem;
    padding-bottom: .9rem; border-bottom: 1px solid rgba(255,255,255,.08);
  }
  .hero-stat:last-child { border-bottom: none; padding-bottom: 0; }
  .hs-val {
    font-family: var(--fm); font-size: 1.6rem; font-weight: 700;
    color: #fff; letter-spacing: -.04em; line-height: 1;
  }
  .hs-den { font-size: .9rem; color: rgba(255,255,255,.35); font-weight: 400; }
  .hs-lbl {
    font-family: var(--fd); font-size: .52rem; font-weight: 600;
    text-transform: uppercase; letter-spacing: .1em; color: rgba(255,255,255,.42);
  }
  .hs-bar { margin-top: .35rem; height: 3px; background: rgba(255,255,255,.08); border-radius: 2px; overflow: hidden; }
  .hs-fill { height: 100%; border-radius: 2px; background: var(--green-mid); transition: width .4s ease; }
  .hs-fill.is-warn { background: #e07b2a; }

  /* ── SECTION COMMON ── */
  .section { padding: 2.75rem max(2.5rem, calc((100% - 860px) / 2)); border-top: 1px solid var(--border); }
  .section-dark  { background: var(--navy); border-top: none; }
  .section-tint  { background: var(--bg-alt); }
  .section-green { background: var(--green); border-top: none; }
  .section-plano { background: var(--bg-alt); }
  .s-hdr { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.75rem; }
  .s-tag {
    font-family: var(--fd); font-size: .52rem; font-weight: 700;
    letter-spacing: .18em; text-transform: uppercase;
    color: var(--green); background: var(--green-lt);
    padding: .18rem .6rem; border-radius: 2px; white-space: nowrap;
  }
  .s-title {
    font-family: var(--fd); font-size: 1.05rem; font-weight: 700;
    color: var(--navy); letter-spacing: -.01em;
  }
  .s-rule { flex: 1; height: 1px; background: var(--border); }

  /* ── BENEFICIOS ── */
  .bene-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
  .bene-card {
    background: var(--bg); border: 1.5px solid var(--border);
    border-radius: 6px; padding: 1.4rem 1.25rem;
    display: flex; flex-direction: column; gap: .75rem;
    position: relative; overflow: hidden;
  }
  .bene-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0;
    height: 3px; background: var(--green);
  }
  .bene-num {
    font-family: var(--fm); font-size: 2.2rem; font-weight: 700;
    color: var(--green-lt); letter-spacing: -.04em; line-height: 1;
  }
  .bene-num span { color: var(--green); }
  .bene-title { font-family: var(--fd); font-size: .82rem; font-weight: 700; color: var(--navy); line-height: 1.3; }
  .bene-desc { font-size: .8rem; color: var(--muted); line-height: 1.65; }

  /* ── CARACTERÍSTICAS ── */
  .feat-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 1px; background: var(--border);
    border: 1.5px solid var(--border); border-radius: 6px; overflow: hidden;
  }
  .feat-item {
    background: var(--bg); padding: 1.1rem 1.25rem;
    display: flex; gap: .85rem; align-items: flex-start;
  }
  .feat-icon {
    width: 32px; height: 32px; border-radius: 7px;
    background: var(--green-lt); display: flex; align-items: center;
    justify-content: center; flex-shrink: 0;
  }
  .feat-icon-img {
    display: block; object-fit: contain; width: 18px; height: 18px;
    filter: brightness(0) saturate(100%) invert(30%) sepia(30%) saturate(600%) hue-rotate(85deg) brightness(85%);
  }
  .feat-name { font-family: var(--fd); font-size: .78rem; font-weight: 700; color: var(--navy); margin-bottom: .2rem; }
  .feat-desc { font-size: .75rem; color: var(--muted); line-height: 1.6; }

  /* ── NORMATIVA ── */
  .norm-layout { display: grid; grid-template-columns: 200px 1fr; gap: 1.5rem; align-items: start; }
  .norm-kpis { display: flex; flex-direction: column; gap: .75rem; }
  .nkpi {
    background: var(--bg-alt); border: 1.5px solid var(--border);
    border-radius: 5px; padding: .85rem 1rem;
  }
  .nkpi.nkpi-estado.is-ok  { background: var(--ok-bg); border-color: #b8ddb8; }
  .nkpi.nkpi-estado.is-fail { background: var(--fail-bg); border-color: #f0b0ac; }
  .nkpi-lbl { font-family: var(--fd); font-size: .52rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin-bottom: .2rem; }
  .nkpi.nkpi-estado.is-ok  .nkpi-lbl  { color: var(--ok); }
  .nkpi.nkpi-estado.is-fail .nkpi-lbl { color: var(--fail); }
  .nkpi-val { font-family: var(--fm); font-size: 1.3rem; font-weight: 700; color: var(--navy); letter-spacing: -.03em; line-height: 1; }
  .nkpi-den { font-size: .8rem; color: var(--muted); font-weight: 400; }
  .nkpi-sub { font-size: .68rem; color: var(--muted); margin-top: .15rem; }
  .nkpi-val-sm { font-family: var(--fd); font-size: 1rem; font-weight: 800; color: var(--ok); line-height: 1.2; padding-top: .2rem; }
  .nkpi.nkpi-estado.is-fail .nkpi-val-sm { color: var(--fail); }
  .norm-list {
    display: flex; flex-direction: column;
    border: 1.5px solid var(--border); border-radius: 6px; overflow: hidden;
  }
  .norm-row {
    display: grid; grid-template-columns: 20px 1fr auto;
    align-items: center; gap: .75rem;
    padding: .75rem 1rem; border-bottom: 1px solid var(--border); background: var(--bg);
  }
  .norm-row:last-child { border-bottom: none; }
  .norm-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .norm-dot.is-ok   { background: var(--ok); }
  .norm-dot.is-fail { background: var(--fail); }
  .norm-name { font-family: var(--fd); font-size: .73rem; font-weight: 700; color: var(--navy); }
  .norm-detail { font-size: .68rem; color: var(--muted); margin-top: .1rem; }
  .norm-detail b { color: var(--navy); font-family: var(--fm); font-weight: 400; }
  .norm-detail i { font-style: normal; color: var(--faint); }
  .ok-pill {
    font-family: var(--fd); font-size: .5rem; font-weight: 700;
    letter-spacing: .08em; text-transform: uppercase;
    padding: .18rem .55rem; border-radius: 30px; white-space: nowrap;
  }
  .ok-pill.is-ok   { background: var(--ok-bg); color: var(--ok); }
  .ok-pill.is-fail { background: var(--fail-bg); color: var(--fail); }

  /* ── INSTALACIÓN ── */
  .inst-grid {
    display: grid; grid-template-columns: 260px 1fr;
    gap: 1px; background: var(--border);
    border: 1.5px solid var(--border); border-radius: 6px; overflow: hidden;
  }
  .inst-panel { background: var(--bg); }
  .inst-head {
    background: var(--bg-alt); padding: .7rem 1.1rem;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: .6rem;
  }
  .inst-badge {
    font-family: var(--fd); font-size: .6rem; font-weight: 800;
    background: var(--navy); color: #fff;
    width: 20px; height: 20px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .inst-panel-title {
    font-family: var(--fd); font-size: .65rem; font-weight: 700;
    letter-spacing: .08em; text-transform: uppercase; color: var(--navy);
  }
  .inst-body { padding: .25rem 1.1rem 1.1rem; }
  .inst-row {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: .55rem 0; border-bottom: 1px solid var(--border);
  }
  .inst-row:last-child { border-bottom: none; }
  .inst-lbl { font-size: .75rem; color: var(--muted); }
  .inst-val { font-family: var(--fm); font-size: .78rem; color: var(--navy); font-weight: 600; }
  .inst-plano {
    padding: 1.25rem; background: #f9fafb;
    display: flex; align-items: center; justify-content: center;
  }

  /* ── EQUIPAMIENTO ── */
  .eq-grid {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 1px; background: var(--border);
    border: 1.5px solid var(--border); border-radius: 6px; overflow: hidden;
  }
  .eq-card { background: var(--bg); padding: 1.1rem; }
  .eq-val { font-family: var(--fm); font-size: 1.85rem; font-weight: 700; color: var(--green); letter-spacing: -.04em; line-height: 1; margin-bottom: .25rem; }
  .eq-unit { font-size: .72rem; color: var(--muted); font-family: var(--fb); }
  .eq-name { font-family: var(--fd); font-size: .58rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-bottom: .25rem; }
  .eq-formula { font-size: .72rem; color: var(--muted); line-height: 1.5; flex: 1; }
  .eq-norm { font-family: var(--fd); font-size: .5rem; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: var(--green); margin-top: .5rem; display: block; border-top: 1px solid var(--border); padding-top: .5rem; }

  /* ── POR QUÉ GYC ── */
  .gyc-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; align-items: start; }
  .gyc-overline { font-family: var(--fd); font-size: .52rem; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; color: var(--green-mid); margin-bottom: 1rem; }
  .gyc-title { font-family: var(--fd); font-weight: 800; font-size: 2rem; color: #fff; line-height: 1; letter-spacing: -.03em; margin-bottom: .85rem; }
  .gyc-sub { font-size: .8rem; color: rgba(255,255,255,.42); line-height: 1.75; }
  .gyc-points { display: flex; flex-direction: column; gap: .85rem; }
  .gyc-point { padding-left: 1rem; border-left: 2px solid rgba(61,107,58,.5); }
  .gyc-point p { font-size: .82rem; color: rgba(255,255,255,.62); line-height: 1.75; }
  .gyc-point strong { color: #fff; font-weight: 700; }
  .gyc-point em { color: #8fd68f; font-style: normal; font-weight: 600; }

  /* ── PLANO EMBED ── */
  .plano-svg { width: 100%; overflow: auto; }
  .plano-svg svg { width: 100%; height: auto; display: block; }
  .plano-fallback { padding: 2rem; text-align: center; color: var(--muted); font-size: .9rem; background: var(--bg); border-radius: 4px; border: 1px solid var(--border); }
  .plano-edit-row { display: flex; justify-content: flex-end; margin-top: 1rem; }
  .plano-edit-link {
    display: inline-flex; align-items: center; gap: .4rem;
    color: var(--green); font-size: .82rem; font-weight: 700;
    text-decoration: none; letter-spacing: .04em;
  }
  .plano-no-dims { padding: 2.5rem; text-align: center; background: var(--bg); border-radius: 4px; border: 1px solid var(--border); }
  .plano-no-dims p { color: var(--muted); font-size: .9rem; margin-bottom: 1rem; }
  .ai-plano-loading {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 1rem; padding: 3rem; color: var(--muted); font-size: .82rem;
  }
  .ai-plano-dots { display: flex; gap: 6px; }
  .ai-plano-dots span { width: 7px; height: 7px; border-radius: 50%; background: var(--green-mid); animation: dot-bounce 1.2s infinite ease-in-out both; }
  .ai-plano-dots span:nth-child(1) { animation-delay: 0s; }
  .ai-plano-dots span:nth-child(2) { animation-delay: .2s; }
  .ai-plano-dots span:nth-child(3) { animation-delay: .4s; }
  @keyframes dot-bounce { 0%,80%,100% { transform: scale(.6); opacity: .4; } 40% { transform: scale(1); opacity: 1; } }

  /* ── CTA ── */
  .cta-inner { display: flex; align-items: center; justify-content: space-between; gap: 2rem; flex-wrap: wrap; }
  .cta-h { font-family: var(--fd); font-size: 1.2rem; font-weight: 800; color: #fff; letter-spacing: -.01em; margin-bottom: .2rem; text-wrap: balance; }
  .cta-p { font-size: .82rem; color: rgba(255,255,255,.72); }
  .cta-btns { display: flex; gap: .65rem; flex-wrap: wrap; flex-shrink: 0; }
  .btn { display: inline-flex; align-items: center; gap: .4rem; border-radius: 4px; padding: .65rem 1.4rem; font-family: var(--fb); font-size: .82rem; font-weight: 700; cursor: pointer; letter-spacing: .04em; text-decoration: none; border: none; }
  .btn-white { background: #fff; color: var(--green); }
  .btn-ghost { background: transparent; color: #fff; border: 1.5px solid rgba(255,255,255,.45); }
  .btn-primary { background: var(--green); color: #fff; }

  /* ── FOOTER ── */
  .ftr {
    background: var(--navy); padding: 1rem max(2.5rem, calc((100% - 860px) / 2));
    display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: .75rem;
    border-top: 1px solid rgba(255,255,255,.06);
  }
  .ftr-brand { font-family: var(--fd); font-size: .58rem; font-weight: 600; color: rgba(255,255,255,.38); letter-spacing: .1em; text-transform: uppercase; }
  .ftr-norms { font-size: .6rem; color: rgba(255,255,255,.28); }
  .ftr-link { display: inline-flex; align-items: center; gap: .3rem; font-family: var(--fd); font-size: .58rem; font-weight: 700; color: rgba(255,255,255,.5); text-decoration: none; letter-spacing: .07em; text-transform: uppercase; }

  /* ── EMPTY STATE ── */
  .empty-state { min-height: 100vh; background: var(--bg-alt); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; }
  .empty-title { font-family: var(--fd); font-size: 1.52rem; font-weight: 800; color: var(--navy); }
  .empty-sub { font-size: 1rem; color: var(--muted); }

  /* ── PRINT ── */
  @media print {
    body { background: white; }
    .doc { box-shadow: none; max-width: 100%; }
    .topbar-btn { display: none; }
    .hero-accent, .hero-dot-grid { display: none; }
    .section-green, .section-dark, .hero, .ftr { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .bene-card, .feat-item, .norm-row, .inst-panel, .eq-card { break-inside: avoid; }
    .section { padding: 1.4rem 1.5rem; }
    .gyc-layout { grid-template-columns: 1fr 1.5fr; }
    .bene-grid { grid-template-columns: repeat(3, 1fr); }
    section { page-break-inside: avoid; }
    h2 { page-break-after: avoid; }
  }

  /* ── RESPONSIVE ── */
  @media (max-width: 720px) {
    .hero-inner { grid-template-columns: 1fr; }
    .hero-right { display: none; }
    .norm-layout { grid-template-columns: 1fr; }
    .inst-grid { grid-template-columns: 1fr; }
    .gyc-layout { grid-template-columns: 1fr; gap: 2rem; }
    .bene-grid { grid-template-columns: 1fr; }
    .eq-grid { grid-template-columns: 1fr 1fr; }
    .feat-grid { grid-template-columns: 1fr; }
    .section { padding: 2rem 1.5rem; }
    .hero { padding: 2.5rem 1.5rem 2rem; }
    .ftr { padding: 1rem 1.5rem; }
  }

  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
    .ai-plano-dots span { animation: none; opacity: 1; }
    .hs-fill { transition: none; }
  }
`;
