<p align="center">
  <img src="logo.png" alt="Social Persona Studio" width="320" />
</p>

<h1 align="center">Social Persona Studio</h1>

<p align="center">
  <b>Tu estudio de contenidos local, con una voz editorial propia por marca.</b><br/>
  Genera publicaciones para <b>X</b> y <b>Telegram</b> en la voz de cada persona,
  sin pelear contra plantillas genéricas.
</p>

<p align="center">
  <a href="#caracteristicas">Características</a> ·
  <a href="#como-funciona">Cómo funciona</a> ·
  <a href="#primeros-pasos">Primeros pasos</a> ·
  <a href="#desarrollo">Desarrollo</a> ·
  <a href="#arquitectura">Arquitectura</a>
</p>

<p align="center">
  <img alt="Rust" src="https://img.shields.io/badge/Rust-1.95-E05C44?logo=rust&logoColor=white&style=flat-square"/>
  <img alt="Tauri" src="https://img.shields.io/badge/Tauri-2-FFC131?logo=tauri&logoColor=white&style=flat-square"/>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white&style=flat-square"/>
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black&style=flat-square"/>
  <img alt="Vite" src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white&style=flat-square"/>
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind%20CSS-4-06B6D4?logo=tailwindcss&logoColor=white&style=flat-square"/>
  <img alt="SQLite" src="https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white&style=flat-square"/>
  <img alt="Privacidad local-first" src="https://img.shields.io/badge/Privacidad-local--first-4ade80?style=flat-square"/>
</p>

---

## Qué hace

Social Persona Studio es una aplicación de escritorio **local-first** para crear
contenido consistente en la voz de cada una de tus marcas o personajes
editoriales.

Dejás de copiar el mismo tono a mano: definís **la persona una vez** (cómo habla,
qué palabras usa, cuáles evita, su nivel de humor o formalidad, sus reglas por
plataforma) y la app genera propuestas que suenan a esa persona — no a un LLM
genérico.

Elegís una persona, subís imágenes y contexto, y recibís **5 conceptos
diferenciados**, cada uno con su variante lista para X y para Telegram.

## Características

- **Personas editoriales completas.** Identidad, ejemplos de estilo buenos y
  malos, memoria de estilo que evoluciona con el tiempo y reglas específicas por
  plataforma.
- **Generación con visión.** Subís imágenes y el modelo las analiza (escena,
  ambiente, objetos, colores) para que los posteos respondan de verdad al
  contenido.
- **Dos plataformas, dos naturalezas.** Adaptadores de X y Telegram que aplican
  sus reglas de extensión, tono y formato. Agregar otra plataforma es sumar una
  entrada al registro, no tocar el resto.
- **5 conceptos diferenciados.** No cinco sinónimos: conceptos realmente
  distintos, cada uno con razonamiento y variante por plataforma.
- **Salida estructurada y validada.** El resultado pasa por un esquema estricto
  (zod). Si el modelo no respeta el formato, se repara automáticamente — con un
  tope, nunca en bucle infinito.
- **Anti-repetición.** El motor recuerda tus posteos recientes y evita repetir
  ideas o ángulos.
- **Control total post-generación.** Ediciones del usuario separadas del texto
  original de la IA, reescritura individual de una variante y estados de
  publicación (borrador, guardado, usado, archivado).
- **Privacidad real.** Tus imágenes, personas, sesiones y posts viven en tu disco.
  Las API keys nunca tocan la base: se guardan en el administrador de
  credenciales del sistema (Keychain / Credential Manager vía `keyring`).
- **Respaldos y restauración.** Backup y restore de todo tu estudio con un clic.

## Cómo funciona

```
Imágenes + contexto ──► Visión (análisis) ──► Prompt por capas ──► Generación
                                                         │
                  Guardado ◄── 5 conceptos validados ◄── Validación + reparación
```

El pipeline completo (visión → armado de prompt → generación → validación →
reparación → guardado) corre localmente y registra qué versión de prompt y qué
modelo se usaron en cada generación.

## Primeros pasos

1. **Ajustes → Proveedores de IA → Agregar**: cargá un endpoint compatible con
   OpenAI (URL base `.../v1`, modelo y API key). Marcá *visión* si el modelo lee
   imágenes. También soporta Anthropic y Ollama.
2. **Modelos por rol**: elegí qué proveedor y modelo escribe y cuál analiza
   imágenes.
3. **Persona**: creala desde la barra lateral y definí identidad, estilo,
   memoria y reglas por plataforma.
4. **Sesión**: subí imágenes, escribí el contexto del contenido y generá.

## Desarrollo

**Requisitos:** Node.js 20+, Rust (toolchain MSVC en Windows).

```bash
npm install          # instalar dependencias
npm run tauri dev    # modo desarrollo (ventana nativa + HMR)
npm test             # correr los tests (Vitest)
npm run tauri build  # generar el instalador
```

## Arquitectura

```text
src/
├── ai/            Proveedores, prompts por capas, esquemas (zod) y motor de generación
├── platforms/     Adaptadores de X y Telegram (reglas, validación, normalización)
├── db/            Cliente SQLite y repositorios tipados
├── features/      Vistas por dominio (composer, personas, posts, media, ajustes)
├── hooks/         Wrappers de TanStack Query sobre los repositorios
├── stores/        Estado efímero de UI (Zustand)
└── types/         Modelos de dominio y errores tipados

src-tauri/
├── src/           Comandos Rust: llavero (keyring), imágenes, respaldos
└── migrations/    Migraciones SQL versionadas
```

**Pila:** Tauri 2 (Rust) · React 19 · TypeScript · Vite 7 · Tailwind CSS 4 ·
TanStack Query · Zustand · zod · SQLite.

## Decisiones de diseño

- **Las API keys nunca tocan SQLite.** Viven en el administrador de credenciales
  del sistema vía `keyring`; la base solo guarda una referencia.
- **El texto original de la IA no se pisa.** Las ediciones del usuario viven en
  `edited_text`, separadas del `generated_text`.
- **Nunca se trunca en silencio.** Si un post supera el límite de X, se reporta
  como error y se pide corrección al modelo.
- **Prompts versionados.** Cada generación registra la versión de prompt usada
  (`post-generation-v1`) para poder depurar regresiones.
- **Reparación con tope.** Máximo 2 reintentos ante JSON inválido.

## Estado

- ✔️ Personas (identidad, ejemplos, memoria, reglas por plataforma)
- ✔️ Sesiones con contexto
- ✔️ Importación de imágenes con deduplicación por hash
- ✔️ Motor de generación con visión y salida estructurada validada
- ✔️ Adaptadores de X y Telegram
- ✔️ Posts guardados con estados y anti-repetición
- ✔️ Respaldos y restauración

**Fuera de alcance por ahora:** publicación automática, programación de posts,
analytics y sincronización en la nube.

## Licencia

Privado — todos los derechos reservados.
