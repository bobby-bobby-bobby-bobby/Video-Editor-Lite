import React, { useRef, useState, useEffect, useMemo } from "react";
import { convertFileSrc } from "@tauri-apps/api/tauri";
import { useMediaStore } from "../../store/mediaStore";
import { useTimelineStore } from "../../store/timelineStore";
import { useEffectsStore } from "../../store/effectsStore";
import { formatTime } from "../../utils/formatTime";

const SEEK_TOLERANCE = 0.15;

/** Video / audio preview panel. Prioritises timeline context and uses proxies when available. */
export const VideoPreview: React.FC = () => {
  const assets = useMediaStore((s) => s.assets);
  const selectedAssetId = useMediaStore((s) => s.selectedAssetId);
  const clips = useTimelineStore((s) => s.clips);
  const selectedClipId = useTimelineStore((s) => s.selectedClipId);
  const playhead = useTimelineStore((s) => s.playhead);
  const setPlayhead = useTimelineStore((s) => s.setPlayhead);
  const getClipEffects = useEffectsStore((s) => s.getClipEffects);

  const mediaRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const selectedClip = useMemo(
    () => clips.find((c) => c.id === selectedClipId) ?? null,
    [clips, selectedClipId]
  );
  const clipAtPlayhead = useMemo(() => {
    const candidates = clips.filter((c) => playhead >= c.startTime && playhead < c.endTime);
    return candidates.sort((a, b) => a.trackIndex - b.trackIndex)[0] ?? null;
  }, [clips, playhead]);
  const activeClip = selectedClip ?? clipAtPlayhead;

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) ?? null;
  const clipAsset = activeClip ? assets.find((a) => a.id === activeClip.assetId) ?? null : null;
  const activeAsset = clipAsset ?? selectedAsset;
  const clipEffects = activeClip ? getClipEffects(activeClip.id) : [];

  const srcUrl = useMemo(() => {
    if (!activeAsset) return null;
    if (activeAsset.proxyStatus === "ready" && activeAsset.proxyPath) {
      return convertFileSrc(activeAsset.proxyPath);
    }
    return convertFileSrc(activeAsset.path);
  }, [activeAsset]);

  const speedEffect = clipEffects.find((e) => e.enabled && e.type === "speed");
  const playbackRate = Math.max(
    0.1,
    Math.min(4, speedEffect?.params.multiplier ?? 1)
  );
  const brightness = clipEffects
    .filter((e) => e.enabled && e.type === "brightness")
    .reduce((acc, e) => acc + (e.params.value ?? 0), 0);
  const contrast = clipEffects
    .filter((e) => e.enabled && e.type === "contrast")
    .reduce((acc, e) => acc + (e.params.value ?? 0), 0);
  const blur = clipEffects
    .filter((e) => e.enabled && e.type === "blur")
    .reduce((acc, e) => acc + (e.params.radius ?? 0), 0);
  const previewFilter = `brightness(${Math.max(0, 1 + brightness)}) contrast(${Math.max(
    0,
    1 + contrast
  )}) blur(${Math.max(0, blur)}px)`;

  const expectedStartTime = useMemo(() => {
    if (!activeClip) return 0;
    return activeClip.inPoint + Math.max(0, playhead - activeClip.startTime);
  }, [activeClip, playhead]);

  useEffect(() => {
    const v = mediaRef.current;
    if (!v) return;
    if (Math.abs(v.currentTime - expectedStartTime) < SEEK_TOLERANCE) return;
    v.currentTime = expectedStartTime;
  }, [expectedStartTime, srcUrl]);

  useEffect(() => {
    const v = mediaRef.current;
    if (!v) return;
    v.playbackRate = playbackRate;
  }, [playbackRate, srcUrl]);

  useEffect(() => {
    setPreviewError(null);
    setIsPlaying(false);
    setCurrentTime(0);
  }, [srcUrl]);

  const handleTimeUpdate = () => {
    const v = mediaRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    if (activeClip) {
      const timelineTime = activeClip.startTime + (v.currentTime - activeClip.inPoint);
      setPlayhead(timelineTime);
      if (timelineTime >= activeClip.endTime) {
        v.pause();
        setIsPlaying(false);
      }
    } else {
      setPlayhead(v.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const v = mediaRef.current;
    if (!v) return;
    const clipDuration = activeClip ? Math.max(0.05, activeClip.outPoint - activeClip.inPoint) : v.duration;
    setDuration(clipDuration);
    setCurrentTime(activeClip ? expectedStartTime : 0);
  };

  const togglePlay = async () => {
    const v = mediaRef.current;
    if (!v) return;
    try {
      if (v.paused) {
        await v.play();
        setIsPlaying(true);
      } else {
        v.pause();
        setIsPlaying(false);
      }
    } catch (e) {
      setPreviewError(`Playback failed: ${String(e)}`);
    }
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    if (!mediaRef.current) return;

    if (activeClip) {
      const targetTimeline = activeClip.startTime + t;
      const targetMedia = activeClip.inPoint + t;
      setPlayhead(targetTimeline);
      mediaRef.current.currentTime = targetMedia;
      setCurrentTime(targetMedia);
    } else {
      setPlayhead(t);
      mediaRef.current.currentTime = t;
      setCurrentTime(t);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (mediaRef.current) mediaRef.current.volume = v;
  };

  const isVideo = activeAsset?.type === "video";
  const isAudio = activeAsset?.type === "audio";

  return (
    <div className="flex flex-col h-full bg-[#0f0f1e] text-xs">
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
        {!activeAsset && (
          <div className="text-[#555] flex flex-col items-center gap-2">
            <span className="text-4xl">🎬</span>
            <span>Select media or place the playhead on a clip</span>
          </div>
        )}

        {activeAsset && isVideo && srcUrl && (
          <video
            ref={mediaRef}
            src={srcUrl}
            className="max-w-full max-h-full"
            style={{ filter: previewFilter }}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            onError={() => setPreviewError("Missing or unreadable media file")}
          />
        )}

        {activeAsset && isAudio && srcUrl && (
          <div className="flex flex-col items-center gap-4 text-[#888]">
            <span className="text-6xl">🎵</span>
            <span className="text-sm text-[#e0e0e0]">{activeAsset.name}</span>
            <audio
              ref={mediaRef as React.RefObject<HTMLAudioElement>}
              src={srcUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              onError={() => setPreviewError("Missing or unreadable media file")}
            />
          </div>
        )}

        {activeAsset && activeAsset.type === "image" && srcUrl && (
          <img
            src={srcUrl}
            alt={activeAsset.name}
            className="max-w-full max-h-full object-contain"
            style={{ filter: previewFilter }}
            onError={() => setPreviewError("Missing or unreadable media file")}
          />
        )}
      </div>

      {previewError && (
        <div className="shrink-0 px-3 py-1 bg-red-950/40 text-red-300 border-t border-red-800/40">
          {previewError}
        </div>
      )}

      {activeAsset && (isVideo || isAudio) && (
        <div className="shrink-0 px-3 py-2 bg-[#16213e] border-t border-[#2a2a4a] space-y-1.5">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.05}
            value={activeClip ? Math.max(0, currentTime - activeClip.inPoint) : currentTime}
            onChange={handleScrub}
            className="w-full h-1.5 accent-[#e94560] cursor-pointer"
          />

          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-[#e94560] hover:bg-[#c73550] text-white transition-colors text-sm"
            >
              {isPlaying ? "⏸" : "▶"}
            </button>

            <span className="text-[#888] font-mono text-[10px]">
              {formatTime(activeClip ? Math.max(0, currentTime - activeClip.inPoint) : currentTime)} / {formatTime(duration)}
            </span>

            {activeAsset.type === "video" && (
              <span className="text-[10px] text-[#666]">
                {activeAsset.proxyStatus === "ready" ? "Proxy Preview" : "Original Preview"}
              </span>
            )}

            <div className="flex-1" />

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
