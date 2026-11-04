// GRUPO AUSTRAL — ponderación del motor de matching: cuánto pesa cada criterio y el puntaje mínimo para recomendar.
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Label } from "@/components/ui/label";
import { BotonEnviar } from "../../_components/boton-enviar";
import { campoClase, Encabezado } from "../_components/encabezado";
import { criterios, type Pesos } from "../_motor";
import { guardarPesos } from "../acciones";

const ayuda: Record<keyof Pesos, string> = {
  habilidades: "Cuánto coinciden sus habilidades con las que busca el proyecto (según nivel).",
  complementariedad: "Qué parte de lo que el equipo busca y todavía no tiene cubre el alumno.",
  intereses: "Cuánto le interesan los temas que más le importan al grupo.",
  formacion: "Si su carrera se relaciona con lo que falta, y si suma una carrera nueva al equipo.",
  disponibilidad: "Franjas horarias en común y modalidad compatible.",
  equilibrio: "Si su perfil hace más parejo el reparto de diseño, tecnología, negocios y operaciones.",
};

export default async function PesosMatching({ searchParams }: PageProps<"/austral/matching/pesos">) {
  await requireRol(); // solo admin
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const { data: c, error: e } = await supabase.from("austral_matching_config").select("*").single();
  if (e) throw e;
  const actuales: Record<keyof Pesos, number> = {
    habilidades: c.peso_habilidades,
    complementariedad: c.peso_complementariedad,
    intereses: c.peso_intereses,
    formacion: c.peso_formacion,
    disponibilidad: c.peso_disponibilidad,
    equilibrio: c.peso_equilibrio,
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Encabezado
        titulo="Ponderación"
        descripcion="Cuánto pesa cada criterio en el puntaje de compatibilidad (0 a 100). Los pesos tienen que sumar 100."
        actual="/austral/matching/pesos"
        ok={ok}
        error={error}
      />
      <form action={guardarPesos} className="mt-8 space-y-4">
        <input type="hidden" name="volver" value="/austral/matching/pesos" />
        {(Object.keys(criterios) as (keyof Pesos)[]).map((k) => (
          <div key={k} className="grid grid-cols-[1fr_6rem] items-center gap-4 border-b pb-4">
            <div>
              <Label htmlFor={k}>{criterios[k]}</Label>
              <p className="text-xs text-[#666]">{ayuda[k]}</p>
            </div>
            <input id={k} name={k} type="number" min={0} max={100} defaultValue={actuales[k]} className={campoClase} />
          </div>
        ))}
        <div className="grid grid-cols-[1fr_6rem] items-center gap-4">
          <div>
            <Label htmlFor="puntaje_minimo">Puntaje mínimo para recomendar</Label>
            <p className="text-xs text-[#666]">Debajo de este puntaje el agente no recomienda y avisa que no hay candidatos suficientes.</p>
          </div>
          <input id="puntaje_minimo" name="puntaje_minimo" type="number" min={0} max={100} defaultValue={c.puntaje_minimo} className={campoClase} />
        </div>
        <div className="pt-4">
          <BotonEnviar enviando="Guardando…">Guardar ponderación</BotonEnviar>
        </div>
      </form>
    </div>
  );
}
