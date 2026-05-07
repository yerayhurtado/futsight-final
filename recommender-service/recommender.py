import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity
from database import load_data

class PlayerRecommender:
    def __init__(self):
        self.df = None
        self.features_by_pos = {
            'fw': ['Gls', 'Ast', 'xG', 'npxG', 'SoT/90', 'Won', 'SCA', 'Touches', 'Att Pen'],
            'mf': ['Ast', 'Cmp%', 'PrgP', 'SCA', 'KP', 'Tkl', 'Int', 'Recov', 'Touches'],
            'df': ['Tkl', 'Int', 'Blocks', 'Clr', 'Won%', 'Cmp%', 'PrgP', 'Recov'],
            'gk': ['Cmp%', 'Recov', 'Tkl'] # Simplificado para porteros si no hay datos específicos de paradas
        }
        self.scalers = {}
        self.matrices = {}
        self.id_to_index = {}

    def _normalize_position(self, pos_raw):
        pos_raw = str(pos_raw).lower()
        if "fw" in pos_raw or "st" in pos_raw or "cf" in pos_raw: return "fw"
        elif "df" in pos_raw or "cb" in pos_raw or "lb" in pos_raw or "rb" in pos_raw: return "df"
        elif "gk" in pos_raw: return "gk"
        return "mf"

    def fit(self):
        print("[recommender] Cargando datos y filtrando por última temporada...")
        self.df = load_data()
        
        if self.df.empty:
            print("[recommender] ERROR: No hay datos disponibles.")
            return

        # Encontrar la temporada más reciente
        latest_season = self.df['Season'].max()
        print(f"[recommender] Filtrando por temporada: {latest_season}")
        self.df = self.df[self.df['Season'] == latest_season]
        
        for pos_code in self.features_by_pos.keys():
            pos_df = self.df[self.df['Pos'].apply(self._normalize_position) == pos_code].copy()
            if pos_df.empty: continue
            
            features = [f for f in self.features_by_pos[pos_code] if f in pos_df.columns]
            print(f"[recommender] {pos_code} - Buscando: {self.features_by_pos[pos_code]}")
            print(f"[recommender] {pos_code} - Encontrados: {features}")
            if not features: continue

            X = pos_df[features].fillna(0)
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)
            sim_matrix = cosine_similarity(X_scaled)
            
            self.scalers[pos_code] = scaler
            self.matrices[pos_code] = sim_matrix
            self.id_to_index[pos_code] = {pid: i for i, pid in enumerate(pos_df['PlayerID'].values)}
            print(f"[recommender] Cargados {len(pos_df)} jugadores para {pos_code}")
        print("[recommender] Motor listo.")

    def find_similar(self, player_id, n=5):
        if self.df is None: self.fit()
        # Encontrar el jugador y su posición
        player_row = self.df[self.df['PlayerID'] == player_id]
        if player_row.empty:
            return []
        
        pos_code = self._normalize_position(player_row.iloc[0]['Pos'])
        
        if pos_code not in self.matrices or player_id not in self.id_to_index[pos_code]:
            return []
        
        idx = self.id_to_index[pos_code][player_id]
        sim_scores = self.matrices[pos_code][idx]
        similar_indices = np.argsort(sim_scores)[::-1][1:n+1]
        
        pos_df = self.df[self.df['Pos'].apply(self._normalize_position) == pos_code]
        similar_ids = pos_df.iloc[similar_indices]['PlayerID'].values.tolist()
        scores = sim_scores[similar_indices].tolist()
        
        results = []
        for sid, score in zip(similar_ids, scores):
            p_data = self.df[self.df['PlayerID'] == sid].iloc[0]
            results.append({
                "PlayerID": int(sid),
                "Player": str(p_data['Player']),
                "Squad": str(p_data['Squad']),
                "Age": int(p_data['Age']),
                "Pos": str(p_data['Pos']),
                "Similarity": round(float(score) * 100, 1),
                "strCutout": str(p_data.get('strCutout', ''))
            })
        return results

recommender = PlayerRecommender()
