"use server";
// GRUPO AUSTRAL — acciones del matching. Todas son solo para el admin.
// El agente nunca suma a nadie solo: aceptar crea una propuesta y recién "Confirmar" agrega al alumno al equipo.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generateText } from "ai";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cargarMatching, hayIA } from "./_datos";
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

  const supabase = await createClient();
  const { error } = await supabase.from("austral_matching_config").update({ ...pesos, puntaje_minimo: minimo, updated_at: new Date().toISOString() }).eq("id", true);
  if (error) throw error;
  volver(formData, "ok", "Ponderación guardada: los puntajes ya se recalcularon.");
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
    if (previa?.estado !== "aceptada" && resultado.proyecto.vacantes <= 0) volver(formData, "error", "El proyecto ya no tiene lugares libres.");
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

  // Si el equipo llegó al tamaño buscado, deja de buscar.
  const [{ count }, { data: necesidad }] = await Promise.all([
    supabase.from("proyecto_integrantes").select("persona_id", { count: "exact", head: true }).eq("proyecto_id", rec.proyecto_id),
    supabase.from("austral_proyecto_necesidades").select("integrantes_necesarios").eq("proyecto_id", rec.proyecto_id).maybeSingle(),
  ]);
  if (necesidad && (count ?? 0) >= necesidad.integrantes_necesarios) {
    await supabase.from("austral_proyecto_necesidades").update({ estado: "completo" }).eq("proyecto_id", rec.proyecto_id);
  }
  // Ya no es un alumno sin grupo, así que su página de recomendación no tiene sentido: vuelve al panel.
  formData.set("volver", "/austral/matching");
  volver(formData, "ok", "Asignación confirmada: el alumno ya es parte del equipo.");
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
