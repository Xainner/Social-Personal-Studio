# Social Persona Studio

<p align="center">
  <img src="logo.png" alt="Social Persona Studio" width="200" />
</p>

Aplicación de escritorio local-first para generar publicaciones de redes
sociales para múltiples personas editoriales. Elegís una persona, subís
imágenes y contexto, y recibís 5 conceptos diferenciados con variante para X y
para Telegram.

## Requisitos

- Node.js 20+
- Rust (toolchain MSVC en Windows)

## Comandos

```bash
npm install          # instalar dependencias
npm run tauri dev    # modo desarrollo
npm test             # correr los tests
npm run tauri build  # generar el instalador
```

## Primer uso

1. **Ajustes → Proveedores de IA → Agregar**: cargá tu endpoint compatible con
   OpenAI (URL base `.../v1`, modelo y API key). Marcá "visión" si el modelo lee
   imágenes.
2. **Modelos por rol**: elegí el proveedor y modelo de escritura.
3. **Persona**: creala desde la barra lateral (identidad, estilo, reglas por
   plataforma).
4. **Sesión**: subí imágenes, escribí el contexto y generá.

## Estructura

```
src/            Frontend: ai/, platforms/, db/, features/, hooks/, stores/, types/
src-tauri/      Backend Rust: comandos (llavero, imágenes, respaldos) y migraciones SQL
```

## Decisiones

- Las API keys nunca tocan SQLite: van al Administrador de credenciales vía
  `keyring`.
- El texto de la IA no se pisa: las ediciones viven en `edited_text`.
- Nunca se trunca en silencio: si un post supera el límite de X, se reporta
  error y se pide corrección.
- Prompts versionados y máximo 2 reintentos ante JSON inválido.

## Estado

MVP en curso. Implementado: personas, sesiones, importación de imágenes con
dedupe por hash, motor de generación con visión y salida validada, adaptadores
de X y Telegram, posts con estados y anti-repetición, respaldo y restauración.

Fuera de alcance: publicación automática, programación, analytics, sync cloud.
