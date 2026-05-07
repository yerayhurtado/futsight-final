import { NextRequest, NextResponse } from 'next/server';

const PREDICTION_API = process.env.PREDICTION_API_URL ?? 'http://localhost:8001';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const player = searchParams.get('player');

  if (!player) {
    return NextResponse.json(
      { error: 'El parámetro "player" es obligatorio.' },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `${PREDICTION_API}/predict?player=${encodeURIComponent(player)}`,
      { next: { revalidate: 0 } } // sin caché, siempre fresco
    );

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail ?? 'Error en el servicio de predicción.' },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: 'El servicio de predicción no está disponible. ¿Está corriendo prediction-service?' },
      { status: 503 }
    );
  }
}
