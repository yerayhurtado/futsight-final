# Cómo integrar el agente de scouting en otro proyecto web

Tienes **tres formas** de usar este agente desde otra aplicación (React, Vue, Next.js, Django, etc.).

---

## 1. Llamar a la API REST (recomendado para frontends)

El agente se ejecuta como servidor y tu otra web lo llama por HTTP.

### Arrancar la API

En esta carpeta (`futsigh_agent`):

```bash
pip install fastapi uvicorn
uvicorn api:app --host 0.0.0.0 --port 8000
```

- Documentación interactiva: **http://localhost:8000/docs**
- Endpoint: **POST http://localhost:8000/buscar**

### Contrato del endpoint

**Request**

```http
POST /buscar
Content-Type: application/json

{"query": "Extremo joven con regate y gol"}
```

**Response (200)**

```json
{
  "player_ids": [12345, 67890, ...],
  "explicacion": "Se encontraron jugadores que coinciden con...",
  "basado_en": "posición fw, perfil Extremo, edad máxima 23...",
  "recomendacion": "Prioriza según presupuesto...",
  "orden": "Ordenados por rendimiento por 90 min.",
  "filtros_relajados": ""
}
```

Si no hay resultados, `player_ids` va vacío y puede venir `error` con un mensaje.

### Ejemplo desde tu frontend (JavaScript/TypeScript)

```javascript
const response = await fetch('http://localhost:8000/buscar', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'Delantero goleador de La Liga' }),
});
const data = await response.json();

if (data.player_ids?.length) {
  // Mostrar tarjetas: usa data.player_ids para pedir datos de jugadores
  // a tu backend o CSV; opcionalmente muestra data.explicacion, data.recomendacion, etc.
  console.log('IDs:', data.player_ids);
  console.log('Análisis:', data.explicacion);
} else {
  console.warn(data.error || 'Sin resultados');
}
```

### CORS

La API tiene CORS abierto (`allow_origins=["*"]`). En producción conviene restringir `allow_origins` a los dominios de tu web.

### Datos de jugadores (fotos, nombre, equipo…)

La API incluye un endpoint para obtener los datos de los jugadores por ID, así tu web puede pintar las tarjetas sin tocar el CSV:

**GET /jugadores?ids=12345,67890,...**

Respuesta:

```json
{
  "jugadores": [
    {
      "PlayerID": 12345,
      "Player": "Nombre",
      "Squad": "Equipo",
      "League": "Liga",
      "Nation": "País",
      "Pos": "FW",
      "Age": 22,
      "Gls": 10,
      "Ast": 5,
      "Won": 30,
      "Min": 2000,
      "xG": 8.5,
      "KP": 20,
      "SoT": 25,
      "market_value_in_eur": 15000000,
      "Pos_Main": "fw",
      "Perfil_Principal": "Extremo",
      "strCutout": "https://..."
    }
  ]
}
```

Flujo típico en tu frontend:

1. **POST /buscar** con la query → recibes `player_ids` y el análisis.
2. **GET /jugadores?ids=** con esos IDs (unidos por coma) → recibes nombre, foto, equipo, estadísticas.
3. Renderizas las tarjetas con esos datos.

---

## 2. Usar el agente desde Python (mismo proceso)

Si tu otro proyecto es en **Python** (Django, Flask, otro FastAPI, script…), puedes importar y llamar al agente directamente.

### Requisitos

- Tener en el mismo entorno (o en el `PYTHONPATH`) la carpeta del agente, con su `main.py`, `utils/`, y el CSV en `data/jugadores_con_cutout.csv`.
- Dependencias instaladas: `langchain-ollama`, `langgraph`, `pandas`, etc. (las que uses en este proyecto).
- Ollama en marcha con el modelo que use el agente (p. ej. `llama3`).

### Código

```python
import json
from main import buscar_jugadores

result = buscar_jugadores("Extremo joven con regate y gol")
# result es el estado completo del grafo

response_json = result.get("response", "{}")
data = json.loads(response_json)

ids = data.get("player_ids", [])
explicacion = data.get("explicacion", "")
recomendacion = data.get("recomendacion", "")
# ... etc.
```

Así obtienes el mismo JSON que devuelve la API (`player_ids`, `explicacion`, `basado_en`, `recomendacion`, `orden`, `filtros_relajados`). En tu Django/Flask puedes devolver ese JSON en una vista o usarlo para rellenar tu propia base o respuestas.

---

## 3. Montar esta API dentro de tu backend

Si tu otro proyecto ya tiene un servidor (p. ej. FastAPI o Flask), puedes:

- **FastAPI:** Incluir los routers de `api.py` en tu app con `app.include_router(...)` o copiar el endpoint `POST /buscar` a tu app y dentro llamar a `buscar_jugadores(query)`.
- **Flask:** Crear una ruta que reciba el JSON, llame a `buscar_jugadores(query)` y devuelva el mismo formato que la API.

En todos los casos, el “contrato” es: entrada `query`, salida el objeto con `player_ids` y los campos de análisis anteriores.

---

## Resumen

| Tu proyecto              | Cómo integrar                                                                 |
|-------------------------|-------------------------------------------------------------------------------|
| React / Vue / Next / etc. | Arrancar `uvicorn api:app` y hacer `POST /buscar` desde el frontend.        |
| Django / Flask / FastAPI  | Llamar a `buscar_jugadores(query)` desde una vista y devolver el JSON.      |
| Cualquier otro lenguaje  | Consumir la API REST (opción 1).                                             |

Si quieres que la API también devuelva datos de jugadores (nombre, foto, equipo) por IDs, se puede añadir un endpoint extra que lea el CSV y responda con esas filas.
