# Preparación manual de jurados

## Problema

Cuando no está configurada la generación con IA, el administrador necesita preparar y aprobar material introductorio para los jurados. La información debe explicar contexto y problemática y reservar la solución para la exposición.

## Recorrido local

Contraseña de las cuentas de prueba: `austral123`.

1. Entrar con `admin@austral.edu.ar` y abrir Austral → Preparación de jurados.
2. Elegir un evento y un proyecto de sus salones. El enlace **Preparar ficha** está disponible aunque no exista material.
3. Pulsar **Preparar ficha manualmente**. Se crea un borrador sin sobrescribir una ficha existente.
4. Completar sector, contexto, problemática y guion con información validada del equipo. La pantalla identifica el material preparado manualmente.
5. Guardar, revisar y aprobar. La aprobación exige contexto, problemática y guion.
6. Entrar con `julio@empresa.com` y abrir Preparación. El jurado ve únicamente materiales aprobados de los proyectos habilitados por sus permisos. El botón Escuchar utiliza la voz del navegador.

El borrador utiliza las tablas y políticas ya existentes. No necesita una migración ni una clave de IA. La generación automática sigue disponible cuando se configura; sin clave, su botón está deshabilitado y se explica la alternativa manual.

## Validación

El recorrido de crear y aprobar una ficha manual de AgroSense se probó en la demo local, y se verificó el acceso del jurado a material aprobado de su salón. Las pruebas locales usan información identificada como demostración y no validan datos de proyectos reales.

```powershell
npm run typecheck
npm run lint
npm run build
```

La compilación normal debe pasar en CI antes de integrar. El entorno local de Windows presentó fallos internos de Turbopack al procesar CSS; el servidor de desarrollo permitió verificar el recorrido.
