"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { convertToSpeechSegments } from "@/lib/database";
import { useEffect, useState } from "react";
import { SpeechSegment } from "./types";

interface VideoHistoryItem {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  duration: number | null;
  language: string;
  createdAt: string;
  transcriptionSegments: {
    id: string;
    startTime: number;
    endTime: number;
    text: string;
    confidence: number | null;
    error: string | null;
    skipped: boolean;
  }[];
}

interface VideoHistoryCardProps {
  onSelectVideo: (video: VideoHistoryItem, segments: SpeechSegment[]) => void;
  onDeleteVideo: (videoId: string) => void;
}

export function VideoHistoryCard({
  onSelectVideo,
  onDeleteVideo,
}: VideoHistoryCardProps) {
  const [videos, setVideos] = useState<VideoHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null);

  useEffect(() => {
    fetchVideoHistory();
  }, []);

  const fetchVideoHistory = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/videos");

      if (!response.ok) {
        throw new Error("Failed to fetch video history");
      }

      const data = await response.json();
      setVideos(data.videos);
    } catch (err) {
      console.error("Error fetching video history:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch video history"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectVideo = (video: VideoHistoryItem) => {
    const segments = convertToSpeechSegments(video.transcriptionSegments);
    onSelectVideo(video, segments);
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this video and its transcription?"
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/videos/${videoId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete video");
      }

      setVideos(videos.filter((v) => v.id !== videoId));
      onDeleteVideo(videoId);
    } catch (err) {
      console.error("Error deleting video:", err);
      alert("Failed to delete video. Please try again.");
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return "Unknown";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const toggleExpanded = (videoId: string) => {
    setExpandedVideo(expandedVideo === videoId ? null : videoId);
  };

  if (isLoading) {
    return (
      <Card className="w-full neo-brutalism-card">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Video History</CardTitle>
          <CardDescription>Loading your transcribed videos...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-black rounded-full border-t-transparent"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full neo-brutalism-card">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Video History</CardTitle>
          <CardDescription>Error loading video history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-red-500 bg-red-50 p-4">
            <p className="text-red-700 font-bold">Error: {error}</p>
            <Button
              onClick={fetchVideoHistory}
              className="neo-brutalism-button bg-red-500 hover:bg-red-600 text-white mt-2"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full neo-brutalism-card">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Video History</CardTitle>
        <CardDescription>
          Select a previously transcribed video to reuse its transcription
        </CardDescription>
      </CardHeader>
      <CardContent>
        {videos.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-300 bg-gray-50">
            <p className="text-gray-600 font-bold">No transcribed videos yet</p>
            <p className="text-gray-500 text-sm mt-1">
              Upload and transcribe a video to see it here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {videos.map((video) => (
              <div
                key={video.id}
                className="border-2 border-black bg-white p-4 neo-brutalism-card hover:shadow-brutal-lg transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-2 break-words">
                      {video.fileName}
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge className="neo-brutalism-button bg-blue-200 text-black border-2 border-black px-2 py-1">
                        {video.language}
                      </Badge>
                      <Badge className="neo-brutalism-button bg-green-200 text-black border-2 border-black px-2 py-1">
                        {formatFileSize(video.fileSize)}
                      </Badge>
                      <Badge className="neo-brutalism-button bg-yellow-200 text-black border-2 border-black px-2 py-1">
                        {formatDuration(video.duration)}
                      </Badge>
                      <Badge className="neo-brutalism-button bg-purple-200 text-black border-2 border-black px-2 py-1">
                        {video.transcriptionSegments.length} segments
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Created: {new Date(video.createdAt).toLocaleDateString()}{" "}
                      at {new Date(video.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    <Button
                      onClick={() => handleSelectVideo(video)}
                      className="neo-brutalism-button bg-green-500 hover:bg-green-600 text-white"
                      size="sm"
                    >
                      Use This Video
                    </Button>
                    <Button
                      onClick={() => toggleExpanded(video.id)}
                      className="neo-brutalism-button bg-blue-500 hover:bg-blue-600 text-white"
                      size="sm"
                    >
                      {expandedVideo === video.id ? "Hide" : "Preview"}
                    </Button>
                    <Button
                      onClick={() => handleDeleteVideo(video.id)}
                      className="neo-brutalism-button bg-red-500 hover:bg-red-600 text-white"
                      size="sm"
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                {expandedVideo === video.id && (
                  <div className="mt-4 border-t-2 border-black pt-4">
                    <h4 className="font-bold mb-2">Transcription Preview:</h4>
                    <div className="max-h-64 overflow-y-auto border-2 border-gray-300 bg-gray-50 p-3">
                      {video.transcriptionSegments
                        .slice(0, 10)
                        .map((segment, index) => (
                          <div
                            key={segment.id}
                            className="mb-2 pb-2 border-b border-gray-300 last:border-b-0"
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-xs font-bold bg-yellow-300 px-2 py-1 border border-black">
                                {segment.startTime.toFixed(1)}s -{" "}
                                {segment.endTime.toFixed(1)}s
                              </span>
                              {segment.error && (
                                <span className="text-xs bg-red-200 px-2 py-1 border border-black">
                                  Error
                                </span>
                              )}
                            </div>
                            <p className="text-sm">
                              {segment.text || "No text"}
                            </p>
                          </div>
                        ))}
                      {video.transcriptionSegments.length > 10 && (
                        <p className="text-xs text-gray-500 text-center mt-2">
                          ... and {video.transcriptionSegments.length - 10} more
                          segments
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
