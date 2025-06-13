import { prisma } from "@/lib/database";
import { NextResponse } from "next/server";
import path from "path";

export async function POST() {
  try {
    console.log("Starting video path migration...");

    // Get all videos from database
    const videos = await prisma.video.findMany();

    let updatedCount = 0;

    for (const video of videos) {
      let newFilePath = video.filePath;

      // Extract just the filename from various path formats
      if (video.filePath.startsWith("file://localhost/")) {
        newFilePath = decodeURIComponent(
          video.filePath.split("/").pop() || video.fileName
        );
      } else if (video.filePath.startsWith("videos/")) {
        newFilePath = path.basename(video.filePath);
      } else if (video.filePath.includes("uploads/")) {
        newFilePath = path.basename(video.filePath);
      } else if (video.filePath.includes("manual://")) {
        newFilePath = video.fileName; // For manual transcriptions, use the filename
      } else if (
        video.filePath !== video.fileName &&
        video.filePath.includes("/")
      ) {
        // If it's a path but not the filename, extract the filename
        newFilePath = path.basename(video.filePath);
      }

      // Update if the path changed
      if (newFilePath !== video.filePath) {
        await prisma.video.update({
          where: { id: video.id },
          data: { filePath: newFilePath },
        });

        console.log(
          `Updated video ${video.id}: "${video.filePath}" -> "${newFilePath}"`
        );
        updatedCount++;
      }
    }

    console.log(`Migration completed. Updated ${updatedCount} videos.`);

    return NextResponse.json({
      success: true,
      message: `Migration completed. Updated ${updatedCount} out of ${videos.length} videos.`,
      updatedCount,
      totalCount: videos.length,
    });
  } catch (error) {
    console.error("Error during video path migration:", error);
    return NextResponse.json(
      {
        error: "Failed to migrate video paths",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
