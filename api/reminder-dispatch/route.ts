import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const jobId = body?.jobId;

    if (!jobId) {
      return NextResponse.json(
        { ok: false, error: 'Missing jobId' },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, jobId });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Use POST /api/reminder-dispatch',
  });
}