import { DatabaseService } from "@/lib/database";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileName, filePath, fileSize, duration, language, segments } = body;

    console.log("Manual transcription API received:");
    console.log("fileName:", fileName);
    console.log("segments length:", segments?.length);
    console.log("First 3 segments received:", segments?.slice(0, 3));
    console.log("Last 3 segments received:", segments?.slice(-3));

    // Validate required fields
    if (!fileName || !segments || !Array.isArray(segments)) {
      return NextResponse.json(
        {
          error: "Missing required fields: fileName and segments are required",
        },
        { status: 400 }
      );
    }

    // Save to database
    const video = await DatabaseService.saveVideoWithTranscription(
      fileName,
      filePath || `manual://transcription/${encodeURIComponent(fileName)}`,
      fileSize || 0,
      duration || 0,
      language || "english",
      segments
    );

    return NextResponse.json({
      success: true,
      videoId: video.id,
      message: `Manual transcription saved with ${segments.length} segments`,
    });
  } catch (error) {
    console.error("Error saving manual transcription:", error);
    return NextResponse.json(
      {
        error: "Failed to save manual transcription",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
