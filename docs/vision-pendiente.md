# Pendiente: soporte de visión en el endpoint de IA

> **Estado:** bloqueado del lado del servidor. La aplicación ya está preparada y
> degrada con gracia, pero las imágenes no alimentan el texto hasta que exista
> un modelo multimodal disponible.

## Resumen

La aplicación puede enviar imágenes al modelo para que las publicaciones
respondan al contenido visual. Hoy eso no funciona porque **ningún modelo del
endpoint acepta imágenes**, y el problema es peor que un simple "no soportado":
el servidor **no devuelve error, deja la petición colgada indefinidamente**.

## Qué necesita la aplicación

Una petición estándar de visión del protocolo OpenAI: el campo `content` del
mensaje como arreglo, con un bloque de texto y uno o más bloques `image_url`
cuyo `url` es un data URL en base64.

```jsonc
POST /v1/chat/completions
{
  "model": "<modelo-multimodal>",
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "Describi esta imagen..." },
        { "type": "image_url", "image_url": { "url": "data:image/png;base64,iVBOR..." } }
      ]
    }
  ],
  "temperature": 0.2
}
```

La respuesta esperada es un `chat.completion` normal. La app pide que el
contenido sea JSON con este esquema:

```json
{
  "scene": "", "mood": "", "clothing": "", "environment": "",
  "objects": [], "colors": [], "activities": [],
  "confidence": "low | medium | high"
}
```

## Qué pasa hoy

Prueba realizada el 2026-08-19 contra `https://api.xainner.net/v1`, enviando una
imagen PNG mínima (1x1 píxel, ~70 bytes en base64) con un tope de espera de 45
segundos por modelo:

| Modelo | Resultado |
|---|---|
| `qwen3.8-27b` | Sin respuesta (>45 s) |
| `qwen3.6-27b` | Sin respuesta (>45 s) |
| `qwen3.6-27b-vllm` | Sin respuesta (>45 s) |
| `gemma-4-31b` | Sin respuesta (>45 s) |
| `gemma-4-12b-int8` | Sin respuesta (>45 s) |
| `deepseek-v4-flash` | Sin respuesta (>45 s) |
| `deckard-40b` | Sin respuesta (>45 s) |
| `qwen3.8-max` | HTTP 500 — `AuthenticationError: The api_key client option must be set` |

Con una imagen real (PNG de 377 KB, 472x644) contra `qwen3.8-27b`, la petición
siguió sin respuesta pasados **180 segundos**.

Los mismos modelos responden **normalmente en 1 a 3 segundos** cuando el
`content` es texto plano. El problema aparece únicamente al incluir un bloque
`image_url`.

## Cómo reproducirlo

```bash
curl -X POST https://api.xainner.net/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  --max-time 60 \
  -d '{
    "model": "qwen3.8-27b",
    "max_tokens": 10,
    "messages": [{
      "role": "user",
      "content": [
        { "type": "text", "text": "Responde solo: OK" },
        { "type": "image_url", "image_url": { "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" } }
      ]
    }
  }' 
```

Comparar con la misma petición usando `"content": "Responde solo: OK"` (texto
plano), que sí responde.

## Qué haría falta del lado del servidor

Cualquiera de estas opciones desbloquea la funcionalidad:

1. **Publicar un modelo multimodal** en el proxy (por ejemplo Qwen-VL, Gemma
   multimodal, LLaVA o similar) y avisar su nombre exacto para configurarlo en
   la app como *modelo de visión*.
2. **Enrutar un modelo cloud con visión** a través del mismo proxy, para no
   tener que cargar un segundo proveedor en la aplicación.
3. Como mínimo, **hacer que los modelos sin visión devuelvan un error** en vez
   de quedarse colgados. Un HTTP 400 con un mensaje claro es mucho más fácil de
   diagnosticar que un timeout, tanto para esta app como para cualquier otro
   cliente.

Aparte, `qwen3.8-max` está publicado pero inutilizable: le falta la API key del
proveedor upstream.

## Mitigación ya aplicada en la aplicación

No hace falta esperar al servidor para usar la app:

- El análisis de imágenes tiene un tope propio de **60 segundos**, separado del
  timeout de escritura (300 s).
- Si la visión falla o no responde, **la generación continúa** usando el
  contexto escrito, en vez de abortar.
- Se muestra un aviso indicando que las imágenes quedaron afuera y sugiriendo
  desmarcar *visión* en Ajustes.
- Las imágenes se siguen guardando, deduplicando y organizando en la biblioteca;
  solo no alimentan el texto.

**Mientras tanto:** desmarcá la casilla *visión* al configurar el proveedor, así
la app no pierde 60 segundos por imagen antes de cada generación.

## Alternativa sin tocar el servidor

La app permite un proveedor distinto para escritura y para visión (Ajustes →
*Modelos por rol*). Se puede dejar la escritura en el endpoint local y agregar
un proveedor cloud con visión únicamente para el análisis de imágenes.
