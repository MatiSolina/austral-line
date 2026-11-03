import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FormularioPresentacion, ReproducirAudio, SubirAudio } from "./_components/formularios";
import { guardarResumen, publicarPerfil, retirarPerfil, valorarPerfil } from "./actions";

const bucket = "austral-audios-mentores";
const boton = "inline-flex min-h-9 items-center border px-4 text-sm hover:bg-muted disabled:opacity-40";

export default async function PerfilesMentores() {
  const usuario = await requireRol("alumno", "mentor");
  const supabase = await createClient();
  const [personasResult, contactosResult, perfilesResult, escuchasResult, valoracionesResult] = await Promise.all([
    supabase.from("personas").select("id, nombre, rol").eq("rol", "mentor").order("nombre"),
    supabase.from("austral_contactos_mentores").select("mentor_id, industria, especialidades, publicado, modalidad"),
    supabase.from("austral_perfiles_mentores").select("mentor_id, trayectoria, intereses, cv_url, linkedin_url, resumen, audio_path, autoriza_audio, estado, actualizado_at"),
    usuario.rol === "admin" ? supabase.from("austral_perfiles_escuchas").select("mentor_id") : Promise.resolve({ data: [], error: null }),
    usuario.rol === "admin" ? supabase.from("austral_perfiles_valoraciones").select("mentor_id, puntaje") : Promise.resolve({ data: [], error: null }),
  ]);
  for (const resultado of [personasResult, contactosResult, perfilesResult, escuchasResult, valoracionesResult]) {
    if (resultado.error) throw resultado.error;
  }
  const mentores = personasResult.data ?? [];
  const contactos = new Map((contactosResult.data ?? []).map((item) => [item.mentor_id, item]));
  const perfiles = new Map((perfilesResult.data ?? []).map((item) => [item.mentor_id, item]));
  const escuchas = escuchasResult.data ?? [];
  const valoraciones = valoracionesResult.data ?? [];
  const audioUrls = new Map<string, string>();
  await Promise.all((perfilesResult.data ?? []).filter((p) => p.audio_path && (usuario.rol !== "alumno" || p.autoriza_audio))
    .map(async (perfil) => {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(perfil.audio_path!, 60 * 60);
      if (data?.signedUrl) audioUrls.set(perfil.mentor_id, data.signedUrl);
    }));

  if (usuario.rol === "mentor") {
    const perfil = perfiles.get(usuario.id) ?? null;
    const contacto = contactos.get(usuario.id);
    return <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase text-[#666]">Austral / Mentores</p>
        <h1 className="font-serif text-2xl">Mi presentación</h1>
        <p className="max-w-2xl text-sm text-[#666]">Compartí únicamente lo que quieras mostrar a los alumnos. Austral revisa el texto y el audio antes de publicarlos. Cada cambio vuelve a revisión.</p>
        <p className="text-sm">Estado: {perfil?.estado === "publicado" ? "Publicado" : perfil ? "Pendiente de revisión" : "Sin completar"}</p>
      </header>
      <section className="space-y-2 border-y py-5 text-sm">
        <h2 className="font-serif text-xl">Industria y especialidades</h2>
        <p>{contacto?.industria || "Industria pendiente"} · {contacto?.especialidades.join(", ") || "Especialidades pendientes"}</p>
        <p className="text-[#666]">Estas etiquetas se toman de tu perfil de contacto.</p>
        <Link href="/austral/contacto-mentores" className="underline underline-offset-4">Editar contacto y etiquetas</Link>
      </section>
      <section className="space-y-4">
        <h2 className="font-serif text-xl">Tu audio de presentación</h2>
        {audioUrls.get(usuario.id) && <audio controls preload="none" src={audioUrls.get(usuario.id)} className="max-w-full" />}
        <SubirAudio />
        {perfil?.audio_path && !perfil.autoriza_audio && <p className="text-sm text-[#666]">El audio está guardado, pero todavía no autorizaste su publicación.</p>}
      </section>
      <section className="space-y-4">
        <h2 className="font-serif text-xl">Información para tu perfil</h2>
        <FormularioPresentacion perfil={perfil} />
      </section>
    </div>;
  }

  if (usuario.rol === "alumno") {
    const visibles = mentores.filter((mentor) => perfiles.has(mentor.id));
    return <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase text-[#666]">Austral / Alumnos</p>
        <h1 className="font-serif text-2xl">Conocé a los mentores</h1>
        <p className="text-sm text-[#666]">Presentaciones revisadas y autorizadas para tu equipo.</p>
      </header>
      {visibles.length === 0 && <p className="border-y py-8 text-sm text-[#666]">Todavía no hay presentaciones disponibles para tu equipo.</p>}
      <div className="grid gap-5 lg:grid-cols-2">{visibles.map((mentor) => {
        const perfil = perfiles.get(mentor.id)!;
        const contacto = contactos.get(mentor.id);
        return <article key={mentor.id} className="space-y-4 border p-5">
          <div>
            <h2 className="font-serif text-xl">{mentor.nombre}</h2>
            <p className="text-sm text-[#666]">{contacto?.industria} · {contacto?.especialidades.join(", ")}</p>
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed">{perfil.resumen}</p>
          <div className="flex flex-wrap gap-4 text-sm">
            {perfil.cv_url && <a href={perfil.cv_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Ver CV</a>}
            {perfil.linkedin_url && <a href={perfil.linkedin_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">LinkedIn</a>}
          </div>
          {perfil.autoriza_audio && audioUrls.get(mentor.id) && <div className="space-y-2">
            <p className="text-sm">Escuchar presentación</p>
            <ReproducirAudio mentorId={mentor.id} url={audioUrls.get(mentor.id)!} />
          </div>}
          <form action={valorarPerfil} className="flex flex-wrap items-end gap-3 border-t pt-4 text-sm">
            <input type="hidden" name="mentor_id" value={mentor.id} />
            <label>¿Te ayudó a conocer al mentor?
              <select className="ml-2 border bg-background px-2 py-1" name="puntaje" defaultValue="3">
                {[1, 2, 3, 4, 5].map((numero) => <option key={numero} value={numero}>{numero} / 5</option>)}
              </select>
            </label>
            <button className={boton}>Enviar opinión</button>
          </form>
        </article>;
      })}</div>
    </div>;
  }

  const completos = mentores.filter((mentor) => {
    const contacto = contactos.get(mentor.id);
    const perfil = perfiles.get(mentor.id);
    return contacto?.publicado && contacto.industria && contacto.especialidades.length &&
      perfil?.estado === "publicado" && perfil.trayectoria && perfil.resumen && perfil.cv_url && perfil.linkedin_url;
  }).length;
  const conAudio = mentores.filter((mentor) => {
    const perfil = perfiles.get(mentor.id);
    return perfil?.estado === "publicado" && perfil.autoriza_audio && perfil.audio_path;
  }).length;
  const promedio = valoraciones.length
    ? (valoraciones.reduce((total, item) => total + item.puntaje, 0) / valoraciones.length).toFixed(1)
    : "—";
  return <div className="space-y-9">
    <header className="space-y-2">
      <p className="text-xs font-medium uppercase text-[#666]">Austral / Administración</p>
      <h1 className="font-serif text-2xl">Presentaciones de mentores</h1>
      <p className="max-w-3xl text-sm text-[#666]">Revisá los datos escritos por el mentor y el audio antes de publicar. El perfil toma industria y especialidades del directorio de contacto.</p>
    </header>
    <section className="grid gap-4 border-y py-5 sm:grid-cols-4">
      {[
        [`${completos} / ${mentores.length}`, "perfiles completos antes de selección"],
        [`${conAudio} / ${mentores.length}`, "perfiles con audio"],
        [String(escuchas.length), "reproducciones"],
        [promedio, "satisfacción promedio (sobre 5)"],
      ].map(([numero, texto]) => <div key={texto}><p className="font-serif text-2xl">{numero}</p><p className="text-xs text-[#666]">{texto}</p></div>)}
    </section>
    <div className="space-y-6">{mentores.map((mentor) => {
      const perfil = perfiles.get(mentor.id);
      const contacto = contactos.get(mentor.id);
      const faltanTags = !contacto?.industria || !contacto.especialidades.length;
      const listo = !!(perfil?.resumen.trim() && perfil.trayectoria.trim() && contacto?.publicado && !faltanTags);
      const audio = audioUrls.get(mentor.id);
      return <section key={mentor.id} className="space-y-4 border p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><h2 className="font-serif text-xl">{mentor.nombre}</h2>
            <p className="text-sm text-[#666]">{contacto?.industria || "Industria pendiente"} · {contacto?.especialidades.join(", ") || "Especialidades pendientes"}</p></div>
          <span className="text-sm">{perfil?.estado === "publicado" ? "Publicado" : perfil ? "Para revisar" : "Sin presentación"}</span>
        </div>
        {faltanTags && <p className="text-sm text-destructive">Faltan etiquetas de industria o especialidad en el contacto del mentor.</p>}
        {perfil && (!perfil.cv_url || !perfil.linkedin_url) && <p className="text-sm text-[#666]">Presentación incompleta: falta el enlace al CV o a LinkedIn.</p>}
        {perfil?.audio_path && !perfil.autoriza_audio && <p className="text-sm text-destructive">El mentor todavía no autorizó publicar el audio.</p>}
        {perfil && <>
          <div className="grid gap-4 text-sm md:grid-cols-2">
            <div><p className="font-medium">Trayectoria</p><p className="whitespace-pre-line text-[#666]">{perfil.trayectoria || "Sin cargar"}</p></div>
            <div><p className="font-medium">Intereses</p><p className="whitespace-pre-line text-[#666]">{perfil.intereses || "Sin cargar"}</p></div>
          </div>
          <div className="flex gap-4 text-sm">
            {perfil.cv_url && <a href={perfil.cv_url} target="_blank" rel="noopener noreferrer" className="underline">Ver CV</a>}
            {perfil.linkedin_url && <a href={perfil.linkedin_url} target="_blank" rel="noopener noreferrer" className="underline">LinkedIn</a>}
          </div>
          {audio && <audio controls preload="none" src={audio} className="max-w-full" />}
          <form action={guardarResumen} className="space-y-2">
            <input type="hidden" name="mentor_id" value={mentor.id} />
            <label className="block text-sm" htmlFor={`resumen-${mentor.id}`}>Resumen para alumnos (revisado por Austral)</label>
            <textarea id={`resumen-${mentor.id}`} name="resumen" maxLength={800} defaultValue={perfil.resumen}
              className="min-h-24 w-full max-w-2xl border bg-background p-3 text-sm" />
            <div><button className={boton}>Guardar resumen</button></div>
          </form>
          <div className="flex flex-wrap gap-2">
            {perfil.estado === "publicado" ? <form action={retirarPerfil}><input type="hidden" name="mentor_id" value={mentor.id} /><button className={boton}>Retirar publicación</button></form>
              : <form action={publicarPerfil}><input type="hidden" name="mentor_id" value={mentor.id} /><button className={boton} disabled={!listo}>Publicar perfil</button></form>}
            {!listo && <p className="self-center text-xs text-[#666]">Completá el resumen y las etiquetas para publicar. El audio solo aparece si el mentor lo autorizó.</p>}
          </div>
        </>}
      </section>;
    })}</div>
  </div>;
}
