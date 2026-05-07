import { NextRequest, NextResponse } from 'next/server';

const PREDICTION_API = process.env.PREDICTION_API_URL ?? 'http://localhost:8001';

/**
 * GET /api/predict/batch?players=Lamine+Yamal,Erling+Haaland,...
 * Proxy al microservicio FastAPI /predict/batch
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const players = searchParams.get('players');

  if (!players) {
    return NextResponse.json(
      { error: 'El parámetro "players" es obligatorio.' },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `${PREDICTION_API}/predict/batch?players=${encodeURIComponent(players)}`,
      { next: { revalidate: 0 } }
    );

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail ?? 'Error en el servicio de predicción batch.' },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: 'El servicio de predicción no está disponible.' },
      { status: 503 }
    );
  }
}
