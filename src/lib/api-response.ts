import { NextResponse } from 'next/server';

export function ok(data: Record<string, unknown> = {}) {
  return NextResponse.json({ success: true, ...data });
}

export function fail(message: string, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status });
}
