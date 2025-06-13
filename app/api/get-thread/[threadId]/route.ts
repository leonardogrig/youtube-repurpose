import { DatabaseService } from "@/lib/database";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const { threadId } = params;

    if (!threadId) {
      return NextResponse.json(
        { error: "Thread ID is required" },
        { status: 400 }
      );
    }

    const thread = await DatabaseService.getXThreadById(threadId);

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // Convert thread posts to the format expected by the frontend
    const twitterPosts = thread.posts.map((post) => ({
      title: post.title,
      post_content: post.postContent,
      start_time: post.startSegment, // Convert segment index to approximate time
      end_time: post.endSegment, // Convert segment index to approximate time
    }));

    return NextResponse.json({
      success: true,
      thread: {
        id: thread.id,
        title: thread.title,
        createdAt: thread.createdAt,
        video: thread.video,
      },
      twitterPosts,
    });
  } catch (error) {
    console.error("Error fetching thread:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch thread",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
