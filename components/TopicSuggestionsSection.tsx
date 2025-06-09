"use client";

import { generateVideoClip } from "@/app/services/videoService";
import { SegmentRangeEditor } from "@/components/SegmentRangeEditor";
import { Button } from "@/components/ui/button";
import { Copy, Download, Edit, Loader2, Play } from "lucide-react";
import { useState } from "react";
import { SpeechSegment } from "./types";

interface TwitterPost {
  title: string;
  post_content: string;
  start_segment: number;
  end_segment: number;
  key_points: string[];
}

interface TopicSuggestionsSectionProps {
  transcribedSegments: SpeechSegment[] | null;
  onDiscardTranscription: () => void;
  onGenerateTwitterPosts?: () => void;
  isGeneratingTwitterPosts?: boolean;
  twitterPosts?: TwitterPost[];
  twitterPostError?: string | null;
  videoFilePath?: string;
  uploadInfo?: {
    sessionId: string;
  };
}

export function TopicSuggestionsSection({
  transcribedSegments,
  onDiscardTranscription,
  onGenerateTwitterPosts,
  isGeneratingTwitterPosts = false,
  twitterPosts = [],
  twitterPostError,
  videoFilePath,
  uploadInfo,
}: TopicSuggestionsSectionProps) {
  const [generatingClipFor, setGeneratingClipFor] = useState<number | null>(
    null
  );
  const [videoClips, setVideoClips] = useState<
    Record<
      number,
      {
        clipUrl: string;
        fileName: string;
        fileSizeInMB: number;
        duration: number;
      }
    >
  >({});
  const [clipErrors, setClipErrors] = useState<Record<number, string>>({});

  // New state for segment editing
  const [editingPostIndex, setEditingPostIndex] = useState<number | null>(null);
  const [customSegmentRanges, setCustomSegmentRanges] = useState<
    Record<number, { start_segment: number; end_segment: number }>
  >({});

  // Get the effective segment range for a post (custom or original)
  const getEffectiveSegmentRange = (post: TwitterPost, index: number) => {
    const customRange = customSegmentRanges[index];
    return (
      customRange || {
        start_segment: post.start_segment,
        end_segment: post.end_segment,
      }
    );
  };

  const handleEditSegmentRange = (index: number) => {
    setEditingPostIndex(index);
  };

  const handleApplySegmentRange = (
    index: number,
    newStartSegment: number,
    newEndSegment: number
  ) => {
    setCustomSegmentRanges((prev) => ({
      ...prev,
      [index]: { start_segment: newStartSegment, end_segment: newEndSegment },
    }));
    setEditingPostIndex(null);

    // Clear any existing video clip since the segments changed
    setVideoClips((prev) => {
      const newClips = { ...prev };
      delete newClips[index];
      return newClips;
    });

    // Clear any clip errors
    setClipErrors((prev) => ({
      ...prev,
      [index]: "",
    }));
  };

  const handleCancelSegmentEdit = () => {
    setEditingPostIndex(null);
  };

  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const handleGenerateVideoClip = async (post: TwitterPost, index: number) => {
    if (!videoFilePath || !transcribedSegments) {
      setClipErrors((prev) => ({
        ...prev,
        [index]: "Missing video file or segments",
      }));
      return;
    }

    setGeneratingClipFor(index);
    setClipErrors((prev) => ({ ...prev, [index]: "" }));

    try {
      // Use effective segment range (custom or original)
      const effectiveRange = getEffectiveSegmentRange(post, index);
      const startTime = transcribedSegments[effectiveRange.start_segment].start;
      const endTime = transcribedSegments[effectiveRange.end_segment].end;

      const result = await generateVideoClip(
        videoFilePath,
        startTime,
        endTime,
        uploadInfo?.sessionId
      );

      if (result.success) {
        setVideoClips((prev) => ({
          ...prev,
          [index]: {
            clipUrl: result.clipUrl,
            fileName: result.fileName,
            fileSizeInMB: result.fileSizeInMB,
            duration: result.duration,
          },
        }));
      } else {
        setClipErrors((prev) => ({
          ...prev,
          [index]: result.error || "Failed to generate video clip",
        }));
      }
    } catch (error) {
      console.error("Error generating video clip:", error);
      setClipErrors((prev) => ({
        ...prev,
        [index]: error instanceof Error ? error.message : "Unknown error",
      }));
    } finally {
      setGeneratingClipFor(null);
    }
  };

  const handleDownloadClip = (index: number) => {
    const clip = videoClips[index];
    if (clip) {
      const link = document.createElement("a");
      link.href = clip.clipUrl;
      link.download = clip.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const formatDuration = (segments: SpeechSegment[]): string => {
    if (segments.length === 0) return "0s";

    const startTime = segments[0].start;
    const endTime = segments[segments.length - 1].end;
    const duration = endTime - startTime;

    if (duration < 60) {
      return `${Math.round(duration)}s`;
    } else {
      const minutes = Math.floor(duration / 60);
      const seconds = Math.round(duration % 60);
      return `${minutes}m ${seconds}s`;
    }
  };

  const formatDurationFromSeconds = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${minutes}m ${secs}s`;
    }
  };

  if (!transcribedSegments) {
    return null;
  }

  return (
    <div className="mt-4 p-4 border-2 border-black bg-gray-50">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold">Twitter Thread Suggestions</h3>
        <div className="flex gap-2">
          <Button
            onClick={onGenerateTwitterPosts}
            disabled={isGeneratingTwitterPosts}
            className="neo-brutalism-button bg-blue-500 hover:bg-blue-600 text-white"
            size="sm"
          >
            {isGeneratingTwitterPosts
              ? "Generating..."
              : "Generate Twitter Posts"}
          </Button>
          <Button
            onClick={onDiscardTranscription}
            className="neo-brutalism-button bg-red-500 hover:bg-red-600 text-white"
            size="sm"
          >
            Discard Transcription
          </Button>
        </div>
      </div>

      {twitterPostError && (
        <div className="mb-4 p-4 border-2 border-red-300 bg-red-50 rounded">
          <h4 className="text-sm font-bold text-red-700">
            Twitter Post Generation Error
          </h4>
          <p className="text-red-600 text-sm mt-1">{twitterPostError}</p>
        </div>
      )}

      {twitterPosts.length > 0 && (
        <div className="space-y-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            Generated Twitter Threads:
          </h4>
          {twitterPosts.map((post, index) => {
            // Use effective segment range for calculations
            const effectiveRange = getEffectiveSegmentRange(post, index);
            const postSegments = transcribedSegments.slice(
              effectiveRange.start_segment,
              effectiveRange.end_segment + 1
            );
            const duration = formatDuration(postSegments);
            const videoClip = videoClips[index];
            const clipError = clipErrors[index];
            const isGeneratingClip = generatingClipFor === index;
            const isEditing = editingPostIndex === index;
            const hasCustomRange = customSegmentRanges[index] !== undefined;

            return (
              <div
                key={index}
                className="p-4 border-2 border-gray-300 rounded-lg bg-white shadow-sm"
              >
                <div className="flex justify-between items-start mb-3">
                  <h5 className="font-bold text-gray-900 text-lg">
                    {post.title}
                  </h5>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">
                    {duration}
                  </span>
                </div>

                {/* Twitter Post Content */}
                <div className="mb-4 p-3 border border-gray-200 rounded bg-gray-50">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      Twitter Thread ({post.post_content.length} characters)
                    </label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyToClipboard(post.post_content)}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <div className="whitespace-pre-wrap text-sm text-gray-800 font-mono border border-gray-300 rounded p-3 bg-white">
                    {post.post_content}
                  </div>
                </div>

                {/* Key Points */}
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">
                    Key Points:
                  </p>
                  <ul className="text-xs text-gray-600 list-disc list-inside">
                    {post.key_points.map((point, pointIndex) => (
                      <li key={pointIndex}>{point}</li>
                    ))}
                  </ul>
                </div>

                {/* Segment Range Editing */}
                {isEditing && (
                  <SegmentRangeEditor
                    startSegment={effectiveRange.start_segment}
                    endSegment={effectiveRange.end_segment}
                    totalSegments={transcribedSegments.length}
                    onApply={(newStart: number, newEnd: number) =>
                      handleApplySegmentRange(index, newStart, newEnd)
                    }
                    onCancel={handleCancelSegmentEdit}
                  />
                )}

                {/* Video Clip Section */}
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-3">
                    <h6 className="text-sm font-medium text-gray-700">
                      Video Clip
                    </h6>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-gray-500">
                        Segments {effectiveRange.start_segment + 1}-
                        {effectiveRange.end_segment + 1}
                        {hasCustomRange && (
                          <span className="ml-1 text-orange-600 font-bold">
                            (Modified)
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditSegmentRange(index)}
                        disabled={isEditing}
                        className="neo-brutalism-button bg-orange-400 hover:bg-orange-500 text-white"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit Range
                      </Button>
                    </div>
                  </div>

                  {!videoClip && !isGeneratingClip && !isEditing && (
                    <Button
                      onClick={() => handleGenerateVideoClip(post, index)}
                      className="w-full mb-2"
                      disabled={!videoFilePath}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Generate Video Clip
                    </Button>
                  )}

                  {isGeneratingClip && (
                    <div className="flex items-center justify-center py-4 mb-2">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      <span className="text-sm">Generating video clip...</span>
                    </div>
                  )}

                  {clipError && (
                    <div className="p-3 border border-red-300 bg-red-50 rounded mb-2">
                      <p className="text-red-600 text-xs">{clipError}</p>
                      <Button
                        onClick={() => handleGenerateVideoClip(post, index)}
                        size="sm"
                        className="mt-2"
                      >
                        Retry
                      </Button>
                    </div>
                  )}

                  {videoClip && (
                    <div className="space-y-3">
                      <div className="p-3 border border-green-300 bg-green-50 rounded">
                        <p className="text-green-700 text-xs font-medium mb-1">
                          ✅ Video clip generated successfully!
                        </p>
                        <p className="text-xs text-gray-600">
                          <strong>File:</strong> {videoClip.fileName} |
                          <strong> Size:</strong> {videoClip.fileSizeInMB} MB |
                          <strong> Duration:</strong>{" "}
                          {formatDurationFromSeconds(videoClip.duration)}
                        </p>
                      </div>

                      <video
                        src={videoClip.clipUrl}
                        controls
                        className="w-full rounded border"
                        style={{ maxHeight: "250px" }}
                      >
                        Your browser does not support the video tag.
                      </video>

                      <Button
                        onClick={() => handleDownloadClip(index)}
                        className="w-full"
                        variant="outline"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Video Clip
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {twitterPosts.length === 0 &&
        !isGeneratingTwitterPosts &&
        !twitterPostError && (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">
              Click "Generate Twitter Posts" to analyze your transcription and
              get viral Twitter thread suggestions with video clips.
            </p>
          </div>
        )}
    </div>
  );
}
