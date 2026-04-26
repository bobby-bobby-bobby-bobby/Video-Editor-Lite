import React, { useRef, useState, useEffect, useCallback } from "react";
import { convertFileSrc } from "@tauri-apps/api/tauri";
import { useMediaStore } from "../../store/mediaStore";
import { useTimelineStore } from "../../store/timelineStore";
import { formatTime } from "../../utils/formatTime";

/** Video / audio preview panel. Plays the selected asset or the clip at the playhead. */
export const VideoPreview: React.FC = () => {
  const assets = useMediaStore((s) => s.assets);
  const selectedAssetId = useMediaStore((s) => s.selectedAssetId);
  const playhead = useTimelineStore((s) => s.playhead);
  const setPlayhead = useTimelineStore((s) => s.setPlayhead);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  // Determine which asset to preview (selected asset, or asset at playhead)
  const selectedAsset = assets.find((a) => a.id === selectedAssetId) ?? null;

  // Use proxy path if available and ready, otherwise fall back to original
  const resolveSourcePath = useCallback(
    (asset: typeof selectedAsset): string | null => {
      if (!asset) return null;
      if (asset.proxyStatus === "ready" && asset.proxyPath) {
        return convertFileSrc(asset.proxyPath);
      }
      return convertFileSrc(asset.path);
    },
    []
  );

  const srcUrl = resolveSourcePath(selectedAsset);

  // Sync external playhead changes to the video element
  useEffect(() => {
    const v = videoRef.current;
    if (!v || Math.abs(v.currentTime - playhead) < 0.2) return;
    v.currentTime = playhead;
  }, [playhead]);

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    setPlayhead(v.currentTime);
  };

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration);
    setCurrentTime(0);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    setCurrentTime(t);
    setPlayhead(t);
    if (videoRef.current) videoRef.current.currentTime = t;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (videoRef.current) videoRef.current.volume = v;
  };

  const handleEnded = () => setIsPlaying(false);

  const isVideo = selectedAsset?.type === "video";
  const isAudio = selectedAsset?.type === "audio";

  return (
    <div className="flex flex-col h-full bg-[#0f0f1e] text-xs">
      {/* Video / Audio area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
        {!selectedAsset && (
          <div className="text-[#555] flex flex-col items-center gap-2">
            <span className="text-4xl">🎬</span>
            <span>Select a clip to preview</span>
          </div>
        )}

        {selectedAsset && isVideo && srcUrl && (
          <video
            ref={videoRef}
            src={srcUrl}
            className="max-w-full max-h-full"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
          />
        )}

        {selectedAsset && isAudio && srcUrl && (
          <div className="flex flex-col items-center gap-4 text-[#888]">
            <span className="text-6xl">🎵</span>
            <span className="text-sm text-[#e0e0e0]">{selectedAsset.name}</span>
            <audio
              ref={videoRef as React.RefObject<HTMLAudioElement>}
              src={srcUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
            />
          </div>
        )}

        {selectedAsset && selectedAsset.type === "image" && srcUrl && (
          <img
            src={srcUrl}
            alt={selectedAsset.name}
            className="max-w-full max-h-full object-contain"
          />
        )}
      </div>

      {/* Controls */}
      {selectedAsset && (isVideo || isAudio) && (
        <div className="shrink-0 px-3 py-2 bg-[#16213e] border-t border-[#2a2a4a] space-y-1.5">
          {/* Scrub bar */}
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.05}
            value={currentTime}
            onChange={handleScrub}
            className="w-full h-1.5 accent-[#e94560] cursor-pointer"
          />

          {/* Playback controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-[#e94560] hover:bg-[#c73550] text-white transition-colors text-sm"
            >
              {isPlaying ? "⏸" : "▶"}
            </button>

            <span className="text-[#888] font-mono text-[10px]">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="flex-1" />

            {/* Volume */}
            <span className="text-[#555]">🔊</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={volume}
              onChange={handleVolumeChange}
              className="w-16 h-1 accent-[#e94560] cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
};
