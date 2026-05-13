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

# Etiquetas legibles para explicaciones XAI (español)
STAT_LABELS_ES: dict[str, str] = {
    "Compl": "Partidos completados",
    "Gls": "Goles",
    "Rep": "Reputación y valor de mercado base",
    "PrgDist": "Distancia en conducciones progresivas",
    "Cmp": "Pases completados",
    "Tkl+Int": "Entradas e intercepciones combinadas",
}

# Coeficiente orientativo de "exigencia" del campeonato (solo explicativo en UI)
def _league_exigencia_coeff(league: object) -> tuple[float, str]:
    if league is None or (isinstance(league, float) and pd.isna(league)):
        return 1.0, "No especificada"
    L = str(league).strip().lower()
    if not L:
        return 1.0, "No especificada"
    rules: list[tuple[tuple[str, ...], float]] = (
        (("premier league", "premier"), 1.16),
        (("la liga", "laliga", "primera división", "primera division"), 1.14),
        (("serie a",), 1.12),
        (("bundesliga",), 1.12),
        (("ligue 1", "ligue1"), 1.10),
        (("primeira liga", "liga portugal", "eredivisie", "belgian", "scottish"), 1.06),
        (("championship", "segunda división", "segunda division", "2. bundesliga", "serie b"), 0.90),
        (("segunda", "second division", "league one", "league two"), 0.88),
    )
    for keys, coeff in rules:
        if any(k in L for k in keys):
            return round(coeff, 2), str(league).strip()
    return 1.0, str(league).strip()


def _raw_stat_value(latest: pd.Series, stat: str) -> float:
    """Valor numérico de la métrica en la fila del jugador (0 si falta)."""
    if stat == "Rep":
        return 0.0
    if stat in latest.index:
        val = latest[stat]
        return float(val) if not pd.isna(val) else 0.0
    if stat == "Tkl+Int":
        tkl = latest.get("Tkl", 0)
        inter = latest.get("Int", 0)
        tkl = float(tkl) if not pd.isna(tkl) else 0.0
        inter = float(inter) if not pd.isna(inter) else 0.0
        return tkl + inter
    return 0.0


def _contribution_for_stat(stat: str, weight: float, latest: pd.Series, base_val: float) -> float:
    """Aporte al performance_score antes del factor edad (misma fórmula que el bucle principal)."""
    if stat == "Rep":
        return base_val * weight
    val = _raw_stat_value(latest, stat)
    return val * weight * (base_val / 100.0)


def _build_explanation_details(
    w_dict: dict[str, float], latest: pd.Series, base_val: float, pos: str, stage: str, top_n: int = 3
) -> list[dict]:
    rows: list[tuple[str, float, float]] = []
    for stat, weight in w_dict.items():
        c = _contribution_for_stat(stat, weight, latest, base_val)
        rows.append((stat, weight, c))
    rows.sort(key=lambda x: abs(x[2]), reverse=True)
    out: list[dict] = []
    for stat, weight, contrib in rows[:top_n]:
        label = STAT_LABELS_ES.get(stat, stat)
        mag = abs(contrib)
        if stat == "Rep":
            mensaje = (
                f"{label}: el mayor peso en esta etapa ({stage}) para {pos.upper()} "
                f"proviene del valor de mercado de referencia; aporta ~{mag:,.0f} € al término de rendimiento antes del ajuste por edad."
            )
        else:
            raw = _raw_stat_value(latest, stat)
            mensaje = (
                f"{label} (valor {raw:,.2f}): con peso {weight:.4f} en el bloque {pos.upper()}/{stage}, "
                f"su impacto absoluto en el score es ~{mag:,.0f} € antes del factor edad."
            )
        out.append({"stat": stat, "weight": weight, "contribution": round(contrib, 2), "mensaje": mensaje})
    return out


def _stage_display(stage: str) -> str:
    return {"early": "Early", "mid": "Mid", "late": "Late"}.get(stage.lower(), stage.title())


def _xai_short_label(stat: str) -> str:
    return {
        "Gls": "Goles",
        "Compl": "Partidos",
        "Cmp": "Pases completados",
        "Tkl+Int": "Entradas + Intercepciones",
        "PrgDist": "Distancia progresiva",
    }.get(stat, STAT_LABELS_ES.get(stat, stat))


def _build_down_trend_xai(
    w_dict: dict[str, float],
    latest: pd.Series,
    base_val: float,
    pos: str,
    stage: str,
    age: float,
    age_mult: float,
    league_display: str,
    league_coeff: float,
    diff_pct: float,
) -> dict:
    """
    Desglose legible cuando el modelo predice por debajo del valor de mercado (corrección técnica).
    """
    impact_lines: list[str] = []

    if "Rep" in w_dict:
        w_r = w_dict["Rep"]
        c_r = _contribution_for_stat("Rep", w_r, latest, base_val)
        impact_lines.append(
            f"Reputación: ~{c_r:,.0f} € (Peso principal en etapa {_stage_display(stage)} para {pos.upper()})."
        )

    others: list[tuple[float, str]] = []
    for stat, weight in w_dict.items():
        if stat == "Rep":
            continue
        c = _contribution_for_stat(stat, weight, latest, base_val)
        raw = _raw_stat_value(latest, stat)
        label = _xai_short_label(stat)
        others.append(
            (
                abs(c),
                f"{label} ({raw:.2f}): Impacto de ~{abs(c):,.0f} € (Peso {round(weight, 4)}).",
            )
        )
    others.sort(key=lambda x: -x[0])
    impact_lines.extend(line for _, line in others[:2])

    factor_edad_line = f"Factor Edad ({age:.0f} años): Multiplicador {age_mult:.2f}."
    coef_liga_line = f"Coeficiente Liga ({league_display}): x{league_coeff:.2f}."

    ad = abs(round(diff_pct, 1))
    conclusion = (
        f"El valor predictivo es un {ad}% menor al valor de mercado actual porque, aunque el rendimiento es excelente, "
        "el precio de mercado actual ha crecido más rápido que las estadísticas reales (Goles/Minutos), sugiriendo una corrección técnica."
    )

    if stage == "early" and age <= 23:
        highlight_box = (
            f"A los {age:.0f} años, el jugador está en fase ascendente (etapa {_stage_display(stage)}). "
            f"El multiplicador de {age_mult:.2f} refuerza su valor, pero el rendimiento estadístico actual pide cautela "
            "frente a la valoración récord de mercado."
        )
    else:
        highlight_box = (
            f"El multiplicador de edad ({age_mult:.2f}) en etapa {_stage_display(stage)} calibra la predicción. "
            "La brecha con el valor de mercado sugiere una posible corrección técnica frente a la cotización actual."
        )

    return {
        "impact_lines": impact_lines,
        "factor_edad_line": factor_edad_line,
        "coef_liga_line": coef_liga_line,
        "conclusion": conclusion,
        "highlight_box": highlight_box,
    }


def _build_age_analysis(age: float, age_mult: float, stage: str) -> str:
    if age <= 23:
        return (
            f"Con {age:.0f} años el jugador está en fase ascendente (etapa «{stage}»). "
            f"El multiplicador de edad aplicado es {age_mult:.2f}, lo que refuerza el valor predicho frente a la base estadística."
        )
    if age <= 29:
        return (
            f"A los {age:.0f} años (etapa «{stage}») el factor edad es {age_mult:.2f}, "
            "coherente con la meseta de rendimiento y cotización del modelo."
        )
    return (
        f"Con {age:.0f} años (etapa «{stage}») el factor edad {age_mult:.2f} "
        "ajusta a la baja respecto al pico 21-24, reflejando la curva de depreciación del modelo."
    )


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
        performance_score += _contribution_for_stat(stat, weight, latest, base_val)

    age_mult = get_age_factor(age)
    predicted_price = performance_score * age_mult
    # Calcular el porcentaje de diferencia respecto al valor REAL de la base de datos (no el base_val inflado)
    actual_val = float(latest.get("Valor_Mercado", 0) or 1) # Evitar división por cero
    diff_pct = ((predicted_price / actual_val) - 1) * 100

    league_raw = latest.get("League")
    league_coeff, league_display = _league_exigencia_coeff(league_raw)

    explanation_details = _build_explanation_details(w_dict, latest, base_val, pos, stage, top_n=3)
    age_analysis = _build_age_analysis(age, age_mult, stage)

    xai_down_trend: dict | None = None
    if diff_pct < 0:
        xai_down_trend = _build_down_trend_xai(
            w_dict, latest, base_val, pos, stage, age, age_mult, league_display, league_coeff, diff_pct
        )

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
        # XAI (explicación del precio)
        "explanation_details": explanation_details,
        "age_analysis": age_analysis,
        "league": league_display,
        "league_coeff": league_coeff,
        # XAI específico cuando la predicción está por debajo del mercado (tendencia a la baja)
        "xai_down_trend": xai_down_trend,
    }
