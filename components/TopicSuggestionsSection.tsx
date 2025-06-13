"use client";

import { generateVideoClip } from "@/app/services/videoService";
import { SegmentRangeEditor } from "@/components/SegmentRangeEditor";
import { Button } from "@/components/ui/button";
import { Copy, Download, Edit, Loader2, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { SpeechSegment } from "./types";

interface TwitterPost {
  post_content: string;
  start_time: number;
  end_time: number;
}

interface TopicSuggestionsSectionProps {
  transcribedSegments: SpeechSegment[] | null;
  onDiscardTranscription: () => void;
  onGenerateTwitterPosts?: () => void;
  isGeneratingTwitterPosts?: boolean;
  twitterPosts?: TwitterPost[];
  twitterPostError?: string | null;
  threadSaveSuccess?: string | null;
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
  threadSaveSuccess,
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
    Record<number, { start_time: number; end_time: number }>
  >({});

  // Clear clips and related state when new posts are generated
  useEffect(() => {
    setVideoClips({});
    setClipErrors({});
    setCustomSegmentRanges({});
    setEditingPostIndex(null);
    setGeneratingClipFor(null);
  }, [twitterPosts]);

  // Wrapper function to clear clips before generating new posts
  const handleGenerateXPosts = () => {
    // Clear all clip-related state before generating new posts
    setVideoClips({});
    setClipErrors({});
    setCustomSegmentRanges({});
    setEditingPostIndex(null);
    setGeneratingClipFor(null);

    // Call the original function
    onGenerateTwitterPosts?.();
  };

  // Get the effective time range for a post (custom or original)
  const getEffectiveTimeRange = (post: TwitterPost, index: number) => {
    const customRange = customSegmentRanges[index];
    return (
      customRange || {
        start_time: post.start_time,
        end_time: post.end_time,
      }
    );
  };

  // Helper function to convert time range to segment indices for UI display
  const getSegmentIndicesFromTimeRange = (timeRange: {
    start_time: number;
    end_time: number;
  }) => {
    if (!transcribedSegments) return { start_segment: 0, end_segment: 0 };

    let startSegment = 0;
    let endSegment = transcribedSegments.length - 1;

    // Find the first segment that starts at or after start_time
    for (let i = 0; i < transcribedSegments.length; i++) {
      if (transcribedSegments[i].start >= timeRange.start_time) {
        startSegment = i;
        break;
      }
    }

    // Find the last segment that ends at or before end_time
    for (let i = transcribedSegments.length - 1; i >= 0; i--) {
      if (transcribedSegments[i].end <= timeRange.end_time) {
        endSegment = i;
        break;
      }
    }

    return { start_segment: startSegment, end_segment: endSegment };
  };

  const handleEditSegmentRange = (index: number) => {
    setEditingPostIndex(index);
  };

  const handleApplySegmentRange = (
    index: number,
    newStartSegment: number,
    newEndSegment: number
  ) => {
    // Convert segment indices to time ranges
    const startTime = transcribedSegments?.[newStartSegment]?.start || 0;
    const endTime = transcribedSegments?.[newEndSegment]?.end || 0;

    setCustomSegmentRanges((prev) => ({
      ...prev,
      [index]: { start_time: startTime, end_time: endTime },
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
      // Use effective time range (custom or original)
      const effectiveRange = getEffectiveTimeRange(post, index);

      // Validate time range
      const startTime = effectiveRange.start_time;
      const endTime = effectiveRange.end_time;
      const duration = endTime - startTime;

      if (duration <= 0) {
        setClipErrors((prev) => ({
          ...prev,
          [index]: `Invalid duration: ${duration.toFixed(
            2
          )}s. Start: ${startTime.toFixed(2)}s, End: ${endTime.toFixed(2)}s`,
        }));
        return;
      }

      if (duration < 0.5) {
        setClipErrors((prev) => ({
          ...prev,
          [index]: `Duration too short: ${duration.toFixed(
            2
          )}s. Minimum duration is 0.5 seconds.`,
        }));
        return;
      }

      // Find segments that overlap with this time range for validation
      const overlappingSegments = transcribedSegments.filter(
        (segment) => segment.start < endTime && segment.end > startTime
      );

      // Check if segments have meaningful content
      const segmentsWithText = overlappingSegments.filter(
        (segment) => segment.text && segment.text.trim().length > 0
      );

      if (segmentsWithText.length === 0) {
        setClipErrors((prev) => ({
          ...prev,
          [index]: `No transcribed content found in time range ${startTime.toFixed(
            2
          )}s-${endTime.toFixed(
            2
          )}s. This range appears to contain only silence.`,
        }));
        return;
      }

      console.log(
        `Generating clip for time range ${startTime.toFixed(
          2
        )}s-${endTime.toFixed(2)}s:`
      );
      console.log(`- Duration: ${duration.toFixed(2)}s`);
      console.log(
        `- Overlapping segments with text: ${segmentsWithText.length}/${overlappingSegments.length}`
      );
      console.log(
        `- Sample text: "${segmentsWithText[0]?.text?.substring(0, 100)}..."`
      );

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
        <h3 className="text-sm font-bold">X Thread Suggestions</h3>
        <div className="flex gap-2">
          <Button
            onClick={handleGenerateXPosts}
            disabled={isGeneratingTwitterPosts}
            className="neo-brutalism-button bg-blue-500 hover:bg-blue-600 text-white"
            size="sm"
          >
            {isGeneratingTwitterPosts ? "Generating..." : "Generate X Posts"}
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
            X Post Generation Error
          </h4>
          <p className="text-red-600 text-sm mt-1">{twitterPostError}</p>
        </div>
      )}

      {threadSaveSuccess && (
        <div className="mb-4 p-4 border-2 border-green-300 bg-green-50 rounded">
          <h4 className="text-sm font-bold text-green-700">Success</h4>
          <p className="text-green-600 text-sm mt-1">✓ {threadSaveSuccess}</p>
        </div>
      )}

      {twitterPosts.length > 0 && (
        <div className="space-y-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            Generated X Threads:
          </h4>
          {twitterPosts.map((post, index) => {
            // Use effective time range for calculations
            const effectiveTimeRange = getEffectiveTimeRange(post, index);
            const segmentIndices =
              getSegmentIndicesFromTimeRange(effectiveTimeRange);
            const postSegments = transcribedSegments.slice(
              segmentIndices.start_segment,
              segmentIndices.end_segment + 1
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
                    X Thread {index + 1}
                  </h5>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">
                    {duration}
                  </span>
                </div>

                {/* Twitter Post Content */}
                <div className="mb-4 p-3 border border-gray-200 rounded bg-gray-50">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      X Thread ({post.post_content.length} characters)
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

                {/* Segment Range Editing */}
                {isEditing && (
                  <SegmentRangeEditor
                    startSegment={segmentIndices.start_segment}
                    endSegment={segmentIndices.end_segment}
                    segments={transcribedSegments}
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
                        Time: {effectiveTimeRange.start_time.toFixed(1)}s-
                        {effectiveTimeRange.end_time.toFixed(1)}s
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
              Click "Generate X Posts" to analyze your transcription and get
              viral X thread suggestions with video clips.
            </p>
          </div>
        )}
    </div>
  );
}
