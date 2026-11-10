import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ mentorId: string }> }) {
  const usuario = await requireRol("alumno", "mentor");
  const { mentorId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mentorId)) return new Response("Audio no disponible", { status: 404 });
  const supabase = await createClient();
  const { data: perfil, error } = await supabase.from("austral_perfiles_mentores")
    .select("audio_path, autoriza_audio").eq("mentor_id", mentorId).maybeSingle();
  if (error || !perfil?.audio_path || (usuario.rol === "alumno" && !perfil.autoriza_audio)) {
    return new Response("Audio no disponible", { status: 404 });
  }
  const { data, error: firmaError } = await supabase.storage.from("austral-audios-mentores").createSignedUrl(perfil.audio_path, 60);
  if (firmaError) return new Response("Audio no disponible", { status: 404 });
  return new Response(null, { status: 302, headers: { Location: data.signedUrl, "Cache-Control": "private, no-store" } });
}
