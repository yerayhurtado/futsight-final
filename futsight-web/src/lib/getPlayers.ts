'use server';

import prisma from './prisma';

/**
 * Estructura completa de les dades de jugadors basat en el 
 * dataset processat pel model GMM (Gaussian Mixture Model).
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
 * Llegeix el fitxer CSV des de la carpeta pública i el parseja
 * per ser utilitzat en components de servidor o API Routes.
 */
// ... (mismos imports)

export async function getPlayers(): Promise<PlayerData[]> {
  try {
    const players = await prisma.player.findMany();
    
    return players.map(p => {
      const stats = JSON.parse(p.statsJson || '{}');
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
        Cluster_ID: p.clusterId,
        Puresa_Perfil: p.puresaPerfil,
        Es_Hibrid: p.esHibrid,
        Perfil_Nom: p.perfilNom,
        Perfil_Principal: p.perfilPrincipal,
        Perfil_Secundari: p.perfilSecundari,
        Perfil_Historico: p.perfilHistorico,
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