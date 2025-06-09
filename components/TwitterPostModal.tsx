"use client";

import {
  generateTwitterPost,
  generateVideoClip,
} from "@/app/services/videoService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Download, Loader2, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { SpeechSegment } from "./types";

interface TopicSuggestion {
  title: string;
  description: string;
  start_segment: number;
  end_segment: number;
  key_points: string[];
  social_media_appeal: string;
}

interface TwitterPost {
  main_post: string;
  alternative_posts: string[];
  hashtags: string[];
  hook_style: string;
}

interface TwitterPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicSuggestion: TopicSuggestion;
  segments: SpeechSegment[];
  videoFilePath?: string;
  sessionId?: string;
}

export function TwitterPostModal({
  isOpen,
  onClose,
  topicSuggestion,
  segments,
  videoFilePath,
  sessionId,
}: TwitterPostModalProps) {
  const [twitterPost, setTwitterPost] = useState<TwitterPost | null>(null);
  const [isGeneratingPost, setIsGeneratingPost] = useState(false);
  const [isGeneratingClip, setIsGeneratingClip] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [clipError, setClipError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<string>("");
  const [videoClip, setVideoClip] = useState<{
    clipUrl: string;
    fileName: string;
    fileSizeInMB: number;
    duration: number;
  } | null>(null);

  // Generate Twitter post when modal opens
  useEffect(() => {
    if (isOpen && !twitterPost && !isGeneratingPost) {
      handleGenerateTwitterPost();
    }
  }, [isOpen]);

  const handleGenerateTwitterPost = async () => {
    setIsGeneratingPost(true);
    setPostError(null);

    try {
      const result = await generateTwitterPost(segments, {
        title: topicSuggestion.title,
        description: topicSuggestion.description,
        key_points: topicSuggestion.key_points,
        social_media_appeal: topicSuggestion.social_media_appeal,
      });

      if (result.twitterPost) {
        setTwitterPost(result.twitterPost);
        setSelectedPost(result.twitterPost.main_post);
      } else {
        setPostError(result.error || "Failed to generate Twitter post");
      }
    } catch (error) {
      console.error("Error generating Twitter post:", error);
      setPostError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsGeneratingPost(false);
    }
  };

  const handleGenerateVideoClip = async () => {
    if (!videoFilePath || segments.length === 0) {
      setClipError("Missing video file or segments");
      return;
    }

    setIsGeneratingClip(true);
    setClipError(null);

    try {
      const startTime = segments[0].start;
      const endTime = segments[segments.length - 1].end;

      const result = await generateVideoClip(
        videoFilePath,
        startTime,
        endTime,
        sessionId
      );

      if (result.success) {
        setVideoClip({
          clipUrl: result.clipUrl,
          fileName: result.fileName,
          fileSizeInMB: result.fileSizeInMB,
          duration: result.duration,
        });
      } else {
        setClipError(result.error || "Failed to generate video clip");
      }
    } catch (error) {
      console.error("Error generating video clip:", error);
      setClipError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsGeneratingClip(false);
    }
  };

  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${minutes}m ${secs}s`;
    }
  };

  const handleDownloadClip = () => {
    if (videoClip) {
      const link = document.createElement("a");
      link.href = videoClip.clipUrl;
      link.download = videoClip.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            {topicSuggestion.title}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Twitter Post Section */}
          <div className="space-y-4">
            <div>
              <h3 className="text-md font-semibold mb-2">Twitter/X Post</h3>

              {isGeneratingPost && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Generating Twitter post...</span>
                </div>
              )}

              {postError && (
                <div className="p-3 border border-red-300 bg-red-50 rounded mb-4">
                  <p className="text-red-600 text-sm">{postError}</p>
                  <Button
                    onClick={handleGenerateTwitterPost}
                    size="sm"
                    className="mt-2"
                  >
                    Retry
                  </Button>
                </div>
              )}

              {twitterPost && (
                <div className="space-y-4">
                  {/* Main Post */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Main Post ({selectedPost.length}/280 characters)
                    </label>
                    <Textarea
                      value={selectedPost}
                      onChange={(e) => setSelectedPost(e.target.value)}
                      className="min-h-[100px] resize-none"
                      maxLength={280}
                    />
                    <div className="flex justify-between items-center mt-2">
                      <Badge variant="outline">
                        Hook Style: {twitterPost.hook_style}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyToClipboard(selectedPost)}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </Button>
                    </div>
                  </div>

                  {/* Alternative Posts */}
                  {twitterPost.alternative_posts.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        Alternative Versions
                      </label>
                      <div className="space-y-2">
                        {twitterPost.alternative_posts.map((alt, index) => (
                          <div
                            key={index}
                            className="p-2 border rounded bg-gray-50"
                          >
                            <p className="text-sm">{alt}</p>
                            <div className="flex justify-end mt-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedPost(alt)}
                              >
                                Use This
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Hashtags */}
                  {twitterPost.hashtags.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        Suggested Hashtags
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {twitterPost.hashtags.map((hashtag, index) => (
                          <Badge key={index} variant="secondary">
                            {hashtag}
                          </Badge>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() =>
                          handleCopyToClipboard(twitterPost.hashtags.join(" "))
                        }
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy Hashtags
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Video Clip Section */}
          <div className="space-y-4">
            <div>
              <h3 className="text-md font-semibold mb-2">Video Clip</h3>

              <div className="p-3 border rounded bg-gray-50 mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Duration:</strong>{" "}
                  {formatDuration(
                    segments[segments.length - 1].end - segments[0].start
                  )}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Segments:</strong> {topicSuggestion.start_segment + 1}{" "}
                  - {topicSuggestion.end_segment + 1}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Time Range:</strong> {Math.round(segments[0].start)}s
                  - {Math.round(segments[segments.length - 1].end)}s
                </p>
              </div>

              {!videoClip && !isGeneratingClip && (
                <Button
                  onClick={handleGenerateVideoClip}
                  className="w-full"
                  disabled={!videoFilePath}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Generate Video Clip
                </Button>
              )}

              {isGeneratingClip && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Generating video clip...</span>
                </div>
              )}

              {clipError && (
                <div className="p-3 border border-red-300 bg-red-50 rounded">
                  <p className="text-red-600 text-sm">{clipError}</p>
                  <Button
                    onClick={handleGenerateVideoClip}
                    size="sm"
                    className="mt-2"
                  >
                    Retry
                  </Button>
                </div>
              )}

              {videoClip && (
                <div className="space-y-4">
                  <div className="p-3 border rounded bg-green-50">
                    <p className="text-green-700 text-sm font-medium mb-2">
                      ✅ Video clip generated successfully!
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>File:</strong> {videoClip.fileName}
                      <br />
                      <strong>Size:</strong> {videoClip.fileSizeInMB} MB
                      <br />
                      <strong>Duration:</strong>{" "}
                      {formatDuration(videoClip.duration)}
                    </p>
                  </div>

                  <video
                    src={videoClip.clipUrl}
                    controls
                    className="w-full rounded border"
                    style={{ maxHeight: "300px" }}
                  >
                    Your browser does not support the video tag.
                  </video>

                  <Button
                    onClick={handleDownloadClip}
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
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
