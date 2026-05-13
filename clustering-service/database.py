"""
Módulo de acceso a datos para el Clustering Service.

Lee la tabla Player de SQLite, expande statsJson, y devuelve un DataFrame
listo para el motor de clasificación GMM.
"""

import pandas as pd
import sqlite3
import os
import json


def load_data() -> pd.DataFrame:
    """Carga todos los jugadores desde la BD SQLite compartida."""
    candidates = [
        "/app/dev.db",
        "/futsight-web/dev.db",
        "../dev.db",
    ]

    db_path = None
    for path in candidates:
        if os.path.exists(path) and os.path.getsize(path) > 0:
            db_path = path
            break

    if not db_path:
        raise FileNotFoundError(f"No se encontró la DB en {candidates}")

    conn = sqlite3.connect(db_path)
    df_raw = pd.read_sql_query("SELECT * FROM Player", conn)
    conn.close()

    print(f"[database] Cargadas {len(df_raw)} filas de la tabla Player")

    if df_raw.empty:
        return df_raw

    # Expandir statsJson a columnas
    stats_list = df_raw["statsJson"].apply(json.loads).tolist()
    df_stats = pd.DataFrame(stats_list)

    # Renombrar columnas Prisma → nombres internos del modelo
    df_base = df_raw.drop(columns=["statsJson", "id"], errors="ignore")
    rename_map = {
        "playerID": "PlayerID",
        "player": "Player",
        "squad": "Squad",
        "league": "League",
        "nation": "Nation",
        "pos_main": "Pos",
        "age": "Age",
        "season": "Season",
        "marketValue": "Valor_Mercado",
        "strCutout": "strCutout",
        "piernaBuena": "Pierna_Buena",
        "altura": "Altura",
    }
    df_base = df_base.rename(columns=rename_map)

    df = pd.concat([df_base, df_stats], axis=1)
    df = df.loc[:, ~df.columns.duplicated()]

    # Asegurar tipos numéricos para las columnas de estadísticas
    # (Evita errores al calcular per-90 o al entrenar el GMM)
    cols_to_numeric = [
        "Min", "90s", "Gls", "Ast", "Sh", "SoT", "xG", "npxG", "xAG", "xA",
        "Pass", "Cmp", "KP", "SCA", "PrgC", "PrgP", "PrgR", "Carries", "Touches",
        "Won", "Lost", "Tkl", "Int", "Blocks", "Clr", "Recov", "CPA",
    ]
    for col in cols_to_numeric:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    return df
