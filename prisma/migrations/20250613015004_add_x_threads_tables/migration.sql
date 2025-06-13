-- CreateTable
CREATE TABLE "videos" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "duration" DOUBLE PRECISION,
    "language" TEXT NOT NULL DEFAULT 'english',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcription_segments" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "startTime" DOUBLE PRECISION NOT NULL,
    "endTime" DOUBLE PRECISION NOT NULL,
    "text" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "error" TEXT,
    "skipped" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "transcription_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "x_threads" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "x_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "x_posts" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "postContent" TEXT NOT NULL,
    "startSegment" INTEGER NOT NULL,
    "endSegment" INTEGER NOT NULL,
    "keyPoints" TEXT[],
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "x_posts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "transcription_segments" ADD CONSTRAINT "transcription_segments_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x_threads" ADD CONSTRAINT "x_threads_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x_posts" ADD CONSTRAINT "x_posts_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "x_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
