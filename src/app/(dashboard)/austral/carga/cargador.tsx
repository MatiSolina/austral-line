"use client";
// GRUPO AUSTRAL — una de las 4 cargas (mentores, jurados, alumnos o proyectos): plantilla, vista previa e importación.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { plantilla, tipos, type Fila, type Tipo } from "./_carga";
import { importar, previsualizar } from "./acciones";

export function Cargador({ tipo }: { tipo: Tipo }) {
  const t = tipos[tipo];
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [archivo, setArchivo] = useState("");
  const [vista, setVista] = useState<{ filas: Fila[]; errorGeneral: string | null } | null>(null);
  const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function elegir(f: File) {
    setResultado(null);
    if (input.current) input.current.value = ""; // así se puede volver a elegir el mismo archivo corregido
    if (!/\.(csv|txt)$/i.test(f.name)) {
      setVista({ filas: [], errorGeneral: "Elegí un archivo .csv. Desde Excel: Archivo → Guardar como → CSV." });
      return;
    }
    const contenido = await f.text();
    setArchivo(f.name);
    setTexto(contenido);
    setOcupado(true);
    setVista(await previsualizar(tipo, contenido));
    setOcupado(false);
  }

  async function confirmar() {
    setOcupado(true);
    const r = await importar(tipo, texto);
    setResultado(r);
    setOcupado(false);
    if (r.ok) setVista(null);
    router.refresh();
  }

  const validas = vista?.filas.filter((f) => !f.errores.length).length ?? 0;

  return (
    <section className="border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-xl">{t.titulo}</h2>
        <code className="text-xs text-[#666]">{t.columnas.join(" ; ")}</code>
      </div>
      <p className="mt-1 text-sm text-[#666]">{t.ayuda}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && elegir(e.target.files[0])} />
        <Button type="button" variant="outline" size="sm" disabled={ocupado} onClick={() => input.current?.click()}>
          {ocupado && !vista ? "Leyendo…" : `Cargar ${t.titulo.toLowerCase()}`}
        </Button>
        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + plantilla(tipo))}`} download={`plantilla-${tipo}.csv`} className="text-sm underline underline-offset-4">
          Descargar plantilla
        </a>
        {archivo && <span className="text-sm text-[#666]">{archivo}</span>}
      </div>

      {resultado && <p className={`mt-4 border p-3 text-sm ${resultado.ok ? "" : "border-destructive text-destructive"}`}>{resultado.mensaje}</p>}
      {vista?.errorGeneral && <p className="mt-4 border border-destructive p-3 text-sm text-destructive">{vista.errorGeneral}</p>}

      {vista && vista.filas.length > 0 && (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">{validas} de {vista.filas.length} filas listas{validas < vista.filas.length ? "; las que tienen errores no se cargan" : ""}.</p>
            <Button type="button" size="sm" disabled={!validas || ocupado} onClick={confirmar}>
              {ocupado ? "Importando…" : `Importar ${validas} fila${validas === 1 ? "" : "s"}`}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fila</TableHead>
                  {t.columnas.map((c) => <TableHead key={c} className="capitalize">{c}</TableHead>)}
                  <TableHead>Qué pasa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vista.filas.map((f) => (
                  <TableRow key={f.linea}>
                    <TableCell className="text-[#666]">{f.linea}</TableCell>
                    {t.columnas.map((c) => <TableCell key={c} className="max-w-56 whitespace-normal">{f.datos[c] || "—"}</TableCell>)}
                    <TableCell className={`max-w-xs whitespace-normal text-sm ${f.errores.length ? "text-destructive" : "text-[#666]"}`}>
                      {f.errores.length ? f.errores.join(" ") : f.accion === "nuevo" ? "Se crea" : "Se actualiza"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </section>
  );
}
