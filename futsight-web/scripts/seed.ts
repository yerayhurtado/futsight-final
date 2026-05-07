import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import path from 'path';
import Papa from 'papaparse';

const adapter = new PrismaLibSql({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  const filePath = path.join(process.cwd(), '..', 'futsigh_agent', 'data', 'jugadores_con_historial_y_cutout.csv');
  console.log('Leyendo CSV desde:', filePath);
  
  if (!fs.existsSync(filePath)) {
    throw new Error('Archivo no encontrado');
  }

  const fileContent = fs.readFileSync(filePath, 'utf8');

  // Usamos Promise para esperar a que Papaparse termine y el batch se complete
  await new Promise<void>((resolve, reject) => {
    Papa.parse(fileContent, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: async (results) => {
        try {
          const data = results.data as Record<string, any>[];
          const validData = data.filter(p => p.PlayerID !== undefined && p.PlayerID !== null);
          
          console.log(`Encontrados ${validData.length} registros válidos. Limpiando BD e insertando...`);

          await prisma.player.deleteMany({});
          
          const BATCH_SIZE = 500;
          for (let i = 0; i < validData.length; i += BATCH_SIZE) {
            const batch = validData.slice(i, i + BATCH_SIZE);
            const mappedBatch = batch.map(row => {
              const {
                PlayerID, Player, Squad, League, Nation, Pos_Main, Age, Season,
                market_value_in_eur, Valor_Mercado,
                Cluster_ID, Puresa_Perfil, Es_Hibrid, Perfil_Nom, Perfil_Principal, Perfil_Secundari, Perfil_Historico,
                strCutout, Pierna_Buena, Altura,
                ...otherStats
              } = row;

              return {
                playerID: Number(PlayerID),
                player: String(Player || ''),
                squad: String(Squad || ''),
                league: League ? String(League) : null,
                nation: Nation ? String(Nation) : null,
                pos_main: String(Pos_Main || row.Pos || ''),
                age: Age !== null && Age !== undefined ? Number(Age) : null,
                season: Season ? String(Season) : null,
                marketValue: Number(Valor_Mercado || market_value_in_eur || 0),
                clusterId: Cluster_ID !== undefined && Cluster_ID !== null ? Number(Cluster_ID) : null,
                puresaPerfil: Puresa_Perfil !== undefined && Puresa_Perfil !== null ? Number(Puresa_Perfil) : null,
                esHibrid: Es_Hibrid ? String(Es_Hibrid) : null,
                perfilNom: Perfil_Nom ? String(Perfil_Nom) : null,
                perfilPrincipal: Perfil_Principal ? String(Perfil_Principal) : null,
                perfilSecundari: Perfil_Secundari ? String(Perfil_Secundari) : null,
                perfilHistorico: Perfil_Historico ? String(Perfil_Historico) : null,
                strCutout: strCutout ? String(strCutout) : null,
                piernaBuena: Pierna_Buena ? String(Pierna_Buena) : null,
                altura: Altura !== null && Altura !== undefined ? Number(Altura) : null,
                statsJson: JSON.stringify(otherStats)
              };
            });

            await prisma.player.createMany({
              data: mappedBatch
            });
            
            console.log(`Insertados ${Math.min(i + batch.length, validData.length)} de ${validData.length}...`);
          }
          
          console.log('Sembrado completado correctamente.');
          resolve();
        } catch (err) {
          reject(err);
        }
      },
      error: (err: Error) => {
        reject(err);
      }
    });
  });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
