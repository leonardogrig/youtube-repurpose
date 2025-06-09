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

    // Parse the input video file path
    let inputPath = videoFilePath;

    // Prioritize sessionId-based path for uploaded files
    if (sessionId) {
      // Handle uploaded files - they should be in uploads/sessionId/
      const uploadsDir = path.join(process.cwd(), "uploads", sessionId);

      // If the videoFilePath already includes the full path, use the filename
      let fileName = path.basename(videoFilePath);

      // If it's a generic file:// URL, extract just the filename
      if (videoFilePath.startsWith("file://localhost/")) {
        fileName = decodeURIComponent(videoFilePath.split("/").pop() || "");
      }

      inputPath = path.join(uploadsDir, fileName);

      console.log(`Trying uploaded file path: ${inputPath}`);

      // Verify the file exists, if not try to find it
      if (!fs.existsSync(inputPath)) {
        console.log(
          `File not found at ${inputPath}, searching in uploads directory...`
        );

        // Try to find any video file in the session directory
        try {
          const files = fs.readdirSync(uploadsDir);
          const videoFiles = files.filter((file) =>
            /\.(mp4|avi|mov|mkv|webm|flv)$/i.test(file)
          );

          if (videoFiles.length > 0) {
            inputPath = path.join(uploadsDir, videoFiles[0]);
            console.log(`Found video file: ${inputPath}`);
          }
        } catch (err) {
          console.error(`Error reading uploads directory: ${err}`);
        }
      }
    } else if (videoFilePath.startsWith("file://localhost/")) {
      // Extract the actual file path from the file:// URL
      const relativePath = decodeURIComponent(
        videoFilePath.replace("file://localhost/", "")
      );

      // For local development, look in the public directory
      inputPath = path.join(process.cwd(), "public", relativePath);

      console.log(`Trying file:// path: ${inputPath}`);
    } else {
      console.log(`Using direct path: ${inputPath}`);
    }

    // Check if input file exists
    if (!fs.existsSync(inputPath)) {
      return NextResponse.json(
        {
          error: `Input video file not found: ${inputPath}`,
          details: `Original path: ${videoFilePath}`,
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
