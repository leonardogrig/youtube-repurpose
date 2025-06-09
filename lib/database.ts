import { SpeechSegment } from "@/components/types";
import { PrismaClient } from "./generated/prisma";

// Global Prisma client instance (best practice for Next.js)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["query"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Database service functions
export class DatabaseService {
  static async saveVideoWithTranscription(
    fileName: string,
    filePath: string,
    fileSize: number,
    duration: number,
    language: string,
    segments: SpeechSegment[]
  ) {
    try {
      const video = await prisma.video.create({
        data: {
          fileName,
          filePath,
          fileSize,
          duration,
          language,
          transcriptionSegments: {
            create: segments.map((segment) => ({
              startTime: segment.start,
              endTime: segment.end,
              text: segment.text || "",
              confidence: segment.confidence,
              error: segment.error,
              skipped: segment.skipped || false,
            })),
          },
        },
        include: {
          transcriptionSegments: true,
        },
      });

      return video;
    } catch (error) {
      console.error("Error saving video with transcription:", error);
      throw error;
    }
  }

  static async getVideoHistory() {
    try {
      const videos = await prisma.video.findMany({
        include: {
          transcriptionSegments: {
            orderBy: {
              startTime: "asc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return videos;
    } catch (error) {
      console.error("Error fetching video history:", error);
      throw error;
    }
  }

  static async getVideoById(id: string) {
    try {
      const video = await prisma.video.findUnique({
        where: { id },
        include: {
          transcriptionSegments: {
            orderBy: {
              startTime: "asc",
            },
          },
        },
      });

      return video;
    } catch (error) {
      console.error("Error fetching video by ID:", error);
      throw error;
    }
  }

  static async deleteVideo(id: string) {
    try {
      await prisma.video.delete({
        where: { id },
      });
    } catch (error) {
      console.error("Error deleting video:", error);
      throw error;
    }
  }

  static async updateVideoTranscription(id: string, segments: SpeechSegment[]) {
    try {
      // Delete existing segments and create new ones
      await prisma.transcriptionSegment.deleteMany({
        where: { videoId: id },
      });

      const video = await prisma.video.update({
        where: { id },
        data: {
          transcriptionSegments: {
            create: segments.map((segment) => ({
              startTime: segment.start,
              endTime: segment.end,
              text: segment.text || "",
              confidence: segment.confidence,
              error: segment.error,
              skipped: segment.skipped || false,
            })),
          },
        },
        include: {
          transcriptionSegments: true,
        },
      });

      return video;
    } catch (error) {
      console.error("Error updating video transcription:", error);
      throw error;
    }
  }
}

// Helper function to convert database segments to SpeechSegment format
export function convertToSpeechSegments(dbSegments: any[]): SpeechSegment[] {
  return dbSegments.map((segment) => ({
    start: segment.startTime,
    end: segment.endTime,
    text: segment.text,
    confidence: segment.confidence,
    error: segment.error,
    skipped: segment.skipped,
  }));
}
