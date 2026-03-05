import { NextResponse } from "next/server";
import { getRankedFundamentals } from "@/lib/fundamentals";

export async function GET() {
    try {
        const data = await getRankedFundamentals();
        return NextResponse.json({ data });
    } catch (e: any) {
        console.error("Fundamental screener error:", e);
        return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
    }
}
