// GRUPO JURADO — agente "Resumen del pitch para jurados" (diseñado en IA Lab).
// Rol: con la presentación final y la transcripción de la sesión grabada del pitch de UN equipo, arma un resumen para
// leer o escuchar, así el jurado llega informado a la evaluación final. No evalúa ni puntúa.
// 1. Antes de usar IA controla el material: que estén los dos archivos, que se puedan abrir y que el equipo esté en un
//    salón del evento. Si algo falla, frena y deja el reporte (equipo, error, archivos recibidos) para el responsable.
// 2. Redacta el resumen con un tope de palabras para que el salón entero se escuche en menos de 15 minutos.
// 3. Un segundo paso lo revisa (que no evalúe, que no invente, que hable de este equipo). Si algo no cierra, queda
//    "con aviso" en vez de "para revisar". Nada le llega a los jurados sin la aprobación del admin.
// Permisos mínimos: corre con la sesión del admin, solo lee los archivos adjuntados y solo escribe jurado_resumenes
// (y, cuando frena, el registro de la alerta que les manda a los admins).
import { generateText, jsonSchema, Output, type FilePart, type TextPart } from "ai";
import { BUCKET, contarPalabras, duracion, tipos, type Supabase } from "../_resumenes";
import { cargarEvento, type Archivo, type Equipo } from "./datos";
import { alertarAdmins } from "./envios";

const MODELO = "anthropic/claude-sonnet-5.5";
const MAX_CARACTERES_TRANSCRIPCION = 150_000; // ~2 horas de sesión
const MIN_CARACTERES_TRANSCRIPCION = 300; // menos que esto no es una sesión transcripta
// Si el gateway se cuelga, cortamos y el catch muestra "La IA no respondió" en vez de dejar "Generando…" para siempre.
const TOPE_IA_MS = 120_000;
// Costo: cada clic manda el PDF y la transcripción dos veces (redactar y revisar). Por eso regenerar pide confirmación.

export const hayIA = () => !!(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);

type Redaccion = { material_del_equipo: boolean; suficiente: boolean; texto: string; aviso: string };

const schemaRedaccion = jsonSchema<Redaccion>({
  type: "object",
  properties: {
    material_del_equipo: {
      type: "boolean",
      description: "true si la presentación y la transcripción corresponden a este equipo y proyecto. false si son de otro, o si este equipo no aparece en la transcripción.",
    },
    suficiente: { type: "boolean", description: "true si el material alcanza para contar de qué trató el pitch." },
    texto: { type: "string", description: "El resumen, listo para leer en voz alta. Vacío si material_del_equipo es false." },
    aviso: {
      type: "string",
      description: "Vacío si está todo bien. Si no: qué falta, qué no coincide o qué se contradice entre la presentación y la sesión, y qué tendría que revisar el admin.",
    },
  },
  required: ["material_del_equipo", "suficiente", "texto", "aviso"],
  additionalProperties: false,
});

const instruccionesRedaccion = (maximo: number) => `Sos el agente "Resumen del pitch para jurados" del concurso de Emprendimientos de la Universidad Austral.
Antes de la evaluación final, cada jurado recibe un resumen de cada equipo de su salón para llegar informado. Lo puede leer o escuchar (una voz lo lee en voz alta).

Tu material: la presentación final del pitch (PDF) y la transcripción de la sesión grabada del pitch de UN equipo, más los datos del proyecto cargados en la app.
- Si la transcripción incluye a otros equipos, usá solo la parte de este equipo.
- Si la presentación o la transcripción son de otro proyecto, o este equipo no aparece en la transcripción, poné "material_del_equipo" en false, dejá "texto" vacío y explicá en "aviso" qué encontraste.

Qué contar, en este orden y solo si aparece en el material: nombre del proyecto y del equipo; el problema y a quién afecta; la solución que proponen; el mercado y el cliente; el modelo de negocio; la tracción, métricas o validaciones; y las preguntas o temas importantes que surgieron en la sesión.

Reglas:
- NO evalúes: nada de notas, puntajes, rankings ni comparaciones con otros equipos. Nada de adjetivos que valoren el proyecto (innovador, sólido, prometedor, débil, etc.) ni recomendaciones. El jurado decide.
- Usá SOLO lo que está en el material. No inventes datos, cifras ni nombres. Si la presentación y la sesión se contradicen, contá lo que dice cada una sin elegir, y avisalo en "aviso".
- Máximo ${maximo} palabras (unos ${duracion(maximo)} leído en voz alta). Es un tope, no un objetivo.
- Se va a escuchar: oraciones cortas, sin viñetas, títulos, emojis, tablas ni links. Escribí los números como se dicen cuando ayude ("tres pilotos", "40 por ciento").
- Español rioplatense neutro y profesional, claro para alguien que no conoce el sector.
- Empezá diciendo el nombre del proyecto. No saludes ni te despidas.`;

type Revision = { correcto: boolean; problemas: string[] };

const schemaRevision = jsonSchema<Revision>({
  type: "object",
  properties: {
    correcto: { type: "boolean", description: "true si el resumen cumple todas las reglas." },
    problemas: { type: "array", items: { type: "string" }, description: "Cada problema encontrado, en una oración concreta. Vacío si está todo bien." },
  },
  required: ["correcto", "problemas"],
  additionalProperties: false,
});

const instruccionesRevision = `Revisás el resumen del pitch de un equipo del concurso de Emprendimientos de la Universidad Austral, antes de que lo vea el admin. Tenés los datos del proyecto, el material original (presentación y transcripción de la sesión) y el resumen generado.
Marcá como problema cualquiera de estas cosas:
- Evalúa: pone notas o puntajes, compara con otros equipos, valora el proyecto (innovador, sólido, débil, etc.) o recomienda mejoras.
- Afirma algo que no está en el material (datos, cifras, nombres) o presenta una suposición como hecho.
- Habla de otro equipo o mezcla información de otros equipos de la sesión.
- Omite algo central del pitch que sí está en el material (el problema, la solución o el cliente).
- Tiene formato que no se puede leer en voz alta (viñetas, títulos, links, tablas).
Sé estricto con lo evaluativo y con lo inventado; no marques cuestiones de estilo menores. Respondé en español.`;

export type Resultado = { ok: boolean; mensaje: string };

// Reporte de escalamiento del documento de IA Lab: equipo, error específico y archivos recibidos hasta el momento.
const reporte = (equipo: Equipo, errores: string[]) =>
  [
    `Equipo: ${equipo.nombre} (${equipo.salon.nombre}).`,
    ...errores.map((e) => `Error: ${e}`),
    `Archivos recibidos: ${equipo.archivos.length ? equipo.archivos.map((a) => `${a.nombre} (${tipos[a.tipo].titulo.toLowerCase()})`).join(", ") : "ninguno"}.`,
  ].join("\n");

// Baja un archivo y verifica que se pueda leer: los PDF vuelven como bytes y las transcripciones como texto.
// Si no sirve, vuelve `error` con el motivo, para el reporte.
async function leer(supabase: Supabase, archivo: Archivo): Promise<{ error?: string; bytes?: Uint8Array; texto?: string }> {
  const { data, error } = await supabase.storage.from(BUCKET).download(archivo.ruta);
  if (error || !data) return { error: `no se pudo abrir "${archivo.nombre}". Volvé a subirlo.` };
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (archivo.mime === "application/pdf") {
    const cabecera = new TextDecoder().decode(bytes.slice(0, 5));
    return cabecera === "%PDF-" ? { bytes } : { error: `"${archivo.nombre}" no es un PDF válido o está dañado.` };
  }
  const texto = new TextDecoder("utf-8").decode(bytes);
  if (texto.includes("\u0000") || (texto.match(/�/g)?.length ?? 0) > 20) {
    return { error: `"${archivo.nombre}" no es un archivo de texto legible (¿se subió un Word o un video?). Exportá la transcripción como .txt, .vtt o .srt.` };
  }
  if (texto.trim().length < MIN_CARACTERES_TRANSCRIPCION) return { error: `"${archivo.nombre}" está casi vacío: no parece la transcripción de una sesión.` };
  return { texto: texto.slice(0, MAX_CARACTERES_TRANSCRIPCION) };
}

// Genera (o rehace) el resumen de un equipo. Si estaba aprobado, vuelve a revisión hasta que el admin lo apruebe de nuevo.
// Si frena, el texto que había queda intacto (solo cambian el estado, el reporte y los archivos).
export async function generarResumen(supabase: Supabase, eventoId: string, proyectoId: string, adminId: string): Promise<Resultado> {
  const [datos, proyecto] = await Promise.all([
    cargarEvento(supabase, eventoId),
    supabase.from("proyectos").select("nombre, descripcion, proyecto_integrantes(personas(nombre))").eq("id", proyectoId).maybeSingle(),
  ]);
  if (proyecto.error) throw proyecto.error;
  if (!datos || !proyecto.data) return { ok: false, mensaje: "No encontramos el evento o el proyecto." };
  const equipo = datos.equipos.find((q) => q.id === proyectoId);
  if (!equipo) return { ok: false, mensaje: `${proyecto.data.nombre} no está en ningún salón de ${datos.evento.nombre}. Asignalo desde Salones.` };

  // Sin `texto` (cuando el agente frena) no se toca el resumen que ya había: el admin no pierde lo que corrigió.
  // El upsert solo pisa las columnas que manda.
  const guardar = async (campos: { estado: "borrador" | "revisar"; texto?: string; aviso: string | null }) => {
    const { error } = await supabase.from("jurado_resumenes").upsert(
      {
        evento_id: eventoId,
        proyecto_id: proyectoId,
        ...(campos.texto !== undefined && { texto: campos.texto.trim() || null, palabras: contarPalabras(campos.texto) }),
        estado: campos.estado,
        aviso: campos.aviso,
        archivos: equipo.archivos.map((a) => a.id),
        generado_por: adminId,
        generado_at: new Date().toISOString(),
        aprobado_por: null,
        aprobado_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "evento_id,proyecto_id" },
    );
    if (error) throw error;
  };
  const frenar = async (errores: string[]) => {
    const texto = reporte(equipo, errores);
    await guardar({ estado: "revisar", aviso: texto });
    const avisado = await alertarAdmins(supabase, datos.evento, equipo, texto);
    const motivo = errores.length === 1 ? errores[0] : `${errores.length} problemas`;
    return {
      ok: false,
      mensaje: `${equipo.nombre}: el agente frenó (${motivo}). Quedó el reporte en el panel; el texto anterior se conserva.${avisado ? " Se avisó por mail a los admins." : ""}`,
    };
  };

  // 1. Controles sin IA: material completo y legible.
  const faltan = (["presentacion", "transcripcion"] as const).filter((t) => !equipo[t]).map((t) => `falta la ${tipos[t].titulo.toLowerCase()}.`);
  if (faltan.length) return frenar(faltan);
  const [presentacion, transcripcion] = await Promise.all([leer(supabase, equipo.presentacion!), leer(supabase, equipo.transcripcion!)]);
  const ilegibles = [presentacion, transcripcion].flatMap((r) => (r.error ? [r.error] : []));
  if (ilegibles.length) return frenar(ilegibles);
  if (!hayIA()) return { ok: false, mensaje: "Falta configurar AI_GATEWAY_API_KEY (pedísela al profe): sin eso no se puede generar el resumen." };

  // 2. Redacción.
  const p = proyecto.data;
  const contexto = {
    proyecto: p.nombre,
    equipo: p.proyecto_integrantes.map((i) => i.personas.nombre),
    descripcion_cargada_en_la_app: p.descripcion,
    evento: datos.evento.nombre,
  };
  const material: (TextPart | FilePart)[] = [
    { type: "text", text: `Presentación final ("${equipo.presentacion!.nombre}"):` },
    { type: "file", data: presentacion.bytes!, mediaType: "application/pdf", filename: equipo.presentacion!.nombre },
    { type: "text", text: `Transcripción de la sesión grabada ("${equipo.transcripcion!.nombre}"):\n\n${transcripcion.texto}` },
  ];

  let redaccion: Redaccion;
  let revision: Revision;
  try {
    ({ output: redaccion } = await generateText({
      model: MODELO,
      instructions: instruccionesRedaccion(equipo.maximo),
      output: Output.object({ schema: schemaRedaccion }),
      abortSignal: AbortSignal.timeout(TOPE_IA_MS),
      messages: [{ role: "user", content: [{ type: "text", text: `Datos del proyecto en la app:\n${JSON.stringify(contexto, null, 2)}` }, ...material] }],
    }));
    if (!redaccion.material_del_equipo) {
      return frenar([`el material no coincide con el equipo. ${redaccion.aviso.trim()}`.trim()]);
    }
    ({ output: revision } = await generateText({
      model: MODELO,
      instructions: instruccionesRevision,
      output: Output.object({ schema: schemaRevision }),
      abortSignal: AbortSignal.timeout(TOPE_IA_MS),
      messages: [{
        role: "user",
        content: [
          { type: "text", text: `Datos del proyecto en la app:\n${JSON.stringify(contexto, null, 2)}` },
          ...material,
          { type: "text", text: `Resumen a revisar:\n\n${redaccion.texto}` },
        ],
      }],
    }));
  } catch (e) {
    return { ok: false, mensaje: `La IA no respondió (${e instanceof Error ? e.message : "error desconocido"}). Probá de nuevo en un rato.` };
  }

  // 3. Controles finales: el tope de tiempo se mide acá, no se le cree al modelo.
  const palabras = contarPalabras(redaccion.texto);
  const avisos = [
    redaccion.aviso.trim(),
    !redaccion.suficiente && !redaccion.aviso.trim() ? "El agente no encontró información suficiente para resumir el pitch." : "",
    palabras > equipo.maximo * 1.1
      ? `Se pasa del tiempo: ${duracion(palabras)} contra ${duracion(equipo.maximo)} por equipo para que ${equipo.salon.nombre} no supere los 15 minutos. Recortalo antes de aprobar.`
      : "",
    ...(revision.correcto ? [] : revision.problemas.map((x) => `Revisión: ${x.trim()}`)),
  ].filter(Boolean);

  await guardar({ estado: avisos.length ? "revisar" : "borrador", texto: redaccion.texto, aviso: avisos.join("\n") || null });
  return avisos.length
    ? { ok: false, mensaje: `${equipo.nombre}: el resumen quedó con aviso. Revisalo antes de aprobarlo.` }
    : { ok: true, mensaje: `${equipo.nombre}: resumen listo para revisar y aprobar (${duracion(palabras)}).` };
}
