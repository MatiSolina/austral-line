// Verifica el formato real antes de registrar el audio para revisión.
export function validarCabeceraAudio(extension: string, cabecera: Uint8Array): boolean {
  const texto = new TextDecoder().decode(cabecera);
  if (extension === "wav") return texto.startsWith("RIFF") && texto.slice(8, 12) === "WAVE";
  if (extension === "mp3") return texto.startsWith("ID3") || (cabecera.length >= 2 && cabecera[0] === 0xff && (cabecera[1] & 0xe0) === 0xe0);
  if (extension === "m4a") return texto.slice(4, 8) === "ftyp";
  if (extension === "webm") return [0x1a, 0x45, 0xdf, 0xa3].every((byte, i) => cabecera[i] === byte);
  return false;
}
