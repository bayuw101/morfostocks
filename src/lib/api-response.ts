import { NextResponse } from 'next/server'

export function apiError(e: unknown) {
    const msg = e instanceof Error ? e.message : 'INTERNAL_ERROR'
    const code = msg.split(':')[0].trim()
    const map: Record<string, number> = {
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        INVALID_TRANSITION: 409,
        VALIDATION_ERROR: 422,
        ATTEMPT_NOT_EDITABLE: 409,
    }
    return NextResponse.json({ error: msg }, { status: map[code] ?? 500 })
}
