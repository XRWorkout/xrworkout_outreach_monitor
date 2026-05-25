import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Invalid request", details: error.issues }, { status: 400 });
  }
  if (error instanceof Error) {
    const status = error.message.includes("cannot") || error.message.includes("Only email") ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ error: "Unexpected dashboard error" }, { status: 500 });
}
