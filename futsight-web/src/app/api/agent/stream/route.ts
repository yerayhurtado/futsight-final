/**
 * POST /api/agent/stream
 *
 * Proxy SSE: reenvía los eventos del backend Python (/buscar-stream)
 * al frontend en tiempo real. Cada evento SSE contiene el progreso
 * de un nodo del pipeline del agente.
 *
 * Cuando llega el evento "result", inyecta los datos completos de
 * los jugadores (llamando a /jugadores) para que el frontend tenga
 * todo en un solo stream.
 */

const AGENT_BASE_URL = (process.env.AGENT_API_URL || process.env.LANGGRAPH_AGENT_URL || '').replace(/\/$/, '');

export async function POST(request: Request) {
    let query = '';
    try {
        const body = await request.json();
        query = typeof body?.query === 'string' ? body.query : '';
    } catch {
        return new Response('data: {"error":"Petición incorrecta"}\n\n', {
            status: 400,
            headers: { 'Content-Type': 'text/event-stream' },
        });
    }

    if (!AGENT_BASE_URL) {
        return new Response(
            `event: error\ndata: ${JSON.stringify({ message: 'AGENT_API_URL no configurada' })}\n\n`,
            { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
        );
    }

    const streamUrl = `${AGENT_BASE_URL}/buscar-stream`;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90000);

        const agentRes = await fetch(streamUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query.trim() }),
            signal: controller.signal,
        });

        if (!agentRes.ok || !agentRes.body) {
            clearTimeout(timeout);
            return new Response(
                `event: error\ndata: ${JSON.stringify({ message: `Agente respondió ${agentRes.status}` })}\n\n`,
                { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
            );
        }

        // Crear un TransformStream que intercepta el evento "result"
        // para enriquecer con datos de /jugadores
        const reader = agentRes.body.getReader();
        const decoder = new TextDecoder();

        const stream = new ReadableStream({
            async start(ctrl) {
                const encoder = new TextEncoder();
                let buffer = '';

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });

                        // Procesar eventos completos (separados por \n\n)
                        const parts = buffer.split('\n\n');
                        buffer = parts.pop() || '';

                        for (const part of parts) {
                            if (!part.trim()) continue;

                            // Detectar si es un evento "result" para enriquecer con jugadores
                            if (part.startsWith('event: result')) {
                                const dataLine = part.split('\n').find(l => l.startsWith('data: '));
                                if (dataLine) {
                                    try {
                                        const resultData = JSON.parse(dataLine.slice(6));
                                        const playerIds: number[] = resultData.player_ids ?? [];

                                        // Cargar jugadores completos
                                        if (playerIds.length > 0) {
                                            try {
                                                const idsParam = playerIds.map(String).join(',');
                                                const jugadoresRes = await fetch(
                                                    `${AGENT_BASE_URL}/jugadores?ids=${encodeURIComponent(idsParam)}`,
                                                    { signal: controller.signal },
                                                );
                                                if (jugadoresRes.ok) {
                                                    const jugData = (await jugadoresRes.json()) as { jugadores?: unknown[] };
                                                    resultData.jugadores = jugData.jugadores ?? [];
                                                }
                                            } catch (e) {
                                                console.error('[Stream] GET /jugadores failed:', e);
                                                resultData.jugadores = [];
                                            }
                                        } else {
                                            resultData.jugadores = [];
                                        }

                                        // Emitir evento result enriquecido
                                        const enriched = `event: result\ndata: ${JSON.stringify(resultData)}\n\n`;
                                        ctrl.enqueue(encoder.encode(enriched));
                                        continue;
                                    } catch {
                                        // Si falla el parsing, reenviar tal cual
                                    }
                                }
                            }

                            // Reenviar evento tal cual (node_start, node_end, error)
                            ctrl.enqueue(encoder.encode(part + '\n\n'));
                        }
                    }

                    // Enviar lo que quede en el buffer
                    if (buffer.trim()) {
                        ctrl.enqueue(encoder.encode(buffer + '\n\n'));
                    }
                } catch (e) {
                    const errMsg = e instanceof Error ? e.message : String(e);
                    ctrl.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: errMsg })}\n\n`));
                } finally {
                    clearTimeout(timeout);
                    ctrl.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        });
    } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        return new Response(
            `event: error\ndata: ${JSON.stringify({ message: errMsg })}\n\n`,
            { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
        );
    }
}
