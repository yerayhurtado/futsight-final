# Documentación: Agente de Scouting FutSigh

Este documento explica detalladamente el funcionamiento técnico y el proceso de creación del Agente de Scouting de Fútbol (FutSigh), diseñado para transformar búsquedas en lenguaje natural en recomendaciones precisas de jugadores basadas en datos estadísticos.

---

## 1. Funcionamiento del Agente

El agente opera bajo una arquitectura de **Grafo de Estado** (StateGraph) utilizando la librería **LangGraph**. A diferencia de un chatbot lineal, este sistema divide la tarea en nodos especializados que comparten un "estado" común.

### El Flujo de Trabajo (Pipeline)

El proceso desde que el usuario escribe una búsqueda hasta que recibe los resultados sigue este orden:

1.  **Nodo Analyzer (Análisis de Intención):**
    *   **LLM (Ollama):** Utiliza un modelo de lenguaje (por defecto `qwen2.5:7b`) para "leer" la consulta del usuario.
    *   **Extracción de Filtros:** Traduce conceptos como "joven promesa" en `max_age=23` o "goleador" en `min_goals=8`.
    *   **Fallback:** Si el LLM no está disponible, cuenta con un sistema de expresiones regulares (regex) y palabras clave para no interrumpir el servicio.

2.  **Nodo Search (Búsqueda y Puntuación):**
    *   **Motor de Datos:** Utiliza **Pandas** para filtrar una base de datos CSV con miles de registros históricos.
    *   **Normalización Estática:** Todas las métricas se calculan "por 90 minutos" para que la comparación entre un suplente eficiente y un titular fijo sea justa.
    *   **Relajación de Filtros:** Si una búsqueda es demasiado restrictiva (0 resultados), el agente inteligentemente "relaja" criterios (como el mínimo de minutos) para ofrecer las mejores alternativas posibles.
    *   **Scoring Contextual:** Los jugadores se ordenan mediante un algoritmo que prioriza diferentes métricas según la posición (ej: goles para delanteros, intercepciones para defensas).

3.  **Nodo Explain (Generación de Explicaciones):**
    *   Genera un resumen legible que explica por qué se eligieron esos jugadores y bajo qué criterios técnicos (basado_en).

4.  **Nodo Format (Serialización):**
    *   Empaqueta toda la información (IDs de jugadores, análisis y recomendaciones) en un formato JSON estandarizado listo para ser consumido por una API o interfaz web.

---

## 2. Creación y Desarrollo

La creación de este agente siguió un proceso de ingeniería centrado en la **precisión** y la **usabilidad**:

### Fase A: Definición del Estado (`state.py`)
Se definió un contrato de datos estricto (`AgentState`). Esto permite que cada nodo sepa exactamente qué información recibe y qué debe entregar, facilitando el mantenimiento y la escalabilidad del sistema.

### Fase B: Lógica de Análisis y Fallback (`nodes.py`)
Uno de los mayores retos fue la interpretación de la ambigüedad del lenguaje natural. Se implementó:
- **Prompt Engineering:** Instrucciones precisas al LLM para evitar que invente datos.
- **Fuzzy Matching:** Para que el agente entienda "La Liga", "España" o "Premier" indistintamente.

### Fase C: Algoritmo de Scouting (`nodes.py`)
No solo se buscaba filtrar, sino **ordenar**. Se desarrolló un sistema de scoring que tiene en cuenta:
- **Fiabilidad:** Penalización por falta de minutos.
- **Recencia:** Bonus para jugadores con datos en la temporada actual.
- **Tendencia de Mercado:** Capacidad de detectar si el valor de un jugador está al alza.

### Fase D: Interfaces de Integración
Para que el agente fuera útil, se crearon múltiples puntos de entrada:
- **CLI (`agent.py`):** Una consola interactiva para pruebas rápidas.
- **API REST (`api.py`):** Utilizando **FastAPI** con soporte para CORS, permitiendo que cualquier aplicación moderna (React, Next.js) consulte al agente.
- **Web App (`app_web.py`):** Una interfaz gráfica amigable para el usuario final.

---

## 3. Tecnologías Core

*   **Lenguaje:** Python 3.10+
*   **Orquestación AI:** LangChain & LangGraph.
*   **Procesamiento de Datos:** Pandas & NumPy.
*   **Inferencia Local:** Ollama (Privacidad de datos y bajo coste).
*   **Servidor API:** FastAPI & Uvicorn.

---
