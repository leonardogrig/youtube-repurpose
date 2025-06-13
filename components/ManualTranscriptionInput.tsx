"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { SpeechSegment } from "./types";

interface ManualTranscriptionInputProps {
  onTranscriptionParsed: (segments: SpeechSegment[], fileName?: string) => void;
  videoFileName?: string;
  onTranscriptionTextChange?: (hasText: boolean) => void;
}

export function ManualTranscriptionInput({
  onTranscriptionParsed,
  videoFileName,
  onTranscriptionTextChange,
}: ManualTranscriptionInputProps) {
  const [transcriptionText, setTranscriptionText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewSegments, setPreviewSegments] = useState<SpeechSegment[]>([]);
  const [manualFileName, setManualFileName] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [showAllSegments, setShowAllSegments] = useState(false);

  const parseTimeToSeconds = (timeStr: string): number => {
    // Handle formats like "0:00", "1:23", "10:45" (mm:ss) and "1:00:01" (h:mm:ss)
    const parts = timeStr.split(":");
    if (parts.length === 2) {
      // mm:ss format
      const minutes = parseInt(parts[0], 10);
      const seconds = parseInt(parts[1], 10);
      return minutes * 60 + seconds;
    } else if (parts.length === 3) {
      // h:mm:ss format
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      const seconds = parseInt(parts[2], 10);
      return hours * 3600 + minutes * 60 + seconds;
    }
    return 0;
  };

  const isValidTimeFormat = (line: string): boolean => {
    // Check if line matches time format like "0:00", "1:23" (mm:ss) or "1:00:01" (h:mm:ss)
    const trimmed = line.trim();
    return /^\d+:\d{2}$/.test(trimmed) || /^\d+:\d{2}:\d{2}$/.test(trimmed);
  };

  const parseTranscription = (text: string): SpeechSegment[] => {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    console.log("=== PARSING TRANSCRIPTION ===");
    console.log("Total lines:", lines.length);
    console.log("First 10 lines:", lines.slice(0, 10));

    const segments: SpeechSegment[] = [];
    let i = 0;

    // Skip any initial non-timestamp lines
    while (i < lines.length && !isValidTimeFormat(lines[i])) {
      console.log(`Skipping initial line: "${lines[i]}"`);
      i++;
    }

    // Process transcription in timestamp -> text pairs
    while (i < lines.length) {
      if (isValidTimeFormat(lines[i])) {
        const timestampLine = lines[i];
        const startTime = parseTimeToSeconds(timestampLine);
        console.log(
          `\n--- Processing timestamp: ${timestampLine} (${startTime}s = ${formatTime(
            startTime
          )}) ---`
        );
        i++; // Move to text content

        // Collect all text lines until the next timestamp
        const textLines: string[] = [];
        while (i < lines.length && !isValidTimeFormat(lines[i])) {
          const textLine = lines[i].trim();
          if (textLine.length > 0) {
            console.log(`  Text line: "${textLine}"`);
            textLines.push(textLine);
          }
          i++;
        }

        // Combine all text for this segment
        const combinedText = textLines.join(" ").trim();

        if (combinedText.length > 0) {
          // Calculate end time
          let endTime = startTime + 2; // Default 2 seconds

          // Look ahead to find next timestamp for accurate end time
          if (i < lines.length && isValidTimeFormat(lines[i])) {
            endTime = parseTimeToSeconds(lines[i]);
            console.log(`  Next timestamp found: ${lines[i]} (${endTime}s)`);
          } else {
            // Last segment - estimate duration
            const wordCount = combinedText.split(/\s+/).length;
            const estimatedDuration = Math.max(wordCount * 0.4, 1);
            endTime = startTime + estimatedDuration;
            console.log(
              `  Last segment - estimated duration: ${estimatedDuration}s`
            );
          }

          const segment = {
            start: startTime,
            end: endTime,
            text: combinedText,
          };

          console.log(
            `  ✓ Created segment: ${startTime}s-${endTime}s (${(
              endTime - startTime
            ).toFixed(1)}s) | "${combinedText.substring(0, 50)}${
              combinedText.length > 50 ? "..." : ""
            }"`
          );
          segments.push(segment);
        } else {
          console.log(`  ⚠ No text found for timestamp ${timestampLine}`);
        }
      } else {
        console.log(`  ? Unexpected line: "${lines[i]}"`);
        i++;
      }
    }

    console.log(`\n=== PARSING COMPLETE ===`);
    console.log(`Total segments created: ${segments.length}`);
    console.log("First 3 segments:", segments.slice(0, 3));
    console.log("Last 3 segments:", segments.slice(-3));

    return segments;
  };

  const handleParseTranscription = () => {
    setError(null);
    setIsProcessing(true);

    try {
      if (!transcriptionText.trim()) {
        throw new Error("Please enter a transcription");
      }

      const segments = parseTranscription(transcriptionText);

      if (segments.length === 0) {
        throw new Error("No valid segments found. Please check the format.");
      }

      setPreviewSegments(segments);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to parse transcription"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmTranscription = () => {
    if (previewSegments.length > 0) {
      const effectiveFileName =
        videoFileName || manualFileName || "Manual Transcription";
      onTranscriptionParsed(previewSegments, effectiveFileName);

      // Show success message
      setShowSuccess(true);

      // Clear the form after a short delay to let user see the success
      setTimeout(() => {
        setTranscriptionText("");
        setPreviewSegments([]);
        setManualFileName("");
        setShowSuccess(false);
        setShowAllSegments(false);
      }, 2000);
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, "0")}`;
    }
  };

  return (
    <Card className="w-full neo-brutalism-card mb-8">
      <CardHeader>
        <CardTitle className="text-xl font-bold">
          Manual Transcription Input
        </CardTitle>
        <CardDescription>
          Enter your own transcription in the specific format: timestamp
          followed by text
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Filename Input - only show if no video file selected */}
          {!videoFileName && (
            <div>
              <label className="block text-sm font-bold mb-2">
                Video/Content Name (Optional)
              </label>
              <Input
                value={manualFileName}
                onChange={(e) => setManualFileName(e.target.value)}
                placeholder="Enter a name for this transcription (e.g., 'Split Pushing Guide')"
                className="border-2 border-black neo-brutalism-input"
                disabled={isProcessing}
              />
            </div>
          )}

          {/* Input Area */}
          <div>
            <label className="block text-sm font-bold mb-2">
              Transcription Text {videoFileName && `for ${videoFileName}`}
            </label>
            <Textarea
              value={transcriptionText}
              onChange={(e) => {
                setTranscriptionText(e.target.value);
                onTranscriptionTextChange?.(e.target.value.trim().length > 0);
              }}
              placeholder={`Enter transcription in this format:
0:00
hello hello hello and welcome back to
0:02
another coaching video today we're going
0:04
to talk about split pushing firstly I
...`}
              className="min-h-[200px] border-2 border-black neo-brutalism-input"
              disabled={isProcessing}
            />
          </div>

          {/* Format Info */}
          <div className="p-3 border-2 border-blue-500 bg-blue-50">
            <h4 className="font-bold text-blue-700 mb-2">
              Format Requirements:
            </h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>
                • Start each segment with a timestamp (e.g., "0:00", "1:23")
              </li>
              <li>• Follow with the transcription text</li>
              <li>• Duplicate section headers will be automatically removed</li>
              <li>• End times will be calculated automatically</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleParseTranscription}
              disabled={isProcessing || !transcriptionText.trim()}
              className="neo-brutalism-button bg-blue-500 hover:bg-blue-600 text-white"
            >
              {isProcessing ? "Parsing..." : "Parse Transcription"}
            </Button>

            {previewSegments.length > 0 && (
              <Button
                onClick={handleConfirmTranscription}
                className="neo-brutalism-button bg-green-500 hover:bg-green-600 text-white"
              >
                Use This Transcription ({previewSegments.length} segments)
              </Button>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 border-2 border-red-500 bg-red-50">
              <p className="text-red-700 font-bold">Error: {error}</p>
            </div>
          )}

          {/* Success Display */}
          {showSuccess && (
            <div className="p-3 border-2 border-green-500 bg-green-50">
              <p className="text-green-700 font-bold">
                ✅ Transcription loaded successfully! Check the segments below.
              </p>
            </div>
          )}

          {/* Preview */}
          {previewSegments.length > 0 && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold">
                  Preview ({previewSegments.length} segments)
                </h3>
                {previewSegments.length > 10 && (
                  <Button
                    onClick={() => setShowAllSegments(!showAllSegments)}
                    className="neo-brutalism-button bg-purple-400 hover:bg-purple-500 text-white text-xs px-3 py-1"
                  >
                    {showAllSegments ? "Show Less" : "Show All Segments"}
                  </Button>
                )}
              </div>
              <div
                className={`${
                  showAllSegments ? "max-h-96" : "max-h-64"
                } overflow-y-auto border-2 border-gray-300 bg-gray-50 p-3`}
              >
                {(showAllSegments
                  ? previewSegments
                  : previewSegments.slice(0, 10)
                ).map((segment, index) => (
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
                    <div className="text-xs text-gray-700 line-clamp-2">
                      {segment.text}
                    </div>
                  </div>
                ))}
                {!showAllSegments && previewSegments.length > 10 && (
                  <div className="text-center text-gray-500 text-sm mt-2">
                    ... and {previewSegments.length - 10} more segments (click
                    "Show All Segments" to view)
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
