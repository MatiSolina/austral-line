import assert from "node:assert/strict";
import test from "node:test";
import { validarCabeceraAudio } from "../_audio.ts";

const bytes = text => new TextEncoder().encode(text);
test("reconoce las cabeceras de los cuatro formatos soportados", () => {
  assert.equal(validarCabeceraAudio("wav", bytes("RIFF0000WAVEfmt ")), true);
  assert.equal(validarCabeceraAudio("mp3", bytes("ID3demo")), true);
  assert.equal(validarCabeceraAudio("mp3", new Uint8Array([0xff, 0xfb, 0x90])), true);
  assert.equal(validarCabeceraAudio("m4a", bytes("0000ftypM4A ")), true);
  assert.equal(validarCabeceraAudio("webm", new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])), true);
});
test("rechaza archivos vacíos, texto renombrado y formatos diferentes", () => {
  for (const extension of ["wav", "mp3", "m4a", "webm"]) {
    assert.equal(validarCabeceraAudio(extension, new Uint8Array()), false);
    assert.equal(validarCabeceraAudio(extension, bytes("archivo de texto")), false);
  }
  assert.equal(validarCabeceraAudio("wav", bytes("ID3demo")), false);
  assert.equal(validarCabeceraAudio("ogg", bytes("OggS")), false);
});
