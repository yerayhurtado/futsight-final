import { getPlayers } from '../src/lib/getPlayers';

async function main() {
  console.log("Fetching players from DB...");
  const start = Date.now();
  const players = await getPlayers();
  const time = Date.now() - start;
  
  console.log(`Fetched ${players.length} players in ${time}ms`);
  
  if (players.length > 0) {
    const p = players[0];
    console.log("Sample player:", {
      Player: p.Player,
      Age: p.Age,
      Squad: p.Squad,
      Pos_Main: p.Pos_Main,
      Altura: p.Altura,
      marketValue: p.market_value_in_eur,
      statsKeys: Object.keys(p).length
    });
  }
}

main().catch(console.error);
