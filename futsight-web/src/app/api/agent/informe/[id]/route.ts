import { NextResponse } from 'next/server';

const AGENT_BASE_URL = (process.env.AGENT_API_URL || process.env.LANGGRAPH_AGENT_URL || '').replace(/\/$/, '');

export type InformeResponse = {
    resumen?: string;
    fortalezas?: string[];
    debilidades?: string[];
};

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    if (!id) {
        return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    if (!AGENT_BASE_URL) {
        return NextResponse.json({ error: 'AGENT_API_URL no configurada' }, { status: 503 });
    }

    try {
        const res = await fetch(`${AGENT_BASE_URL}/jugador/${encodeURIComponent(id)}/informe`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
            const text = await res.text();
            return NextResponse.json(
                { error: text || `Informe no disponible (${res.status})` },
                { status: res.status }
            );
        }
        const data = (await res.json()) as InformeResponse;
        return NextResponse.json(data);
    } catch (e) {
        console.error('[Agente] GET /jugador/:id/informe failed:', e);
        return NextResponse.json(
            { error: 'No se pudo obtener el informe' },
            { status: 502 }
        );
    }
}
