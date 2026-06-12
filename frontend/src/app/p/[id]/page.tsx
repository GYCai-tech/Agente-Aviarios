"use client";

import { useEffect } from "react";

// Enlace corto para el cliente: /p/<id> → /propuesta?id=<id>
export default function PropuestaCompartida() {
  useEffect(() => {
    const id = window.location.pathname.split("/").filter(Boolean).pop() ?? "";
    window.location.replace(`/propuesta?id=${encodeURIComponent(id)}`);
  }, []);
  return null;
}
