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
    <header className="est-top">
      <div className="est-top-inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/gyc-logo.png" alt="Gómez y Crespo" className="est-logo" />
        <span className="est-top-div" aria-hidden="true" />
        <nav className="est-tabs" aria-label="Secciones">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={t.href}
              className={`est-tab${activa === t.id ? " is-on" : ""}`}
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
