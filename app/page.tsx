"use client";

import { ErrorDisplay } from "@/components/ErrorDisplay";
import { ManualTranscriptionInput } from "@/components/ManualTranscriptionInput";
import { SilenceRemovalCard } from "@/components/SilenceRemovalCard";
import { TopicSuggestionsSection } from "@/components/TopicSuggestionsSection";
import { TranscriptionWarningDialog } from "@/components/TranscriptionWarningDialog";
import {
  DialogControls,
  InstallationInstructions,
  SpeechSegment,
} from "@/components/types";
import { Button } from "@/components/ui/button";
import { UploadCard } from "@/components/UploadCard";
import {
  VideoHistoryCard,
  type VideoHistoryCardRef,
} from "@/components/VideoHistoryCard";
import { useEffect, useRef, useState } from "react";
import { TranscriptionProgressButton } from "./components/TranscriptionProgressButton";
import { TranscriptionProgressDialog } from "./components/TranscriptionProgressDialog";
import { supportedLanguages } from "./constants/languages";
import { removeSilence, transcribeVideo } from "./services/videoService";
import { neoBrutalismStyles } from "./styles/neo-brutalism";

// Utility functions
const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  }
};

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};

// Create a custom hook for the transcription progress dialog
function useTranscriptionProgressDialog(
  isTranscribing: boolean,
  transcriptionProgressDetails: any,
  completedTranscriptions: any[]
) {
  const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false);

  // Button component that can be inserted next to the transcribe button
  const progressButton = isTranscribing ? (
    <TranscriptionProgressButton
      onClick={() => setIsProgressDialogOpen(true)}
      percent={
        transcriptionProgressDetails.totalSegments > 0
          ? Math.round(
              (transcriptionProgressDetails.currentSegment /
                transcriptionProgressDetails.totalSegments) *
                100
            )
          : 0
      }
      completedSegments={completedTranscriptions.length}
      totalSegments={transcriptionProgressDetails.totalSegments}
      status={transcriptionProgressDetails.status}
    />
  ) : null;

  // Dialog component that appears when button is clicked
  const progressDialog = (
    <TranscriptionProgressDialog
      isOpen={isProgressDialogOpen}
      onClose={() => setIsProgressDialogOpen(false)}
      currentSegment={transcriptionProgressDetails.currentSegment}
      totalSegments={transcriptionProgressDetails.totalSegments}
      status={transcriptionProgressDetails.status}
      message={transcriptionProgressDetails.message}
      currentSegmentInfo={transcriptionProgressDetails.currentSegmentInfo}
      result={transcriptionProgressDetails.latestResult}
      completedSegments={completedTranscriptions}
    />
  );

  return { progressButton, progressDialog };
}

interface TranscriptionResult {
  segments: SpeechSegment[];
  processedCount: number;
  totalCount: number;
  error?: string;
  installationInstructions?: InstallationInstructions;
}

export default function Home() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [silenceSegments, setSilenceSegments] = useState<
    SpeechSegment[] | null
  >(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [volumeThreshold, setVolumeThreshold] = useState<number>(35);
  const [paddingDurationMs, setPaddingDurationMs] = useState<number>(0);
  const [speechPaddingMs, setSpeechPaddingMs] = useState<number>(50);
  const [silencePaddingMs, setSilencePaddingMs] = useState<number>(500);

  const [dialogControls, setDialogControls] = useState<DialogControls>({
    volumeThreshold: 35,
    paddingDurationMs: 0,
    speechPaddingMs: 50,
    silencePaddingMs: 500,
  });
  const [isDialogProcessing, setIsDialogProcessing] = useState(false);

  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState<string>(
    "Processing video and preparing transcription..."
  );
  const [transcribedSegments, setTranscribedSegments] = useState<
    SpeechSegment[] | null
  >(null);
  const [showTranscriptionWarning, setShowTranscriptionWarning] =
    useState<boolean>(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(
    null
  );
  const [selectedLanguage, setSelectedLanguage] = useState<string>("english");

  const [totalSegmentDuration, setTotalSegmentDuration] = useState<number>(0);
  const [originalDuration, setOriginalDuration] = useState<number>(0);

  const [installationInstructions, setInstallationInstructions] =
    useState<InstallationInstructions | null>(null);

  // Twitter post generation state
  const [twitterPosts, setTwitterPosts] = useState<
    Array<{
      post_content: string;
      start_time: number;
      end_time: number;
    }>
  >([]);
  const [isGeneratingTwitterPosts, setIsGeneratingTwitterPosts] =
    useState<boolean>(false);
  const [twitterPostError, setTwitterPostError] = useState<string | null>(null);
  const [threadSaveSuccess, setThreadSaveSuccess] = useState<string | null>(
    null
  );

  const [transcriptionProgressDetails, setTranscriptionProgressDetails] =
    useState<{
      currentSegment: number;
      totalSegments: number;
      status: string;
      message: string;
      currentSegmentInfo?: {
        start: string;
        end: string;
        duration: string;
      };
      latestResult?: string;
    }>({
      currentSegment: 0,
      totalSegments: 0,
      status: "idle",
      message: "",
    });

  const [completedTranscriptions, setCompletedTranscriptions] = useState<
    Array<{
      segment: SpeechSegment;
      result: string;
    }>
  >([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoHistoryRef = useRef<VideoHistoryCardRef>(null);

  const { progressButton, progressDialog } = useTranscriptionProgressDialog(
    isTranscribing,
    transcriptionProgressDetails,
    completedTranscriptions
  );

  const [videoFileName, setVideoFileName] = useState<string | null>(null);
  const [videoFilePath, setVideoFilePath] = useState<string | null>(null);

  // Add new state variables for upload
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadMessage, setUploadMessage] = useState<string>("");
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [uploadInfo, setUploadInfo] = useState<{
    filePath: string;
    fileName: string;
    fileSize: number;
    sessionId: string;
  } | null>(null);
  const [hasManualTranscriptionText, setHasManualTranscriptionText] =
    useState<boolean>(false);

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    fileInfo?: { fileName: string; filePath: string }
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setVideoSrc(URL.createObjectURL(file));
      setSilenceSegments(null);
      setAudioUrl(null);
      setError(null);

      // Store file name and path information
      if (fileInfo) {
        setVideoFileName(fileInfo.fileName);
        setVideoFilePath(fileInfo.filePath);
      } else {
        setVideoFileName(file.name);

        // Store path in a format that the clip generation can easily find
        // Just store the filename, the clip generation will search for it
        setVideoFilePath(file.name);
      }
    }
  };

  const handleTranscribe = async () => {
    if (!silenceSegments || isTranscribing) return;

    setIsTranscribing(true);
    setTranscriptionProgress("0%");
    setTranscriptionError(null);
    setUploadProgress(0);
    setUploadMessage("");

    try {
      const result = await transcribeVideo(
        videoFile!,
        silenceSegments,
        selectedLanguage,
        (progressData) => {
          if (progressData.type === "upload_progress") {
            setUploadProgress(progressData.progress || 0);
            setUploadMessage(progressData.message || "Uploading video...");
          }

          if (progressData.type === "status") {
            setProcessingStatus(progressData.message || "");
          }

          if (progressData.type === "segment_processing") {
            const percent = progressData.percent || 0;
            setTranscriptionProgress(`${percent}%`);

            setTranscriptionProgressDetails({
              currentSegment: progressData.currentSegment || 0,
              totalSegments: progressData.totalSegments || 0,
              status: progressData.status || "Processing",
              message:
                progressData.message ||
                `Processing segment ${progressData.currentSegment || 0}...`,
              currentSegmentInfo: progressData.currentSegmentInfo,
              latestResult: progressData.latestResult,
            });
          }

          if (progressData.type === "segment_complete") {
            if (progressData.segment && progressData.result) {
              setCompletedTranscriptions((prev) => [
                ...prev,
                { segment: progressData.segment, result: progressData.result },
              ]);
            }
            setTranscriptionProgressDetails((prev) => ({
              ...prev,
              status: progressData.status || "Segment Complete",
              message:
                progressData.message ||
                `Completed segment ${progressData.currentSegment || 0}`,
              latestResult: progressData.result,
            }));
          }

          if (progressData.type === "complete") {
            setTranscriptionProgress("Finishing...");
            setUploadProgress(0);
            setTranscriptionProgressDetails({
              currentSegment: progressData.totalSegments || 0,
              totalSegments: progressData.totalSegments || 0,
              status: "complete",
              message: "Transcription finished.",
              latestResult: undefined,
              currentSegmentInfo: undefined,
            });
          }
        },
        uploadInfo || undefined
      );

      const typedResult = result as { segments?: SpeechSegment[] };

      if (typedResult.segments) {
        setTranscribedSegments(typedResult.segments);

        // Save to database after successful transcription
        if (videoFile) {
          try {
            await fetch("/api/videos", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                fileName: videoFile.name,
                filePath: videoFile.name, // Store just the filename for easier searching
                fileSize: videoFile.size,
                duration: originalDuration,
                language: selectedLanguage,
                segments: typedResult.segments,
              }),
            });
          } catch (dbError) {
            console.error("Failed to save transcription to database:", dbError);
            // Don't throw error here as transcription was successful
          }
        }
      }
    } catch (error) {
      console.error("Error transcribing:", error);
      setTranscriptionError(
        error instanceof Error ? error.message : "An error occurred"
      );
    } finally {
      setIsTranscribing(false);
      setTranscriptionProgress("");
      setProcessingStatus("");
    }
  };

  const handleRemoveSilence = async () => {
    if (transcribedSegments) {
      setShowTranscriptionWarning(true);
      return;
    }

    if (!videoFile) return;

    setIsLoading(true);
    setError(null);
    setSilenceSegments(null);
    setAudioUrl(null);
    setUploadProgress(0);
    setUploadMessage("");
    setProcessingStatus("Initializing...");
    setUploadInfo(null);

    try {
      const result = await removeSilence(
        videoFile,
        {
          volumeThreshold,
          paddingDurationMs: 0,
          speechPaddingMs,
          silencePaddingMs,
        },
        (progressData) => {
          if (progressData.type === "status") {
            setProcessingStatus(progressData.status || "");
            setUploadMessage(progressData.message || "");
          }

          if (progressData.type === "upload_progress") {
            setUploadProgress(progressData.progress || 0);
            setUploadMessage(progressData.message || "Uploading video...");
          }
        }
      );

      setSilenceSegments(result.segments);
      setAudioUrl(result.audioUrl);

      if (result.uploadInfo) {
        setUploadInfo(result.uploadInfo);
      }

      if (result.segments && result.segments.length > 0) {
        const totalSegmentDuration = result.segments.reduce(
          (acc, segment) => acc + (segment.end - segment.start),
          0
        );
        setTotalSegmentDuration(totalSegmentDuration);

        const lastSegment = result.segments[result.segments.length - 1];
        setOriginalDuration(lastSegment.end);
      }
    } catch (error) {
      console.error("Error removing silence:", error);
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred while processing the video"
      );
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
      setProcessingStatus("");
    }
  };

  const confirmTranscriptionRemoval = () => {
    setShowTranscriptionWarning(false);
    setTranscribedSegments(null);
    setUploadInfo(null);

    if (!videoFile) return;

    setIsLoading(true);
    setError(null);
    setSilenceSegments(null);
    setAudioUrl(null);
    setProcessingStatus("Initializing...");

    removeSilence(
      videoFile,
      {
        volumeThreshold,
        paddingDurationMs: 0,
        speechPaddingMs,
        silencePaddingMs,
      },
      (progressData) => {
        if (progressData.type === "status") {
          setProcessingStatus(progressData.status || "");
          setUploadMessage(progressData.message || "");
        }

        if (progressData.type === "upload_progress") {
          setUploadProgress(progressData.progress || 0);
          setUploadMessage(progressData.message || "Uploading video...");
        }
      }
    )
      .then((result) => {
        setSilenceSegments(result.segments);
        setAudioUrl(result.audioUrl);

        if (result.uploadInfo) {
          setUploadInfo(result.uploadInfo);
        }

        if (result.segments && result.segments.length > 0) {
          const totalSegmentDuration = result.segments.reduce(
            (acc, segment) => acc + (segment.end - segment.start),
            0
          );
          setTotalSegmentDuration(totalSegmentDuration);

          const lastSegment = result.segments[result.segments.length - 1];
          setOriginalDuration(lastSegment.end);
        }
        setIsLoading(false);
        setProcessingStatus("");
      })
      .catch((error) => {
        console.error("Error removing silence:", error);
        setError(
          error instanceof Error
            ? error.message
            : "An error occurred while processing the video"
        );
        setIsLoading(false);
        setProcessingStatus("");
      });
  };

  const handleApplyChanges = async () => {
    if (!videoFile) return;

    setIsDialogProcessing(true);
    setProcessingStatus("Processing with new parameters...");

    try {
      const result = await removeSilence(
        videoFile,
        {
          volumeThreshold: dialogControls.volumeThreshold,
          paddingDurationMs: 0,
          speechPaddingMs: dialogControls.speechPaddingMs,
          silencePaddingMs: dialogControls.silencePaddingMs,
        },
        (progressData) => {
          if (progressData.type === "status") {
            setProcessingStatus(progressData.status || "");
          }
        }
      );

      setSilenceSegments(result.segments);
      setAudioUrl(result.audioUrl);

      if (result.uploadInfo) {
        setUploadInfo(result.uploadInfo);
      }

      setVolumeThreshold(dialogControls.volumeThreshold);
      setPaddingDurationMs(0);
      setSpeechPaddingMs(dialogControls.speechPaddingMs);
      setSilencePaddingMs(dialogControls.silencePaddingMs);

      // XML export removed from automatic apply - should be a separate feature
    } catch (error) {
      console.error("Error reprocessing in dialog:", error);
    } finally {
      setIsDialogProcessing(false);
    }
  };

  const handleDialogControlChange = (
    key: keyof DialogControls,
    value: number
  ) => {
    if (key === "paddingDurationMs") return;
    setDialogControls((prev) => ({ ...prev, [key]: value }));
  };

  const handleDialogOpen = () => {
    setDialogControls({
      volumeThreshold,
      paddingDurationMs,
      speechPaddingMs,
      silencePaddingMs,
    });
  };

  const handleDiscardTranscription = () => {
    setTranscribedSegments(null);
    setTwitterPosts([]); // Reset Twitter posts
    setTwitterPostError(null);
  };

  const handleGenerateTwitterPosts = async () => {
    if (!transcribedSegments) return;

    setIsGeneratingTwitterPosts(true);
    setTwitterPostError(null);
    setTwitterPosts([]);

    try {
      // Import the function dynamically to avoid import issues
      const { generateTwitterPosts } = await import("./services/videoService");
      const result = await generateTwitterPosts(transcribedSegments);

      if (result.twitterPosts) {
        setTwitterPosts(result.twitterPosts);

        // Save X thread to database if we have a video
        if (uploadInfo?.sessionId || videoFileName) {
          try {
            // Try to find the video in the database to get its ID
            const videos = await fetch("/api/get-video-history").then((res) =>
              res.json()
            );
            let currentVideoId = null;

            // Look for the current video by filename or session
            if (videos.videos) {
              const currentVideo = videos.videos.find(
                (v: any) =>
                  v.fileName === videoFileName ||
                  v.filePath.includes(uploadInfo?.sessionId || "")
              );
              currentVideoId = currentVideo?.id;
            }

            if (currentVideoId) {
              const threadTitle = `X Thread - ${
                videoFileName || "Generated"
              } - ${new Date().toLocaleDateString()}`;

              await fetch("/api/save-x-thread", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  videoId: currentVideoId,
                  title: threadTitle,
                  posts: result.twitterPosts,
                }),
              });

              console.log("X thread saved to database");
              setThreadSaveSuccess("X thread saved to database");

              // Clear success message after 3 seconds
              setTimeout(() => {
                setThreadSaveSuccess(null);
              }, 3000);
            }
          } catch (dbError) {
            console.error("Failed to save X thread to database:", dbError);
            // Don't show error to user since posts generation still worked
          }
        }

        if (result.warning) {
          setTwitterPostError(`Warning: ${result.warning}`);
        } else if (result.error) {
          setTwitterPostError(`Note: ${result.error}`);
        }
      } else {
        setTwitterPostError("Failed to generate X posts. Please try again.");
      }
    } catch (error) {
      console.error("Error generating X posts:", error);
      setTwitterPostError(
        error instanceof Error
          ? error.message
          : "An error occurred during X post generation"
      );
    } finally {
      setIsGeneratingTwitterPosts(false);
    }
  };

  const handleSelectVideoFromHistory = (
    video: any,
    segments: SpeechSegment[]
  ) => {
    console.log("Loading video from history:");
    console.log("Video:", video);
    console.log("Segments received:", segments);
    console.log("First 3 segments:", segments.slice(0, 3));

    // Clear current video and set from history
    setVideoFile(null);
    setVideoSrc(null);
    setVideoFileName(video.fileName);
    setVideoFilePath(video.filePath);

    // Set the transcribed segments
    setTranscribedSegments(segments);

    // Clear other states that might conflict
    setSilenceSegments(null);
    setAudioUrl(null);
    setError(null);
    setIsTranscribing(false);
    setTranscriptionError(null);

    // Set language and duration
    setSelectedLanguage(video.language);
    setOriginalDuration(video.duration || 0);

    // Calculate total segment duration
    const totalSegmentDuration = segments.reduce(
      (acc, segment) => acc + (segment.end - segment.start),
      0
    );
    setTotalSegmentDuration(totalSegmentDuration);

    console.log("Total segment duration calculated:", totalSegmentDuration);
    console.log("transcribedSegments state will be set to:", segments);
  };

  const handleDeleteVideoFromHistory = (videoId: string) => {
    // If the deleted video is currently loaded, clear it
    // This could be enhanced to check if the current video matches the deleted one
    console.log(`Video ${videoId} deleted from history`);
  };

  const handleManualTranscription = async (
    segments: SpeechSegment[],
    fileName?: string
  ) => {
    try {
      setTranscribedSegments(segments);

      // Clear other states that might conflict
      setSilenceSegments(null);
      setAudioUrl(null);
      setError(null);
      setIsTranscribing(false);
      setTranscriptionError(null);

      // Calculate total segment duration
      const totalSegmentDuration = segments.reduce(
        (acc, segment) => acc + (segment.end - segment.start),
        0
      );
      setTotalSegmentDuration(totalSegmentDuration);

      // Use the provided filename or fallback to existing videoFileName
      const effectiveFileName =
        fileName || videoFileName || "Manual Transcription";

      // Update videoFileName state if we received a new one
      if (fileName && !videoFileName) {
        setVideoFileName(fileName);
      }

      // Save to database
      try {
        console.log("Saving transcription to database:");
        console.log("Effective filename:", effectiveFileName);
        console.log("Segments being saved:", segments);
        console.log("First 3 segments:", segments.slice(0, 3));
        console.log("Last 3 segments:", segments.slice(-3));

        const response = await fetch("/api/manual-transcription", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileName: effectiveFileName,
            filePath: effectiveFileName, // Store just the filename for consistency
            fileSize: videoFile?.size || 0,
            duration:
              originalDuration || segments[segments.length - 1]?.end || 0,
            language: selectedLanguage,
            segments: segments,
          }),
        });

        const result = await response.json();

        if (result.success) {
          console.log(
            `Manual transcription saved to database with ID: ${result.videoId}`
          );
          // Refresh the video history to show the new entry
          videoHistoryRef.current?.refresh();
        } else {
          console.error("Failed to save manual transcription:", result.error);
        }
      } catch (dbError) {
        console.error(
          "Failed to save manual transcription to database:",
          dbError
        );
        // Don't show error to user since transcription still works without DB
      }

      // Clear the manual input states
      console.log(
        `Manual transcription loaded with ${segments.length} segments`
      );
    } catch (error) {
      console.error("Error processing manual transcription:", error);
      setError("Failed to process manual transcription");
    }
  };

  const handleLoadThread = async (
    threadId: string,
    videoData: any,
    segments: SpeechSegment[]
  ) => {
    try {
      // Load the thread data
      const response = await fetch(`/api/get-thread/${threadId}`);
      if (!response.ok) {
        throw new Error("Failed to load thread");
      }

      const data = await response.json();

      // Set the video and transcription data
      setVideoFileName(videoData.fileName);
      setVideoFilePath(videoData.filePath);
      setTranscribedSegments(segments);
      setUploadInfo({
        sessionId: videoData.id,
        filePath: videoData.filePath,
        fileName: videoData.fileName,
        fileSize: videoData.fileSize,
      });

      // Set the X posts from the thread
      setTwitterPosts(data.twitterPosts);
      setTwitterPostError(null);
      setThreadSaveSuccess(`Loaded thread: ${data.thread.title}`);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setThreadSaveSuccess(null);
      }, 3000);
    } catch (error) {
      console.error("Error loading thread:", error);
      setTwitterPostError("Failed to load thread. Please try again.");
    }
  };

  useEffect(() => {
    return () => {
      if (videoSrc) {
        URL.revokeObjectURL(videoSrc);
      }
    };
  }, [videoSrc]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background text-foreground font-sans neo-brutalism-container selection:bg-black selection:text-yellow-300">
      <style jsx global>
        {neoBrutalismStyles}
      </style>

      <div className="mx-auto max-w-[800px]">
        <UploadCard
          onChange={handleFileChange}
          videoSrc={videoSrc}
          videoRef={videoRef}
        />

        {/* Video History Card */}
        <div className="mb-8">
          <VideoHistoryCard
            ref={videoHistoryRef}
            onSelectVideo={handleSelectVideoFromHistory}
            onDeleteVideo={handleDeleteVideoFromHistory}
            onLoadThread={handleLoadThread}
          />
        </div>

        {/* Manual Transcription Input - Available regardless of video file */}
        <div className="mb-8">
          <ManualTranscriptionInput
            onTranscriptionParsed={handleManualTranscription}
            videoFileName={videoFileName || undefined}
            onTranscriptionTextChange={setHasManualTranscriptionText}
          />
        </div>

        {videoFile && (
          <>
            <div className="relative">
              <SilenceRemovalCard
                videoFile={videoFile}
                isLoading={isLoading}
                error={error}
                silenceSegments={silenceSegments}
                audioUrl={audioUrl}
                dialogControls={dialogControls}
                isDialogProcessing={isDialogProcessing}
                transcribedSegments={transcribedSegments}
                isTranscribing={isTranscribing}
                transcriptionProgress={transcriptionProgress}
                transcriptionError={transcriptionError}
                selectedLanguage={selectedLanguage}
                supportedLanguages={supportedLanguages}
                onRemoveSilence={handleRemoveSilence}
                onApplyChanges={handleApplyChanges}
                onDialogControlChange={handleDialogControlChange}
                onTranscribe={handleTranscribe}
                onLanguageChange={setSelectedLanguage}
                onDiscardTranscription={handleDiscardTranscription}
                onDialogOpen={handleDialogOpen}
                progressButton={progressButton}
                uploadProgress={uploadProgress}
                uploadMessage={uploadMessage}
                processingStatus={processingStatus}
                hasManualTranscriptionText={hasManualTranscriptionText}
              />
            </div>
          </>
        )}

        {/* Show transcription results for both video files and manual input */}
        {transcribedSegments && !videoFile && (
          <div className="mb-8">
            <div className="border-2 border-black bg-white p-6 neo-brutalism-card">
              <h2 className="text-xl font-bold mb-4">
                Manual Transcription Results
              </h2>
              <div className="space-y-2">
                <p>
                  <strong>Segments:</strong> {transcribedSegments.length}
                </p>
                <p>
                  <strong>Total Duration:</strong>{" "}
                  {formatDuration(totalSegmentDuration)}
                </p>
                <p>
                  <strong>Language:</strong> {selectedLanguage}
                </p>
              </div>
              <div className="mt-4 max-h-64 overflow-y-auto border border-gray-300 bg-gray-50 p-3">
                {transcribedSegments.slice(0, 10).map((segment, index) => (
                  <div
                    key={index}
                    className="mb-2 p-2 border border-gray-300 bg-white rounded"
                  >
                    <div className="flex gap-2 items-center mb-1">
                      <span className="text-xs font-bold bg-blue-300 px-2 py-1 border border-black">
                        #{index + 1}
                      </span>
                      <span className="text-xs bg-yellow-300 px-2 py-1 border border-black">
                        {formatTime(segment.start)} - {formatTime(segment.end)}
                      </span>
                      <span className="text-xs bg-green-300 px-2 py-1 border border-black">
                        {(segment.end - segment.start).toFixed(1)}s
                      </span>
                    </div>
                    <div className="text-xs text-gray-700">{segment.text}</div>
                  </div>
                ))}
                {transcribedSegments.length > 10 && (
                  <div className="text-center text-gray-500 text-sm mt-2">
                    ... and {transcribedSegments.length - 10} more segments
                  </div>
                )}
              </div>
              <div className="mt-4">
                <Button
                  onClick={handleDiscardTranscription}
                  className="neo-brutalism-button bg-red-500 hover:bg-red-600 text-white"
                >
                  Clear Transcription
                </Button>
              </div>
            </div>
          </div>
        )}

        {transcribedSegments && (
          <>
            <TopicSuggestionsSection
              transcribedSegments={transcribedSegments}
              onDiscardTranscription={handleDiscardTranscription}
              onGenerateTwitterPosts={handleGenerateTwitterPosts}
              isGeneratingTwitterPosts={isGeneratingTwitterPosts}
              twitterPosts={twitterPosts}
              twitterPostError={twitterPostError}
              threadSaveSuccess={threadSaveSuccess}
              videoFilePath={videoFilePath || undefined}
              uploadInfo={uploadInfo || undefined}
            />
          </>
        )}

        <TranscriptionWarningDialog
          isOpen={showTranscriptionWarning}
          onClose={() => setShowTranscriptionWarning(false)}
          onConfirm={confirmTranscriptionRemoval}
        />

        {/* Add the transcription progress dialog */}
        {progressDialog}

        {error && (
          <ErrorDisplay
            message={error}
            instructions={installationInstructions}
          />
        )}
      </div>
    </main>
  );
}
