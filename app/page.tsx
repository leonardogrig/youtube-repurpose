"use client";

import { ErrorDisplay } from "@/components/ErrorDisplay";
import { SilenceRemovalCard } from "@/components/SilenceRemovalCard";
import { TopicSuggestionsSection } from "@/components/TopicSuggestionsSection";
import { TranscriptionWarningDialog } from "@/components/TranscriptionWarningDialog";
import {
  DialogControls,
  InstallationInstructions,
  SpeechSegment,
} from "@/components/types";
import { UploadCard } from "@/components/UploadCard";
import { VideoHistoryCard } from "@/components/VideoHistoryCard";
import { useEffect, useRef, useState } from "react";
import { TranscriptionProgressButton } from "./components/TranscriptionProgressButton";
import { TranscriptionProgressDialog } from "./components/TranscriptionProgressDialog";
import { supportedLanguages } from "./constants/languages";
import { removeSilence, transcribeVideo } from "./services/videoService";
import { neoBrutalismStyles } from "./styles/neo-brutalism";

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
      title: string;
      post_content: string;
      start_segment: number;
      end_segment: number;
      key_points: string[];
    }>
  >([]);
  const [isGeneratingTwitterPosts, setIsGeneratingTwitterPosts] =
    useState<boolean>(false);
  const [twitterPostError, setTwitterPostError] = useState<string | null>(null);

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

        // Use same path format as in UploadCard - generic, not system specific
        const filePath = `file://localhost/videos/${encodeURIComponent(
          file.name
        )}`;
        setVideoFilePath(filePath);
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
                filePath: videoFilePath || `videos/${videoFile.name}`,
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

        if (result.warning) {
          setTwitterPostError(`Warning: ${result.warning}`);
        } else if (result.error) {
          setTwitterPostError(`Note: ${result.error}`);
        }
      } else {
        setTwitterPostError(
          "Failed to generate Twitter posts. Please try again."
        );
      }
    } catch (error) {
      console.error("Error generating Twitter posts:", error);
      setTwitterPostError(
        error instanceof Error
          ? error.message
          : "An error occurred during Twitter post generation"
      );
    } finally {
      setIsGeneratingTwitterPosts(false);
    }
  };

  const handleSelectVideoFromHistory = (
    video: any,
    segments: SpeechSegment[]
  ) => {
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
  };

  const handleDeleteVideoFromHistory = (videoId: string) => {
    // If the deleted video is currently loaded, clear it
    // This could be enhanced to check if the current video matches the deleted one
    console.log(`Video ${videoId} deleted from history`);
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
      <h1 className="text-4xl font-bold mb-8 text-center border-b-4 border-black pb-2">
        Neobrutalist Video Silence Remover
      </h1>

      <div className="mx-auto max-w-[800px]">
        <UploadCard
          onChange={handleFileChange}
          videoSrc={videoSrc}
          videoRef={videoRef}
        />

        {/* Video History Card */}
        <div className="mb-8">
          <VideoHistoryCard
            onSelectVideo={handleSelectVideoFromHistory}
            onDeleteVideo={handleDeleteVideoFromHistory}
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
              />
            </div>
          </>
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
