import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// GET /api/selection-groups/[id] - Get specific selection group
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const groupId = Number.parseInt(id, 10);

    if (Number.isNaN(groupId)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    const db = getDb();

    const selectionGroup = await db
      .selectFrom("selection_groups")
      .selectAll()
      .where("id", "=", groupId)
      .executeTakeFirst();

    if (!selectionGroup) {
      return NextResponse.json({ error: "Selection group not found" }, { status: 404 });
    }

    return NextResponse.json(selectionGroup);
  } catch (error) {
    console.error("Error fetching selection group:", error);
    return NextResponse.json({ error: "Failed to fetch selection group" }, { status: 500 });
  }
}

// PUT /api/selection-groups/[id] - Update selection group
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const groupId = Number.parseInt(id, 10);

    if (Number.isNaN(groupId)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    const body = await request.json();
    const { name, data } = body;

    // At least one field must be provided
    if (!name && !data) {
      return NextResponse.json({ error: "At least one of name or data must be provided" }, { status: 400 });
    }

    // Validate name if provided
    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
      return NextResponse.json({ error: "Name must be a non-empty string" }, { status: 400 });
    }

    // Validate data if provided
    if (data !== undefined) {
      if (typeof data !== "object") {
        return NextResponse.json({ error: "Data must be an object" }, { status: 400 });
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
    }

    const db = getDb();

    // Check if selection group exists
    const existing = await db.selectFrom("selection_groups").select("id").where("id", "=", groupId).executeTakeFirst();

    if (!existing) {
      return NextResponse.json({ error: "Selection group not found" }, { status: 404 });
    }

    // Check for duplicate name if name is being changed
    if (name) {
      const duplicateName = await db
        .selectFrom("selection_groups")
        .select("id")
        .where("name", "=", name.trim())
        .where("id", "!=", groupId)
        .executeTakeFirst();

      if (duplicateName) {
        return NextResponse.json({ error: "A selection group with this name already exists" }, { status: 409 });
      }
    }

    // Build update query
    let query = db.updateTable("selection_groups");

    if (name !== undefined) {
      query = query.set({ name: name.trim() });
    }

    if (data !== undefined) {
      query = query.set({ data: JSON.stringify(data) as any });
    }

    const updatedGroup = await query
      .where("id", "=", groupId)
      .returning(["id", "name", "data", "created_at", "updated_at"])
      .executeTakeFirstOrThrow();

    return NextResponse.json(updatedGroup);
  } catch (error) {
    console.error("Error updating selection group:", error);

    if (error instanceof Error && error.message.includes("unique constraint")) {
      return NextResponse.json({ error: "A selection group with this name already exists" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to update selection group" }, { status: 500 });
  }
}

// DELETE /api/selection-groups/[id] - Delete selection group (optional)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const groupId = Number.parseInt(id, 10);

    if (Number.isNaN(groupId)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    const db = getDb();

    const deleted = await db
      .deleteFrom("selection_groups")
      .where("id", "=", groupId)
      .returning("id")
      .executeTakeFirst();

    if (!deleted) {
      return NextResponse.json({ error: "Selection group not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting selection group:", error);
    return NextResponse.json({ error: "Failed to delete selection group" }, { status: 500 });
  }
}
