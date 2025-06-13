"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { SpeechSegment } from "./types";

interface SegmentRangeEditorProps {
  startSegment: number;
  endSegment: number;
  segments: SpeechSegment[]; // Changed from totalSegments to actual segments
  onApply: (newStartSegment: number, newEndSegment: number) => void;
  onCancel: () => void;
}

export function SegmentRangeEditor({
  startSegment,
  endSegment,
  segments,
  onApply,
  onCancel,
}: SegmentRangeEditorProps) {
  const [tempStartSegment, setTempStartSegment] = useState(startSegment);
  const [tempEndSegment, setTempEndSegment] = useState(endSegment);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds
        .toString()
        .padStart(2, "0")}`;
    } else {
      return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    }
  };

  const handleStartChange = (newValue: number) => {
    const clampedValue = Math.max(0, Math.min(newValue, segments.length - 1));
    setTempStartSegment(clampedValue);
    // Ensure end segment is not before start segment
    if (tempEndSegment < clampedValue) {
      setTempEndSegment(clampedValue);
    }
  };

  const handleEndChange = (newValue: number) => {
    const clampedValue = Math.max(
      tempStartSegment,
      Math.min(newValue, segments.length - 1)
    );
    setTempEndSegment(clampedValue);
  };

  const getCurrentSegmentInfo = (index: number) => {
    if (index >= 0 && index < segments.length) {
      const segment = segments[index];
      return {
        start: formatTime(segment.start),
        end: formatTime(segment.end),
        duration: (segment.end - segment.start).toFixed(1),
      };
    }
    return { start: "0:00", end: "0:00", duration: "0.0" };
  };

  const startInfo = getCurrentSegmentInfo(tempStartSegment);
  const endInfo = getCurrentSegmentInfo(tempEndSegment);

  return (
    <div className="p-4 border-2 border-orange-400 bg-orange-50 rounded-lg mb-4">
      <h4 className="font-bold text-orange-800 mb-4">Edit Segment Range</h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Start Segment Selector */}
        <div>
          <Label className="text-sm font-bold mb-2 block">Start Segment</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleStartChange(tempStartSegment - 1)}
              disabled={tempStartSegment <= 0}
              className="p-2"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 text-center">
              <div className="font-mono text-lg font-bold">
                Segment {tempStartSegment + 1}
              </div>
              <div className="text-xs text-gray-600">
                {startInfo.start} ({startInfo.duration}s)
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleStartChange(tempStartSegment + 1)}
              disabled={tempStartSegment >= segments.length - 1}
              className="p-2"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* End Segment Selector */}
        <div>
          <Label className="text-sm font-bold mb-2 block">End Segment</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleEndChange(tempEndSegment - 1)}
              disabled={tempEndSegment <= tempStartSegment}
              className="p-2"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 text-center">
              <div className="font-mono text-lg font-bold">
                Segment {tempEndSegment + 1}
              </div>
              <div className="text-xs text-gray-600">
                {endInfo.end} ({endInfo.duration}s)
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleEndChange(tempEndSegment + 1)}
              disabled={tempEndSegment >= segments.length - 1}
              className="p-2"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white p-3 rounded border border-orange-200 mb-4">
        <div className="text-sm">
          <strong>Selected Range:</strong> Segments {tempStartSegment + 1} to{" "}
          {tempEndSegment + 1}
        </div>
        <div className="text-sm text-gray-600">
          <strong>Time Range:</strong> {startInfo.start} → {endInfo.end}
        </div>
        <div className="text-sm text-gray-600">
          <strong>Total Segments:</strong>{" "}
          {tempEndSegment - tempStartSegment + 1}
        </div>
      </div>

      {/* Transcription Preview */}
      <div className="bg-gray-50 p-3 rounded border border-orange-200 mb-4">
        <div className="text-sm font-bold mb-2 text-gray-700">
          Transcription Preview:
        </div>
        <div className="max-h-40 overflow-y-auto border border-gray-300 bg-white p-3 rounded text-sm">
          {(() => {
            const selectedSegments = segments.slice(
              tempStartSegment,
              tempEndSegment + 1
            );
            const segmentsWithText = selectedSegments.filter(
              (segment) => segment.text && segment.text.trim().length > 0
            );
            const emptySegments =
              selectedSegments.length - segmentsWithText.length;

            return (
              <>
                {selectedSegments.map((segment, index) => (
                  <span key={tempStartSegment + index} className="block mb-1">
                    {segment.text && segment.text.trim().length > 0 ? (
                      <span className="text-gray-800">{segment.text}</span>
                    ) : (
                      <span className="text-red-500 italic">
                        (No text - Segment {tempStartSegment + index + 1})
                      </span>
                    )}
                    {index < tempEndSegment - tempStartSegment && " "}
                  </span>
                ))}

                {/* Warning for empty segments */}
                {emptySegments > 0 && (
                  <div className="mt-3 p-2 bg-yellow-50 border border-yellow-300 rounded text-xs">
                    <div className="font-bold text-yellow-800">⚠️ Warning:</div>
                    <div className="text-yellow-700">
                      {emptySegments} of {selectedSegments.length} segments have
                      no transcribed text. This may result in a very short or
                      empty video clip.
                    </div>
                  </div>
                )}

                {/* Info about content */}
                {segmentsWithText.length > 0 && (
                  <div className="mt-3 p-2 bg-blue-50 border border-blue-300 rounded text-xs">
                    <div className="font-bold text-blue-800">
                      📝 Content Summary:
                    </div>
                    <div className="text-blue-700">
                      {segmentsWithText.length} segments with text,
                      approximately {Math.round(segmentsWithText.length * 2)}{" "}
                      seconds of content.
                    </div>
                  </div>
                )}

                {tempStartSegment === tempEndSegment && (
                  <div className="text-gray-500 italic mt-2">
                    Single segment selected
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={() => onApply(tempStartSegment, tempEndSegment)}
          className="neo-brutalism-button bg-green-500 hover:bg-green-600 text-white"
        >
          Apply Changes
        </Button>
        <Button
          onClick={onCancel}
          variant="outline"
          className="neo-brutalism-button"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
