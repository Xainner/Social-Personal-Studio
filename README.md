# Social Persona Studio

Aplicación de escritorio local-first para generar y gestionar publicaciones de
redes sociales para múltiples personas editoriales independientes.

Elegís una persona, subís imágenes y contexto, y recibís **exactamente 5
conceptos diferenciados**, cada uno con su variante para X y para Telegram.

## Requisitos

- Node.js 20+
- Rust (stable, toolchain MSVC en Windows)
- Visual Studio Build Tools con "Desktop development with C++"

## Comandos

```bash
npm install          # instalar dependencias
npm run tauri dev    # ejecutar en modo desarrollo
npm test             # correr los tests
npm run tauri build  # generar el instalador
```

## Primer uso

1. Abrí **Ajustes → Proveedores de IA → Agregar** y cargá tu endpoint
   compatible con OpenAI: URL base (`https://.../v1`), nombre del modelo y API
   key. Marcá "visión" si el modelo puede leer imágenes.
2. En **Modelos por rol**, elegí el proveedor y modelo de escritura.
3. Creá una **persona** desde la barra lateral y definí su identidad, ejemplos
   de estilo y reglas por plataforma.
4. Creá una **sesión**, subí imágenes, escribí el contexto y generá.

## Arquitectura

```
src/
├── ai/            Proveedores, prompts por capas, schemas y motor de generación
├── platforms/     Adaptadores de X y Telegram (reglas, validación, normalización)
├── db/            Cliente SQLite y repositorios tipados
├── features/      Vistas por dominio (composer, personas, posts, media, ajustes)
├── hooks/         Wrappers de TanStack Query sobre los repositorios
├── stores/        Estado efímero de UI (Zustand)
└── types/         Modelos de dominio y errores tipados

src-tauri/
├── src/           Comandos Rust: llavero, imágenes, respaldos
└── migrations/    Migraciones SQL versionadas
```

### Decisiones importantes

- **Las API keys nunca tocan SQLite.** Se guardan en el Administrador de
  credenciales de Windows (o Keychain / Secret Service) vía el crate `keyring`.
  La base solo guarda una referencia.
- **El texto original de la IA no se pisa.** Las ediciones del usuario viven en
  `edited_text`, separadas de `generated_text`.
- **Nunca se trunca en silencio.** Si un post supera el límite de X, se reporta
  como error y se pide corrección al modelo.
- **Los prompts están versionados** (`post-generation-v1`) y cada generación
  registra qué versión usó, para poder depurar regresiones.
- **La reparación tiene tope.** Como máximo 2 reintentos ante JSON inválido,
  nunca un bucle infinito.

## Estado

MVP en curso. Implementado: personas con identidad/ejemplos/memoria/reglas,
sesiones, importación de imágenes con deduplicación por hash, motor de
generación con visión y salida estructurada validada, adaptadores de X y
Telegram, publicaciones guardadas con estados y anti-repetición, respaldo y
restauración.

Fuera de alcance por ahora: publicación automática, programación de posts,
analytics, sincronización en la nube.
