"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { TwitterPostModal } from "./TwitterPostModal";
import { SpeechSegment } from "./types";

interface TopicSuggestion {
  title: string;
  description: string;
  start_segment: number;
  end_segment: number;
  key_points: string[];
  social_media_appeal: string;
}

interface TopicSuggestionsSectionProps {
  transcribedSegments: SpeechSegment[] | null;
  onDiscardTranscription: () => void;
  onIdentifyTopics?: () => void;
  isIdentifyingTopics?: boolean;
  topicSuggestions?: TopicSuggestion[];
  topicError?: string | null;
  videoFilePath?: string;
  uploadInfo?: {
    sessionId: string;
  };
}

export function TopicSuggestionsSection({
  transcribedSegments,
  onDiscardTranscription,
  onIdentifyTopics,
  isIdentifyingTopics = false,
  topicSuggestions = [],
  topicError,
  videoFilePath,
  uploadInfo,
}: TopicSuggestionsSectionProps) {
  const [selectedTopic, setSelectedTopic] = useState<{
    suggestion: TopicSuggestion;
    segments: SpeechSegment[];
  } | null>(null);

  const handleTopicClick = (suggestion: TopicSuggestion) => {
    if (!transcribedSegments) return;

    // Extract the segments for this topic
    const topicSegments = transcribedSegments.slice(
      suggestion.start_segment,
      suggestion.end_segment + 1
    );

    setSelectedTopic({
      suggestion,
      segments: topicSegments,
    });
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

  if (!transcribedSegments) {
    return null;
  }

  return (
    <>
      <div className="mt-4 p-4 border-2 border-black bg-gray-50">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold">Content Suggestions</h3>
          <div className="flex gap-2">
            <Button
              onClick={onIdentifyTopics}
              disabled={isIdentifyingTopics}
              className="neo-brutalism-button bg-blue-500 hover:bg-blue-600 text-white"
              size="sm"
            >
              {isIdentifyingTopics ? "Analyzing..." : "Find Main Topics"}
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

        {topicError && (
          <div className="mb-4 p-4 border-2 border-red-300 bg-red-50 rounded">
            <h4 className="text-sm font-bold text-red-700">
              Topic Analysis Error
            </h4>
            <p className="text-red-600 text-sm mt-1">{topicError}</p>
          </div>
        )}

        {topicSuggestions.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Suggested Content for Social Media:
            </h4>
            {topicSuggestions.map((suggestion, index) => {
              const topicSegments = transcribedSegments.slice(
                suggestion.start_segment,
                suggestion.end_segment + 1
              );
              const duration = formatDuration(topicSegments);

              return (
                <div
                  key={index}
                  className="p-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleTopicClick(suggestion)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h5 className="font-semibold text-gray-900">
                      {suggestion.title}
                    </h5>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {duration}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mb-2">
                    {suggestion.description}
                  </p>

                  <div className="mb-2">
                    <p className="text-xs font-medium text-gray-500 mb-1">
                      Key Points:
                    </p>
                    <ul className="text-xs text-gray-600 list-disc list-inside">
                      {suggestion.key_points.map((point, pointIndex) => (
                        <li key={pointIndex}>{point}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="mb-2">
                    <p className="text-xs font-medium text-gray-500 mb-1">
                      Social Media Appeal:
                    </p>
                    <p className="text-xs text-gray-600">
                      {suggestion.social_media_appeal}
                    </p>
                  </div>

                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>
                      Segments {suggestion.start_segment + 1}-
                      {suggestion.end_segment + 1}
                    </span>
                    <span className="text-blue-600 font-medium">
                      Click to create Twitter post & video clip →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {topicSuggestions.length === 0 &&
          !isIdentifyingTopics &&
          !topicError && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">
                Click "Find Main Topics" to analyze your transcription and get
                content suggestions for social media.
              </p>
            </div>
          )}
      </div>

      {/* Twitter Post Modal */}
      {selectedTopic && (
        <TwitterPostModal
          isOpen={!!selectedTopic}
          onClose={() => setSelectedTopic(null)}
          topicSuggestion={selectedTopic.suggestion}
          segments={selectedTopic.segments}
          videoFilePath={videoFilePath}
          sessionId={uploadInfo?.sessionId}
        />
      )}
    </>
  );
}
