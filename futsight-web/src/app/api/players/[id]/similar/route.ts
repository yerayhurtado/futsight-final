import { NextRequest, NextResponse } from "next/server";

const RECOMMENDER_API = process.env.RECOMMENDER_API_URL ?? "http://localhost:8002";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "El ID del jugador es obligatorio." },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `${RECOMMENDER_API}/similar/${id}`,
      { next: { revalidate: 3600 } }
    );

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail ?? "Error al obtener jugadores similares." },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("[Similar] API Error:", e);
    return NextResponse.json(
      { error: "El servicio de recomendación no está disponible." },
      { status: 503 }
    );
  }
}
