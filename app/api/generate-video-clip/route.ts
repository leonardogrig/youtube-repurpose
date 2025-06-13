import { execSync } from "child_process";
import { randomUUID } from "crypto";
import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import path from "path";

// Add API route configuration
export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: Infinity,
    },
  },
};

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toFixed(3).padStart(6, "0")}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoFilePath, startTime, endTime, sessionId } = body;

    console.log(`DEBUG: Received request with params:`, {
      videoFilePath,
      startTime,
      endTime,
      sessionId: sessionId || "undefined/null",
      sessionIdType: typeof sessionId,
    });

    if (
      !videoFilePath ||
      typeof startTime !== "number" ||
      typeof endTime !== "number"
    ) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    if (startTime >= endTime) {
      return NextResponse.json(
        { error: "Start time must be less than end time" },
        { status: 400 }
      );
    }

    // Check if FFmpeg is available
    try {
      execSync("ffmpeg -version", { stdio: "ignore" });
    } catch (error) {
      return NextResponse.json(
        {
          error: "FFmpeg is not installed or not accessible",
          installationInstructions: {
            windows:
              "Download from https://ffmpeg.org/download.html or use 'winget install ffmpeg'",
            mac: "Install with Homebrew: 'brew install ffmpeg'",
            linux:
              "Install with package manager: 'sudo apt install ffmpeg' (Ubuntu/Debian) or 'sudo yum install ffmpeg' (CentOS/RHEL)",
          },
        },
        { status: 500 }
      );
    }

    // Create output directory if it doesn't exist
    const outputDir = path.join(process.cwd(), "public", "clips");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate unique filename for the clip
    const clipId = randomUUID();
    const outputFileName = `clip_${clipId}.mp4`;
    const outputPath = path.join(outputDir, outputFileName);

    // Parse the input video file path with improved detection
    let inputPath = videoFilePath;

    console.log(`Original videoFilePath: ${videoFilePath}`);
    console.log(`SessionId: ${sessionId}`);

    // Function to check multiple possible video locations
    const findVideoFile = (fileName: string): string | null => {
      const possiblePaths = [
        // Check public/videos directory (most common)
        path.join(process.cwd(), "public", "videos", fileName),
        // Check uploads/sessionId directory (for uploaded files)
        sessionId
          ? path.join(process.cwd(), "uploads", sessionId, fileName)
          : null,
        // Check public directory directly
        path.join(process.cwd(), "public", fileName),
        // Check if it's already a full path
        fileName.includes(path.sep) ? fileName : null,
      ].filter(Boolean) as string[];

      for (const possiblePath of possiblePaths) {
        console.log(`Checking path: ${possiblePath}`);
        if (fs.existsSync(possiblePath)) {
          console.log(`Found video at: ${possiblePath}`);
          return possiblePath;
        }
      }

      return null;
    };

    // Extract filename from various path formats
    let fileName = path.basename(videoFilePath);

    // Handle different path formats
    if (videoFilePath.startsWith("file://localhost/")) {
      // Extract filename from file:// URL
      fileName = decodeURIComponent(videoFilePath.split("/").pop() || "");
      console.log(`Extracted filename from file:// URL: ${fileName}`);
    } else if (videoFilePath.startsWith("videos/")) {
      // Handle relative path like "videos/filename.mp4"
      fileName = path.basename(videoFilePath);
      console.log(`Extracted filename from relative path: ${fileName}`);
    } else if (videoFilePath.includes("uploads/")) {
      // Handle uploads path
      fileName = path.basename(videoFilePath);
      console.log(`Extracted filename from uploads path: ${fileName}`);
    }

    // Try to find the video file
    const foundPath = findVideoFile(fileName);

    if (foundPath) {
      inputPath = foundPath;
    } else {
      // If not found, try to search in public/videos directory for any matching file
      const videosDir = path.join(process.cwd(), "public", "videos");
      console.log(`Searching in videos directory: ${videosDir}`);

      try {
        if (fs.existsSync(videosDir)) {
          const files = fs.readdirSync(videosDir);
          console.log(`Files in videos directory: ${files.join(", ")}`);

          // Look for exact match first
          const exactMatch = files.find((file) => file === fileName);
          if (exactMatch) {
            inputPath = path.join(videosDir, exactMatch);
            console.log(`Found exact match: ${inputPath}`);
          } else {
            // Look for any video file that contains the base name (without extension)
            const baseName = path.parse(fileName).name;
            const videoFiles = files.filter(
              (file) =>
                /\.(mp4|avi|mov|mkv|webm|flv)$/i.test(file) &&
                file.includes(baseName)
            );

            if (videoFiles.length > 0) {
              inputPath = path.join(videosDir, videoFiles[0]);
              console.log(`Found similar video file: ${inputPath}`);
            }
          }
        }
      } catch (err) {
        console.error(`Error reading videos directory: ${err}`);
      }
    }

    console.log(`Final input path: ${inputPath}`);

    // Check if input file exists
    if (!fs.existsSync(inputPath)) {
      // Last resort: search all possible video directories
      const searchDirs = [
        path.join(process.cwd(), "public", "videos"),
        path.join(process.cwd(), "public"),
        sessionId ? path.join(process.cwd(), "uploads", sessionId) : null,
      ].filter(Boolean) as string[];

      let foundAlternative = false;
      let searchResults: string[] = [];

      for (const searchDir of searchDirs) {
        try {
          if (fs.existsSync(searchDir)) {
            const files = fs.readdirSync(searchDir);
            const videoFiles = files.filter((file) =>
              /\.(mp4|avi|mov|mkv|webm|flv)$/i.test(file)
            );
            searchResults.push(`${searchDir}: [${videoFiles.join(", ")}]`);
          }
        } catch (err) {
          searchResults.push(`${searchDir}: Error reading directory`);
        }
      }

      return NextResponse.json(
        {
          error: `Input video file not found: ${inputPath}`,
          details: {
            originalPath: videoFilePath,
            searchedPath: inputPath,
            extractedFileName: fileName,
            sessionId: sessionId,
            availableVideos: searchResults,
          },
        },
        { status: 404 }
      );
    }

    // Format times for FFmpeg
    const startFormatted = formatTime(startTime);
    const duration = endTime - startTime;
    const durationFormatted = formatTime(duration);

    try {
      // Build FFmpeg command for extracting video clip
      const command = [
        "ffmpeg",
        "-y", // Overwrite output file
        "-ss",
        startFormatted, // Start time
        "-i",
        `"${inputPath}"`, // Input file (quoted for spaces)
        "-t",
        durationFormatted, // Duration
        "-c:v",
        "libx264", // Video codec
        "-c:a",
        "aac", // Audio codec
        "-preset",
        "fast", // Encoding preset for faster processing
        "-crf",
        "23", // Quality setting (lower = better quality)
        `"${outputPath}"`, // Output file (quoted for spaces)
      ].join(" ");

      console.log("Executing FFmpeg command:", command);

      // Execute FFmpeg command
      execSync(command, {
        stdio: "pipe",
        timeout: 120000, // 2 minute timeout
      });

      // Check if output file was created
      if (!fs.existsSync(outputPath)) {
        throw new Error("Output file was not created");
      }

      // Get file size for response
      const stats = fs.statSync(outputPath);
      const fileSizeInBytes = stats.size;
      const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);

      // Return the clip URL (relative to public directory)
      const clipUrl = `/clips/${outputFileName}`;

      return NextResponse.json({
        success: true,
        clipUrl,
        fileName: outputFileName,
        fileSizeInMB: parseFloat(fileSizeInMB),
        duration: duration,
        startTime,
        endTime,
      });
    } catch (error) {
      console.error("FFmpeg execution error:", error);

      // Clean up output file if it exists but the process failed
      if (fs.existsSync(outputPath)) {
        try {
          fs.unlinkSync(outputPath);
        } catch (cleanupError) {
          console.error("Error cleaning up failed output file:", cleanupError);
        }
      }

      return NextResponse.json(
        {
          error: "Failed to generate video clip",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in video clip generation:", error);

    return NextResponse.json(
      {
        error: "An error occurred while generating video clip",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
