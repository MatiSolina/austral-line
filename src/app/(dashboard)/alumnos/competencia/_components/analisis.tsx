// GRUPO ALUMNOS — cómo se muestra un análisis de competencia guardado.
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Resultado } from "../_agente";

const TIPO = { directo: "Directo", indirecto: "Indirecto", sustituto: "Sustituto" } as const;

function Lista({ titulo, items, vacio }: { titulo: string; items: string[]; vacio?: string }) {
  if (items.length === 0 && !vacio) return null;
  return (
    <section className="grid gap-2">
      <h3 className="font-serif text-base">{titulo}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-[#666]">{vacio}</p>
      ) : (
        <ul className="grid list-disc gap-1 pl-5 text-sm">
          {items.map((x) => <li key={x}>{x}</li>)}
        </ul>
      )}
    </section>
  );
}

// El resultado viene de la base y un integrante lo puede escribir por la API: se descarta lo que no tenga
// la forma esperada y solo se muestran links http(s).
const esLink = (u: unknown): u is string => typeof u === "string" && /^https?:\/\//i.test(u);
const textos = (xs: unknown) => (Array.isArray(xs) ? xs.filter((x): x is string => typeof x === "string") : []);

export function Analisis({ resultado }: { resultado: Partial<Resultado> }) {
  const r = {
    resumen: typeof resultado.resumen === "string" ? resultado.resumen : "",
    competidores: (Array.isArray(resultado.competidores) ? resultado.competidores : []).filter(
      (c) => c && typeof c.nombre === "string" && esLink(c.fuente),
    ),
    diferenciales: textos(resultado.diferenciales),
    alertas: textos(resultado.alertas),
    preguntas: textos(resultado.preguntas),
    fuentes: (Array.isArray(resultado.fuentes) ? resultado.fuentes : []).filter(
      (f) => f && typeof f.titulo === "string" && esLink(f.url),
    ),
    descartados: typeof resultado.descartados === "number" ? resultado.descartados : 0,
  };
  return (
    <div className="grid gap-6">
      <p className="text-sm">{r.resumen}</p>

      <section className="grid gap-2">
        <h3 className="font-serif text-base">Competidores y alternativas ({r.competidores.length})</h3>
        {r.competidores.length === 0 ? (
          <p className="text-sm text-[#666]">
            La búsqueda no encontró competidores con una fuente para verificar. Eso no quiere decir que no existan: prueben
            contar el problema de otra forma en el breve o buscar por su cuenta.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Nombre</TableHead><TableHead>Qué hace</TableHead><TableHead>Se parece</TableHead><TableHead>Se diferencia</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {r.competidores.map((c) => (
                <TableRow key={`${c.nombre}-${c.fuente}`} className="align-top">
                  <TableCell className="whitespace-normal">
                    <div className="grid gap-1">
                      <a href={c.fuente} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-4 hover:text-[#666]">
                        {c.nombre}
                      </a>
                      <Badge variant={c.tipo === "directo" ? "default" : "outline"}>{TIPO[c.tipo] ?? c.tipo}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-normal">{c.que_hace}</TableCell>
                  <TableCell className="whitespace-normal">{c.parecido}</TableCell>
                  <TableCell className="whitespace-normal">{c.diferencia}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {r.descartados > 0 && (
          <p className="text-xs text-[#666]">
            {r.descartados === 1 ? "Se descartó 1 competidor" : `Se descartaron ${r.descartados} competidores`} que la IA nombró
            sin una fuente de la búsqueda para verificarlo.
          </p>
        )}
        <p className="text-xs text-[#666]">
          Directo: resuelve lo mismo para el mismo público. Indirecto: otra solución al mismo problema. Sustituto: lo que la
          gente hace hoy en lugar de usar una solución.
        </p>
      </section>

      <Lista titulo="Por dónde podrían diferenciarse" items={r.diferenciales} />
      <Lista titulo="Alertas" items={r.alertas} />
      <Lista titulo="Preguntas para pensar (como las haría un jurado)" items={r.preguntas} />

      {r.fuentes.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-[#666] hover:text-primary">Fuentes consultadas ({r.fuentes.length})</summary>
          <ul className="mt-2 grid gap-1">
            {r.fuentes.map((f) => (
              <li key={f.url}>
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-[#666]">{f.titulo}</a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
