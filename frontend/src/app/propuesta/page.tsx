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

interface MetricasPlano {
  total_modulos: number;
  gallinas_max: number;
  yacija_m2: number;
  densidad: number;
  densidad_max: number;
}

function PlanoEmbed({
  ancho_nave_m, largo_nave_m, gallinas, sistema, tipo_zona, niveles, onMetricas,
}: {
  ancho_nave_m: number; largo_nave_m: number; gallinas: number;
  sistema: string; tipo_zona: "nidal_colectivo" | "aviario"; niveles?: number;
  onMetricas?: (m: MetricasPlano) => void;
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
        if (data.svg) {
          setSvg(data.svg);
          if (data.metricas) onMetricas?.(data.metricas);
        } else setError(data.error ?? "Sin plano");
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

// ── Contenido editorial por producto ──────────────────────────────────────────

const FOTOS = {
  aviario: { cover: "/IMG_9878.JPG", sistema: "/WhatsApp Image 2026-06-12 at 09.21.11 (9).jpeg", materiales: "/WhatsApp Image 2026-06-12 at 09.21.11 (5).jpeg" },
  nidal_colectivo: { cover: "/hero-nidal.jpg", sistema: "/WhatsApp Image 2026-06-12 at 09.21.11 (9).jpeg", materiales: "/WhatsApp Image 2026-06-12 at 09.21.11 (5).jpeg" },
} as const;

const CHIPS = {
  aviario: ["Modular y escalable", "Recolección automática", "Bienestar animal", "Diseño antiplagas"],
  nidal_colectivo: ["Slats a medida", "Limpieza simple", "Huevo de calidad", "Sin obras ni grúas"],
} as const;

const DETALLES = {
  aviario: [
    { icon: "/icons/Recurso 22.svg", cap: "Acero PosMAC®", sub: "Anticorrosión galvanizado" },
    { icon: "/icons/Recurso 14.svg", cap: "Nido AstroTurf", sub: "Confort y huevo limpio" },
    { icon: "/icons/Recurso 20.svg", cap: "Recolección en cinta", sub: "Menos manipulación" },
  ],
  nidal_colectivo: [
    { icon: "/icons/Recurso 22.svg", cap: "Chapa DX51D+Z275", sub: "20 micras de Zinc · EN 10346" },
    { icon: "/icons/Recurso 15.svg", cap: "Alfombras AstroTurf", sub: "Higiénicas y perforadas" },
    { icon: "/icons/Antipiojos.svg", cap: "Diseño antipiojos", sub: "Sin zonas ocultas de ácaro" },
  ],
} as const;

// ── Página ────────────────────────────────────────────────────────────────────

export default function PropuestaPage() {
  const [data, setData] = useState<ProposalData | null>(null);
  const [mounted, setMounted] = useState(false);
  const [metricas, setMetricas] = useState<MetricasPlano | null>(null);
  const [esCompartida, setEsCompartida] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareState, setShareState] = useState<"idle" | "saving" | "copied" | "error">("idle");

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) {
      // Vista del cliente: la propuesta viene del backend, no del localStorage
      setEsCompartida(true);
      fetch(`/api/propuestas?id=${encodeURIComponent(id)}`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (d && d.informe) setData(d); })
        .catch(() => { })
        .finally(() => setMounted(true));
      return;
    }
    try {
      const raw = localStorage.getItem("gc_propuesta");
      if (raw) setData(JSON.parse(raw));
    } catch { }
    setMounted(true);
  }, []);

  async function compartir() {
    if (!data || shareState === "saving") return;
    setShareState("saving");
    try {
      const res = await fetch("/api/propuestas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const j = await res.json();
      if (!j.id) throw new Error("sin id");
      const url = `${window.location.origin}/p/${j.id}`;
      setShareUrl(url);
      try { await navigator.clipboard.writeText(url); } catch { }
      setShareState("copied");
      setTimeout(() => setShareState("idle"), 4000);
    } catch {
      setShareState("error");
      setTimeout(() => setShareState("idle"), 4000);
    }
  }

  if (!mounted) return null;

  if (!data) {
    return (
      <div className="empty-state">
        <style>{BASE_CSS}</style>
        {esCompartida ? (
          <>
            <p className="empty-title">Propuesta no disponible</p>
            <p className="empty-sub">El enlace no es válido o la propuesta ya no existe. Contacta con tu comercial de Gómez y Crespo.</p>
          </>
        ) : (
          <>
            <p className="empty-title">Sin datos de propuesta</p>
            <p className="empty-sub">Genera un informe desde la calculadora primero.</p>
            <a href="/" className="btn">← Volver a la calculadora</a>
          </>
        )}
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
  const fechaHoy = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }).toUpperCase();
  const densMax = sistema === "ecologico" ? 6 : 9;
  // Respaldo local (CLAUDE.md): solo si el plano aún no ha devuelto métricas del backend
  const supDispPorMod = nivelesEfectivos === 3 ? 9.1232 : 5.5452;
  const numModulosFallback = isAviario
    ? Math.ceil(parseInt(gallinas) / Math.floor(densMax * supDispPorMod))
    : Math.ceil(parseInt(gallinas) / 144);
  const numModulos = metricas?.total_modulos || numModulosFallback;
  const densidadVerif = informe.verificaciones_nave.find(v => v.parametro.toLowerCase().includes("densidad"));
  const densidadReal = metricas ? metricas.densidad : (densidadVerif ? densidadVerif.valor_real : 0);
  const densidadLimite = metricas ? metricas.densidad_max : (densidadVerif ? densidadVerif.valor_limite : densMax);
  const densidadOk = densidadLimite > 0 ? densidadReal <= densidadLimite : informe.cumple_nave;
  const productoNombre = isAviario ? "Aviario" : "A-Nida";
  const verifOk = informe.verificaciones_nave.filter(v => v.cumple).length;
  const verifTotal = informe.verificaciones_nave.length;

  const gallinasInt = parseInt(gallinas);
  const supFloat = parseFloat(superficie);
  const supRound = Math.round(supFloat);
  const supeloConvencional = Math.round(supFloat * 4);
  const fotos = FOTOS[tipo_zona];
  const chips = CHIPS[tipo_zona];
  const detalles = DETALLES[tipo_zona];

  // Producción estimada: 1 huevo cada 1,5 días por gallina
  const huevosAnio = Math.round(gallinasInt * (365 / 1.5));
  const huevosAnioFmt = huevosAnio >= 1_000_000
    ? `${(huevosAnio / 1_000_000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} M`
    : huevosAnio.toLocaleString("es-ES");

  // Yacija: la del plano (backend) si está disponible; si no, aproximación local
  // (aviario 4.482 m²/mód · nidal cuerpo+slot 5.28 m²/mód)
  const supYacija = metricas
    ? Math.round(metricas.yacija_m2)
    : Math.max(0, Math.round(supFloat - numModulos * (isAviario ? 4.482 : 5.28)));

  const coverSub = isAviario
    ? `Sistema ${sistemaLabel.toLowerCase()} de ${nivelesEfectivos} niveles para ${gallinasInt.toLocaleString("es-ES")} ponedoras en una nave de ${supRound.toLocaleString("es-ES")} m².`
    : `Nidales colectivos para ${gallinasInt.toLocaleString("es-ES")} ponedoras (${sistemaLabel.toLowerCase()}) en una nave de ${supRound.toLocaleString("es-ES")} m².`;

  const argParrafos = argumentario_ventas
    ? argumentario_ventas.split(/\n\n+/).filter(p => p.trim())
    : [];

  return (
    <>
      <style>{BASE_CSS}</style>

      {esCompartida ? (
        <header className="share-topbar">
          <img src="/gyc-logo.png" alt="Gómez y Crespo" style={{ height: 34, width: "auto" }} />
          <button className="topbar-btn" onClick={() => window.print()}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 4V1h8v3M2 8H1V5h10v3h-1M3.5 8v3h5V8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Exportar PDF
          </button>
        </header>
      ) : (
        <JourneyHeader
          activeStep={4}
          actions={
            <>
              <button className="topbar-btn" onClick={compartir} disabled={shareState === "saving"}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M8.5 4 11 6.5 8.5 9M11 6.5H4.5A3.5 3.5 0 0 1 1 3V2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {shareState === "saving" ? "Generando enlace…" : shareState === "copied" ? "Enlace copiado ✓" : shareState === "error" ? "Error, reintenta" : "Compartir enlace"}
              </button>
              <button className="topbar-btn" onClick={() => window.print()}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2 4V1h8v3M2 8H1V5h10v3h-1M3.5 8v3h5V8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Exportar PDF
              </button>
            </>
          }
        />
      )}

      {shareUrl && !esCompartida && (
        <div className="share-toast" role="status">
          <span>Enlace para el cliente</span>
          <input readOnly value={shareUrl} onFocus={e => e.currentTarget.select()} />
          <button onClick={() => setShareUrl("")} aria-label="Cerrar aviso">✕</button>
        </div>
      )}

      <div className="doc">

        {/* ═══════ PORTADA ═══════ */}
        <header className="cover">
          <div className="cover-photo" style={{ backgroundImage: `url('${encodeURI(fotos.cover)}')` }} />
          <div className="cover-veil" />
          <div className="cover-top">
            <div className="logo">
              <img src="/gyc-logo.png" alt="Gómez y Crespo" style={{ height: "80px", width: "auto", display: "block" }} />
            </div>
            <div className="cover-meta">
              <span>{fechaHoy}</span>
            </div>
          </div>
          <div className="cover-foot">
            <div className="cover-eyebrow">Propuesta comercial</div>
            <h1 className="cover-title">
              {isAviario ? <>Aviario<br /><em>Industrial</em></> : <>A-Nida<br /><em>Colectivo</em></>}
            </h1>
            <div className="cover-rule" />
            <p className="cover-sub">{coverSub}</p>
          </div>
        </header>

        {/* ═══════ EN UN VISTAZO ═══════ */}
        <section className="section cream">
          <div className="sec-head"><span className="kicker">En un vistazo</span><span className="rule" /><span className="num-mark">01 / 06</span></div>
          <h2 className="glance-lede">Una explotación de {gallinasInt.toLocaleString("es-ES")} ponedoras, resuelta en una sola nave.</h2>
          <p className="lede">Multiplica la capacidad de tu nave sobre la misma superficie. Automatización estructural con materiales de alta resistencia, diseñados a medida para maximizar tu producción y garantizar una puesta en marcha eficiente.</p>
          <div className="glance-grid">
            <div className="glance-cell"><div className="glance-v">{gallinasInt.toLocaleString("es-ES")}</div><div className="glance-l">Ponedoras · {sistemaLabel.toLowerCase()}</div></div>
            <div className="glance-cell"><div className="glance-v">{supRound.toLocaleString("es-ES")} <small>m²</small></div><div className="glance-l">Superficie de nave</div></div>
            <div className="glance-cell"><div className="glance-v">{numModulos}</div><div className="glance-l">{isAviario ? `Módulos · ${nivelesEfectivos} niveles` : "Módulos A-Nida"}</div></div>
            <div className="glance-cell"><div className="glance-v">{huevosAnioFmt} <small>huevos/año</small></div><div className="glance-l">Producción anual estimada</div></div>
          </div>
        </section>
        {/* ═══════ SPREAD 01 · EL SISTEMA ═══════ */}
        <section className="spread">
          <div className="spread-media" style={{ backgroundImage: `url('${encodeURI(fotos.sistema)}')` }} />
          <div className="spread-text">
            <div className="spread-num">02 — El sistema</div>
            <h2 className="spread-h">{isAviario ? "Maximiza tu producción con un entorno de puesta eficiente" : "El nidal que guía a la gallina a poner donde debe"}</h2>
            {isAviario ? (
              <p className="spread-p">
                El aviario industrial de {nivelesEfectivos} niveles aprovecha la altura de la nave para alojar <strong>{gallinasInt.toLocaleString("es-ES")} aves</strong>, multiplicando la densidad y la producción en la misma superficie. Gracias a su diseño altamente eficiente, optimiza cada metro cúbico disponible garantizando un flujo continuo de huevos limpios mediante recolección automática en cinta, minimizando el trabajo operativo.
              </p>
            ) : (
              <p className="spread-p">
                Cada módulo A-Nida aloja <strong>144 gallinas</strong>: optimiza el espacio de tu nave alojando <strong>{gallinasInt.toLocaleString("es-ES")} aves</strong> con la máxima eficiencia técnica. Su diseño inteligente reduce drásticamente el huevo en suelo, guiando a la gallina hacia un entorno óptimo de puesta que asegura un mayor porcentaje de huevo limpio, intacto y comercializable.
              </p>
            )}
            <div className="chips">
              {chips.map(c => (
                <span key={c} className="chip"><span className="dot" />{c}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════ SPREAD 02 · MATERIALES ═══════ */}
        <section className="spread flip">
          <div className="spread-media" style={{ backgroundImage: `url('${encodeURI(fotos.materiales)}')`, backgroundPosition: "center bottom" }} />
          <div className="spread-text on-green">
            <div className="spread-num">03 — Materiales</div>
            <h2 className="spread-h">Calidad de materiales premium diseñada para durar</h2>
            {isAviario ? (
              <p className="spread-p">Estructura de <strong>acero galvanizado con recubrimiento PosMAC®</strong>, con resistencia superior a la corrosión en ambiente intensivo y mantenimiento mínimo. Los nidos AstroTurf reducen el <strong>huevo sucio</strong>, mejorando la categoría del producto desde el primer ciclo.</p>
            ) : (
              <p className="spread-p">Chapa <strong>DX51D+Z275</strong> con galvanizado de alta calidad: 20 micras de Zinc según ISO 9223 y EN 10346:2015. El diseño en chapa minimiza las zonas ocultas para <strong>evitar la proliferación del ácaro rojo</strong> y permite limpiar y desinfectar sin desmontar el nidal.</p>
            )}
            <div className="detail-band">
              {detalles.map(d => (
                <div key={d.cap} className="detail">
                  <div className="detail-icon"><img src={d.icon} alt="" width={36} height={36} /></div>
                  <div className="detail-cap">{d.cap}</div>
                  <div className="detail-sub">{d.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>



        {/* ═══════ RESPALDO · 50 AÑOS ═══════ */}
        <section className="section dark">
          <div className="respaldo">
            <div className="kicker on-dark">Sobre Gómez y Crespo</div>
            <div className="respaldo-big"><em>50</em> años</div>
            <p className="respaldo-sub">cuidando del bienestar animal.</p>
            <div className="respaldo-row">
              <div className="respaldo-cell"><div className="v">ISO 9001</div><div className="l">Calidad</div></div>
              <div className="respaldo-cell"><div className="v">ISO 14001</div><div className="l">Medio ambiente</div></div>
              <div className="respaldo-cell"><div className="v">+30</div><div className="l">Países</div></div>
              <div className="respaldo-cell"><div className="v">Diseñado para durar</div><div className="l">Fabricación · transporte · montaje</div></div>
            </div>
            {argParrafos.length > 0 && (
              <div className="arg-points">
                <div className="arg-points-kicker">El argumento para tu explotación</div>
                {argParrafos.map((p, i) => (
                  <div key={i} className="arg-point">
                    <p dangerouslySetInnerHTML={{ __html: renderMd(p) }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ═══════ TU NAVE EN UN VISTAZO (plano) ═══════ */}
        <section className="section">
          <div className="sec-head"><span className="kicker">Tu nave en un vistazo</span><span className="rule" /><span className="num-mark">Plano de planta</span></div>
          <p className="nave-intro">Así queda distribuida tu explotación sobre los <strong>{supRound.toLocaleString("es-ES")} m² de nave</strong>: {numModulos} módulos {isAviario ? `de ${nivelesEfectivos} niveles` : "A-Nida"}, pasillos de servicio y yacija libre para el ave.</p>
          <div className="nave-grid">
            <div className="sheet">
              <div className="sheet-head">
                <span className="sh-t"><span className="sh-mark" aria-hidden="true" />Vista de planta</span>
                <span className="sh-c">{isAviario ? "COD. 10007" : "A-NIDA"} · {fechaHoy} · Esc. ref.</span>
              </div>
              <div className="sheet-plano">
                {tieneNaveDims ? (
                  <PlanoEmbed
                    ancho_nave_m={anchoM}
                    largo_nave_m={largoM}
                    gallinas={gallinasInt}
                    sistema={sistema}
                    tipo_zona={tipo_zona}
                    niveles={nivelesEfectivos}
                    onMetricas={setMetricas}
                  />
                ) : (
                  <div className="plano-no-dims">
                    <p>{esCompartida ? "Plano de distribución no disponible para esta propuesta." : "Introduce el ancho y largo de la nave en la calculadora para ver el plano de distribución."}</p>
                    {!esCompartida && (
                      <a href="/plano" className="plano-edit-link">
                        Abrir editor de plano
                        <svg width="12" height="9" viewBox="0 0 12 9" fill="none"><path d="M1 4.5h10M7 1l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </a>
                    )}
                  </div>
                )}
              </div>
              <div className="titleblock">
                <div className="tb-cell tb-brand">
                  <div className="tb-brand-name">Gómez y Crespo</div>
                  <div className="tb-brand-sub">Plano de distribución</div>
                </div>
                <div className="tb-cell"><div className="tb-k">Proyecto</div><div className="tb-v">{productoNombre}</div></div>
                <div className="tb-cell"><div className="tb-k">Módulos</div><div className="tb-v tb-num">{numModulos}{isAviario ? ` × ${nivelesEfectivos} niv.` : ""}</div></div>
                <div className="tb-cell"><div className="tb-k">Superficie</div><div className="tb-v tb-num">{supRound.toLocaleString("es-ES")} m²</div></div>
                <div className="tb-cell"><div className="tb-k">Densidad</div><div className={`tb-v tb-num ${densidadOk ? "tb-ok" : "tb-fail"}`}>{densidadReal.toFixed(1)} / {densidadLimite} gal·m²</div></div>
              </div>
            </div>
            <div className="claves">
              <div className="clave"><div className="clave-n">1</div><div><div className="clave-t">{numModulos} módulos {isAviario ? `de ${nivelesEfectivos} niveles` : "A-Nida"}</div><div className="clave-d">Distribuidos para aprovechar todo el ancho útil de la nave.</div></div></div>
              <div className="clave"><div className="clave-n">2</div><div><div className="clave-t">Pasillos de servicio</div><div className="clave-d">Acceso para el manejo y la revisión diaria del operario.</div></div></div>
              <div className="clave"><div className="clave-n">3</div><div><div className="clave-t">Yacija libre ≈ {supYacija.toLocaleString("es-ES")} m²</div><div className="clave-d">Superficie de yacija para el comportamiento natural del ave.</div></div></div>
              {data.altura ? (
                <div className="clave"><div className="clave-n">4</div><div><div className="clave-t">Altura libre {data.altura} cm</div><div className="clave-d">{isAviario ? `Espacio suficiente para los ${nivelesEfectivos} niveles del aviario.` : "Altura de nave compatible con el nidal colectivo."}</div></div></div>
              ) : (
                <div className="clave"><div className="clave-n">4</div><div><div className="clave-t">Densidad {densidadReal.toFixed(1)} gal·m²</div><div className="clave-d">Dentro del límite normativo de {densidadLimite} gal·m².</div></div></div>
              )}
              {tieneNaveDims && !esCompartida && (
                <a href="/plano" className="plano-edit-link">
                  Abrir editor interactivo
                  <svg width="12" height="9" viewBox="0 0 12 9" fill="none"><path d="M1 4.5h10M7 1l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </a>
              )}
            </div>
          </div>
        </section>

        {/* ═══════ FICHA TÉCNICA ═══════ */}
        <section className="section cream">
          <div className="sec-head"><span className="kicker">Ficha técnica</span><span className="rule" /><span className="num-mark">Dimensionamiento</span></div>
          <div className="ficha-grid">
            <div className="data-list">
              <div className="data-row"><span className="data-l">Gallinas</span><span className="data-v">{gallinasInt.toLocaleString("es-ES")} aves</span></div>
              <div className="data-row"><span className="data-l">Sistema</span><span className="data-v">{sistemaLabel}</span></div>
              <div className="data-row"><span className="data-l">Superficie nave</span><span className="data-v">{supRound.toLocaleString("es-ES")} m²</span></div>
              <div className="data-row"><span className="data-l">Alojamiento</span><span className="data-v">{isAviario ? `Aviario · ${nivelesEfectivos} niveles` : "Nidal A-Nida"}</span></div>
              {data.altura && <div className="data-row"><span className="data-l">Altura libre</span><span className="data-v">{data.altura} cm</span></div>}
              <div className="data-row"><span className="data-l">Módulos</span><span className="data-v">{numModulos} uds.</span></div>
              <div className="data-row"><span className="data-l">Densidad</span><span className="data-v">{densidadReal.toFixed(1)} / {densidadLimite} gal·m²</span></div>
            </div>
            <div>
              <div className="eq-grid">
                {informe.requisitos.map(r => (
                  <div key={r.nombre} className="eq-cell" title={`${r.formula} · ${r.articulo}`}>
                    <div className="eq-v">{r.valor_minimo.toLocaleString("es-ES", { maximumFractionDigits: 2 })} <small>{r.unidad}</small></div>
                    <div className="eq-l">{r.nombre}</div>
                  </div>
                ))}
              </div>
              <div className={`compliance ${cumple ? "" : "is-fail"}`}>
                <div className="seal">
                  {cumple ? (
                    <svg width="18" height="14" viewBox="0 0 18 14" fill="none"><path d="M1 7l5 5 11-11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
                  )}
                </div>
                <div>
                  <div className="ct">{cumple ? "Cumple toda la normativa" : "Revisar parámetros"}</div>
                  <div className="cs">RD 3/2002 · {verifOk}/{verifTotal} parámetros verificados</div>
                </div>
              </div>
            </div>
          </div>
          <div className="veri-block">
            <div className="veri-head">Verificación · RD 3/2002</div>
            <div className="data-list">
              {informe.verificaciones_nave.map(v => (
                <div key={v.parametro} className="data-row veri-row">
                  <div>
                    <div className="veri-name">{v.parametro}</div>
                    <div className="veri-detail">
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

        {/* ═══════ CONTRAPORTADA · CTA ═══════ */}
        <section className="section green">
          <div className="closing">
            <h2 className="closing-h">Hablemos de tu explotación</h2>
            <p className="closing-p">Solicita tu presupuesto o agenda una visita.</p>
            <a href="mailto:info@gomezycrespo.com" className="btn">
              Solicitar presupuesto
              <svg width="15" height="11" viewBox="0 0 15 11" fill="none"><path d="M1 5.5h12M9 1l5 4.5L9 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </a>
            <div className="contact">
              <div>info@gomezycrespo.com</div><span>·</span><div>+34 988 217 754</div>
            </div>
          </div>
        </section>

        {/* ═══════ FOOTER ═══════ */}
        <footer className="footer">
          <span className="fb">Gómez y Crespo</span>
          <span className="fn">RD 3/2002 · Directiva 1999/74/CE · RD 637/2021</span>
          {!esCompartida && (
            <a href="/" className="flink">
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M3.5 1L1 4m0 0l2.5 3M1 4h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Calculadora
            </a>
          )}
        </footer>

      </div>{/* .doc */}
    </>
  );
}

// ── Estilos (diseño dossier) ──────────────────────────────────────────────────

const BASE_CSS = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  :root{
    --navy:#000823; --navy-2:#0a1430;
    --green:#3d6b3a; --green-dk:#1e3d1b; --green-lt:#eef6ed; --green-mid:#4f764d;
    --ink:#23283a; --body:#3d4354; --muted:#7b8197; --faint:#aab0c0;
    --line:#e4e2da; --line-soft:#eceae3;
    --paper:#ffffff; --cream:#f7f6f1; --cream-2:#f1efe8;
    --ok:#1d6b22; --ok-bg:#e8f5e8; --fail:#b5261e; --fail-bg:#fdecea;
    --fd:'Montserrat',sans-serif; --fb:'Source Sans 3','Source Sans Pro',sans-serif; --fm:'JetBrains Mono',monospace;
  }
  html{scroll-behavior:smooth;}
  body{font-family:var(--fb);background:var(--cream-2);color:var(--body);-webkit-font-smoothing:antialiased;line-height:1.6;}
  .doc{max-width:1180px;margin:0 auto;background:var(--paper);box-shadow:0 4px 60px rgba(0,8,35,.14);overflow:hidden;}
  img{display:block;max-width:100%;}

  .kicker{font-family:var(--fd);font-size:.72rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--green);}
  .kicker.on-dark{color:var(--green-mid);}
  .num-mark{font-family:var(--fm);font-size:.78rem;font-weight:700;letter-spacing:.1em;color:var(--faint);}
  .lede{font-size:1.18rem;line-height:1.7;color:var(--muted);max-width:54ch;}

  /* ── COMPARTIR ── */
  .share-topbar{position:sticky;top:0;z-index:50;background:var(--navy);display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.65rem 1.5rem;}
  .share-toast{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:60;display:flex;align-items:center;gap:.7rem;background:var(--navy);color:#fff;padding:.55rem .7rem .55rem 1.1rem;border-radius:8px;box-shadow:0 10px 34px rgba(0,8,35,.4);font-size:.8rem;white-space:nowrap;}
  .share-toast input{width:300px;max-width:46vw;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.22);color:#fff;border-radius:4px;padding:.32rem .55rem;font-family:var(--fm);font-size:.68rem;}
  .share-toast button{background:none;border:none;color:rgba(255,255,255,.6);cursor:pointer;font-size:.85rem;padding:.2rem;}
  .share-toast button:hover{color:#fff;}

  /* ── TOPBAR BTN (JourneyHeader) ── */
  .topbar-btn{display:inline-flex;align-items:center;gap:.4rem;background:rgba(255,255,255,.1);color:rgba(255,255,255,.85);border:1px solid rgba(255,255,255,.15);border-radius:4px;padding:.32rem .8rem;font-family:var(--fb);font-size:.68rem;font-weight:600;cursor:pointer;}
  .topbar-btn:hover{background:rgba(255,255,255,.18);}

  /* ── PORTADA ── */
  .cover{position:relative;height:720px;background:var(--navy);overflow:hidden;}
  .cover-photo{position:absolute;inset:0;background-size:cover;background-position:center;}
  .cover-veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,8,35,.55) 0%,rgba(0,8,35,.15) 38%,rgba(0,8,35,.35) 62%,rgba(0,8,35,.92) 100%);pointer-events:none;z-index:2;}
  .cover-top{position:absolute;top:0;left:0;right:0;z-index:3;display:flex;align-items:center;justify-content:space-between;padding:2rem 2.8rem;}
  .logo{font-family:var(--fd);font-weight:800;font-size:1.05rem;letter-spacing:.18em;color:#fff;}
  .cover-meta{display:flex;align-items:center;gap:1rem;font-family:var(--fm);font-size:.7rem;letter-spacing:.08em;color:rgba(255,255,255,.7);}
  .cover-cod{border:1px solid rgba(255,255,255,.28);border-radius:3px;padding:.28rem .65rem;text-transform:uppercase;}
  .cover-foot{position:absolute;left:0;right:0;bottom:0;z-index:3;padding:2.8rem 2.8rem 3.2rem;}
  .cover-eyebrow{font-family:var(--fm);font-size:.72rem;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:#9bd398;margin-bottom:1.1rem;}
  .cover-title{font-family:var(--fd);font-weight:800;font-size:clamp(3rem,7vw,5.6rem);color:#fff;line-height:.9;letter-spacing:-.035em;}
  .cover-title em{font-style:normal;color:var(--green-mid);}
  .cover-rule{width:64px;height:3px;background:var(--green-mid);margin:1.6rem 0 1.3rem;}
  .cover-sub{font-size:1.15rem;color:rgba(255,255,255,.82);max-width:38ch;}
  .cover-badge{display:inline-flex;align-items:center;gap:.5rem;margin-top:1.5rem;font-family:var(--fd);font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;background:rgba(61,107,58,.3);color:#aee0ab;border:1px solid rgba(120,190,116,.4);padding:.4rem .85rem;border-radius:4px;}
  .cover-badge.is-fail{background:rgba(181,38,30,.3);color:#f0a09a;border-color:rgba(220,110,100,.4);}

  /* ── SECTION SHELL ── */
  .section{padding:5.5rem 2.8rem;}
  .section.cream{background:var(--cream);}
  .section.dark{background:var(--navy);}
  .section.green{background:var(--green);}
  .sec-head{display:flex;align-items:baseline;gap:1.3rem;margin-bottom:2.6rem;}
  .sec-head .kicker{white-space:nowrap;}
  .sec-head .rule{flex:1;height:1px;background:var(--line);}

  /* ── VISTAZO ── */
  .glance-lede{max-width:30ch;font-family:var(--fd);font-weight:700;font-size:clamp(1.8rem,3.4vw,2.7rem);line-height:1.08;letter-spacing:-.02em;color:var(--ink);margin-bottom:.4rem;}
  .glance-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-top:3rem;}
  .glance-cell{background:var(--paper);padding:1.8rem 1.6rem;}
  .glance-v{font-family:var(--fd);font-weight:800;font-size:2.5rem;letter-spacing:-.035em;color:var(--green);line-height:1;}
  .glance-v small{font-size:1rem;color:var(--muted);font-family:var(--fb);letter-spacing:0;}
  .glance-l{font-family:var(--fd);font-size:.66rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-top:.7rem;}

  /* ── SPREAD ── */
  .spread{display:grid;grid-template-columns:1fr 1fr;min-height:600px;}
  .spread.flip .spread-media{order:2;}
  .spread-media{position:relative;background:var(--navy);background-size:cover;background-position:center;}
  .spread-text{padding:5rem 4rem;display:flex;flex-direction:column;justify-content:center;}
  .spread-text.on-green{background:var(--green-lt);}
  .spread-num{font-family:var(--fd);font-size:.85rem;font-weight:700;letter-spacing:.06em;color:var(--green);margin-bottom:1rem;}
  .spread-h{font-family:var(--fd);font-weight:800;font-size:clamp(1.9rem,3vw,2.6rem);line-height:1.04;letter-spacing:-.025em;color:var(--ink);margin-bottom:1.2rem;}
  .spread-p{font-size:1.04rem;line-height:1.8;color:var(--body);margin-bottom:1.6rem;max-width:42ch;}
  .spread-p strong{color:var(--ink);font-weight:600;}
  .chips{display:flex;flex-wrap:wrap;gap:.55rem;}
  .chip{display:inline-flex;align-items:center;gap:.45rem;font-family:var(--fd);font-size:.72rem;font-weight:600;letter-spacing:.02em;color:var(--ink);background:var(--paper);border:1.5px solid var(--line);border-radius:30px;padding:.4rem .85rem;}
  .chip .dot{width:7px;height:7px;border-radius:50%;background:var(--green);}

  /* material detail band */
  .detail-band{display:grid;grid-template-columns:repeat(3,1fr);gap:1.4rem;margin-top:1.8rem;}
  .detail-icon{width:64px;height:64px;border-radius:12px;background:var(--paper);border:1.5px solid var(--line);display:flex;align-items:center;justify-content:center;}
  .detail-icon img{width:36px;height:36px;object-fit:contain;filter:brightness(0) saturate(100%) invert(30%) sepia(30%) saturate(600%) hue-rotate(85deg) brightness(85%);}
  .detail-cap{font-family:var(--fd);font-size:.95rem;font-weight:700;color:var(--ink);margin-top:.65rem;}
  .detail-sub{font-size:.88rem;color:var(--muted);line-height:1.45;}

  /* ── RESPALDO ── */
  .respaldo{text-align:center;max-width:760px;margin:0 auto;}
  .respaldo-big{font-family:var(--fd);font-weight:900;font-size:clamp(4rem,11vw,8rem);color:#fff;line-height:.9;letter-spacing:-.04em;margin:1.4rem 0 .2rem;}
  .respaldo-big em{font-style:normal;color:var(--green-mid);}
  .respaldo-sub{font-size:1.2rem;color:rgba(255,255,255,.62);max-width:30ch;margin:0 auto 2.4rem;line-height:1.6;}
  .respaldo-row{display:flex;justify-content:center;gap:0;flex-wrap:wrap;border-top:1px solid rgba(255,255,255,.12);border-bottom:1px solid rgba(255,255,255,.12);}
  .respaldo-cell{padding:1.6rem 2rem;border-left:1px solid rgba(255,255,255,.12);}
  .respaldo-cell:first-child{border-left:none;}
  .respaldo-cell .v{font-family:var(--fd);font-weight:800;font-size:1.55rem;color:#fff;letter-spacing:-.02em;}
  .respaldo-cell .l{font-family:var(--fd);font-size:.62rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.42);margin-top:.4rem;}
  .arg-points{margin-top:3rem;text-align:left;display:flex;flex-direction:column;gap:1rem;}
  .arg-points-kicker{font-family:var(--fd);font-size:.62rem;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--green-mid);margin-bottom:.3rem;}
  .arg-point{padding-left:1.1rem;border-left:2px solid rgba(79,118,77,.6);}
  .arg-point p{font-size:.95rem;color:rgba(255,255,255,.68);line-height:1.75;}
  .arg-point strong{color:#fff;font-weight:700;}
  .arg-point em{color:#9bd398;font-style:normal;font-weight:600;}

  /* ── TU NAVE (plano protagonista) ── */
  .nave-intro{font-size:1.1rem;line-height:1.7;color:var(--muted);max-width:54ch;margin-bottom:2.4rem;}
  .nave-intro strong{color:var(--ink);font-weight:600;}
  .nave-grid{display:flex;flex-direction:column;gap:2.2rem;}
  .sheet{background:var(--paper);border:1.5px solid #25304e;border-radius:4px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 2px 18px rgba(0,8,35,.08);}
  .sheet-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.85rem 1.3rem;background:var(--navy);}
  .sheet-head .sh-t{display:inline-flex;align-items:center;gap:.55rem;font-family:var(--fm);font-size:.64rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#fff;}
  .sh-mark{width:9px;height:9px;background:var(--green-mid);}
  .sheet-head .sh-c{font-family:var(--fm);font-size:.62rem;letter-spacing:.08em;color:rgba(255,255,255,.55);white-space:nowrap;}
  .sheet-plano{position:relative;flex:1;padding:2.4rem;background:var(--cream);display:flex;align-items:center;justify-content:center;background-image:linear-gradient(var(--line-soft) 1px,transparent 1px),linear-gradient(90deg,var(--line-soft) 1px,transparent 1px);background-size:24px 24px;}
  .sheet-plano::before{content:"";position:absolute;inset:14px;border:1px solid var(--line);pointer-events:none;}
  .sheet-plano::after{content:"";position:absolute;inset:8px;pointer-events:none;background-image:linear-gradient(var(--green) 0 0),linear-gradient(var(--green) 0 0),linear-gradient(var(--green) 0 0),linear-gradient(var(--green) 0 0),linear-gradient(var(--green) 0 0),linear-gradient(var(--green) 0 0),linear-gradient(var(--green) 0 0),linear-gradient(var(--green) 0 0);background-position:top left,top left,top right,top right,bottom left,bottom left,bottom right,bottom right;background-size:16px 2px,2px 16px,16px 2px,2px 16px,16px 2px,2px 16px,16px 2px,2px 16px;background-repeat:no-repeat;}
  .titleblock{display:grid;grid-template-columns:1.25fr 1fr .95fr .9fr 1.05fr;border-top:1.5px solid #25304e;background:var(--paper);}
  .tb-cell{padding:.9rem 1.1rem;border-left:1px solid var(--line);}
  .tb-cell:first-child{border-left:none;}
  .tb-brand-name{font-family:var(--fd);font-weight:800;font-size:.78rem;letter-spacing:.07em;text-transform:uppercase;color:var(--navy);}
  .tb-brand-sub{font-size:.74rem;color:var(--muted);margin-top:.28rem;}
  .tb-k{font-family:var(--fm);font-size:.56rem;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);}
  .tb-v{font-family:var(--fd);font-weight:800;font-size:.95rem;color:var(--ink);margin-top:.32rem;letter-spacing:-.01em;}
  .tb-num{font-variant-numeric:tabular-nums;}
  .tb-ok{color:var(--ok);}
  .tb-fail{color:var(--fail);}
  .claves{display:grid;grid-template-columns:repeat(4,1fr);gap:1.4rem 1.8rem;align-items:start;}
  .claves .plano-edit-link{grid-column:1/-1;justify-self:start;}
  .clave{display:flex;gap:.95rem;align-items:flex-start;}
  .clave-n{flex:0 0 auto;width:32px;height:32px;border-radius:8px;background:var(--green-lt);color:var(--green);font-family:var(--fd);font-weight:800;font-size:.9rem;display:flex;align-items:center;justify-content:center;}
  .clave-t{font-family:var(--fd);font-weight:700;font-size:.95rem;color:var(--ink);margin-bottom:.15rem;}
  .clave-d{font-size:.88rem;color:var(--muted);line-height:1.5;}

  /* plano embed */
  .plano-svg{position:relative;z-index:1;width:100%;overflow:auto;}
  .plano-svg svg{width:100%;height:auto;display:block;}
  .plano-fallback{padding:2rem;text-align:center;color:var(--muted);font-size:.9rem;background:var(--paper);border-radius:8px;border:1px solid var(--line);}
  .plano-fallback a{color:var(--green);font-weight:700;text-decoration:none;}
  .plano-no-dims{padding:2.5rem;text-align:center;}
  .plano-no-dims p{color:var(--muted);font-size:.9rem;margin-bottom:1rem;}
  .plano-edit-link{display:inline-flex;align-items:center;gap:.4rem;color:var(--green);font-size:.82rem;font-weight:700;text-decoration:none;letter-spacing:.04em;margin-top:.4rem;}
  .ai-plano-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;padding:3rem;color:var(--muted);font-size:.82rem;}
  .ai-plano-dots{display:flex;gap:6px;}
  .ai-plano-dots span{width:7px;height:7px;border-radius:50%;background:var(--green-mid);animation:dot-bounce 1.2s infinite ease-in-out both;}
  .ai-plano-dots span:nth-child(1){animation-delay:0s;}
  .ai-plano-dots span:nth-child(2){animation-delay:.2s;}
  .ai-plano-dots span:nth-child(3){animation-delay:.4s;}
  @keyframes dot-bounce{0%,80%,100%{transform:scale(.6);opacity:.4;}40%{transform:scale(1);opacity:1;}}

  /* ── FICHA ── */
  .ficha-grid{display:grid;grid-template-columns:1.15fr 1fr;gap:2.4rem;align-items:start;}
  .data-list{border:1px solid var(--line);border-radius:10px;overflow:hidden;}
  .data-row{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:.85rem 1.2rem;border-bottom:1px solid var(--line-soft);background:var(--paper);}
  .data-row:last-child{border-bottom:none;}
  .data-l{font-size:.92rem;color:var(--muted);white-space:nowrap;}
  .data-v{font-family:var(--fd);font-size:.95rem;font-weight:700;color:var(--ink);letter-spacing:-.01em;}
  .eq-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:10px;overflow:hidden;}
  .eq-cell{background:var(--paper);padding:1rem 1.1rem;}
  .eq-v{font-family:var(--fd);font-weight:800;font-size:1.5rem;color:var(--green);letter-spacing:-.03em;}
  .eq-v small{font-size:.8rem;color:var(--muted);font-family:var(--fb);font-weight:400;}
  .eq-l{font-family:var(--fd);font-size:.6rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-top:.35rem;}
  .compliance{display:flex;align-items:center;gap:.9rem;margin-top:1.4rem;background:var(--green-lt);border:1px solid #c4ddc1;border-radius:10px;padding:1.1rem 1.3rem;}
  .compliance .seal{width:42px;height:42px;border-radius:50%;border:2px solid var(--green);color:var(--green);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .compliance .ct{font-family:var(--fd);font-weight:700;font-size:.92rem;color:var(--green-dk);}
  .compliance .cs{font-size:.82rem;color:var(--green);}
  .compliance.is-fail{background:var(--fail-bg);border-color:#f0b0ac;}
  .compliance.is-fail .seal{border-color:var(--fail);color:var(--fail);}
  .compliance.is-fail .ct{color:var(--fail);}
  .compliance.is-fail .cs{color:#a04540;}

  .veri-block{margin-top:2.4rem;}
  .veri-head{font-family:var(--fm);font-size:.62rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:.8rem;}
  .veri-name{font-family:var(--fd);font-size:.82rem;font-weight:700;color:var(--ink);}
  .veri-detail{font-size:.78rem;color:var(--muted);margin-top:.1rem;}
  .veri-detail b{color:var(--ink);font-family:var(--fm);font-weight:400;}
  .veri-detail i{font-style:normal;color:var(--faint);}
  .ok-pill{font-family:var(--fd);font-size:.55rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:.22rem .65rem;border-radius:30px;white-space:nowrap;}
  .ok-pill.is-ok{background:var(--ok-bg);color:var(--ok);}
  .ok-pill.is-fail{background:var(--fail-bg);color:var(--fail);}

  /* ── CONTRAPORTADA ── */
  .closing{text-align:center;max-width:680px;margin:0 auto;}
  .closing-h{font-family:var(--fd);font-weight:800;font-size:clamp(2.2rem,4.5vw,3.4rem);color:#fff;line-height:1.02;letter-spacing:-.03em;}
  .closing-p{font-size:1.15rem;color:rgba(255,255,255,.82);margin:1.1rem 0 2.2rem;}
  .btn{display:inline-flex;align-items:center;gap:.6rem;font-family:var(--fd);font-weight:700;font-size:1rem;letter-spacing:.01em;background:#fff;color:var(--green);border:none;border-radius:6px;padding:.95rem 2rem;text-decoration:none;cursor:pointer;}
  .btn svg{transition:transform .18s;}
  .btn:hover svg{transform:translateX(4px);}
  .contact{margin-top:2.2rem;font-family:var(--fm);font-size:.86rem;color:rgba(255,255,255,.78);letter-spacing:.04em;display:flex;gap:1.4rem;justify-content:center;flex-wrap:wrap;}
  .contact span{color:rgba(255,255,255,.4);}

  /* ── FOOTER ── */
  .footer{background:var(--navy-2);padding:1.5rem 2.8rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;border-top:1px solid rgba(255,255,255,.06);}
  .footer .fb{font-family:var(--fd);font-size:.64rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.4);}
  .footer .fn{font-family:var(--fm);font-size:.66rem;color:rgba(255,255,255,.28);}
  .footer .flink{display:inline-flex;align-items:center;gap:.3rem;font-family:var(--fd);font-size:.6rem;font-weight:700;color:rgba(255,255,255,.5);text-decoration:none;letter-spacing:.1em;text-transform:uppercase;}

  /* ── EMPTY STATE ── */
  .empty-state{min-height:100vh;background:var(--cream);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;}
  .empty-state .btn{background:var(--green);color:#fff;}
  .empty-title{font-family:var(--fd);font-size:1.52rem;font-weight:800;color:var(--navy);}
  .empty-sub{font-size:1rem;color:var(--muted);}

  /* ── RESPONSIVE (solo pantalla: en impresión se mantiene el layout de escritorio) ── */
  @media screen and (max-width:880px){
    .section{padding:3.5rem 1.5rem;}
    .glance-grid{grid-template-columns:1fr 1fr;}
    .spread{grid-template-columns:1fr;}
    .spread.flip .spread-media{order:0;}
    .spread-media{min-height:300px;}
    .spread-text{padding:3rem 1.8rem;}
    .detail-band{grid-template-columns:1fr;}
    .ficha-grid{grid-template-columns:1fr;}
    .eq-grid{grid-template-columns:1fr 1fr 1fr;}
    .claves{grid-template-columns:1fr;}
    .titleblock{grid-template-columns:1fr 1fr;}
    .tb-brand{grid-column:1/-1;}
    .tb-cell{border-top:1px solid var(--line);}
    .tb-brand{border-top:none;}
    .tb-cell:nth-child(even){border-left:none;}
    .cover{height:600px;}
    .cover-top,.cover-foot{padding-left:1.5rem;padding-right:1.5rem;}
    .respaldo-cell{padding:1.2rem 1.3rem;}
  }

  /* ── PRINT ── */
  @media print{
    @page{size:A4;margin:0;}
    body{background:#fff;}
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .doc{box-shadow:none;max-width:100%;overflow:visible;}
    .jrn-hdr,.topbar-btn,.plano-edit-link,.share-topbar,.share-toast{display:none !important;}

    /* dossier: cada bloque ocupa una página completa a sangre */
    .cover{height:297mm;break-after:page;}
    .section,.spread{break-inside:avoid;break-after:page;min-height:297mm;}
    .section:has(.ficha-grid){break-inside:auto;}
    .section.dark{display:flex;flex-direction:column;justify-content:center;}
    .section.green{min-height:276mm;break-after:avoid;display:flex;flex-direction:column;justify-content:center;}
    .footer{break-inside:avoid;}

    .section{padding:14mm 12mm;}
    .spread{min-height:297mm;}
    .spread-media{min-height:0;}
    .spread-text{padding:12mm 10mm;}

    /* nada se parte por la mitad */
    .sheet,.glance-grid,.eq-grid,.titleblock,.compliance,.detail-band,.respaldo-row,.chips{break-inside:avoid;}
    .glance-cell,.data-row,.eq-cell,.clave,.detail,.respaldo-cell,.arg-point,.veri-row{break-inside:avoid;}
    h2,.sec-head,.veri-head,.nave-intro{break-after:avoid;}
  }

  @media (prefers-reduced-motion: reduce){
    html{scroll-behavior:auto;}
    .ai-plano-dots span{animation:none;opacity:1;}
    .btn svg{transition:none;}
  }
`;
