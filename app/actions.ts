"use server";

import { redirect } from "next/navigation";
import { parseEventInput } from "@/lib/vex/parse";

export type FindEventState = { error: string | null; value: string };

export async function findEvent(_prev: FindEventState, formData: FormData): Promise<FindEventState> {
  const value = String(formData.get("event") ?? "");
  const parsed = parseEventInput(value);
  if (!parsed.ok) return { error: parsed.error, value };
  redirect(`/event/${parsed.sku}`);
}
