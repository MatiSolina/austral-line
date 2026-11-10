// GRUPO AUSTRAL — indicadores y métricas de seguimiento del matching, calculados con lo que ya cargó cargarMatching
// más la fecha de alta de cada alumno y la satisfacción registrada después de cada asignación.
import type { createClient } from "@/lib/supabase/server";
import type { cargarMatching } from "./_datos";
import { categorias, distribucion, faltantes, parejo, type Categoria } from "./_motor";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Datos = Awaited<ReturnType<typeof cargarMatching>>;
type Fila = { nombre: string; valor: number };

const contar = (valores: string[]): Fila[] =>
  [...valores.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map<string, number>())]
    .map(([nombre, valor]) => ({ nombre, valor }))
    .sort((a, b) => b.valor - a.valor);

const promedio = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export async function calcularMetricas(supabase: Supabase, datos: Datos) {
  const [personas, satisfaccion] = await Promise.all([
    supabase.from("personas").select("id, created_at").eq("rol", "alumno"),
    supabase.from("austral_matching_satisfaccion").select("recomendacion_id, alumno, equipo"),
  ]);
  if (personas.error) throw personas.error;
  if (satisfaccion.error) throw satisfaccion.error;
  const altaDe = new Map(personas.data.map((p) => [p.id, p.created_at]));

  const porEstado = (e: string) => datos.decisiones.filter((d) => d.estado === e);
  const confirmadas = porEstado("confirmada");
  // Las ubicaciones a mano del admin cuentan como incorporados, pero no para medir al motor.
  const confirmadasMotor = confirmadas.filter((d) => d.origen === "motor");
  const aceptadas = porEstado("aceptada");
  const rechazadas = porEstado("rechazada");
  const decididas = confirmadasMotor.length + aceptadas.length + rechazadas.length;
  const matches = datos.resultados.filter((r) => r.puntaje >= datos.config.puntaje_minimo);

  // Días desde que el alumno está en la app hasta que se confirmó su asignación.
  const dias = confirmadasMotor
    .filter((d) => d.confirmado_at && altaDe.get(d.persona_id))
    .map((d) => (new Date(d.confirmado_at!).getTime() - new Date(altaDe.get(d.persona_id)!).getTime()) / 86_400_000);

  // Equilibrio de cada equipo con al menos 2 integrantes con habilidades cargadas (100 = las 4 categorías parejas).
  const equipos = datos.todosLosProyectos
    .filter((p) => p.proyecto.integrantes.filter((i) => i.habilidades.length).length >= 2)
    .map((p) => ({ nombre: p.nombre, valor: Math.round(parejo(distribucion(p.proyecto.integrantes)) * 100) }))
    .sort((a, b) => a.valor - b.valor);

  const conAlumno = satisfaccion.data.filter((s) => s.alumno !== null).map((s) => s.alumno!);
  const conEquipo = satisfaccion.data.filter((s) => s.equipo !== null).map((s) => s.equipo!);

  return {
    indicadores: {
      sinGrupo: datos.sinGrupo.length,
      buscando: datos.buscando.length,
      matches: matches.length,
      pendientes: aceptadas.length,
      aceptados: confirmadas.length,
      consiguieronEquipo: confirmadas.length + datos.sinGrupo.length ? confirmadas.length / (confirmadas.length + datos.sinGrupo.length) : null,
    },
    graficos: {
      carreras: contar(datos.sinGrupo.map((a) => a.carrera ?? "Sin carrera cargada")),
      categoriasDisponibles: (Object.keys(categorias) as Categoria[])
        .map((c) => ({ nombre: categorias[c], valor: datos.sinGrupo.filter((a) => a.habilidades.some((h) => h.categoria === c)).length }))
        .sort((a, b) => b.valor - a.valor),
      habilidadesDisponibles: contar(datos.sinGrupo.flatMap((a) => a.habilidades.map((h) => h.nombre))).slice(0, 8),
      habilidadesDemandadas: contar(datos.buscando.flatMap((p) => faltantes(p).map((h) => h.nombre))).slice(0, 8),
      necesidadProyectos: datos.buscando.map((p) => ({ nombre: p.nombre, valor: p.vacantes })).sort((a, b) => b.valor - a.valor),
      estados: [
        { nombre: "Pendientes", valor: porEstado("pendiente").length },
        { nombre: "Propuestas a confirmar", valor: aceptadas.length },
        { nombre: "Confirmadas", valor: confirmadas.length },
        { nombre: "Rechazadas", valor: rechazadas.length },
      ],
    },
    seguimiento: {
      incorporados: confirmadas.length,
      tasaAceptacion: decididas ? (confirmadasMotor.length + aceptadas.length) / decididas : null,
      decididas,
      diasPromedio: promedio(dias),
      satisfaccionAlumno: promedio(conAlumno),
      satisfaccionEquipo: promedio(conEquipo),
      respuestas: satisfaccion.data.length,
      equilibrioPromedio: promedio(equipos.map((e) => e.valor)),
      equipos,
      confirmadas: confirmadas.map((d) => ({ ...d, satisfaccion: satisfaccion.data.find((x) => x.recomendacion_id === d.id) ?? null })),
    },
  };
}
