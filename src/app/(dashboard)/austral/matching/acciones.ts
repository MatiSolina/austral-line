"use server";
// GRUPO AUSTRAL — acciones del matching. Todas son solo para el admin.
// El agente nunca suma a nadie solo: aceptar crea una propuesta y recién "Confirmar" agrega al alumno al equipo.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generateText } from "ai";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cargarMatching, hayIA } from "./_datos";
import { alumnosConEmail, validar } from "./_csv";
import { criterios, franjas, modalidades } from "./_motor";

function volver(formData: FormData, tipo: "ok" | "error", mensaje: string): never {
  revalidatePath("/austral", "layout");
  const pedido = String(formData.get("volver") ?? "");
  const destino = pedido.startsWith("/austral/matching") ? pedido : "/austral/matching";
  redirect(`${destino}${destino.includes("?") ? "&" : "?"}${tipo}=${encodeURIComponent(mensaje)}`);
}

const texto = (formData: FormData, campo: string, max = 1000) => String(formData.get(campo) ?? "").trim().slice(0, max) || null;
const opcion = <T extends string>(valor: FormDataEntryValue | null, validas: readonly T[]) =>
  validas.includes(String(valor) as T) ? (String(valor) as T) : null;
const listaFranjas = (formData: FormData) => formData.getAll("disponibilidad").map(String).filter((f) => f in franjas);
const modalidadDe = (formData: FormData) => opcion(formData.get("modalidad"), Object.keys(modalidades) as ("presencial" | "remota" | "mixta")[]);

export async function guardarPerfil(formData: FormData) {
  await requireRol();
  const supabase = await createClient();
  const personaId = String(formData.get("persona_id"));
  const anio = Number(formData.get("anio")) || null;
  if (anio !== null && (anio < 1 || anio > 6)) volver(formData, "error", "El año de cursado tiene que estar entre 1 y 6.");

  const { error } = await supabase.from("austral_perfiles_matching").upsert({
    persona_id: personaId,
    anio,
    area: texto(formData, "area", 200),
    experiencia: texto(formData, "experiencia"),
    disponibilidad: listaFranjas(formData),
    modalidad: modalidadDe(formData),
    preferencias: texto(formData, "preferencias"),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;

  // Las habilidades vienen como "habilidad:<id>" = nivel (0 = no la tiene).
  const habilidades = [...formData.entries()]
    .filter(([clave]) => clave.startsWith("habilidad:"))
    .map(([clave, valor]) => ({ persona_id: personaId, habilidad_id: Number(clave.slice(10)), nivel: Number(valor) }))
    .filter((h) => h.nivel >= 1 && h.nivel <= 3);
  const borrado = await supabase.from("austral_perfil_habilidades").delete().eq("persona_id", personaId);
  if (borrado.error) throw borrado.error;
  if (habilidades.length) {
    const alta = await supabase.from("austral_perfil_habilidades").insert(habilidades);
    if (alta.error) throw alta.error;
  }
  volver(formData, "ok", "Perfil guardado.");
}

export async function guardarNecesidades(formData: FormData) {
  await requireRol();
  const supabase = await createClient();
  const proyectoId = String(formData.get("proyecto_id"));
  const necesarios = Number(formData.get("integrantes_necesarios"));
  if (!Number.isInteger(necesarios) || necesarios < 1 || necesarios > 12) volver(formData, "error", "La cantidad de integrantes tiene que estar entre 1 y 12.");

  const { error } = await supabase.from("austral_proyecto_necesidades").upsert({
    proyecto_id: proyectoId,
    integrantes_necesarios: necesarios,
    objetivo: texto(formData, "objetivo"),
    problematica: texto(formData, "problematica"),
    disponibilidad: listaFranjas(formData),
    modalidad: modalidadDe(formData),
    estado: opcion(formData.get("estado"), ["activo", "buscando", "completo"] as const) ?? "buscando",
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;

  const elegidas = formData.getAll("buscada").map(Number).filter(Boolean).map((id) => ({ proyecto_id: proyectoId, habilidad_id: id }));
  const borrado = await supabase.from("austral_proyecto_habilidades").delete().eq("proyecto_id", proyectoId);
  if (borrado.error) throw borrado.error;
  if (elegidas.length) {
    const alta = await supabase.from("austral_proyecto_habilidades").insert(elegidas);
    if (alta.error) throw alta.error;
  }
  volver(formData, "ok", "Necesidades del proyecto guardadas.");
}

export async function guardarPesos(formData: FormData) {
  await requireRol();
  const pesos = Object.fromEntries(Object.keys(criterios).map((k) => [`peso_${k}`, Number(formData.get(k))]));
  const valores = Object.values(pesos);
  if (valores.some((v) => !Number.isInteger(v) || v < 0 || v > 100)) volver(formData, "error", "Cada peso tiene que ser un número entero entre 0 y 100.");
  const suma = valores.reduce((a, b) => a + b, 0);
  if (suma !== 100) volver(formData, "error", `Los pesos tienen que sumar 100 (ahora suman ${suma}).`);
  const minimo = Number(formData.get("puntaje_minimo"));
  if (!Number.isInteger(minimo) || minimo < 0 || minimo > 100) volver(formData, "error", "El puntaje mínimo tiene que estar entre 0 y 100.");
  const [integrantesMin, integrantesMax, carrerasMin] = ["integrantes_min", "integrantes_max", "carreras_min"].map((k) => Number(formData.get(k)));
  if (![integrantesMin, integrantesMax].every((n) => Number.isInteger(n) && n >= 1 && n <= 12)) volver(formData, "error", "El mínimo y el máximo de integrantes tienen que estar entre 1 y 12.");
  if (integrantesMin > integrantesMax) volver(formData, "error", "El mínimo de integrantes no puede ser mayor que el máximo.");
  if (!Number.isInteger(carrerasMin) || carrerasMin < 1 || carrerasMin > 6) volver(formData, "error", "El mínimo de carreras distintas tiene que estar entre 1 y 6.");
  if (carrerasMin > integrantesMax) volver(formData, "error", `Con un máximo de ${integrantesMax} integrantes no se pueden pedir ${carrerasMin} carreras distintas.`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("austral_matching_config")
    .update({ ...pesos, puntaje_minimo: minimo, integrantes_min: integrantesMin, integrantes_max: integrantesMax, carreras_min: carrerasMin, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) throw error;
  volver(formData, "ok", "Ponderación y restricciones guardadas: los puntajes y las recomendaciones ya se recalcularon.");
}

// Aceptar (= propuesta a confirmar), rechazar o dejar pendiente. Guarda el puntaje y la justificación de ese momento,
// recalculados acá (no se confía en lo que manda el formulario).
export async function decidir(formData: FormData) {
  const persona = await requireRol();
  const supabase = await createClient();
  const personaId = String(formData.get("persona_id"));
  const proyectoId = String(formData.get("proyecto_id"));
  const decision = opcion(formData.get("decision"), ["aceptada", "rechazada", "pendiente"] as const);
  if (!decision) volver(formData, "error", "Elegí una decisión.");

  const datos = await cargarMatching(supabase);
  const previa = datos.decisionDe(personaId, proyectoId);
  if (previa?.estado === "confirmada") volver(formData, "error", "Esa asignación ya está confirmada.");
  const resultado = datos.resultados.find((r) => r.alumno.id === personaId && r.proyecto.id === proyectoId);
  if (decision === "aceptada") {
    if (!resultado) volver(formData, "error", "Ese proyecto ya no busca integrantes o el alumno tiene otra propuesta en curso.");
    if (previa?.estado !== "aceptada" && resultado.proyecto.vacantes <= 0) volver(formData, "error", "El proyecto ya no tiene lugares libres (llegó a lo que busca o al máximo de integrantes por grupo).");
    if (previa?.estado !== "aceptada" && resultado.bloqueo) volver(formData, "error", resultado.bloqueo);
  }

  const { error } = await supabase.from("austral_recomendaciones").upsert(
    {
      persona_id: personaId,
      proyecto_id: proyectoId,
      estado: decision,
      observaciones: texto(formData, "observaciones"),
      ...(resultado && { puntaje: resultado.puntaje, justificacion: resultado.justificacion }),
      decidido_por: persona.id,
      decidido_at: new Date().toISOString(),
    },
    { onConflict: "persona_id,proyecto_id" },
  );
  if (error?.code === "23505") volver(formData, "error", "El alumno ya tiene otra propuesta en curso. Resolvé esa antes de aceptar una nueva.");
  if (error) throw error;
  const mensajes = { aceptada: "Propuesta creada. Falta confirmarla para sumar al alumno al equipo.", rechazada: "Recomendación rechazada.", pendiente: "Quedó pendiente." };
  volver(formData, "ok", mensajes[decision]);
}

// Recién acá el alumno pasa a ser integrante del proyecto.
export async function confirmar(formData: FormData) {
  const persona = await requireRol();
  const supabase = await createClient();
  const { data: rec, error } = await supabase.from("austral_recomendaciones").select("id, persona_id, proyecto_id, estado").eq("id", String(formData.get("recomendacion_id"))).single();
  if (error) throw error;
  if (rec.estado !== "aceptada") volver(formData, "error", "Solo se pueden confirmar propuestas aceptadas.");

  const alta = await supabase.from("proyecto_integrantes").insert({ proyecto_id: rec.proyecto_id, persona_id: rec.persona_id });
  if (alta.error && alta.error.code !== "23505") throw alta.error;
  const cambio = await supabase
    .from("austral_recomendaciones")
    .update({ estado: "confirmada", confirmado_at: new Date().toISOString(), decidido_por: persona.id })
    .eq("id", rec.id);
  if (cambio.error) throw cambio.error;

  await cerrarSiCompleto(supabase, rec.proyecto_id);
  // Ya no es un alumno sin grupo, así que su página de recomendación no tiene sentido: vuelve al panel.
  formData.set("volver", "/austral/matching");
  volver(formData, "ok", "Asignación confirmada: el alumno ya es parte del equipo.");
}

// Importa perfiles desde el texto del CSV. Vuelve a validar todo acá; las filas con errores no se cargan.
export async function importarPerfiles(texto: string): Promise<{ ok: boolean; mensaje: string }> {
  await requireRol();
  if (texto.length > 500_000) return { ok: false, mensaje: "El archivo es demasiado grande (máximo 500 KB)." };
  const supabase = await createClient();
  const [catalogo, alumnos] = await Promise.all([
    supabase.from("austral_habilidades").select("id, nombre"),
    supabase.from("personas_contacto").select("id, nombre, email").eq("rol", "alumno"),
  ]);
  if (catalogo.error) throw catalogo.error;
  if (alumnos.error) throw alumnos.error;
  const { filas, errorGeneral } = validar(texto, catalogo.data, alumnosConEmail(alumnos.data));
  if (!filas.length) return { ok: false, mensaje: errorGeneral ?? "No hay filas para importar." };

  const validas = filas.filter((f) => !f.errores.length && f.personaId);
  const ahora = new Date().toISOString();
  // Un upsert por fila (cada una trae columnas distintas y una celda vacía no tiene que pisar nada), en paralelo.
  const perfiles = await Promise.all(
    validas.map((f) => supabase.from("austral_perfiles_matching").upsert({ persona_id: f.personaId!, ...f.cambios, updated_at: ahora })),
  );
  const fallidas = new Set(validas.filter((_, k) => perfiles[k].error).map((f) => f.linea));

  // Habilidades: primero se cargan las nuevas (un solo upsert para todas las filas) y recién después se borran las que
  // ya no van. Si algo falla a mitad de camino, el alumno queda con más habilidades, nunca sin ninguna.
  const conHabilidades = validas.filter((f) => f.habilidades && !fallidas.has(f.linea));
  const nuevas = conHabilidades.flatMap((f) => f.habilidades!.map((h) => ({ persona_id: f.personaId!, habilidad_id: h.id, nivel: h.nivel })));
  const alta = nuevas.length ? await supabase.from("austral_perfil_habilidades").upsert(nuevas, { onConflict: "persona_id,habilidad_id" }) : { error: null };
  if (alta.error) conHabilidades.forEach((f) => fallidas.add(f.linea));
  else {
    const bajas = await Promise.all(
      conHabilidades.map((f) => {
        const quedan = f.habilidades!.map((h) => h.id);
        const consulta = supabase.from("austral_perfil_habilidades").delete().eq("persona_id", f.personaId!);
        return quedan.length ? consulta.not("habilidad_id", "in", `(${quedan.join(",")})`) : consulta;
      }),
    );
    conHabilidades.filter((_, k) => bajas[k].error).forEach((f) => fallidas.add(f.linea));
  }

  revalidatePath("/austral", "layout");
  const importadas = validas.length - fallidas.size;
  const salteadas = filas.length - validas.length;
  const partes = [
    importadas === 1 ? "Se importó 1 perfil" : `Se importaron ${importadas} perfiles`,
    salteadas ? (salteadas === 1 ? "1 fila con errores no se cargó" : `${salteadas} filas con errores no se cargaron`) : "",
    fallidas.size ? `no se pudieron guardar las filas ${[...fallidas].sort((a, b) => a - b).join(", ")} (probá importarlas de nuevo)` : "",
  ].filter(Boolean);
  return { ok: importadas > 0 && !fallidas.size, mensaje: `${partes.join("; ")}.` };
}

// Satisfacción con una asignación confirmada (1 a 5 del alumno y del equipo), para las métricas de seguimiento.
export async function guardarSatisfaccion(formData: FormData) {
  const persona = await requireRol();
  const supabase = await createClient();
  const puntaje = (campo: string) => {
    const n = Number(formData.get(campo));
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
  };
  const alumno = puntaje("alumno");
  const equipo = puntaje("equipo");

  const recomendacionId = String(formData.get("recomendacion_id"));
  const { data: rec } = await supabase.from("austral_recomendaciones").select("estado").eq("id", recomendacionId).maybeSingle();
  if (rec?.estado !== "confirmada") volver(formData, "error", "Solo se registra la satisfacción de asignaciones confirmadas.");

  // Las dos en "Sin dato": si había algo cargado (por ejemplo, por error), se borra; si no, no hay nada que guardar.
  if (alumno === null && equipo === null) {
    const { data: borrada, error } = await supabase.from("austral_matching_satisfaccion").delete().eq("recomendacion_id", recomendacionId).select("recomendacion_id");
    if (error) throw error;
    if (borrada.length) volver(formData, "ok", "Satisfacción borrada.");
    volver(formData, "error", "Elegí al menos una calificación (del alumno o del equipo).");
  }
  const { error } = await supabase.from("austral_matching_satisfaccion").upsert({
    recomendacion_id: recomendacionId,
    alumno,
    equipo,
    comentario: texto(formData, "comentario"),
    registrado_por: persona.id,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  volver(formData, "ok", "Satisfacción registrada.");
}

// Si el equipo llegó al tamaño buscado, deja de buscar.
async function cerrarSiCompleto(supabase: Awaited<ReturnType<typeof createClient>>, proyectoId: string) {
  const [{ count }, { data: necesidad }] = await Promise.all([
    supabase.from("proyecto_integrantes").select("persona_id", { count: "exact", head: true }).eq("proyecto_id", proyectoId),
    supabase.from("austral_proyecto_necesidades").select("integrantes_necesarios").eq("proyecto_id", proyectoId).maybeSingle(),
  ]);
  if (necesidad && (count ?? 0) >= necesidad.integrantes_necesarios) {
    await supabase.from("austral_proyecto_necesidades").update({ estado: "completo" }).eq("proyecto_id", proyectoId);
  }
}

// El admin ubica a mano a un alumno sin grupo en un proyecto que busca integrantes (desde "Alumnos sin grupo").
// Es la decisión del admin, así que queda directo como asignación confirmada, con el puntaje del motor de ese momento.
export async function ubicarAlumno(formData: FormData) {
  const persona = await requireRol();
  const supabase = await createClient();
  const personaId = String(formData.get("persona_id"));
  const proyectoId = String(formData.get("proyecto_id") ?? "");
  if (!proyectoId) volver(formData, "error", "Elegí en qué proyecto ubicar al alumno.");

  const datos = await cargarMatching(supabase);
  const alumno = datos.sinGrupo.find((a) => a.id === personaId);
  if (!alumno) volver(formData, "error", "Ese alumno ya está en un equipo.");
  const enCurso = datos.conPropuesta.get(personaId);
  if (enCurso && enCurso !== proyectoId) volver(formData, "error", `${alumno.nombre} tiene una propuesta en curso para otro proyecto. Resolvela desde Recomendaciones.`);
  const resultado = datos.resultados.find((r) => r.alumno.id === personaId && r.proyecto.id === proyectoId);
  // Con una propuesta aceptada para este mismo proyecto, su lugar ya está descontado de las vacantes.
  if (!resultado || (!enCurso && resultado.proyecto.vacantes <= 0)) volver(formData, "error", "Ese proyecto ya no busca integrantes o no tiene lugares libres (llegó a lo que busca o al máximo por grupo).");
  if (resultado.bloqueo) volver(formData, "error", resultado.bloqueo);

  const ahora = new Date().toISOString();
  const { error } = await supabase.from("austral_recomendaciones").upsert(
    {
      persona_id: personaId,
      proyecto_id: proyectoId,
      estado: "confirmada",
      origen: "manual",
      puntaje: resultado.puntaje,
      justificacion: resultado.justificacion,
      observaciones: "Ubicado a mano por el admin desde Alumnos sin grupo.",
      decidido_por: persona.id,
      decidido_at: ahora,
      confirmado_at: ahora,
    },
    { onConflict: "persona_id,proyecto_id" },
  );
  // Primero la asignación y después el alta en el equipo: si el alumno ya tiene otra asignación vigente, no queda a medias.
  if (error?.code === "23505") volver(formData, "error", `${alumno.nombre} ya tiene otra asignación registrada. Resolvela desde Recomendaciones.`);
  if (error) throw error;
  const alta = await supabase.from("proyecto_integrantes").insert({ proyecto_id: proyectoId, persona_id: personaId });
  if (alta.error && alta.error.code !== "23505") throw alta.error;
  await cerrarSiCompleto(supabase, proyectoId);
  volver(formData, "ok", `${alumno.nombre} ya es integrante de ${resultado.proyecto.nombre}.`);
}

// Opcional: una justificación más redactada. Usa solo los datos calculados por el motor; no cambia el puntaje.
export async function redactarConIA(formData: FormData) {
  await requireRol();
  const supabase = await createClient();
  const personaId = String(formData.get("persona_id"));
  const proyectoId = String(formData.get("proyecto_id"));
  if (!hayIA()) volver(formData, "error", "No hay clave de IA configurada: la justificación del motor sigue disponible.");

  const datos = await cargarMatching(supabase);
  const r = datos.resultados.find((x) => x.alumno.id === personaId && x.proyecto.id === proyectoId);
  if (!r) volver(formData, "error", "Esa combinación ya no está entre las recomendaciones.");
  const perfil = datos.perfilDe.get(personaId);

  let redaccion: string;
  try {
    const { text } = await generateText({
      model: "anthropic/claude-sonnet-5.5",
      instructions: `Sos el asistente de matching de la Universidad Austral. Redactás para el admin, en español rioplatense y en 3 a 5 oraciones,
por qué conviene (o no) sumar a un alumno a un proyecto. Usá SOLO los datos que te paso: no inventes habilidades, experiencia ni datos personales,
no cambies el puntaje y mencioná las alertas si las hay. Priorizá lo que el alumno le suma al equipo por sobre sus habilidades sueltas.`,
      prompt: JSON.stringify({
        alumno: { nombre: r.alumno.nombre, carrera: r.alumno.carrera, anio: r.alumno.anio, habilidades: r.alumno.habilidades.map((h) => `${h.nombre} (nivel ${h.nivel}/3)`), experiencia: perfil?.experiencia, preferencias: perfil?.preferencias },
        proyecto: { nombre: r.proyecto.nombre, busca: r.proyecto.buscadas.map((h) => h.nombre), integrantes: r.proyecto.integrantes.map((i) => ({ carrera: i.carrera, habilidades: i.habilidades.map((h) => h.nombre) })) },
        puntaje: r.puntaje,
        criterios: Object.fromEntries(Object.entries(r.valores).map(([k, v]) => [criterios[k as keyof typeof criterios], v === null ? "sin datos" : `${Math.round(v * 100)}%`])),
        cubre_lo_que_falta: r.cubre.map((h) => h.nombre),
        alertas: r.alertas,
        justificacion_del_motor: r.justificacion,
      }, null, 2),
    });
    redaccion = text.trim();
  } catch (e) {
    volver(formData, "error", `La IA no respondió (${e instanceof Error ? e.message : "error"}). La justificación del motor sigue disponible.`);
  }

  const { error } = await supabase
    .from("austral_recomendaciones")
    .upsert({ persona_id: personaId, proyecto_id: proyectoId, justificacion_ia: redaccion, puntaje: r.puntaje, justificacion: r.justificacion }, { onConflict: "persona_id,proyecto_id", ignoreDuplicates: false });
  if (error) throw error;
  volver(formData, "ok", "Justificación redactada con IA.");
}
