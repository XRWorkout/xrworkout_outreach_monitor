import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Invalid request", details: error.issues }, { status: 400 });
  }
  if (error instanceof Error) {
    const conflict = ["cannot", "Only email", "dry-run only"].some((text) => error.message.includes(text));
    const status = conflict ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ error: "Unexpected dashboard error" }, { status: 500 });
}
