# Prospectiva LinkTic

Aplicativo para la actividad de prospectiva estratégica de LinkTic. Los
participantes responden tres preguntas desde su celular y los resultados se
visualizan en vivo en un mapa de ideas que agrupa las respuestas similares.

## Ventanas (acceso solo por URL directa)

| Ruta | Contenido |
|---|---|
| `/pregunta-1` | ¿En qué somos buenos? |
| `/pregunta-2` | ¿Qué nos guía? |
| `/pregunta-3` | ¿Cuáles son nuestros dolores? |
| `/resultados` | Mapa de ideas + tablas por pregunta (se actualiza cada 10 s) |

Cada ventana de pregunta pide primero el nombre del participante y luego
permite registrar respuestas de máximo 50 caracteres, solo letras (sin números
ni caracteres especiales), siempre en mayúsculas. Se pueden registrar varias
respuestas por persona.

## Base de datos (Supabase)

Tabla `public.respuestas_prospectiva`:

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | bigint identity | autoincremental |
| `nombre` | text | quien registra (1–80 caracteres) |
| `respuesta` | text | la respuesta (1–50 caracteres) |
| `categoria` | text | `pregunta_1` \| `pregunta_2` \| `pregunta_3` |

RLS habilitado: el rol `anon` (clave publishable) solo puede insertar y leer.

## Desarrollo

```bash
pnpm install
pnpm dev
```

Requiere `.env.local` con:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

## Estructura

- `src/app/pregunta-{1,2,3}/page.tsx` — rutas de las preguntas
- `src/app/resultados/page.tsx` — ruta de resultados
- `src/components/QuestionFlow.tsx` — flujo nombre → pregunta → guardado
- `src/components/ResultsBoard.tsx` — indicadores, mapa de ideas y tablas
- `src/lib/clustering.ts` — agrupación de respuestas similares (acentos, plurales, artículos, errores de tipeo)
- `src/lib/preguntas.ts` — definición de preguntas y colores
- `src/lib/supabase.ts` — cliente de Supabase
