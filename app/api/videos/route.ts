import { DatabaseService } from "@/lib/database";
import { NextRequest, NextResponse } from "next/server";

// GET /api/videos - Fetch video history
export async function GET() {
  try {
    const videos = await DatabaseService.getVideoHistory();
    return NextResponse.json({ videos });
  } catch (error) {
    console.error("Failed to fetch video history:", error);
    return NextResponse.json(
      { error: "Failed to fetch video history" },
      { status: 500 }
    );
  }
}

// POST /api/videos - Save video with transcription
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileName, filePath, fileSize, duration, language, segments } = body;

    if (!fileName || !filePath || !fileSize || !segments) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const video = await DatabaseService.saveVideoWithTranscription(
      fileName,
      filePath,
      fileSize,
      duration || 0,
      language || "english",
      segments
    );

    return NextResponse.json({ video });
  } catch (error) {
    console.error("Failed to save video:", error);
    return NextResponse.json(
      { error: "Failed to save video" },
      { status: 500 }
    );
  }
}
