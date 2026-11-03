// GRUPO AUSTRAL — barras horizontales de una sola serie: nombre, barra proporcional y valor (mismo estilo que el panel
// de profesores del grupo Alumnos).
export function Barras({ filas, unidad, vacio = "Sin datos todavía." }: { filas: { nombre: string; valor: number }[]; unidad: string; vacio?: string }) {
  if (!filas.length || filas.every((f) => f.valor === 0)) return <p className="text-sm text-[#666]">{vacio}</p>;
  const max = Math.max(1, ...filas.map((f) => f.valor));
  return (
    <ul className="grid gap-2">
      {filas.map((f) => (
        <li key={f.nombre} className="grid grid-cols-[minmax(0,11rem)_1fr_2.5rem] items-center gap-3 text-sm" title={`${f.nombre}: ${f.valor} ${unidad}`}>
          <span className="truncate">{f.nombre}</span>
          <span className="h-2 bg-muted">
            <span className="block h-2 bg-primary" style={{ width: `${(f.valor / max) * 100}%` }} />
          </span>
          <span className="text-right text-[#666]">{f.valor}</span>
        </li>
      ))}
    </ul>
  );
}
