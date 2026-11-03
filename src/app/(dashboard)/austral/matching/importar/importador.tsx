"use client";
// GRUPO AUSTRAL — elegir el CSV, ver la vista previa con los errores de cada fila e importar las válidas.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { plantilla, validar, type Fila } from "../_csv";
import { franjas, modalidades, niveles } from "../_motor";
import { importarPerfiles } from "../acciones";

type Props = { catalogo: { id: number; nombre: string }[]; alumnos: { id: string; nombre: string; email: string }[] };

export function Importador({ catalogo, alumnos }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [archivo, setArchivo] = useState("");
  const [vista, setVista] = useState<{ filas: Fila[]; errorGeneral: string | null } | null>(null);
  const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const [importando, setImportando] = useState(false);

  async function elegir(f: File) {
    setResultado(null);
    if (!/\.(csv|txt)$/i.test(f.name)) {
      setVista({ filas: [], errorGeneral: "Elegí un archivo .csv. Si lo tenés en Excel: Archivo → Guardar como → CSV." });
      return;
    }
    const contenido = await f.text();
    setArchivo(f.name);
    setTexto(contenido);
    setVista(validar(contenido, catalogo, alumnos));
  }

  async function importar() {
    setImportando(true);
    const r = await importarPerfiles(texto);
    setResultado(r);
    setImportando(false);
    if (r.ok) {
      setVista(null);
      if (input.current) input.current.value = "";
      router.refresh();
    }
  }

  const validas = vista?.filas.filter((f) => !f.errores.length).length ?? 0;
  const descripcion = (f: Fila) =>
    [
      f.cambios.anio && `${f.cambios.anio}º año`,
      f.cambios.area,
      f.cambios.disponibilidad?.map((x) => franjas[x]).join(", "),
      f.cambios.modalidad && modalidades[f.cambios.modalidad],
      f.habilidades && (f.habilidades.length ? f.habilidades.map((h) => `${h.nombre} (${niveles[h.nivel].toLowerCase()})`).join(", ") : "sin habilidades"),
    ].filter(Boolean).join(" · ");

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && elegir(e.target.files[0])} />
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>Elegir archivo CSV</Button>
        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent("﻿" + plantilla)}`} download="plantilla-perfiles-matching.csv" className="text-sm underline underline-offset-4">
          Descargar plantilla
        </a>
        {archivo && <span className="text-sm text-[#666]">{archivo}</span>}
      </div>

      {resultado && <p className={`mt-6 border p-3 text-sm ${resultado.ok ? "" : "border-destructive text-destructive"}`}>{resultado.mensaje}</p>}
      {vista?.errorGeneral && <p className="mt-6 border border-destructive p-3 text-sm text-destructive">{vista.errorGeneral}</p>}

      {vista && vista.filas.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">{validas} de {vista.filas.length} filas listas para importar{validas < vista.filas.length ? "; las que tienen errores no se cargan." : "."}</p>
            <Button type="button" size="sm" disabled={!validas || importando} onClick={importar}>
              {importando ? "Importando…" : `Importar ${validas} perfil${validas === 1 ? "" : "es"}`}
            </Button>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Fila</TableHead><TableHead>Alumno</TableHead><TableHead>Qué se carga</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
            <TableBody>
              {vista.filas.map((f) => (
                <TableRow key={f.linea}>
                  <TableCell className="text-[#666]">{f.linea}</TableCell>
                  <TableCell>{f.nombre ?? <span className="text-[#666]">{f.email || "—"}</span>}</TableCell>
                  <TableCell className="max-w-md text-[#666]">{descripcion(f) || "—"}</TableCell>
                  <TableCell className={`max-w-xs text-sm ${f.errores.length ? "text-destructive" : ""}`}>{f.errores.length ? f.errores.join(" ") : "OK"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
