'use server';

import prisma from './prisma';

/**
 * Estructura completa de les dades de jugadors.
 * Los perfiles GMM se obtienen dinámicamente del clustering-service.
 */
export interface PlayerData {
  [x: string]: any;
  Perfil_Historico: any;
  Perfil_Secundari: any;
  Perfil_Principal: any;
  PlayerID: number;      // Identificador únic del jugador
  Player: string;        // Nom del jugador
  Nation: string;        // Nacionalitat (codi de país)
  Pos_Main: string;      // Posició principal (df, mf, fw, gk)
  Squad: string;         // Equip actual
  Age: number;           // Edat del jugador
  Cluster_ID: number;    // ID del clúster assignat pel GMM (0, 1, 2)
  Puresa_Perfil: number; // Probabilitat d'assignació al clúster (0-1)
  Es_Hibrid: string;     // 'Sí' o 'No' segons el llindar de probabilitat
  Perfil_Nom: string;    // Nom descriptiu del perfil (ex: 'Mur Defensiu')
  Season?: string;       // Temporada de les dades (opcional per deduplicació)
  /** Altura en cm (jugadores_con_historial_y_cutout) */
  Altura?: number;
  /** Pierna preferida: right, left (jugadores_con_historial_y_cutout) */
  Pierna_Buena?: string;
}

/**
 * Cache en memoria de las clasificaciones del clustering-service.
 * Se refresca cada 5 minutos o al arrancar.
 */
let _clusteringCache: Record<number, any> | null = null;
let _clusteringCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

async function fetchClusteringData(): Promise<Record<number, any>> {
  const now = Date.now();
  // if (_clusteringCache && (now - _clusteringCacheTime) < CACHE_TTL_MS) {
  //   return _clusteringCache;
  // }

  const clusteringUrl = process.env.CLUSTERING_API_URL || 'http://localhost:8003';
  try {
    const res = await fetch(`${clusteringUrl}/classify/all`, {
      cache: 'no-store', // Forzar fetch siempre, no usar cache de Next.js
    });
    if (res.ok) {
      const data = await res.json();
      _clusteringCache = data.classifications || {};
      _clusteringCacheTime = now;
      return _clusteringCache!;
    }
  } catch (err) {
    console.warn('[getPlayers] Clustering service no disponible, usando fallback:', err);
  }
  return {};
}

/**
 * Llegeix els jugadors de la BD i els enriqueix amb perfils del clustering-service.
 */
export async function getPlayers(filters?: { season?: string }): Promise<PlayerData[]> {
  try {
    const players = await prisma.player.findMany({
      where: filters?.season ? { season: filters.season } : undefined
    });

    // Obtener clasificaciones del clustering-service
    const classifications = await fetchClusteringData();

    return players.map(p => {
      const stats = JSON.parse(p.statsJson || '{}');
      const cls = classifications[p.playerID] || {};

      return {
        ...stats,
        PlayerID: p.playerID,
        Player: p.player,
        Squad: p.squad,
        League: p.league,
        Nation: p.nation,
        Pos_Main: p.pos_main,
        Age: p.age,
        Season: p.season,
        market_value_in_eur: p.marketValue,
        Valor_Mercado: p.marketValue,
        // Campos GMM del clustering-service
        Cluster_ID: cls.cluster_id ?? null,
        Puresa_Perfil: cls.cluster_prob ?? 0,
        Es_Hibrid: cls.is_hybrid ? 'Sí' : 'No',
        Perfil_Nom: cls.perfil_principal ?? '',
        Perfil_Principal: cls.perfil_principal ?? '',
        Perfil_Secundari: cls.perfil_secundari ?? '',
        Perfil_Historico: cls.perfil_historico ?? cls.perfil_principal ?? '',
        strCutout: p.strCutout,
        Pierna_Buena: p.piernaBuena,
        Altura: p.altura,
      };
    });
  } catch (err) {
    console.error("Error fetching from Prisma:", err);
    throw err;
  }
}