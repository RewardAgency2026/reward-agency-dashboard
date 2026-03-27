import { NextResponse } from "next/server";

/** Finalization is now automatic (cron on 1st of month). This endpoint is retired. */
export async function PATCH() {
  return NextResponse.json(
    { error: "Manual finalization has been removed. Commissions are finalized automatically by cron on the 1st of each month." },
    { status: 410 }
  );
}
