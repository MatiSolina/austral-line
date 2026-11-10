// GRUPO AUSTRAL — junta de la base todo lo que usa el matching y lo convierte al formato del motor.
// Carrera, intereses y "sobre mí" vienen del grupo Alumnos (solo lectura); el resto, de las tablas austral_.
import type { createClient } from "@/lib/supabase/server";
import { alertas, alertasGrupos, evaluar, planSugerido, type Alumno, type Categoria, type HabilidadConNivel, type Pesos, type Proyecto, type Restricciones } from "./_motor";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const hayIA = () => !!(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL);

export async function cargarMatching(supabase: Supabase) {
  const consultas = await Promise.all([
    supabase.from("austral_habilidades").select("id, nombre, categoria").order("orden"),
    supabase.from("austral_matching_config").select("*").single(),
    supabase.from("personas").select("id, nombre").eq("rol", "alumno").order("nombre"),
    supabase.from("proyecto_integrantes").select("proyecto_id, persona_id"),
    supabase.from("alumnos_carreras").select("persona_id, alumnos_carreras_maestro(nombre)"),
    supabase.from("alumnos_intereses").select("persona_id, interes_id, estrellas"),
    supabase.from("austral_perfiles_matching").select("*"),
    supabase.from("austral_perfil_habilidades").select("persona_id, habilidad_id, nivel"),
    supabase.from("proyectos").select("id, nombre, descripcion, estado").order("nombre"),
    supabase.from("alumnos_grupo_intereses").select("proyecto_id, interes_id, estrellas"),
    supabase.from("austral_proyecto_necesidades").select("*"),
    supabase.from("austral_proyecto_habilidades").select("proyecto_id, habilidad_id"),
    supabase.from("austral_recomendaciones").select("*"),
    supabase.from("alumnos_intereses_maestro").select("id, nombre"),
  ]);
  for (const c of consultas) if (c.error) throw c.error;
  const [habilidades, config, personas, integrantes, carreras, intereses, perfiles, perfilHabilidades, proyectos, gruposIntereses, necesidades, buscadas, decisiones, temas] =
    consultas.map((c) => c.data) as [
      { id: number; nombre: string; categoria: Categoria }[],
      { peso_habilidades: number; peso_complementariedad: number; peso_intereses: number; peso_formacion: number; peso_disponibilidad: number; peso_equilibrio: number; puntaje_minimo: number; integrantes_min: number; integrantes_max: number; carreras_min: number },
      { id: string; nombre: string }[],
      { proyecto_id: string; persona_id: string }[],
      { persona_id: string; alumnos_carreras_maestro: { nombre: string } }[],
      { persona_id: string; interes_id: number; estrellas: number }[],
      { persona_id: string; anio: number | null; area: string | null; experiencia: string | null; disponibilidad: string[]; modalidad: string | null; preferencias: string | null }[],
      { persona_id: string; habilidad_id: number; nivel: number }[],
      { id: string; nombre: string; descripcion: string | null; estado: string }[],
      { proyecto_id: string; interes_id: number; estrellas: number }[],
      { proyecto_id: string; integrantes_necesarios: number; objetivo: string | null; problematica: string | null; disponibilidad: string[]; modalidad: string | null; estado: string }[],
      { proyecto_id: string; habilidad_id: number }[],
      { id: string; persona_id: string; proyecto_id: string; estado: string; puntaje: number | null; justificacion: string | null; justificacion_ia: string | null; observaciones: string | null; decidido_at: string | null; confirmado_at: string | null; origen: string }[],
      { id: number; nombre: string }[],
    ];

  const habilidadPorId = new Map(habilidades.map((h) => [h.id, h]));
  const carreraDe = new Map(carreras.map((c) => [c.persona_id, c.alumnos_carreras_maestro.nombre]));
  const perfilDe = new Map(perfiles.map((p) => [p.persona_id, p]));
  const habilidadesDe = (personaId: string): HabilidadConNivel[] =>
    perfilHabilidades.filter((h) => h.persona_id === personaId).map((h) => ({ ...habilidadPorId.get(h.habilidad_id)!, nivel: h.nivel }));
  const interesesDe = (personaId: string) => new Map(intereses.filter((i) => i.persona_id === personaId).map((i) => [i.interes_id, i.estrellas]));

  const conProyecto = new Set(integrantes.map((i) => i.persona_id));
  const aceptadas = decisiones.filter((d) => d.estado === "aceptada");
  const conPropuesta = new Map(aceptadas.map((d) => [d.persona_id, d.proyecto_id]));

  const aAlumno = (p: { id: string; nombre: string }): Alumno => {
    const perfil = perfilDe.get(p.id);
    return {
      id: p.id,
      nombre: p.nombre,
      carrera: carreraDe.get(p.id) ?? null,
      anio: perfil?.anio ?? null,
      habilidades: habilidadesDe(p.id),
      intereses: interesesDe(p.id),
      disponibilidad: perfil?.disponibilidad ?? [],
      modalidad: perfil?.modalidad ?? null,
    };
  };
  const sinGrupo = personas.filter((p) => !conProyecto.has(p.id)).map(aAlumno);
  // Con una propuesta aceptada sin confirmar, el alumno sale de la lista de candidatos para los demás proyectos.
  const libres = sinGrupo.filter((a) => !conPropuesta.has(a.id));

  const restricciones: Restricciones = { integrantesMin: config.integrantes_min, integrantesMax: config.integrantes_max, carrerasMin: config.carreras_min };
  const necesidadDe = new Map(necesidades.map((n) => [n.proyecto_id, n]));
  const nombreDe = new Map(personas.map((p) => [p.id, p.nombre]));
  const todosLosProyectos = proyectos.map((p) => {
    const n = necesidadDe.get(p.id);
    const suyos = integrantes.filter((i) => i.proyecto_id === p.id).map((i) => i.persona_id);
    const suyosPropuestos = aceptadas.filter((d) => d.proyecto_id === p.id).map((d) => d.persona_id);
    const propuestos = suyosPropuestos.length;
    const ocupados = suyos.length + propuestos;
    const carreras = [...new Set([...suyos, ...suyosPropuestos].map((id) => carreraDe.get(id)).filter((c): c is string => !!c))];
    const proyecto: Proyecto = {
      id: p.id,
      nombre: p.nombre,
      buscadas: buscadas.filter((b) => b.proyecto_id === p.id).map((b) => habilidadPorId.get(b.habilidad_id)!),
      intereses: new Map(gruposIntereses.filter((g) => g.proyecto_id === p.id).map((g) => [g.interes_id, g.estrellas])),
      integrantes: suyos.map((id) => ({ nombre: nombreDe.get(id) ?? "Integrante", carrera: carreraDe.get(id) ?? null, habilidades: habilidadesDe(id) })),
      disponibilidad: n?.disponibilidad ?? [],
      modalidad: n?.modalidad ?? null,
      // El grupo busca hasta lo que pidió, sin pasarse del máximo por grupo que fijó el admin.
      vacantes: n ? Math.max(0, Math.min(n.integrantes_necesarios, restricciones.integrantesMax) - ocupados) : 0,
      ocupados,
      carreras,
    };
    return { ...p, necesidad: n ?? null, proyecto, propuestos };
  });
  // Solo buscan integrantes los proyectos con necesidades cargadas, en estado "buscando" y con lugar.
  const buscando = todosLosProyectos.filter((p) => p.necesidad?.estado === "buscando" && p.proyecto.vacantes > 0).map((p) => p.proyecto);

  const pesos: Pesos = {
    habilidades: config.peso_habilidades,
    complementariedad: config.peso_complementariedad,
    intereses: config.peso_intereses,
    formacion: config.peso_formacion,
    disponibilidad: config.peso_disponibilidad,
    equilibrio: config.peso_equilibrio,
  };
  const candidatos = libres.flatMap((a) => buscando.map((p) => evaluar(a, p, pesos, restricciones.carrerasMin)));
  const plan = planSugerido(candidatos, config.puntaje_minimo, restricciones.carrerasMin);
  // Quien tiene una propuesta en curso se sigue mostrando, pero solo en el proyecto al que fue propuesto.
  const enCurso = sinGrupo.flatMap((a) => {
    const p = todosLosProyectos.find((x) => x.id === conPropuesta.get(a.id));
    // Su lugar ya está reservado y su carrera ya cuenta en el grupo: no se le aplica el bloqueo de carreras.
    return p ? [{ ...evaluar(a, p.proyecto, pesos), bloqueo: null }] : [];
  });
  const resultados = [...candidatos, ...enCurso];

  return {
    habilidades,
    temas: new Map(temas.map((t) => [t.id, t.nombre])),
    config,
    pesos,
    restricciones,
    sinGrupo,
    libres,
    conPropuesta,
    perfilDe,
    todosLosProyectos,
    buscando,
    resultados,
    plan,
    decisiones,
    nombreAlumno: (personaId: string) => nombreDe.get(personaId) ?? "Alumno",
    decisionDe: (personaId: string, proyectoId: string) => decisiones.find((d) => d.persona_id === personaId && d.proyecto_id === proyectoId),
    alertas: [
      ...alertasGrupos(todosLosProyectos.map((p) => ({ ...p.proyecto, buscaIntegrantes: p.necesidad?.estado === "buscando" })), restricciones),
      ...alertas(libres, buscando, candidatos, config.puntaje_minimo),
    ],
  };
}

export const estadosBusqueda: Record<string, string> = { buscando: "Buscando integrantes", activo: "Activo", completo: "Completo" };

export const claseEstado:Record<string, { texto: string; variante: "default" | "secondary" | "outline" | "destructive" }> = {
  pendiente: { texto: "Pendiente", variante: "secondary" },
  aceptada: { texto: "Propuesta a confirmar", variante: "outline" },
  rechazada: { texto: "Rechazada", variante: "destructive" },
  confirmada: { texto: "Confirmada", variante: "default" },
};
