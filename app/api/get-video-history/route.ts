import { DatabaseService } from "@/lib/database";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const videos = await DatabaseService.getVideoHistory();

    return NextResponse.json({
      success: true,
      videos: videos,
    });
  } catch (error) {
    console.error("Error fetching video history:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch video history",
        details: error instanceof Error ? error.message : "Unknown error",
        videos: [],
      },
      { status: 200 } // Return 200 but with error for graceful degradation
    );
  }
}
