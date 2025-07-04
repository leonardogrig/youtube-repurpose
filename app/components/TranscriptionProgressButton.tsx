type TranscriptionProgressButtonProps = {
  onClick: () => void;
  percent: number;
  completedSegments: number;
  totalSegments: number;
  status: string;
};

export function TranscriptionProgressButton({
  onClick,
  percent,
  completedSegments,
  totalSegments,
  status,
}: TranscriptionProgressButtonProps) {
  // Get status color
  const getStatusColor = () => {
    switch (status) {
      case "transcribing":
        return "bg-green-400";
      case "extracting":
        return "bg-blue-400";
      case "filtering":
        return "bg-yellow-400";
      case "saving":
        return "bg-purple-400";
      case "checking":
        return "bg-orange-400";
      case "completed_segment":
        return "bg-teal-400";
      case "complete":
        return "bg-green-500";
      default:
        return "bg-gray-400";
    }
  };

  // Determine what to show based on status
  const getDisplayText = () => {
    if (status === "complete") {
      return "Finishing...";
    }
    return `${percent}%`;
  };

  // Adjust font size for longer text
  const getTextSize = () => {
    if (status === "complete") {
      return "text-[10px]";
    }
    return "text-xs";
  };

  return (
    <button
      onClick={onClick}
      className="px-3 py-2 border-4 border-black bg-yellow-200 hover:bg-yellow-300 font-bold shadow-brutal-sm transition duration-200 flex items-center"
      title="View transcription progress"
    >
      <div className="relative w-12 h-8 border-3 border-black overflow-hidden flex items-center justify-center bg-white">
        {/* Progress circle */}
        <div
          className={`inset-0 ${getStatusColor()} transition-all duration-500`}
          style={{
            clipPath: `polygon(0 0, 100% 0, 100% ${
              status === "complete" ? 100 : percent
            }%, 0 ${status === "complete" ? 100 : percent}%)`,
          }}
        />
        <span className={`${getTextSize()} font-bold z-10`}>
          {getDisplayText()}
        </span>
      </div>
      <div className="flex flex-col items-start ml-2">
        <span className="text-xs font-bold">Progress</span>
      </div>
    </button>
  );
}
