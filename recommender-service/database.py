import pandas as pd
import sqlite3
import os
import json

def load_data() -> pd.DataFrame:
    # Path a la base de datos SQLite de Prisma (montada por Docker)
    candidates = [
        "/app/dev.db",
        "/futsight-web/dev.db",
        "../dev.db"
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

    # Reconstrucción mínima necesaria para el recomendador
    stats_list = df_raw['statsJson'].apply(json.loads).tolist()
    df_stats = pd.DataFrame(stats_list)
    
    df_base = df_raw.drop(columns=['statsJson', 'id'])
    rename_map = {
        'playerID': 'PlayerID', 'player': 'Player', 'squad': 'Squad',
        'pos_main': 'Pos', 'age': 'Age', 'season': 'Season'
    }
    df_base = df_base.rename(columns=rename_map)
    
    df = pd.concat([df_base, df_stats], axis=1)
    return df.loc[:, ~df.columns.duplicated()]
