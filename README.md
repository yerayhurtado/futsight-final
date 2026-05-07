# ⚽ FutSight

FutSight es una plataforma avanzada de scouting de fútbol impulsada por Inteligencia Artificial. Permite a ojeadores, analistas y aficionados buscar jugadores utilizando lenguaje natural y predecir sus valores de mercado mediante modelos estadísticos y de Machine Learning.

## 🏗️ Arquitectura del Proyecto (Monorepo)

Este repositorio contiene todos los servicios necesarios para ejecutar la plataforma de FutSight en un entorno unificado:

- **`futsight-web/`**: El Frontend principal de la aplicación.
  - Desarrollado con **Next.js**, React y TailwindCSS.
  - Interfaz dinámica y responsiva para visualizar estadísticas de jugadores, reportes de scouting y valoraciones.
- **`futsight-web/prediction-service/`**: El Backend de Predicción.
  - Desarrollado con **Python y FastAPI**.
  - Encargado de predecir el valor de mercado de los jugadores utilizando modelos de Machine Learning.
- **`futsigh_agent/`**: El Agente de IA para Scouting.
  - Desarrollado con **Python, FastAPI, LangChain y LangGraph**.
  - Utiliza **Ollama** (modelos locales) para traducir búsquedas en lenguaje natural (ej. *"Extremo joven con regate y gol"*) en filtros estadísticos complejos, devolviendo recomendaciones precisas y justificadas.

---

## 🚀 Requisitos Previos

Asegúrate de tener instalado lo siguiente en tu sistema antes de iniciar:

1. **Node.js** (v18 o superior)
2. **Python** (v3.10 o superior)
3. **Ollama** (Instalado y en ejecución para el agente de IA local)

---

## 🛠️ Instalación

1. Clona el repositorio:
   ```bash
   git clone https://github.com/tu-usuario/futsight-final.git
   cd futsight-final
   ```

2. Instala las dependencias del frontend:
   ```bash
   cd futsight-web
   npm install
   ```

3. Instala las dependencias del agente (asegúrate de crear/activar tu entorno virtual):
   ```bash
   cd ../futsigh_agent
   python -m venv venv
   # En Windows:
   venv\Scripts\activate
   pip install -r requirements.txt
   ```

4. Instala las dependencias del servicio de predicción:
   ```bash
   cd ../futsight-web/prediction-service
   pip install -r requirements.txt
   ```

---

## 🐳 Ejecución con Docker (Recomendado)

Si tienes Docker instalado, puedes levantar todo el sistema con un solo comando sin preocuparte por las dependencias de Node.js o Python.

1. **Asegúrate de que Ollama esté corriendo** en tu máquina local (host).
2. En la raíz del proyecto, ejecuta:
   ```bash
   docker-compose up --build
   ```

Esto levantará:
- **Frontend**: `http://localhost:3000`
- **Agente IA**: `http://localhost:8000`
- **Servicio de Predicción**: `http://localhost:8001`

> [!TIP]
> El contenedor del agente está configurado para conectarse a Ollama en `host.docker.internal:11434`.

---

## 🧠 Características del Agente de IA (`futsigh_agent`)

El agente de scouting es el núcleo analítico de la plataforma. Está diseñado bajo una arquitectura de **Grafo de Estado**:
- **Procesamiento de Lenguaje Natural:** Entiende peticiones complejas gracias a modelos locales LLM.
- **Scoring Contextual:** Ordena a los jugadores priorizando diferentes métricas según la posición buscada.
- **Filtros Flexibles:** Si una búsqueda es demasiado restrictiva, el agente "relaja" inteligentemente los filtros para siempre ofrecer alternativas.

Para más detalles técnicos sobre el agente, consulta su [Documentación Técnica](futsigh_agent/EXPLICACION_AGENTE.md) o la [Guía de Integración](futsigh_agent/INTEGRACION.md).
