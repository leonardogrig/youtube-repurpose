import { useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface UploadCardProps {
  videoSrc: string | null;
  onChange: (event: React.ChangeEvent<HTMLInputElement>, fileInfo?: { fileName: string, filePath: string }) => void;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
}

export function UploadCard({ videoSrc, onChange, videoRef }: UploadCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsPlaying(false);
    setPlaybackRate(1);
    const file = event.target.files?.[0];
    if (file) {
      // Extract file name
      const fileName = file.name;
      
      // Create a path that's web-friendly but without hardcoding a specific user directory
      // Use a format like file://localhost/videos/[filename]
      // The actual filepath doesn't matter for XML export, as long as it's consistent
      const filePath = `file://localhost/videos/${encodeURIComponent(fileName)}`;
      
      // Call the original onChange handler with the file info
      onChange(event, { fileName, filePath });
    } else {
      onChange(event);
    }
  };
  
  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const setSpeed = (rate: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = rate;
    setPlaybackRate(rate);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleRateChange = () => setPlaybackRate(video.playbackRate);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ratechange', handleRateChange);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ratechange', handleRateChange);
    };
  }, [videoRef]);

  const neoButtonStyle = "neo-brutalism-button px-3 py-1 text-sm";
  const activeButtonStyle = "bg-yellow-300";

  return (
    <Card className="w-full max-w-lg mb-8 neo-brutalism-card mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Upload Video</CardTitle>
        <CardDescription>Select a video file from your computer.</CardDescription>
      </CardHeader>
      <CardContent>
        <Input
          type="file"
          accept="video/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="neo-brutalism-input"
        />
        {videoSrc && (
          <div className="mt-4">
            <div className="border-2 border-black mb-2">
              <video
                src={videoSrc}
                className="w-full aspect-video block"
                ref={videoRef}
                onLoadedMetadata={() => {
                  setIsPlaying(false);
                  setPlaybackRate(videoRef.current?.playbackRate || 1);
                }}
              >
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="flex items-center justify-center gap-2 mt-2">
               <Button
                 onClick={togglePlayPause}
                 className={`${neoButtonStyle} ${isPlaying ? activeButtonStyle : ''}`}
               >
                 {isPlaying ? 'Pause' : 'Play'}
               </Button>
               <Button
                 onClick={() => setSpeed(1)}
                 className={`${neoButtonStyle} ${playbackRate === 1 ? activeButtonStyle : ''}`}
               >
                 1x
               </Button>
               <Button
                 onClick={() => setSpeed(2)}
                 className={`${neoButtonStyle} ${playbackRate === 2 ? activeButtonStyle : ''}`}
               >
                 2x
               </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 