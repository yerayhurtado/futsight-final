"""
Motor de recomendacion de jugadores similares para FutSight.

Flujo general:
1. Cargar datos desde SQLite (statsJson + metadatos del jugador).
2. Filtrar por la temporada mas reciente.
3. Deduplicar jugadores (quedarse con el registro de mas minutos).
4. Calcular metricas avanzadas (ratios, per-90) a partir de las estadisticas.
5. Limpiar e imputar valores nulos por media de posicion.
6. Construir matrices de similaridad coseno por posicion (GK / DF / MF / FW).
7. Exponer find_similar(player_id, n) para la API.
"""

import warnings
import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler
from database import load_data

warnings.filterwarnings("ignore", category=pd.errors.PerformanceWarning)

# ============================================================
# CONFIGURACION
# ============================================================

# Minutos minimos para que un jugador entre en el calculo
MIN_MINUTES = 500

# Columnas brutas (conteos) que se normalizan a per-90
COLS_TO_PER90 = [
    "Sh", "SoT", "Gls", "Ast", "xG", "npxG", "xAG", "xA",
    "Pass", "Cmp", "KP", "Crs", "CrsPA", "PPA",
    "Tkl", "TklW", "Int", "Blocks", "Clr", "Recov",
    "SCA", "PrgC", "PrgP", "PrgR", "Carries", "Touches",
    "Won", "Lost", "Att", "Att Pen", "Def", "Def 3rd", "Mid 3rd", "Att 3rd",
    "Fls", "Dis", "Rec", "CPA", "Tkld", "Off", "Sw", "TB",
    "Live", "Dead", "FK", "Crs", "PassLive", "PassDead",
]

# Columnas informativas que se excluyen del modelado
COLS_EXCLUDE_FROM_MODEL = [
    "PlayerID", "Player", "Squad", "Pos", "Season", "Age",
    "nation", "league",
    "Ballon d or", "European Golden Shoe", "League Won", "UCL_Won",
    "The Best FIFA Mens Player", "UEFA Best Player",
    "UCL_MP", "UCL_Gls", "UCL_xG", "UCL_Ast", "UCL_xA",
    "UCL_KP", "UCL_GCA", "UCL_SCA",
    "MP", "Min", "Mn/MP", "Starts", "Mn/Start", "Subs", "Mn/Sub", "unSub",
    "Born", "ID", "Nombre", "PPM", "Compl",
    "GeneralPos", "90s", "_pos",
]

# ============================================================
# Features por posicion general
# Cada grupo contiene las metricas mas relevantes para ese tipo
# de jugador, usando per-90 para conteos y ratios directamente.
# ============================================================

POSITION_FEATURE_GROUPS = {
    "gk": [
        "Cmp%", "Pass_p90", "Cmp_p90", "Touches_p90",
        "PrgP_p90", "Recov_p90",
    ],
    "df": [
        # Defensa
        "Tkl_p90", "TklW_p90", "Tkl%", "Int_p90", "Blocks_p90", "Clr_p90",
        "Recov_p90", "Def 3rd_p90", "Def_p90",
        # Duelos
        "Won_p90", "Won%", "DuelWinRate",
        # Distribucion
        "Pass_p90", "Cmp_p90", "Cmp%", "PrgP_p90", "Touches_p90",
        # Conduccion
        "Carries_p90", "PrgC_p90", "PrgC_per_Carry",
        # Contribucion ofensiva
        "SCA_p90", "xG_p90", "KP_p90",
    ],
    "mf": [
        # Pase y creacion
        "Pass_p90", "Cmp_p90", "Cmp%", "KP_p90", "PPA_p90",
        "KP_per_Pass", "SCA_per_Touch",
        # Progresion
        "PrgP_p90", "PrgC_p90", "PrgR_p90", "PrgC_per_Carry", "PrgR_per_Touch",
        # Creacion de gol
        "SCA_p90", "xAG_p90", "xA_p90", "CrsPA_p90",
        # Gol
        "Gls_p90", "Ast_p90", "xG_p90", "Sh_p90",
        # Defensa
        "Tkl_p90", "Int_p90", "Recov_p90",
        # Duelos y regate
        "Won_p90", "DuelWinRate", "Tkld_p90", "Dis_p90",
        # Volumen de juego
        "Touches_p90", "Carries_p90", "Att_p90", "Rec_p90",
    ],
    "fw": [
        # ---- FINALIZACION ----
        "Sh_p90", "SoT_p90", "SoT%", "G/Sh", "G/SoT",
        "Gls_p90", "xG_p90", "npxG_p90", "G-xG", "npxG/Sh",
        "xG_per_Sh",
        # ---- CREACION ----
        "Ast_p90", "xAG_p90", "xA_p90",
        "KP_p90", "SCA_p90", "CrsPA_p90",
        "KP_per_Pass", "SCA_per_Touch",
        # ---- REGATE Y CONDUCCION (clave para distinguir extremos) ----
        "PrgC_p90", "PrgR_p90", "Carries_p90", "CPA_p90",
        "PrgC_per_Carry", "PrgR_per_Touch",
        "Tkld_p90",  # veces que le roban el balon al regatear
        "Dis_p90",   # posesiones perdidas
        # ---- DUELOS ----
        "Won_p90", "Won%", "DuelWinRate",
        # ---- POSICIONAMIENTO ----
        "Att Pen_p90", "Touches_p90", "Rec_p90",
        "Off_p90",   # fueras de juego (delanteros de profundidad)
        # ---- PASE ----
        "Pass_p90", "Cmp%",
    ],
}


# ============================================================
# HELPERS
# ============================================================

def _safe_div(num, den, ndigits=4):
    """Division segura: devuelve NaN cuando den == 0 o hay nulos."""
    result = np.where(
        (den != 0) & (~pd.isna(num)) & (~pd.isna(den)),
        num / den,
        np.nan,
    )
    return np.round(result, ndigits)


def _normalize_position(pos_raw) -> str:
    """Mapea la posicion cruda a uno de los cuatro grupos generales."""
    p = str(pos_raw).lower()
    if "gk" in p:
        return "gk"
    if "df" in p or "cb" in p or "lb" in p or "rb" in p:
        return "df"
    if "fw" in p or "st" in p or "cf" in p or "lw" in p or "rw" in p:
        return "fw"
    return "mf"


# ============================================================
# INGENIERIA DE METRICAS
# ============================================================

def _build_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calcula metricas per-90 y ratios derivados necesarios para el modelo.
    """
    out = df.copy()

    # Factor per-90 basado en la columna '90s' de FBref
    factor_90 = _safe_div(1.0, out["90s"])

    # --- Metricas per-90 ---
    for col in COLS_TO_PER90:
        if col in out.columns:
            col_name = f"{col}_p90"
            if col_name not in out.columns:  # evitar duplicados
                out[col_name] = np.round(out[col] * factor_90, 4)

    # --- Ratios derivados adicionales ---
    # Creacion
    out["KP_per_Pass"] = _safe_div(out.get("KP", 0), out.get("Pass", np.nan))
    out["CrsPA_per_Crs"] = _safe_div(out.get("CrsPA", 0), out.get("Crs", np.nan))
    out["SCA_per_Touch"] = _safe_div(out.get("SCA", 0), out.get("Touches", np.nan))

    # Duelos
    total_duels = out.get("Won", 0) + out.get("Lost", 0)
    out["DuelWinRate"] = _safe_div(out.get("Won", 0), total_duels)

    # Progresion
    out["PrgC_per_Carry"] = _safe_div(out.get("PrgC", 0), out.get("Carries", np.nan))
    out["PrgR_per_Touch"] = _safe_div(out.get("PrgR", 0), out.get("Touches", np.nan))

    # Tiros
    out["xG_per_Sh"] = _safe_div(out.get("xG", 0), out.get("Sh", np.nan))

    return out


# ============================================================
# LIMPIEZA FINAL
# ============================================================

def _clean_for_model(df: pd.DataFrame, pos_code: str) -> pd.DataFrame:
    """
    Selecciona las features relevantes para la posicion, imputa nulos
    por la media del grupo y elimina columnas constantes.
    """
    feature_cols = [c for c in POSITION_FEATURE_GROUPS[pos_code] if c in df.columns]

    if not feature_cols:
        return pd.DataFrame()

    sub = df[["PlayerID"] + feature_cols].copy()
    sub = sub.set_index("PlayerID")

    # Imputar nulos por la media de la columna dentro del grupo posicional
    sub = sub.fillna(sub.mean())

    # Eliminar columnas constantes (sin varianza)
    sub = sub.loc[:, sub.nunique() > 1]

    # Eliminar columnas con NaN residuales
    sub = sub.dropna(axis=1)

    return sub


# ============================================================
# MATRIZ DE SIMILARIDAD
# ============================================================

def _compute_similarity_matrix(df: pd.DataFrame) -> pd.DataFrame:
    """
    Escala con StandardScaler y calcula la similitud coseno.
    Devuelve un DataFrame cuadrado PlayerID x PlayerID.
    """
    if df.empty:
        return pd.DataFrame()

    scaler = StandardScaler()
    X = scaler.fit_transform(df.values)
    sim = cosine_similarity(X)

    return pd.DataFrame(sim, index=df.index, columns=df.index)


# ============================================================
# CLASE PRINCIPAL
# ============================================================

class PlayerRecommender:
    """
    Motor de recomendacion de jugadores similares basado en matrices
    de similitud coseno, segmentadas por posicion general.

    Posiciones:
        gk  -> Porteros
        df  -> Defensas
        mf  -> Centrocampistas
        fw  -> Delanteros / Extremos
    """

    POS_ORDER = ["gk", "df", "mf", "fw"]

    def __init__(self):
        self.df: pd.DataFrame | None = None          # datos limpios (1 fila / jugador)
        self.matrices: dict[str, pd.DataFrame] = {}  # pos_code -> sim_matrix

    # ----------------------------------------------------------
    def fit(self):
        """Carga datos, calcula metricas y construye las matrices de similitud."""
        print("[recommender] Cargando datos...")
        raw = load_data()

        if raw.empty:
            print("[recommender] ERROR: No hay datos disponibles.")
            return

        # Filtrar por temporada mas reciente
        latest = raw["Season"].max()
        print(f"[recommender] Temporada: {latest}")
        df = raw[raw["Season"] == latest].copy()

        # --- DEDUPLICACION ---
        # Hay jugadores con multiples filas (distintas ligas, traspasos, etc.)
        # Nos quedamos con la fila que tiene mas minutos jugados.
        before_dedup = len(df)
        df = df.sort_values("Min", ascending=False)
        df = df.drop_duplicates(subset="PlayerID", keep="first")
        after_dedup = len(df)
        if before_dedup != after_dedup:
            print(f"[recommender] Deduplicados: {before_dedup} -> {after_dedup} jugadores unicos")

        # Filtro minimo de minutos
        if "Min" in df.columns:
            df = df[df["Min"] >= MIN_MINUTES].copy()
            print(f"[recommender] Jugadores con >={MIN_MINUTES} min: {len(df)}")

        # Normalizar posicion
        df["_pos"] = df["Pos"].apply(_normalize_position)

        # Construir metricas derivadas
        df = _build_features(df)

        self.df = df.reset_index(drop=True)

        # Construir una matriz por posicion
        for pos_code in self.POS_ORDER:
            pos_df = self.df[self.df["_pos"] == pos_code].copy()

            if pos_df.empty:
                print(f"[recommender] {pos_code.upper()} - sin jugadores, omitido.")
                continue

            model_df = _clean_for_model(pos_df, pos_code)

            if model_df.empty:
                print(f"[recommender] {pos_code.upper()} - sin features validas, omitido.")
                continue

            self.matrices[pos_code] = _compute_similarity_matrix(model_df)
            print(
                f"[recommender] {pos_code.upper()} - "
                f"{len(model_df)} jugadores, {model_df.shape[1]} features."
            )

        print("[recommender] Motor listo OK")

    # ----------------------------------------------------------
    def find_similar(self, player_id: int, n: int = 5) -> list[dict]:
        """
        Devuelve los n jugadores mas similares a player_id.

        La similitud se normaliza min-max al rango [0, 100] y los
        resultados se devuelven ORDENADOS de mayor a menor similitud.

        Returns
        -------
        list[dict]
            Lista de dicts con PlayerID, Player, Squad, Age, Pos,
            Similarity (0-100), strCutout.
        """
        if self.df is None:
            self.fit()

        player_row = self.df[self.df["PlayerID"] == player_id]
        if player_row.empty:
            return []

        pos_code = player_row.iloc[0]["_pos"]

        if pos_code not in self.matrices:
            return []

        sim_matrix = self.matrices[pos_code]

        if player_id not in sim_matrix.index:
            return []

        # Scores de similitud para el jugador objetivo
        scores = sim_matrix.loc[player_id].drop(index=player_id)

        # Normalizar min-max a [0, 1]
        s_min, s_max = scores.min(), scores.max()
        if s_max > s_min:
            scores = (scores - s_min) / (s_max - s_min)
        else:
            scores = scores * 0.0

        # Top N, ya ordenado de mayor a menor
        top = scores.nlargest(n)

        results = []
        for sid, score in top.items():
            row = self.df[self.df["PlayerID"] == sid]
            if row.empty:
                continue
            r = row.iloc[0]
            results.append(
                {
                    "PlayerID": int(sid),
                    "Player": str(r.get("Player", "")),
                    "Squad": str(r.get("Squad", "")),
                    "Age": int(r["Age"]) if pd.notna(r.get("Age")) else None,
                    "Pos": str(r.get("Pos", "")),
                    "Similarity": round(float(score) * 100, 1),
                    "strCutout": str(r.get("strCutout", "")),
                }
            )

        return results


# Instancia global importada por main.py
recommender = PlayerRecommender()
