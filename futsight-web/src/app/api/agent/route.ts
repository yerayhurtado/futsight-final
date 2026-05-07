import { NextResponse } from 'next/server';

const AGENT_BASE_URL = (process.env.AGENT_API_URL || process.env.LANGGRAPH_AGENT_URL || '').replace(/\/$/, '');

export type AgentSearchResponse = {
    jugadores: Array<Record<string, unknown>>;
    explicacion: string;
    basado_en: string;
    recomendacion: string;
    orden: string;
    filtros_relajados: string;
    error: string;
    busquedas_similares: string[];
};

const emptyResponse = (error: string): AgentSearchResponse => ({
    jugadores: [],
    explicacion: '',
    basado_en: '',
    recomendacion: '',
    orden: '',
    filtros_relajados: '',
    error,
    busquedas_similares: [],
});

export async function POST(request: Request) {
    let query = '';
    try {
        const body = await request.json();
        query = typeof body?.query === 'string' ? body.query : '';
    } catch {
        return NextResponse.json(emptyResponse('Petición incorrecta. Envía un JSON con "query".'), { status: 400 });
    }

    if (!AGENT_BASE_URL) {
        return NextResponse.json(
            emptyResponse('Configura AGENT_API_URL en .env.local (ej: http://127.0.0.1:8000).')
        );
    }

    const buscarUrl = `${AGENT_BASE_URL}/buscar`;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        const buscarRes = await fetch(buscarUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query.trim() }),
            signal: controller.signal,
        });

        if (!buscarRes.ok) {
            clearTimeout(timeout);
            const text = await buscarRes.text();
            console.error(`[Agente] POST ${buscarUrl} → ${buscarRes.status}`, text.slice(0, 300));
            return NextResponse.json(
                emptyResponse(`El agente respondió ${buscarRes.status}. Revisa la consola del servidor.`)
            );
        }

        let buscarData: unknown;
        try {
            buscarData = await buscarRes.json();
        } catch {
            clearTimeout(timeout);
            console.error('[Agente] Respuesta de /buscar no es JSON válido');
            return NextResponse.json(emptyResponse('La respuesta del agente no es válida.'));
        }

        const data = buscarData as Record<string, unknown>;
        const playerIds = Array.isArray(data.player_ids) ? data.player_ids : [];
        const explicacion = typeof data.explicacion === 'string' ? data.explicacion : '';
        const basado_en = typeof data.basado_en === 'string' ? data.basado_en : '';
        const recomendacion = typeof data.recomendacion === 'string' ? data.recomendacion : '';
        const orden = typeof data.orden === 'string' ? data.orden : '';
        const filtros_relajados = typeof data.filtros_relajados === 'string' ? data.filtros_relajados : '';
        const error = typeof data.error === 'string' ? data.error : '';
        const busquedas_similares = Array.isArray(data.busquedas_similares)
            ? (data.busquedas_similares as string[]).filter((s) => typeof s === 'string')
            : [];

        let jugadores: Array<Record<string, unknown>> = [];

        if (playerIds.length > 0) {
            try {
                const idsParam = playerIds.map(String).join(',');
                const jugadoresRes = await fetch(`${AGENT_BASE_URL}/jugadores?ids=${encodeURIComponent(idsParam)}`, {
                    method: 'GET',
                    signal: controller.signal,
                });
                if (jugadoresRes.ok) {
                    const jugadoresData = (await jugadoresRes.json()) as { jugadores?: unknown[] };
                    jugadores = Array.isArray(jugadoresData.jugadores)
                        ? (jugadoresData.jugadores as Array<Record<string, unknown>>)
                        : [];
                } else {
                    console.error(`[Agente] GET /jugadores → ${jugadoresRes.status}`);
                }
            } catch (e) {
                console.error('[Agente] GET /jugadores failed:', e);
            }
        }

        clearTimeout(timeout);
        return NextResponse.json({
            jugadores,
            explicacion,
            basado_en,
            recomendacion,
            orden,
            filtros_relajados,
            error,
            busquedas_similares,
        } satisfies AgentSearchResponse);
    } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        console.error('[Agente] POST', buscarUrl, 'failed:', err.message, err.cause ?? '');
        return NextResponse.json(
            emptyResponse('No se pudo conectar al agente. Comprueba que esté en marcha y AGENT_API_URL en .env.local (ej: http://127.0.0.1:8000).')
        );
    }
}
