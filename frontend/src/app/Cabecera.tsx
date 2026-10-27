import Link from "next/link";

interface Props {
  activa: "estudio" | "ficha";
  /** Contenido a la derecha (p. ej. los pasos del estudio) */
  children?: React.ReactNode;
}

export default function Cabecera({ activa, children }: Props) {
  const tabs = [
    { id: "estudio", href: "/", label: "Estudio" },
    { id: "ficha", href: "/ficha", label: "Ficha técnica" },
  ] as const;
  return (
    <header className="sticky top-0 z-10 border-b border-base-300 bg-base-100/95 shadow-sm backdrop-blur print:hidden">
      <div className="navbar mx-auto max-w-[1180px] flex-wrap gap-x-4 gap-y-1 px-[clamp(1rem,4vw,2rem)] md:flex-nowrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {/* La versión recortada, sin el margen transparente de gyc-logo.png: la altura es la de la marca */}
        <img src="/gyc-logo-recortado.png" alt="Gómez y Crespo" className="h-6 w-auto shrink-0 md:h-7" />
        <span className="hidden h-6 w-px bg-base-300 md:block" aria-hidden="true" />
        <nav role="tablist" className="tabs tabs-border font-display" aria-label="Secciones">
          {tabs.map((t) => (
            <Link
              key={t.id}
              role="tab"
              href={t.href}
              className={`tab text-[0.95rem] ${activa === t.id ? "tab-active font-semibold text-primary" : ""}`}
              aria-current={activa === t.id ? "page" : undefined}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </header>
  );
}
