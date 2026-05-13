"""
Motor de clasificación de jugadores mediante Gaussian Mixture Model (GMM).

Arquitectura:
    1. Carga datos desde SQLite (tabla Player + statsJson).
    2. Filtra temporada más reciente, deduplica, aplica mínimo de minutos.
    3. Calcula métricas per-90 y ratios derivados.
    4. Entrena un GMM por posición (df/mf/fw/gk) con K optimizado.
    5. Asigna nombres de perfil profesionales (Extremo, Goleador, Pivote…)
       mediante matching de centroides contra arquetipos de scouting.
    6. Expone clasificaciones en memoria para la API.

Autor: FutSight Clustering Service
"""

import warnings
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.mixture import GaussianMixture
from database import load_data

warnings.filterwarnings("ignore", category=pd.errors.PerformanceWarning)

# ============================================================
# CONFIGURACIÓN
# ============================================================

MIN_MINUTES = 900
BIC_K_RANGE = range(2, 9)       # Rango de K para búsqueda BIC
HYBRID_THRESHOLD = 0.65         # Prob < esto → jugador híbrido

# Columnas brutas que se normalizan a per-90
_COLS_TO_PER90 = [
    "Sh", "SoT", "Gls", "Ast", "xG", "npxG", "xAG", "xA",
    "Pass", "Cmp", "KP", "Crs", "CrsPA", "PPA",
    "Tkl", "TklW", "Int", "Blocks", "Clr", "Recov",
    "SCA", "PrgC", "PrgP", "PrgR", "Carries", "Touches",
    "Won", "Lost", "Att", "Att Pen", "Def", "Def 3rd", "Mid 3rd", "Att 3rd",
    "Fls", "Dis", "Rec", "CPA", "Sw",
]

# ============================================================
# FEATURES POR POSICIÓN (per-90 + ratios)
# ============================================================

FEATURES_BY_POS = {
    "fw": [
        "Gls_p90", "Sh_p90", "SoT_p90", "SoT%", "G/Sh",
        "xG_p90", "npxG_p90",
        "Ast_p90", "KP_p90", "SCA_p90",
        "PrgC_p90", "PrgR_p90", "Carries_p90", "CPA_p90",
        "Won_p90", "Won%",
        "Att Pen_p90", "Touches_p90",
    ],
    "mf": [
        "Cmp_p90", "Cmp%", "KP_p90", "PPA_p90",
        "PrgP_p90", "PrgC_p90",
        "SCA_p90", "xAG_p90",
        "Gls_p90", "Ast_p90", "Sh_p90",
        "Tkl_p90", "Int_p90", "Recov_p90",
        "Won_p90", "Touches_p90", "Carries_p90",
    ],
    "df": [
        "Tkl_p90", "TklW_p90", "Int_p90", "Blocks_p90", "Clr_p90",
        "Won_p90", "Won%",
        "Def 3rd_p90", "Mid 3rd_p90",
        "Cmp_p90", "Cmp%", "PrgP_p90",
        "Carries_p90", "PrgC_p90",
        "SCA_p90", "KP_p90",
    ],
    "gk": [
        "Cmp%", "Cmp_p90", "PrgP_p90", "Touches_p90", "Recov_p90",
    ],
}

# ============================================================
# ARQUETIPOS DE SCOUTING (para naming de clusters)
# ============================================================

ARCHETYPES: dict[str, list[dict]] = {
    "gk": [
        {
            "name": "Portero Líbero",
            "desc": "Participa en la salida de balón y domina el área",
            "signature": {"Cmp_p90": 1.5, "Cmp%": 1.2, "PrgP_p90": 1.2, "Touches_p90": 1.0, "Recov_p90": 0.8},
        },
        {
            "name": "Portero Clásico",
            "desc": "Especialista bajo palos, perfil reactivo",
            "signature": {"Won%": 1.5, "Cmp%": -0.8, "PrgP_p90": -1.2, "Touches_p90": -0.5},
        },
    ],
    "df": [
        {
            "name": "Lateral Ofensivo",
            "desc": "Carrilero con gran volumen de ataque y centros",
            "signature": {"SCA_p90": 2.0, "KP_p90": 1.8, "PrgC_p90": 2.2, "CPA_p90": 1.8, "Crs_p90": 1.5},
        },
        {
            "name": "Defensa Constructor",
            "desc": "Central con gran salida de balón y conducción",
            "signature": {"Cmp_p90": 2.2, "Cmp%": 1.5, "PrgP_p90": 2.0, "PrgC_p90": 1.5, "Carries_p90": 1.2},
        },
        {
            "name": "Central Dominante",
            "desc": "Líder defensivo, imperial en duelos y despejes",
            "signature": {"Won_p90": 2.5, "Won%": 1.8, "Tkl_p90": 1.5, "Blocks_p90": 1.5, "Clr_p90": 1.8},
        },
        {
            "name": "Marcador",
            "desc": "Defensa agresivo, especialista en anticipación",
            "signature": {"TklW_p90": 1.8, "Int_p90": 2.2, "Blocks_p90": 1.2, "Recov_p90": 1.2},
        },
        {
            "name": "Defensa Mixto",
            "desc": "Perfil equilibrado entre defensa y pase",
            "signature": {"Cmp_p90": 1.0, "Tkl_p90": 1.0, "Won_p90": 1.0, "Clr_p90": 1.0, "Int_p90": 1.0},
        },
    ],
    "mf": [
        {
            "name": "Organizador",
            "desc": "Metrónomo del equipo, controla el ritmo y la progresión",
            "signature": {"Cmp_p90": 2.8, "Cmp%": 1.8, "PrgP_p90": 2.5, "Touches_p90": 2.2, "PPA_p90": 1.8},
        },
        {
            "name": "Box-to-Box",
            "desc": "Todocampista físico con presencia en ambas áreas",
            "signature": {"Recov_p90": 2.0, "Tkl_p90": 1.5, "PrgC_p90": 1.5, "SCA_p90": 1.2, "Touches_p90": 1.2, "Won_p90": 1.0},
        },
        {
            "name": "Mediapunta",
            "desc": "Creativo en zona de tres cuartos, último pase",
            "signature": {"SCA_p90": 2.5, "KP_p90": 2.2, "Ast_p90": 2.0, "xAG_p90": 1.8, "TB_p90": 1.5},
        },
        {
            "name": "Pivote Defensivo",
            "desc": "Ancla del equipo, especialista en equilibrio y robos",
            "signature": {"Tkl_p90": 2.2, "Int_p90": 2.2, "Blocks_p90": 1.8, "Recov_p90": 1.5},
        },
        {
            "name": "Interior Ofensivo",
            "desc": "Llegador desde segunda línea con regate y tiro",
            "signature": {"PrgC_p90": 2.0, "Carries_p90": 1.8, "Sh_p90": 1.5, "SCA_p90": 1.8, "Touches_p90": 0.8},
        },
        {
            "name": "Mediocentro",
            "desc": "Perfil asociativo y táctico",
            "signature": {"Cmp%": 1.5, "Touches_p90": 1.2, "Recov_p90": 1.0, "Cmp_p90": 1.2},
        },
    ],
    "fw": [
        {
            "name": "Goleador",
            "desc": "Especialista en finalización y presencia en el área",
            "signature": {
                "Gls_p90": 2.2, "xG_p90": 2.0, "G/Sh": 2.5,
                "Att Pen_p90": 1.8, "SoT_p90": 1.5, "Sh_p90": 1.2,
                "PrgC_p90": -1.2,
            },
        },
        {
            "name": "Extremo",
            "desc": "Especialista en desborde, 1vs1 y profundidad",
            "signature": {
                "PrgC_p90": 2.8, "PrgR_p90": 2.2, "CPA_p90": 2.5,
                "SCA_p90": 1.8, "Carries_p90": 2.0, "KP_p90": 1.2,
            },
        },
        {
            "name": "Delantero Asociativo",
            "desc": "Falso 9 que genera juego y espacios",
            "signature": {
                "Ast_p90": 2.2, "KP_p90": 2.2, "SCA_p90": 2.5,
                "Touches_p90": 1.8, "Cmp_p90": 1.5, "TB_p90": 1.2,
            },
        },
        {
            "name": "Delantero Completo",
            "desc": "Atacante total con gol, creación y potencia",
            "signature": {
                "Gls_p90": 2.0, "xG_p90": 1.8, "PrgC_p90": 2.0,
                "SCA_p90": 2.0, "Ast_p90": 1.8, "Carries_p90": 1.5,
                "Att Pen_p90": 1.2,
            },
        },
        {
            "name": "Ariete",
            "desc": "Referencia física y dominador del juego aéreo",
            "signature": {
                "Won_p90": 2.8, "Won%": 1.8, "Att Pen_p90": 1.8,
                "Gls_p90": 1.2, "Clr_p90": 1.2,
            },
        },
        {
            "name": "Segundo Delantero",
            "desc": "Media punta adelantado, combina gol y asistencia",
            "signature": {
                "SCA_p90": 1.8, "Ast_p90": 1.8, "Gls_p90": 1.8,
                "KP_p90": 1.5, "PrgR_p90": 1.2,
            },
        },
    ],
}

# ============================================================
# HELPERS
# ============================================================

def _safe_div(num, den, ndigits=4):
    """División segura: NaN cuando den == 0."""
    result = np.where(
        (den != 0) & (~pd.isna(num)) & (~pd.isna(den)),
        num / den,
        np.nan,
    )
    return np.round(result, ndigits)


def _league_exigencia_coeff(league: object) -> float:
    """Retorna el coeficiente de peso según el nivel de la liga."""
    if league is None or (isinstance(league, float) and pd.isna(league)):
        return 1.0
    L = str(league).strip().lower()
    if not L:
        return 1.0
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
            return round(coeff, 2)
    return 1.0


def _normalize_position(pos_raw) -> str:
    """Mapea posición cruda a grupo general."""
    p = str(pos_raw).lower()
    if "gk" in p:
        return "gk"
    if any(x in p for x in ("df", "cb", "lb", "rb", "wb")):
        return "df"
    if any(x in p for x in ("fw", "st", "cf", "lw", "rw")):
        return "fw"
    return "mf"


def _build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Calcula métricas per-90, aplica peso por liga y ratios derivados."""
    out = df.copy()
    nineties = out.get("90s")
    if nineties is None:
        if "Min" in out.columns:
            nineties = out["Min"] / 90.0
        else:
            return out

    factor_90 = _safe_div(1.0, nineties)

    # Calcular coeficientes de liga para cada fila
    league_coeffs = out["League"].apply(_league_exigencia_coeff) if "League" in out.columns else 1.0

    for col in _COLS_TO_PER90:
        if col in out.columns:
            col_name = f"{col}_p90"
            if col_name not in out.columns:
                # Aplicamos el factor per-90 y el coeficiente de exigencia de liga
                out[col_name] = np.round(out[col] * factor_90 * league_coeffs, 4)

    return out


# ============================================================
# NAMING: ASIGNACIÓN DE NOMBRES DE PERFIL
# ============================================================

def _assign_archetype_names(
    pos: str,
    centroids: np.ndarray,
    feature_names: list[str],
) -> dict[int, dict]:
    """
    Asigna un nombre de arquetipo a cada cluster mediante matching
    greedy de centroides (z-scores) contra las firmas de los arquetipos.
    Usa Similitud Coseno para evitar que magnitudes extremas distorsionen la asignación.
    """
    archetypes = ARCHETYPES.get(pos, [])
    if not archetypes:
        return {i: {"name": f"Perfil {pos.upper()}-{i+1}", "desc": ""} for i in range(len(centroids))}

    # Computar scores (Weighted Sum / Dot Product sobre las features definidas)
    # Ya que X_scaled está clipeado, no habrá outliers que rompan esta suma.
    scores = []
    for ci, centroid in enumerate(centroids):
        centroid_dict = dict(zip(feature_names, centroid))
        for ai, arch in enumerate(archetypes):
            score = sum(
                centroid_dict.get(feat, 0.0) * weight
                for feat, weight in arch["signature"].items()
            )
            scores.append((score, ci, ai))

    # Asignación greedy: mayor score primero, sin repetir
    scores.sort(key=lambda x: -x[0])
    assigned_clusters: set[int] = set()
    assigned_archetypes: set[int] = set()
    assignments: dict[int, dict] = {}

    for dist, ci, ai in scores:
        if ci in assigned_clusters or ai in assigned_archetypes:
            continue
        assignments[ci] = {"name": archetypes[ai]["name"], "desc": archetypes[ai]["desc"]}
        assigned_clusters.add(ci)
        assigned_archetypes.add(ai)

    # Fallback para clusters sin asignación
    for i in range(len(centroids)):
        if i not in assignments:
            assignments[i] = {"name": f"Perfil {pos.upper()}-{i+1}", "desc": ""}

    return assignments


# ============================================================
# CLASE PRINCIPAL
# ============================================================

class PlayerClassifier:
    """
    Motor de clasificación de jugadores por GMM.

    Entrena un modelo Gaussian Mixture por posición (gk/df/mf/fw),
    asigna nombres de perfil realistas para scouting, y expone
    clasificaciones en memoria.
    """

    POS_ORDER = ["gk", "df", "mf", "fw"]

    def __init__(self):
        self.df: pd.DataFrame | None = None
        self.models: dict[str, GaussianMixture] = {}
        self.scalers: dict[str, StandardScaler] = {}
        self.profiles: dict[str, dict[int, dict]] = {}   # pos -> {cluster_id: {name, desc}}
        self.player_map: dict[int, dict] = {}             # player_id -> classification
        self.cluster_info: dict[str, list[dict]] = {}     # pos -> [{id, name, desc, size, features}]
        self._feature_names: dict[str, list[str]] = {}
        self._is_fitted = False

    # ----------------------------------------------------------
    def fit(self):
        """Carga datos, entrena GMMs, asigna perfiles a todos los jugadores."""
        print("[clustering] Cargando datos...")
        raw = load_data()

        if raw.empty:
            print("[clustering] ERROR: No hay datos disponibles.")
            return

        # En lugar de usar solo la temporada global más reciente (que puede estar incompleta),
        # buscamos para cada jugador su temporada más reciente donde tenga >= MIN_MINUTES.
        if "Min" in raw.columns:
            # Primero nos quedamos con las filas válidas (o todas si queremos asegurar no perder a nadie, 
            # pero el GMM necesita minutos suficientes para que las stats per90 sean estables).
            valid_rows = raw[raw["Min"] >= MIN_MINUTES].copy()
            if valid_rows.empty:
                print(f"[clustering] ADVERTENCIA: Nadie tiene >= {MIN_MINUTES} mins. Usando todos.")
                valid_rows = raw.copy()
        else:
            valid_rows = raw.copy()

        # Ordenar por Temporada (desc) y Minutos (desc), luego deduplicar por PlayerID.
        # Esto asegura que nos quedamos con la mejor/más reciente temporada válida del jugador.
        before = len(raw["PlayerID"].unique())
        df = valid_rows.sort_values(["Season", "Min"], ascending=[False, False])
        df = df.drop_duplicates(subset="PlayerID", keep="first")
        
        print(f"[clustering] Jugadores únicos con ≥{MIN_MINUTES} min: {len(df)} (de {before} totales)")

        # Normalizar posición
        df["_pos"] = df["Pos"].apply(_normalize_position)

        # Construir features derivadas
        df = _build_features(df)
        self.df = df.reset_index(drop=True)

        # Entrenar un GMM por posición
        for pos in self.POS_ORDER:
            pos_df = self.df[self.df["_pos"] == pos].copy()
            if len(pos_df) < 10:
                print(f"[clustering] {pos.upper()} - pocos jugadores ({len(pos_df)}), omitido.")
                continue

            self._fit_position(pos, pos_df)

        self._is_fitted = True
        print(f"[clustering] Motor listo — {len(self.player_map)} jugadores clasificados.")

    # ----------------------------------------------------------
    def _fit_position(self, pos: str, pos_df: pd.DataFrame):
        """Entrena el GMM para una posición y asigna perfiles."""
        # Seleccionar features disponibles
        all_features = FEATURES_BY_POS.get(pos, [])
        available = [f for f in all_features if f in pos_df.columns]
        if len(available) < 3:
            print(f"[clustering] {pos.upper()} - insuficientes features ({len(available)}), omitido.")
            return

        X = pos_df[available].fillna(0).values
        self._feature_names[pos] = available

        # Escalar y limitar valores atípicos extremos (outliers)
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        X_scaled = np.clip(X_scaled, -3.5, 3.5)
        self.scalers[pos] = scaler

        # En lugar de usar BIC (que penaliza mucho la complejidad y a menudo colapsa todo en K=2),
        # forzamos al GMM a crear tantos clusters como arquetipos hemos definido para esa posición.
        # Esto garantiza mayor granularidad (ej: 6 perfiles distintos para medios en lugar de solo 2).
        best_k = len(ARCHETYPES.get(pos, []))
        if best_k < 2:
            best_k = 2
        
        # Límite por si hay muy pocos jugadores
        if best_k >= len(pos_df):
            best_k = len(pos_df) // 2

        print(f"[clustering] {pos.upper()} - Forzando K={best_k} (basado en número de arquetipos definidos)")

        # Entrenar modelo final
        gmm = GaussianMixture(n_components=best_k, random_state=42, n_init=5)
        gmm.fit(X_scaled)
        self.models[pos] = gmm

        # Predicciones
        labels = gmm.predict(X_scaled)
        probs = gmm.predict_proba(X_scaled)

        # Asignar nombres de arquetipo a los clusters
        centroids = gmm.means_
        profile_map = _assign_archetype_names(pos, centroids, available)
        self.profiles[pos] = profile_map

        # Info de clusters para el endpoint
        cluster_info = []
        for cid, meta in profile_map.items():
            mask = labels == cid
            centroid_dict = dict(zip(available, centroids[cid]))
            # Top features del centroide
            top_features = sorted(centroid_dict.items(), key=lambda x: abs(x[1]), reverse=True)[:5]
            cluster_info.append({
                "id": cid,
                "name": meta["name"],
                "desc": meta["desc"],
                "size": int(mask.sum()),
                "top_features": [{"feature": f, "z_score": round(float(z), 3)} for f, z in top_features],
            })
        self.cluster_info[pos] = cluster_info

        # Clasificar cada jugador
        for i, (_, row) in enumerate(pos_df.iterrows()):
            pid = int(row["PlayerID"])
            cluster_id = int(labels[i])
            max_prob = float(probs[i].max())
            primary = profile_map[cluster_id]

            # Perfil secundario (segundo cluster más probable)
            sorted_probs = np.argsort(probs[i])[::-1]
            secondary_id = int(sorted_probs[1]) if len(sorted_probs) > 1 else cluster_id
            secondary = profile_map.get(secondary_id, {"name": "", "desc": ""})

            is_hybrid = max_prob < HYBRID_THRESHOLD

            self.player_map[pid] = {
                "player_id": pid,
                "player": str(row.get("Player", "")),
                "position": pos,
                "cluster_id": cluster_id,
                "cluster_prob": round(max_prob, 4),
                "is_hybrid": is_hybrid,
                "perfil_principal": primary["name"],
                "perfil_secundari": secondary["name"] if is_hybrid else "",
                "perfil_desc": primary["desc"],
                "perfil_historico": primary["name"],  # Misma temporada por ahora
            }

        print(
            f"[clustering] {pos.upper()} - "
            f"{len(pos_df)} jugadores, {len(available)} features, "
            f"{best_k} clusters: {[p['name'] for p in profile_map.values()]}"
        )

    # ----------------------------------------------------------
    def classify(self, player_id: int) -> dict | None:
        """Devuelve la clasificación de un jugador, o None si no existe."""
        if not self._is_fitted:
            self.fit()
        return self.player_map.get(player_id)

    def classify_batch(self, player_ids: list[int]) -> dict[int, dict]:
        """Clasificación batch: devuelve {player_id: classification}."""
        if not self._is_fitted:
            self.fit()
        return {pid: self.player_map[pid] for pid in player_ids if pid in self.player_map}

    def classify_all(self) -> dict[int, dict]:
        """Devuelve todas las clasificaciones."""
        if not self._is_fitted:
            self.fit()
        return dict(self.player_map)

    def get_clusters(self, pos: str) -> list[dict]:
        """Info de clusters para una posición."""
        if not self._is_fitted:
            self.fit()
        return self.cluster_info.get(pos, [])

    def get_all_profiles(self) -> list[str]:
        """Catálogo de nombres de perfil únicos."""
        if not self._is_fitted:
            self.fit()
        profiles = set()
        for pos_profiles in self.profiles.values():
            for meta in pos_profiles.values():
                profiles.add(meta["name"])
        return sorted(profiles)


# Instancia global importada por main.py
classifier = PlayerClassifier()
