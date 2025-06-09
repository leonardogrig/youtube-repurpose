"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface SegmentRangeEditorProps {
  startSegment: number;
  endSegment: number;
  totalSegments: number;
  onApply: (newStartSegment: number, newEndSegment: number) => void;
  onCancel: () => void;
}

export function SegmentRangeEditor({
  startSegment,
  endSegment,
  totalSegments,
  onApply,
  onCancel,
}: SegmentRangeEditorProps) {
  const [newStartSegment, setNewStartSegment] = useState(startSegment);
  const [newEndSegment, setNewEndSegment] = useState(endSegment);
  const [errors, setErrors] = useState<string[]>([]);

  const validateRange = (start: number, end: number): string[] => {
    const validationErrors: string[] = [];

    if (start < 0) {
      validationErrors.push("Start segment cannot be negative");
    }

    if (end >= totalSegments) {
      validationErrors.push(`End segment cannot exceed ${totalSegments - 1}`);
    }

    if (start > end) {
      validationErrors.push("Start segment cannot be greater than end segment");
    }

    return validationErrors;
  };

  const handleStartChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      setNewStartSegment(numValue);
      setErrors(validateRange(numValue, newEndSegment));
    }
  };

  const handleEndChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      setNewEndSegment(numValue);
      setErrors(validateRange(newStartSegment, numValue));
    }
  };

  const handleApply = () => {
    const validationErrors = validateRange(newStartSegment, newEndSegment);
    if (validationErrors.length === 0) {
      onApply(newStartSegment, newEndSegment);
    } else {
      setErrors(validationErrors);
    }
  };

  const isValid = errors.length === 0;
  const hasChanges =
    newStartSegment !== startSegment || newEndSegment !== endSegment;

  return (
    <div className="border-2 border-black bg-yellow-100 p-4 mb-4">
      <h4 className="font-bold mb-3 text-lg">Edit Segment Range</h4>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <Label
            htmlFor="start-segment"
            className="text-sm font-bold mb-2 block"
          >
            Start Segment (1-based)
          </Label>
          <Input
            id="start-segment"
            type="number"
            min="1"
            max={totalSegments}
            value={newStartSegment + 1}
            onChange={(e) =>
              handleStartChange((parseInt(e.target.value, 10) - 1).toString())
            }
            className="neo-brutalism-input"
          />
          <p className="text-xs text-gray-600 mt-1">
            Current: Segment {newStartSegment + 1}
          </p>
        </div>

        <div>
          <Label htmlFor="end-segment" className="text-sm font-bold mb-2 block">
            End Segment (1-based)
          </Label>
          <Input
            id="end-segment"
            type="number"
            min="1"
            max={totalSegments}
            value={newEndSegment + 1}
            onChange={(e) =>
              handleEndChange((parseInt(e.target.value, 10) - 1).toString())
            }
            className="neo-brutalism-input"
          />
          <p className="text-xs text-gray-600 mt-1">
            Current: Segment {newEndSegment + 1}
          </p>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="border-2 border-red-500 bg-red-50 p-3 mb-4">
          <h5 className="font-bold text-red-700 mb-2">Validation Errors:</h5>
          <ul className="text-red-600 text-sm list-disc list-inside">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-gray-100 border-2 border-gray-400 p-3 mb-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-bold">Original Range:</span>
            <br />
            Segments {startSegment + 1} to {endSegment + 1}
            <br />
            <span className="text-gray-600">
              ({endSegment - startSegment + 1} segments)
            </span>
          </div>
          <div>
            <span className="font-bold">New Range:</span>
            <br />
            Segments {newStartSegment + 1} to {newEndSegment + 1}
            <br />
            <span className="text-gray-600">
              ({newEndSegment - newStartSegment + 1} segments)
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button
          onClick={onCancel}
          className="neo-brutalism-button bg-gray-400 hover:bg-gray-500 text-white"
        >
          Cancel
        </Button>
        <Button
          onClick={handleApply}
          disabled={!isValid || !hasChanges}
          className="neo-brutalism-button bg-green-500 hover:bg-green-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Apply Changes
        </Button>
      </div>
    </div>
  );
}
