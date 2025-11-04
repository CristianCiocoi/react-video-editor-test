import { NextRequest, NextResponse } from "next/server";

// In-memory storage for uploaded files (for testing purposes)
const mockStorage = new Map<string, { data: Buffer; contentType: string }>();

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path: pathSegments } = await params;
    const path = pathSegments.join("/");
    const contentType = request.headers.get("content-type") || "application/octet-stream";

    // Read the file data
    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Store in mock storage
    mockStorage.set(path, { data: buffer, contentType });

    console.log(`Mock storage: Uploaded file to ${path} (${buffer.length} bytes)`);

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("Error in mock storage PUT:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path: pathSegments } = await params;
    const path = pathSegments.join("/");
    const stored = mockStorage.get(path);

    if (!stored) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(stored.data);

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        "Content-Type": stored.contentType,
        "Content-Length": stored.data.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error in mock storage GET:", error);
    return NextResponse.json({ error: "Failed to retrieve file" }, { status: 500 });
  }
}
