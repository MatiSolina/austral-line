import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FormularioNecesidades, FormularioQuitarTitular, FormularioSugerencia, FormularioTitular } from "./_components/formularios";

const etapaNombre: Record<string, string> = {
  idea: "Idea", prototipo: "Prototipo", validacion: "Validación", crecimiento: "Crecimiento",
};

export default async function Compatibilidad() {
  await requireRol("admin");
  const supabase = await createClient();
  const [proyectosResult, personasResult, contactosResult, vinculosResult, titularesResult,
    revisionesResult, puntajesResult, decisionesResult, documentosResult, satisfaccionResult] = await Promise.all([
    supabase.from("proyectos").select("id, nombre, descripcion, estado").order("nombre"),
    supabase.from("personas").select("id, nombre").eq("rol", "mentor"),
    supabase.from("austral_contactos_mentores").select("mentor_id, industria, especialidades, modalidad, publicado, acepta_consultas_otros"),
    supabase.from("austral_vinculos_mentor_proyecto").select("proyecto_id, mentor_id"),
    supabase.from("austral_titulares_proyecto").select("proyecto_id, mentor_id"),
    supabase.from("austral_necesidades_revision").select("id, proyecto_id, etapa, sector, necesidades, contexto, created_at")
      .order("created_at", { ascending: false }).order("id", { ascending: false }),
    supabase.from("austral_compatibilidades").select("revision_id, proyecto_id, mentor_id, porcentaje, coincidencias, faltantes, calculado_at"),
    supabase.from("austral_recomendaciones_sesion").select("revision_id, proyecto_id, mentor_id, estado"),
    supabase.from("austral_documentos").select("proyecto_id, created_at"),
    supabase.from("austral_satisfaccion_mentoria").select("proyecto_id, puntaje, comentario"),
  ]);
  for (const resultado of [proyectosResult, personasResult, contactosResult, vinculosResult, titularesResult,
    revisionesResult, puntajesResult, decisionesResult, documentosResult, satisfaccionResult]) {
    if (resultado.error) throw resultado.error;
  }
  const proyectos = proyectosResult.data ?? [];
  const mentores = personasResult.data ?? [];
  const contactos = contactosResult.data ?? [];
  const vinculos = vinculosResult.data ?? [];
  const titulares = new Map((titularesResult.data ?? []).map((t) => [t.proyecto_id, t.mentor_id]));
  const revisiones = revisionesResult.data ?? [];
  const puntajes = puntajesResult.data ?? [];
  const decisiones = decisionesResult.data ?? [];
  const documentos = documentosResult.data ?? [];
  const satisfaccion = satisfaccionResult.data ?? [];
  const nombreMentor = new Map(mentores.map((m) => [m.id, m.nombre]));
  const contactoMentor = new Map(contactos.map((c) => [c.mentor_id, c]));
  const revisionesPorProyecto = new Map<string, typeof revisiones>();
  for (const revision of revisiones) {
    const actual = revisionesPorProyecto.get(revision.proyecto_id) ?? [];
    actual.push(revision);
    revisionesPorProyecto.set(revision.proyecto_id, actual);
  }
  const puntajePorClave = new Map(puntajes.map((p) => [`${p.revision_id}:${p.mentor_id}`, p]));
  const decisionPorClave = new Map(decisiones.map((d) => [`${d.revision_id}:${d.mentor_id}`, d.estado]));
  const conRevision = proyectos.filter((p) => revisionesPorProyecto.has(p.id)).length;
  const ultimoPorProyecto = proyectos.map((p) => revisionesPorProyecto.get(p.id)?.[0]).filter((r) => !!r);
  const esperados = ultimoPorProyecto.length * contactos.length;
  const calculados = ultimoPorProyecto.reduce((total, revision) =>
    total + puntajes.filter((p) => p.revision_id === revision.id && contactoMentor.has(p.mentor_id)).length, 0);
  const consideradas = decisiones.filter((d) => d.estado === "considerada").length;
  const promedio = satisfaccion.length
    ? (satisfaccion.reduce((total, s) => total + s.puntaje, 0) / satisfaccion.length).toFixed(1)
    : "—";

  return <div className="space-y-9">
    <header className="space-y-2">
      <p className="text-xs font-medium uppercase text-[#666]">Austral / Administración</p>
      <h1 className="font-serif text-2xl">Compatibilidad mentor–proyecto</h1>
      <p className="max-w-3xl text-sm text-[#666]">Registrá cómo evolucionan las necesidades de cada equipo. El porcentaje compara etiquetas de especialidad y sector; es una orientación para sugerir consultas puntuales. No cambia al mentor titular ni asigna mentores automáticamente.</p>
      <p className="text-xs text-[#666]">Fórmula: necesidades coincidentes 80 % y sector 20 %. Si no se indica sector, las necesidades pesan 100 %. Coincidencia exacta sin distinguir mayúsculas.</p>
    </header>
    <section className="grid gap-4 border-y py-5 sm:grid-cols-4">
      {[
        [`${conRevision} / ${proyectos.length}`, "proyectos con seguimiento"],
        [esperados ? `${Math.round(100 * calculados / esperados)} %` : "—", "coincidencias actualizadas"],
        [decisiones.length ? `${Math.round(100 * consideradas / decisiones.length)} %` : "—", "sugerencias consideradas"],
        [promedio, "satisfacción de equipos (sobre 5)"],
      ].map(([numero, texto]) => <div key={texto}>
        <p className="font-serif text-2xl">{numero}</p><p className="text-xs text-[#666]">{texto}</p>
      </div>)}
    </section>
    <div className="space-y-8">{proyectos.map((proyecto) => {
      const [actual, anterior] = revisionesPorProyecto.get(proyecto.id) ?? [];
      const titularId = titulares.get(proyecto.id);
      const titular = titularId && actual ? puntajePorClave.get(`${actual.id}:${titularId}`) : undefined;
      const titularAntes = titularId && anterior ? puntajePorClave.get(`${anterior.id}:${titularId}`) : undefined;
      const vinculados = vinculos.filter((v) => v.proyecto_id === proyecto.id)
        .map((v) => ({ id: v.mentor_id, nombre: nombreMentor.get(v.mentor_id) ?? "Mentor" }));
      const alertas: string[] = [];
      const nuevosDocumentos = documentos.filter((d) => d.proyecto_id === proyecto.id &&
        (!actual || new Date(d.created_at) > new Date(actual.created_at))).length;
      if (nuevosDocumentos) alertas.push(`${nuevosDocumentos} documento(s) nuevo(s) desde la última revisión: comprobá si cambiaron las necesidades.`);
      if (actual && anterior && (actual.etapa !== anterior.etapa || actual.sector !== anterior.sector ||
        actual.necesidades.map((n) => n.toLocaleLowerCase("es")).sort().join("|") !==
        anterior.necesidades.map((n) => n.toLocaleLowerCase("es")).sort().join("|"))) {
        alertas.push("La etapa, el sector o las necesidades cambiaron desde la revisión anterior.");
      }
      if (titular && titularAntes && titularAntes.porcentaje - titular.porcentaje >= 20) {
        alertas.push(`La coincidencia del titular bajó ${titularAntes.porcentaje - titular.porcentaje} puntos. Revisá si necesita apoyo de un mentor de sesión.`);
      }
      const candidatos = actual ? contactos.filter((c) => c.mentor_id !== titularId && c.publicado &&
        ["consulta", "ambas"].includes(c.modalidad) &&
        (c.acepta_consultas_otros || vinculos.some((v) => v.proyecto_id === proyecto.id && v.mentor_id === c.mentor_id)))
        .map((c) => ({ contacto: c, puntaje: puntajePorClave.get(`${actual.id}:${c.mentor_id}`) }))
        .filter((item) => !!item.puntaje && item.puntaje.porcentaje >= 60)
        .sort((a, b) => b.puntaje!.porcentaje - a.puntaje!.porcentaje).slice(0, 3) : [];
      if (titular && candidatos.some((c) => c.puntaje!.porcentaje >= titular.porcentaje + 25)) {
        alertas.push("Hay un mentor de sesión con una coincidencia bastante mayor para las necesidades actuales. Considerá una consulta específica; el titular se mantiene.");
      }
      const notas = satisfaccion.filter((s) => s.proyecto_id === proyecto.id);
      return <section key={proyecto.id} className="space-y-6 border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-serif text-xl">{proyecto.nombre}</h2>
            <p className="text-sm text-[#666]">{proyecto.descripcion || "Sin descripción"}</p></div>
          <p className="text-xs text-[#666]">{actual ? `Última revisión: ${new Date(actual.created_at).toLocaleDateString("es-AR")}` : "Sin revisión de necesidades"}</p>
        </div>
        {alertas.length > 0 && <div className="space-y-1 border-y py-3 text-sm" role="status">
          <p className="font-medium">Atención del administrador</p>
          {alertas.map((alerta) => <p key={alerta}>• {alerta}</p>)}
        </div>}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 text-sm">
            <h3 className="font-serif text-lg">Necesidades actuales</h3>
            {actual ? <>
              <p>Etapa: {etapaNombre[actual.etapa]} · Sector: {actual.sector || "Sin indicar"}</p>
              <p>Especialidades buscadas: {actual.necesidades.join(", ")}</p>
              {actual.contexto && <p className="text-[#666]">{actual.contexto}</p>}
            </> : <p className="text-[#666]">Cargá la primera revisión para calcular coincidencias.</p>}
          </div>
          <div className="space-y-3 text-sm">
            <h3 className="font-serif text-lg">Mentor titular</h3>
            {titularId ? <>
              <p>{nombreMentor.get(titularId) ?? "Mentor"}</p>
              <p className="font-serif text-2xl">{titular ? `${titular.porcentaje} %` : "Sin datos para calcular"}</p>
              {titular && <p className="text-[#666]">Coincide en: {titular.coincidencias.join(", ") || "ninguna necesidad cargada"}. Falta cubrir: {titular.faltantes.join(", ") || "ninguna"}.</p>}
              <FormularioQuitarTitular proyectoId={proyecto.id} />
              {vinculados.length > 1 && <FormularioTitular proyectoId={proyecto.id} mentores={vinculados} actualId={titularId} />}
            </> : <>
              <p className="text-[#666]">Todavía no se registró un titular. Solo se puede seleccionar un mentor ya vinculado formalmente.</p>
              {vinculados.length ? <FormularioTitular proyectoId={proyecto.id} mentores={vinculados} />
                : <Link href="/austral/contacto-mentores" className="underline underline-offset-4">Registrar primero el vínculo formal</Link>}
            </>}
            {notas.length > 0 && <p className="text-xs text-[#666]">Satisfacción del equipo: {(notas.reduce((total, n) => total + n.puntaje, 0) / notas.length).toFixed(1)} / 5 ({notas.length} respuesta(s)).</p>}
            {notas.filter((n) => n.comentario).map((n, i) => <p key={i} className="border-l pl-3 text-xs text-[#666]">“{n.comentario}”</p>)}
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="font-serif text-lg">Mentores para consultas específicas</h3>
          {candidatos.length === 0 ? <p className="text-sm text-[#666]">No hay mentores disponibles con al menos 60 % de coincidencia en esta revisión.</p>
            : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{candidatos.map(({ contacto, puntaje }) => {
              const decision = decisionPorClave.get(`${actual!.id}:${contacto.mentor_id}`);
              return <article key={contacto.mentor_id} className="space-y-2 border p-4 text-sm">
                <div className="flex items-baseline justify-between gap-2"><p className="font-medium">{nombreMentor.get(contacto.mentor_id)}</p><p className="font-serif text-xl">{puntaje!.porcentaje} %</p></div>
                <p className="text-[#666]">Coincide: {puntaje!.coincidencias.join(", ") || "ninguna"}</p>
                <p className="text-[#666]">Falta: {puntaje!.faltantes.join(", ") || "ninguna"}</p>
                {decision && <p>Decisión administrativa: {decision === "considerada" ? "Considerar consulta" : "Descartada"}</p>}
                <div className="flex flex-wrap gap-2">
                  {(["considerada", "descartada"] as const).map((estado) =>
                    <FormularioSugerencia key={estado} proyectoId={proyecto.id} revisionId={actual!.id} mentorId={contacto.mentor_id} estado={estado} />)}
                </div>
              </article>;
            })}</div>}
          <p className="text-xs text-[#666]">Considerar una sugerencia no contacta ni asigna al mentor. El administrador valida cualquier paso posterior.</p>
        </div>
        <div className="space-y-3">
          <h3 className="font-serif text-lg">Actualizar seguimiento</h3>
          <FormularioNecesidades proyectoId={proyecto.id} actual={actual} />
        </div>
      </section>;
    })}</div>
  </div>;
}
