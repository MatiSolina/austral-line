# Presentación y audio de mentores

## Recorrido

1. Entrar como `marta@empresa.com` (contraseña local `austral123`). En Presentación de mentores, completar trayectoria, intereses y enlaces. Subir un audio de hasta 10 MB y autorizar su publicación.
2. Entrar como `admin@austral.edu.ar`. Revisar el perfil y escuchar el audio. Preparar el resumen y publicar el perfil cuando corresponda. El contacto del mentor debe estar publicado y tener industria y especialidades.
3. Entrar como `ana@alumnos.austral.edu.ar`. Ver el perfil si su equipo está habilitado por el directorio y escuchar la presentación autorizada. Las métricas cuentan alumnos por mentor que iniciaron la reproducción.

Cada modificación del mentor vuelve a revisión. El audio y el contacto conservan sus permisos. El archivo se entrega mediante una ruta autenticada que comprueba los permisos y genera el enlace de reproducción al solicitarlo, evitando que una pestaña abierta conserve un enlace vencido.

La subida comprueba extensión, tamaño y cabecera del archivo antes de registrarlo para revisión. Las cabeceras permiten detectar archivos vacíos o texto renombrado; no garantizan que un audio esté íntegro ni sustituyen la escucha del administrador. Formatos: MP3, M4A, WAV y WebM.

## Validación

```powershell
node --test 'src/app/(dashboard)/austral/perfiles-mentores/_tests/audio.test.mjs'
npm run typecheck
npm run lint
npm run build
```

Estas mejoras reutilizan las tablas y permisos de este PR. No crean un segundo sistema de perfiles. Las pruebas de cabeceras cubren formatos válidos, vacíos, texto renombrado y discrepancias de formato.
