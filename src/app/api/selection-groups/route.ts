import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { SelectionData } from "@/lib/db-types";

// GET /api/selection-groups - List all selection groups
export async function GET() {
  try {
    const db = getDb();

    const selectionGroups = await db
      .selectFrom("selection_groups")
      .select(["id", "name", "created_at", "updated_at"])
      .orderBy("created_at", "desc")
      .execute();

    return NextResponse.json(selectionGroups);
  } catch (error) {
    console.error("Error fetching selection groups:", error);
    return NextResponse.json({ error: "Failed to fetch selection groups" }, { status: 500 });
  }
}

// POST /api/selection-groups - Create new selection group
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, data } = body;

    // Validation
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required and must be a non-empty string" }, { status: 400 });
    }

    if (!data || typeof data !== "object") {
      return NextResponse.json({ error: "Data is required and must be an object" }, { status: 400 });
    }

    // Validate data structure
    for (const [key, value] of Object.entries(data)) {
      if (!value || typeof value !== "object") {
        return NextResponse.json({ error: `Invalid data format for "${key}"` }, { status: 400 });
      }

      const { start, end } = value as { start?: unknown; end?: unknown };

      if (typeof start !== "number" || typeof end !== "number") {
        return NextResponse.json({ error: `Invalid start/end values for "${key}"` }, { status: 400 });
      }

      if (start < 0 || end < 0 || start >= end) {
        return NextResponse.json(
          { error: `Invalid time range for "${key}": start must be less than end` },
          { status: 400 }
        );
      }
    }

    const db = getDb();

    // Check for duplicate name
    const existing = await db
      .selectFrom("selection_groups")
      .select("id")
      .where("name", "=", name.trim())
      .executeTakeFirst();

    if (existing) {
      return NextResponse.json({ error: "A selection group with this name already exists" }, { status: 409 });
    }

    // Insert new selection group
    const newGroup = await db
      .insertInto("selection_groups")
      .values({
        name: name.trim(),
        data: JSON.stringify(data) as any,
      })
      .returning(["id", "name", "data", "created_at", "updated_at"])
      .executeTakeFirstOrThrow();

    return NextResponse.json(newGroup, { status: 201 });
  } catch (error) {
    console.error("Error creating selection group:", error);

    if (error instanceof Error && error.message.includes("unique constraint")) {
      return NextResponse.json({ error: "A selection group with this name already exists" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to create selection group" }, { status: 500 });
  }
}
