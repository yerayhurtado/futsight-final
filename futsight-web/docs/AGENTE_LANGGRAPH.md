# Integrar el agente de scouting

La web llama al agente por HTTP. La API de Next.js (`/api/agent`) hace por ti:

1. **POST** a `{AGENT_API_URL}/buscar` con la consulta del usuario.
2. Con los `player_ids` devueltos, **GET** a `{AGENT_API_URL}/jugadores?ids=...` para obtener los datos de las tarjetas.
3. Devuelve al frontend: jugadores + textos de análisis (explicación, criterios, recomendación, orden).

La base URL del agente (ej. `http://localhost:8000`) se configura con **AGENT_API_URL** en `.env.local`.

---

## ¿Local o en la nube?

| FutSight (web) | Agente | ¿Funciona? |
|----------------|--------|------------|
| **Local** | **Local** (puerto 8000) | ✅ `AGENT_API_URL=http://localhost:8000` |
| **Local** | **Nube** | ✅ `AGENT_API_URL=https://tu-agente.ejemplo.com` |
| **Nube** | **Local** | ❌ El servidor en la nube no puede llamar a tu `localhost`. |
| **Nube** | **Nube** | ✅ Misma URL pública en las variables de entorno. |

---

## Contrato del agente (tu backend)

Tu API debe exponer **dos endpoints**:

### 1) POST /buscar — Búsqueda en lenguaje natural

- **URL:** `{base}/buscar` (ej. `http://localhost:8000/buscar`)
- **Headers:** `Content-Type: application/json`
- **Body:** `{ "query": "Extremo joven con regate y gol" }`

**Respuesta (200) — JSON:**

```json
{
  "player_ids": [12345, 67890],
  "explicacion": "Se encontraron jugadores que...",
  "basado_en": "posición fw, perfil Extremo, edad máxima 23...",
  "recomendacion": "Prioriza según presupuesto...",
  "orden": "Ordenados por rendimiento por 90 min.",
  "filtros_relajados": ""
}
```

- Si no hay resultados: `player_ids` es `[]` y opcionalmente `"error": "mensaje"`.
- `filtros_relajados`: si se relajaron criterios, mensaje para el usuario.

### 2) GET /jugadores — Datos para las tarjetas

- **URL:** `{base}/jugadores?ids=12345,67890,...`
- **Query:** `ids` = los `player_ids` de POST /buscar, separados por coma.

**Respuesta (200) — JSON:**

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
      "Pos_Main": "fw",
      "Age": 22,
      "Gls": 10,
      "Ast": 5,
      "Won": 30,
      "Min": 2000,
      "xG": 8.5,
      "KP": 20,
      "SoT": 25,
      "market_value_in_eur": 15000000,
      "Perfil_Principal": "Extremo",
      "strCutout": "https://..."
    }
  ]
}
```

Cada jugador en el mismo orden que los IDs; campos opcionales pueden ser `null`. La web usa al menos: `strCutout`, `Player`, `Squad`, `League`, `Gls`, `Ast`, `Won`, `Age`, `market_value_in_eur`.

---

## Configurar la URL en FutSight

1. Crea `.env.local` en la raíz del proyecto (o copia `env.example`).
2. Añade la **base URL** del agente (sin barra final):

```bash
AGENT_API_URL=http://localhost:8000
```

Para producción:

```bash
AGENT_API_URL=https://tu-agente.up.railway.app
```

---

## Setup rápido en local

1. En el proyecto del **agente**:
   ```bash
   uvicorn api:app --host 0.0.0.0 --port 8000
   ```
2. En **FutSight**, `.env.local`:
   ```bash
   AGENT_API_URL=http://localhost:8000
   ```
3. Arranca la web:
   ```bash
   npm run dev
   ```
4. Abre la página **Agente**, escribe una búsqueda y pulsa Buscar.

---

## Comportamiento en este proyecto

- Si **no** defines `AGENT_API_URL` (ni `LANGGRAPH_AGENT_URL`), la página del Agente usa un filtro por keywords integrado (sin textos de análisis).
- Si la llamada a `/buscar` o `/jugadores` falla, se usa ese mismo fallback.
- Timeout: 60 segundos.
