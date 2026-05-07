import { getPlayers } from '@/lib/getPlayers';
import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const all = await getPlayers();
    const rows = all
      .filter((p) => String(p.PlayerID) === String(id))
      .map((p) => ({
        Season: p.Season ?? '',
        Valor_Mercado: p.Valor_Mercado ?? null,
        Gls: p.Gls ?? null,
        Ast: p.Ast ?? null,
        Min: p.Min ?? null,
        Age: p.Age ?? null,
      }))
      .filter((r) => r.Season)
      .sort((a, b) => (a.Season < b.Season ? -1 : 1));

    return NextResponse.json({ seasons: rows });
  } catch (error) {
    return NextResponse.json({ error: 'Error leyendo datos' }, { status: 500 });
  }
}
