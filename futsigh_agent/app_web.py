import streamlit as st
import json
import pandas as pd
from pathlib import Path
from io import StringIO
from agent import buscar_jugadores
from utils.nodes import _get_df

# _csv_path ya no es necesario para carga, se usa DB

st.set_page_config(page_title="IA Scouting Pro", layout="wide")

NUMERIC_COLS = ["Age", "Gls", "Ast", "Won", "Min", "market_value_in_eur", "xG", "KP", "SoT", "Tkl", "Int", "90s"]

@st.cache_data
def load_db_data():
    df, err = _get_df()
    if df is None:
        st.error(f"Error cargando base de datos: {err}")
        return pd.DataFrame()
    return df

df_web = load_db_data()


if "recent_queries" not in st.session_state:
    st.session_state["recent_queries"] = []
if "shortlist" not in st.session_state:
    st.session_state["shortlist"] = set()
if "comparador_ids" not in st.session_state:
    st.session_state["comparador_ids"] = []

# Plantillas de búsqueda (un clic)
PLANTILLAS = [
    ("Lateral tipo", "Lateral joven con proyección"),
    ("9 goleador", "Delantero goleador con goles"),
    ("Medio creativo", "Mediocentro con asistencias y pases clave"),
    ("Extremo desequilibrador", "Extremo joven con regate y gol"),
]
# Sugerencias para autocompletar / clic
SUGERENCIAS = ["delantero español", "extremo joven", "mediocentro con asistencias", "lateral", "goleador"]

st.title("⚽ Plataforma de Scouting con IA")
st.markdown("Describe el perfil del jugador en lenguaje natural. El agente devuelve IDs y la web muestra las tarjetas.")

with st.sidebar:
    st.subheader("⚙️ Opciones")
    st.caption("Orden y exportar se aplican a los resultados después de buscar.")
    st.subheader("📋 Mi shortlist")
    if st.session_state["shortlist"]:
        for pid in list(st.session_state["shortlist"])[:20]:
            sub = df_web[df_web["PlayerID"] == pid]
            nom = sub["Player"].iloc[0] if len(sub) else str(pid)
            if st.button(f"✕ {nom[:25]}", key=f"rm_short_{pid}"):
                st.session_state["shortlist"] = st.session_state["shortlist"] - {pid}
                st.rerun()
        if st.button("Vaciar shortlist"):
            st.session_state["shortlist"] = set()
            st.rerun()
        sl_df = df_web[df_web["PlayerID"].isin(st.session_state["shortlist"])].drop_duplicates("PlayerID", keep="first")
        if not sl_df.empty:
            csv_sl = sl_df[["Player", "Squad", "League", "Age", "Gls", "Ast", "Won", "Min", "market_value_in_eur"]].to_csv(index=False).encode("utf-8-sig")
            st.download_button("📥 Exportar shortlist CSV", data=csv_sl, file_name="mi_shortlist.csv", mime="text/csv", key="dl_shortlist")
    else:
        st.caption("Añade jugadores desde las tarjetas.")
    st.subheader("📊 Comparador (2-4 jugadores)")
    st.caption("Marca en las tarjetas «Añadir al comparador» y revisa la tabla comparativa.")

query = st.text_input("🔍 ¿A quién buscas?", placeholder="Ej: Extremo joven con regate y gol...", key="query_input")

st.caption("Plantillas:")
cols_plant = st.columns(len(PLANTILLAS))
for i, (label, q) in enumerate(PLANTILLAS):
    with cols_plant[i]:
        if st.button(label, key=f"plant_{i}"):
            st.session_state["query_input"] = q
            st.rerun()
col_sug = st.columns(len(SUGERENCIAS))
for i, sug in enumerate(SUGERENCIAS):
    with col_sug[i]:
        if st.button(sug[:22], key=f"sug_{i}"):
            st.session_state["query_input"] = sug
            st.rerun()

if st.session_state["recent_queries"]:
    st.caption("Búsquedas recientes:")
    cols_rec = st.columns(min(5, len(st.session_state["recent_queries"])))
    for i, q in enumerate(st.session_state["recent_queries"][:5]):
        with cols_rec[i]:
            if st.button(q[:22] + ("…" if len(q) > 22 else ""), key=f"recent_{i}"):
                st.session_state["query_input"] = q
                st.rerun()

if query:
    if query.strip() and query.strip() not in st.session_state["recent_queries"]:
        st.session_state["recent_queries"] = [query.strip()] + [q for q in st.session_state["recent_queries"] if q != query.strip()][:9]

    with st.spinner("Buscando jugadores..."):
        try:
            result = buscar_jugadores(query)
            data = json.loads(result.get("response", "{}"))
        except Exception as e:
            st.error(f"Error al conectar con el agente. ¿Tienes Ollama en marcha con el modelo llama3? Detalle: {e}")
            data = {"player_ids": [], "error": str(e)}

    ids_recibidos = data.get("player_ids", [])

    if ids_recibidos:
        # Aviso si se relajaron filtros
        if data.get("filtros_relajados"):
            st.warning("📌 " + data["filtros_relajados"])

        # Análisis del ojeador
        if data.get("explicacion") or data.get("basado_en") or data.get("recomendacion") or data.get("orden"):
            with st.expander("📊 Análisis del Ojeador", expanded=True):
                if data.get("explicacion"):
                    st.write(data["explicacion"])
                if data.get("basado_en"):
                    st.caption(f"**Criterios:** {data['basado_en']}")
                if data.get("orden"):
                    st.caption(f"**Orden:** {data['orden']}")
                if data.get("recomendacion"):
                    st.info(f"💡 **Recomendación:** {data['recomendacion']}")

        # Datos locales: una fila por jugador (temporada más reciente)
        df_filtrado = df_web[df_web["PlayerID"].isin(ids_recibidos)].copy()
        if "Season" in df_filtrado.columns:
            df_filtrado = df_filtrado.sort_values("Season", ascending=False)
        jugadores_encontrados = df_filtrado.groupby("PlayerID", as_index=False).first()
        jugadores_encontrados["PlayerID"] = pd.Categorical(
            jugadores_encontrados["PlayerID"], categories=ids_recibidos, ordered=True
        )
        jugadores_encontrados = jugadores_encontrados.sort_values("PlayerID")

        # Ordenar resultados
        sort_option = st.selectbox(
            "Ordenar por",
            ["Relevancia (del agente)", "Goles", "Asistencias", "Regates", "Valor de mercado", "Edad"],
            key="sort",
        )
        sort_col = {"Goles": "Gls", "Asistencias": "Ast", "Regates": "Won", "Valor de mercado": "market_value_in_eur", "Edad": "Age"}.get(sort_option)
        if sort_col and sort_col in jugadores_encontrados.columns:
            jugadores_encontrados = jugadores_encontrados.sort_values(sort_col, ascending=(sort_col == "Age"))
        jugadores_lista = list(jugadores_encontrados.iterrows())

        # Exportar CSV (solo datos)
        def _to_csv():
            out = jugadores_encontrados[["Player", "Squad", "League", "Age", "Gls", "Ast", "Won", "Min", "market_value_in_eur"]].copy()
            out.columns = ["Jugador", "Equipo", "Liga", "Edad", "Goles", "Asistencias", "Regates", "Minutos", "Valor_eur"]
            return out.to_csv(index=False).encode("utf-8-sig")

        # Export con contexto (criterios + explicación en cabecera)
        def _to_csv_con_contexto():
            lines = []
            lines.append("Criterios;" + (data.get("basado_en") or "").replace(",", " "))
            lines.append("Explicación;" + (data.get("explicacion") or "").replace(",", " ").replace("\n", " "))
            if data.get("filtros_relajados"):
                lines.append("Filtros relajados;" + data["filtros_relajados"].replace(",", " "))
            lines.append("")
            out = jugadores_encontrados[["Player", "Squad", "League", "Age", "Gls", "Ast", "Won", "Min", "market_value_in_eur"]].copy()
            out.columns = ["Jugador", "Equipo", "Liga", "Edad", "Goles", "Asistencias", "Regates", "Minutos", "Valor_eur"]
            return ("\n".join(lines) + "\n" + out.to_csv(index=False)).encode("utf-8-sig")

        st.download_button("📥 Descargar CSV", data=_to_csv(), file_name="scouting_resultados.csv", mime="text/csv")
        st.download_button("📥 CSV con criterios y explicación", data=_to_csv_con_contexto(), file_name="scouting_con_contexto.csv", mime="text/csv")

        # Comparador: tabla si hay 2-4 jugadores seleccionados
        comp = st.session_state["comparador_ids"]
        if len(comp) >= 2:
            df_comp = df_web[df_web["PlayerID"].isin(comp)].drop_duplicates("PlayerID", keep="first")
            cols_comp = ["Player", "Age", "Gls", "Ast", "Won", "Min", "market_value_in_eur"]
            cols_comp = [c for c in cols_comp if c in df_comp.columns]
            if df_comp.shape[0] > 0:
                with st.expander("📊 Tabla comparativa", expanded=True):
                    st.dataframe(df_comp[cols_comp].rename(columns={"Player": "Jugador", "Age": "Edad", "Gls": "Goles", "Ast": "Asis", "Won": "Regates", "Min": "Minutos", "market_value_in_eur": "Valor_eur"}), use_container_width=True)
            if st.button("Vaciar comparador"):
                st.session_state["comparador_ids"] = []
                st.rerun()

        st.subheader(f"Top {len(jugadores_encontrados)} Jugadores")
        n_cols = 4
        for i in range(0, len(jugadores_lista), n_cols):
            cols = st.columns(n_cols)
            for j, col in enumerate(cols):
                idx = i + j
                if idx < len(jugadores_lista):
                    _, row = jugadores_lista[idx]
                    pid = int(row["PlayerID"])
                    with col:
                        foto = row.get("strCutout")
                        if pd.notna(foto) and str(foto).startswith("http"):
                            st.image(foto, use_container_width=True)
                        else:
                            st.image("https://via.placeholder.com/150?text=Sin+foto", use_container_width=True)
                        st.metric(label=row["Player"], value=f"{int(row.get('Gls', 0) or 0)} Goles")
                        st.caption(f"🎯 {int(row.get('Ast', 0) or 0)} asis · 🏃 {int(row.get('Won', 0) or 0)} regates")
                        if "xG" in row and pd.notna(row.get("xG")) and row.get("xG", 0) > 0:
                            st.caption(f"xG: {float(row['xG']):.1f}")
                        st.write(f"🏠 {row['Squad']} ({row.get('League', '')})")
                        edad = row.get("Age")
                        st.write(f"🎂 {int(edad) if pd.notna(edad) else '—'} años")
                        min_val = row.get("Min")
                        if pd.notna(min_val) and min_val > 0:
                            st.caption(f"⏱️ {int(min_val)} min")
                        valor = row.get("market_value_in_eur")
                        if pd.notna(valor) and valor > 0:
                            st.write(f"💰 {int(valor):,} €".replace(",", "."))
                        else:
                            st.write("💰 —")
                        c1, c2 = st.columns(2)
                        with c1:
                            if st.button("⭐ Shortlist", key=f"short_{pid}"):
                                st.session_state["shortlist"] = st.session_state["shortlist"] | {pid}
                                st.rerun()
                        with c2:
                            if len(comp) < 4 and pid not in comp:
                                if st.button("📊 Comparar", key=f"comp_{pid}"):
                                    st.session_state["comparador_ids"] = (st.session_state["comparador_ids"] + [pid])[:4]
                                    st.rerun()
    else:
        st.error(data.get("error", "No se encontraron jugadores para esta búsqueda."))
        similares = data.get("busquedas_similares", [])
        if similares:
            st.caption("Prueba con:")
            cols_sim = st.columns(min(5, len(similares)))
            for i, s in enumerate(similares[:5]):
                with cols_sim[i]:
                    if st.button(s[:28], key=f"sim_{i}"):
                        st.session_state["query_input"] = s
                        st.rerun()

