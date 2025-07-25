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

  static async saveXThread(
    videoId: string,
    title: string,
    posts: Array<{
      post_content: string;
      start_time: number;
      end_time: number;
    }>
  ) {
    try {
      const thread = await prisma.xThread.create({
        data: {
          videoId,
          title,
          posts: {
            create: posts.map((post, index) => ({
              title: `Thread ${index + 1}`, // Generate a default title
              postContent: post.post_content,
              startSegment: Math.floor(post.start_time), // Convert time to approximate segment
              endSegment: Math.floor(post.end_time), // Convert time to approximate segment
              keyPoints: [],
              orderIndex: index,
            })),
          },
        },
        include: {
          posts: {
            orderBy: {
              orderIndex: "asc",
            },
          },
        },
      });

      return thread;
    } catch (error) {
      console.error("Error saving X thread:", error);
      throw error;
    }
  }

  static async getXThreadsByVideoId(videoId: string) {
    try {
      const threads = await prisma.xThread.findMany({
        where: { videoId },
        include: {
          posts: {
            orderBy: {
              orderIndex: "asc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return threads;
    } catch (error) {
      console.error("Error fetching X threads:", error);
      throw error;
    }
  }

  static async getXThreadById(threadId: string) {
    try {
      const thread = await prisma.xThread.findUnique({
        where: { id: threadId },
        include: {
          posts: {
            orderBy: {
              orderIndex: "asc",
            },
          },
          video: true,
        },
      });

      return thread;
    } catch (error) {
      console.error("Error fetching X thread by ID:", error);
      throw error;
    }
  }

  static async updateVideoName(videoId: string, newName: string) {
    try {
      const video = await prisma.video.update({
        where: { id: videoId },
        data: { fileName: newName },
        include: {
          transcriptionSegments: {
            orderBy: {
              startTime: "asc",
            },
          },
          threads: {
            include: {
              posts: {
                orderBy: {
                  orderIndex: "asc",
                },
              },
            },
          },
        },
      });

      return video;
    } catch (error) {
      console.error("Error updating video name:", error);
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
          threads: {
            include: {
              posts: {
                orderBy: {
                  orderIndex: "asc",
                },
              },
            },
            orderBy: {
              createdAt: "desc",
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
          threads: {
            include: {
              posts: {
                orderBy: {
                  orderIndex: "asc",
                },
              },
            },
            orderBy: {
              createdAt: "desc",
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
  console.log("Converting database segments to SpeechSegment format:");
  console.log("Input dbSegments:", dbSegments);

  const result = dbSegments.map((segment, index) => {
    console.log(`Segment ${index}:`, {
      original: segment,
      startTime: segment.startTime,
      endTime: segment.endTime,
      text: segment.text,
    });

    return {
      start: segment.startTime,
      end: segment.endTime,
      text: segment.text,
      confidence: segment.confidence,
      error: segment.error,
      skipped: segment.skipped,
    };
  });

  console.log("Converted result:", result);
  return result;
}
