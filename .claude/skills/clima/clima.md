---

name: clima
description: Consulta el clima actual y el pronóstico de Rionegro, Antioquia (ubicación por defecto) o de otra ciudad concreta usando wttr.in desde la terminal. Usar cuando el usuario pregunte por el clima, el tiempo, la temperatura, si va a llover, o invoque /clima. Acepta opcionalmente una ciudad como argumento.
argument-hint: "[ciudad] [pronostico]"
allowed-tools: Bash(curl:*)
---

# Clima

Obtiene el clima con `curl` contra https://wttr.in. No necesita API key. Ubicación por defecto: **Rionegro, Antioquia, Colombia**.

## Argumentos

`$ARGUMENTS` puede traer:
- Una ciudad (ej. `Medellin`, `Bogota`, `"New York"`). Espacios se reemplazan por `+` en la URL.
- La palabra `pronostico` (o `pronóstico`) para pedir los próximos 3 días.
- Nada: clima actual de Rionegro, Antioquia.

## Pasos

1. Construir `LUGAR`: la ciudad de `$ARGUMENTS` con espacios cambiados por `+`; si no hay ciudad, usar siempre `LUGAR="Rionegro+Antioquia+Colombia"`. Nunca dejarlo vacío (eso usaría la IP del usuario).
2. **Clima actual** (siempre):

   ```bash
   curl -s --max-time 10 "https://wttr.in/${LUGAR}?format=%l:+%c+%C,+%t+(sensación+%f),+humedad+%h,+viento+%w,+lluvia+%p&lang=es&m"
   ```
3. **Pronóstico** (solo si el usuario lo pide o pregunta por mañana/próximos días, o si va a llover): pedir JSON y leer `weather[]` (3 días) con `maxtempC`, `mintempC`, y en `hourly[]` los campos `chanceofrain` y `lang_es[0].value`:

   ```bash
   curl -s --max-time 10 "https://wttr.in/${LUGAR}?format=j1&lang=es"
   ```

   Para no volcar el JSON entero, filtrar con `python3 -c` o `jq` si está instalado. Ejemplo con python3:

   ```bash
   curl -s --max-time 10 "https://wttr.in/${LUGAR}?format=j1&lang=es" | python3 -c '
   import json,sys
   d=json.load(sys.stdin)
   for w in d["weather"]:
       lluvia=max(int(h["chanceofrain"]) for h in w["hourly"])
       desc=w["hourly"][4]["lang_es"][0]["value"]
       print(w["date"] + ":", w["mintempC"] + "°C –", w["maxtempC"] + "°C,", desc + ", lluvia máx", str(lluvia) + "%")
   '
   ```

## Respuesta

- Responder en español, breve: ubicación, condición, temperatura, sensación térmica, humedad, viento y, si aplica, pronóstico por día.
- Para otra ciudad, el usuario puede usar `/clima <ciudad>`.

## Errores

- Salida vacía o timeout: wttr.in caído o sin red. Reintentar una vez; si falla, informar al usuario.
- Respuesta tipo `Unknown location`: ciudad no encontrada; pedir otro nombre (sin tildes o en inglés suele funcionar).