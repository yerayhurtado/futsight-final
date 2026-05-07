import pandas as pd
import numpy as np
import os
import sqlite3
import json

# ---------------------------------------------------------------------------
# Pesos del Modelo (Tabla 2 del PDF)
# ---------------------------------------------------------------------------
WEIGHTS = {
    'fw': {
        'early': {'Compl': 0.1956, 'Gls': 0.1726, 'Rep': 0.5941},
        'mid':   {'Compl': 0.1719, 'PrgDist': 0.0627, 'Gls': 0.0051, 'Rep': 0.2380},
        'late':  {'Compl': 0.5615, 'Rep': 0.0765}
    },
    'mf': {
        'early': {'Cmp': 0.0301, 'Rep': 0.9069},
        'mid':   {'Cmp': 0.0811, 'Tkl+Int': 0.0295, 'Rep': 0.7795},
        'late':  {'Cmp': 0.6350, 'Tkl+Int': 0.1052, 'Rep': 0.0657}
    },
    'df': {
        'early': {'Tkl+Int': 0.0177, 'Rep': 0.9456},
        'mid':   {'Tkl+Int': 0.3224, 'Cmp': 0.0567, 'PrgDist': 0.0133, 'Rep': 0.5819},
        'late':  {'Tkl+Int': 0.6280, 'PrgDist': 0.1944, 'Cmp': 0.0565, 'Rep': 0.0398}
    }
}

# Jugadores con tope de 250M (estrellas absolutas)
TOP_PLAYERS = {"lamine yamal", "erling haaland", "kylian mbappé", "kylian mbappe"}

# ---------------------------------------------------------------------------
# Carga del Dataset (singleton, se carga una sola vez al arrancar)
# ---------------------------------------------------------------------------
_df: pd.DataFrame | None = None

def load_data() -> pd.DataFrame:
    global _df
    if _df is not None:
        return _df

    # Path a la base de datos SQLite de Prisma
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Probar varias ubicaciones posibles y elegir la que exista y no esté vacía
    candidates = [
        os.path.join(base_dir, "dev.db"),
        os.path.join(base_dir, "prisma", "dev.db"),
        os.path.join(os.getcwd(), "dev.db"),
        os.path.join(os.getcwd(), "prisma", "dev.db"),
    ]

    db_path = None
    for path in candidates:
        if os.path.exists(path) and os.path.getsize(path) > 0:
            db_path = path
            break

    if not db_path:
        raise FileNotFoundError(f"No se encontró la base de datos poblada en ninguna de estas rutas: {candidates}")

    print(f"[model] Cargando datos desde SQLite: {db_path} ({os.path.getsize(db_path)} bytes)")
    try:
        conn = sqlite3.connect(db_path)
        df_raw = pd.read_sql_query("SELECT * FROM Player", conn)
        conn.close()

        if df_raw.empty:
            print("[model] ADVERTENCIA: La tabla Player está vacía.")
            return df_raw

        # 1. Expandir statsJson (contiene las métricas FBref secundarias)
        stats_list = df_raw['statsJson'].apply(json.loads).tolist()
        df_stats = pd.DataFrame(stats_list)

        # 2. Renombrar columnas Prisma -> Nombres esperados por el modelo
        df_base = df_raw.drop(columns=['statsJson', 'id'])
        rename_map = {
            'playerID': 'PlayerID',
            'player': 'Player',
            'squad': 'Squad',
            'league': 'League',
            'nation': 'Nation',
            'pos_main': 'Pos',
            'age': 'Age',
            'season': 'Season',
            'marketValue': 'Valor_Mercado',
            'clusterId': 'Cluster_ID',
            'puresaPerfil': 'Puresa_Perfil',
            'esHibrid': 'Es_Hibrid',
            'perfilNom': 'Perfil_Nom',
            'perfilPrincipal': 'Perfil_Principal',
            'perfilSecundari': 'Perfil_Secundari',
            'perfilHistorico': 'Perfil_Historico',
            'strCutout': 'strCutout',
            'piernaBuena': 'Pierna_Buena',
            'altura': 'Altura'
        }
        df_base = df_base.rename(columns=rename_map)

        # 3. Combinar todo en un solo DataFrame
        _df = pd.concat([df_base, df_stats], axis=1)
        _df = _df.loc[:, ~_df.columns.duplicated()] # Eliminar duplicados de columnas
        
        print(f"[model] Dataset reconstruido exitosamente ({len(_df)} filas)")
        return _df

    except Exception as e:
        print(f"[model] Error cargando DB: {e}")
        raise e

# ---------------------------------------------------------------------------
# Curva de valor por edad (pico 21-24 años)
# ---------------------------------------------------------------------------
def get_age_factor(age: float) -> float:
    if age <= 24:
        return 1.0 + (age - 16) * 0.05
    if age <= 29:
        return 1.15 - (age - 24) * 0.03
    return max(0.2, 1.0 - (age - 29) * 0.08)

# ---------------------------------------------------------------------------
# Función principal de predicción
# ---------------------------------------------------------------------------
def predict_player_value(player_name: str) -> dict:
    df = load_data()

    # Búsqueda flexible (ignora mayúsculas y acentos parcialmente)
    mask = df["Player"].str.contains(player_name, case=False, na=False)
    player_data = df[mask]

    if player_data.empty:
        return {"error": f"Jugador '{player_name}' no encontrado en el dataset."}

    # Temporada más reciente
    latest = player_data.sort_values(by="Season", ascending=False).iloc[0]

    pos_raw = str(latest.get("Pos", "MF")).lower()
    # Normalizar posición al grupo correcto (fw, mf, df)
    if "fw" in pos_raw or "st" in pos_raw or "cf" in pos_raw:
        pos = "fw"
    elif "df" in pos_raw or "cb" in pos_raw or "lb" in pos_raw or "rb" in pos_raw:
        pos = "df"
    else:
        pos = "mf"

    age = float(latest.get("Age", 25))

    # Etapa de carrera
    if age <= 23:
        stage = "early"
    elif age <= 29:
        stage = "mid"
    else:
        stage = "late"

    # Valor base (con tope para estrellas)
    base_val = float(latest.get("Valor_Mercado", 0) or 0)
    if player_name.lower() in TOP_PLAYERS:
        base_val = 250_000_000

    if base_val == 0:
        return {"error": f"El jugador '{player_name}' no tiene valor de mercado en el dataset."}

    w_dict = WEIGHTS.get(pos, WEIGHTS["mf"])[stage]
    performance_score = 0.0

    for stat, weight in w_dict.items():
        if stat == "Rep":
            performance_score += base_val * weight
        elif stat in latest.index:
            val = latest[stat]
            val = float(val) if not pd.isna(val) else 0.0
            performance_score += val * weight * (base_val / 100)

    age_mult = get_age_factor(age)
    predicted_price = performance_score * age_mult
    # Calcular el porcentaje de diferencia respecto al valor REAL de la base de datos (no el base_val inflado)
    actual_val = float(latest.get("Valor_Mercado", 0) or 1) # Evitar división por cero
    diff_pct = ((predicted_price / actual_val) - 1) * 100

    return {
        "player": str(latest["Player"]),
        "squad": str(latest.get("Squad", "Desconocido")),
        "age": age,
        "position": pos.upper(),
        "stage": stage,
        "season": str(latest.get("Season", "N/A")),
        "base_value": base_val,
        "predicted_value": round(predicted_price),
        "age_factor": round(age_mult, 4),
        "diff_pct": round(diff_pct, 2),
        "trend": "ALZA" if diff_pct > 0 else "BAJA",
        "weights_used": w_dict,
    }
