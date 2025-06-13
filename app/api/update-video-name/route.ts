import { DatabaseService } from "@/lib/database";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoId, newName } = body;

    // Validate required fields
    if (!videoId || !newName || typeof newName !== "string") {
      return NextResponse.json(
        {
          error: "Missing required fields: videoId and newName are required",
        },
        { status: 400 }
      );
    }

    // Update video name in database
    const video = await DatabaseService.updateVideoName(
      videoId,
      newName.trim()
    );

    return NextResponse.json({
      success: true,
      video: {
        id: video.id,
        fileName: video.fileName,
      },
      message: "Video name updated successfully",
    });
  } catch (error) {
    console.error("Error updating video name:", error);
    return NextResponse.json(
      {
        error: "Failed to update video name",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
