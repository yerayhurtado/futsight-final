import { getPlayers } from '@/lib/getPlayers';
import { NextResponse } from 'next/server';

const TARGET_SEASON = '2025-2026';

export async function GET() {
    try {
        const players = await getPlayers();
        
        // Filtrar únicamente jugadores con datos de la temporada 2025-2026
        const seasonPlayers = players.filter(p => p.Season === TARGET_SEASON);

        // Deduplicar por PlayerID en caso de filas duplicadas en esa temporada
        const deduped = new Map();
        seasonPlayers.forEach(player => {
            const idKey = String(player.PlayerID);
            if (!deduped.has(idKey)) {
                deduped.set(idKey, player);
            }
        });

        return NextResponse.json(Array.from(deduped.values()));
    } catch (error) {
        return NextResponse.json({ error: "Error leyendo datos" }, { status: 500 });
    }
}