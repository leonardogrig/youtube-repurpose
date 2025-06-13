import { DatabaseService } from "@/lib/database";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoId, title, posts } = body;

    // Validate required fields
    if (!videoId || !title || !posts || !Array.isArray(posts)) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: videoId, title, and posts are required",
        },
        { status: 400 }
      );
    }

    // Save X thread to database
    const thread = await DatabaseService.saveXThread(videoId, title, posts);

    return NextResponse.json({
      success: true,
      threadId: thread.id,
      message: `X thread saved with ${posts.length} posts`,
    });
  } catch (error) {
    console.error("Error saving X thread:", error);
    return NextResponse.json(
      {
        error: "Failed to save X thread",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
