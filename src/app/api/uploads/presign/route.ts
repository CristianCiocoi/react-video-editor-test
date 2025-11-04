import { NextRequest, NextResponse } from "next/server";

interface PresignRequest {
  userId: string;
  fileNames: string[];
}

interface ExternalPresignResponse {
  fileName: string;
  filePath: string;
  contentType: string;
  presignedUrl: string;
  folder?: string;
  url: string;
}

interface ExternalPresignsResponse {
  uploads: ExternalPresignResponse[];
}

// Helper to generate mock presigned URLs for local testing
function generateMockPresignedUrls(userId: string, fileNames: string[]): ExternalPresignResponse[] {
  return fileNames.map((fileName) => {
    const timestamp = Date.now();
    const filePath = `uploads/${userId}/${timestamp}_${fileName}`;
    const contentType =
      fileName.endsWith(".mp4") || fileName.endsWith(".webm")
        ? `video/${fileName.split(".").pop()}`
        : fileName.endsWith(".mp3") || fileName.endsWith(".wav")
        ? `audio/${fileName.split(".").pop()}`
        : fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")
        ? "image/jpeg"
        : fileName.endsWith(".png")
        ? "image/png"
        : "application/octet-stream";

    return {
      fileName,
      filePath,
      contentType,
      // Mock presigned URL that will be intercepted by our upload handler
      presignedUrl: `/api/uploads/mock-storage/${encodeURIComponent(filePath)}`,
      folder: "uploads",
      url: `/api/uploads/mock-storage/${encodeURIComponent(filePath)}`,
    };
  });
}

export async function POST(request: NextRequest) {
  try {
    const body: PresignRequest = await request.json();
    const { userId, fileNames } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (!fileNames || !Array.isArray(fileNames) || fileNames.length === 0) {
      return NextResponse.json({ error: "fileNames array is required and must not be empty" }, { status: 400 });
    }

    // Try to call external presigned URL service with timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const externalResponse = await fetch("https://upload-file-j43uyuaeza-uc.a.run.app/presigned", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          fileNames,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (externalResponse.ok) {
        const externalData: ExternalPresignsResponse = await externalResponse.json();
        const { uploads = [] } = externalData;

        return NextResponse.json({
          success: true,
          uploads: uploads,
        });
      }
    } catch (externalError) {
      console.warn("External upload service unavailable, using local mock:", externalError);
    }

    // Fallback to mock presigned URLs for local testing
    console.log("Using mock presigned URLs for testing");
    const mockUploads = generateMockPresignedUrls(userId, fileNames);

    return NextResponse.json({
      success: true,
      uploads: mockUploads,
    });
  } catch (error) {
    console.error("Error in presign route:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
