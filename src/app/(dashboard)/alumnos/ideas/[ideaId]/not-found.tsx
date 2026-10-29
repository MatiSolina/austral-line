// GRUPO ALUMNOS — idea que no existe o link mal copiado.
import Link from "next/link";

export default function IdeaNoEncontrada() {
  return (
    <div className="max-w-xl border bg-card p-8">
      <h1 className="mb-2 font-serif text-2xl">No encontramos esa idea</h1>
      <p className="text-sm text-[#666]">Puede que el link esté mal copiado o que la idea ya no esté en el banco.</p>
      <Link href="/alumnos/ideas" className="mt-4 inline-block text-sm underline underline-offset-4 hover:text-primary">Volver al banco de ideas</Link>
    </div>
  );
}
