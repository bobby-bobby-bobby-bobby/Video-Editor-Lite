import React, { useRef, useCallback } from "react";
import { MIN_CLIP_DURATION, useTimelineStore } from "../../store/timelineStore";
import { useMediaStore } from "../../store/mediaStore";
import { TimelineClip as TClip } from "../../types";
import { formatTime } from "../../utils/formatTime";

const RULER_STEP_SECONDS = 5;

export const Timeline: React.FC = () => {
  const clips = useTimelineStore((s) => s.clips);
  const tracks = useTimelineStore((s) => s.tracks);
  const playhead = useTimelineStore((s) => s.playhead);
  const duration = useTimelineStore((s) => s.duration);
  const pixelsPerSecond = useTimelineStore((s) => s.pixelsPerSecond);
  const selectedClipId = useTimelineStore((s) => s.selectedClipId);
  const selectClip = useTimelineStore((s) => s.selectClip);
  const setPlayhead = useTimelineStore((s) => s.setPlayhead);
  const removeClip = useTimelineStore((s) => s.removeClip);
  const moveClip = useTimelineStore((s) => s.moveClip);
  const setZoom = useTimelineStore((s) => s.setZoom);
  const trimClip = useTimelineStore((s) => s.trimClip);
  const trimClipStart = useTimelineStore((s) => s.trimClipStart);
  const arrangeSequentially = useTimelineStore((s) => s.arrangeSequentially);
  const assets = useMediaStore((s) => s.assets);
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalWidth = Math.max(duration * pixelsPerSecond + 200, 1000);

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
    setPlayhead(x / pixelsPerSecond);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(pixelsPerSecond - e.deltaY * 0.3);
    }
  };

  const rulerMarks: number[] = [];
  const totalSecs = Math.ceil(duration + 30);
  for (let t = 0; t <= totalSecs; t += RULER_STEP_SECONDS) {
    rulerMarks.push(t);
  }

  return (
    <div className="flex h-full bg-[#0f0f1e] text-xs overflow-hidden" onWheel={handleWheel}>
      <div className="w-28 shrink-0 flex flex-col border-r border-[#2a2a4a]">
        <div className="h-6 border-b border-[#2a2a4a] flex items-center px-2 text-[10px] text-[#555] gap-1">
          <span>⌛ {formatTime(playhead)}</span>
          <button
            className="ml-auto px-1 py-0.5 rounded bg-[#1a1a2e] hover:bg-[#2a2a4a] text-[9px]"
            onClick={() => arrangeSequentially()}
            title="Pack clips in each track sequentially"
          >
            Pack
          </button>
        </div>
        {tracks.map((track) => (
          <div
            key={track.id}
            className="border-b border-[#2a2a4a] flex items-center px-2 text-[#888] shrink-0"
            style={{ height: track.height }}
          >
            <span className={`w-3 h-3 rounded-full mr-1.5 ${track.type === "video" ? "bg-blue-600" : "bg-purple-600"}`} />
            <span className="truncate text-[10px]">{track.label}</span>
          </div>
        ))}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden relative">
        <div style={{ width: totalWidth, position: "relative" }}>
          <div
            className="h-6 border-b border-[#2a2a4a] relative cursor-pointer bg-[#16213e] sticky top-0 z-10"
            onClick={handleRulerClick}
          >
            {rulerMarks.map((t) => (
              <div
                key={t}
                className="absolute top-0 flex flex-col items-center"
                style={{ left: t * pixelsPerSecond }}
              >
                <div className="w-px h-3 bg-[#2a2a4a]" />
                <span className="text-[9px] text-[#555] mt-0.5 select-none">{formatTime(t)}</span>
              </div>
            ))}
            <div
              className="absolute top-0 w-px h-full bg-[#e94560] z-20 pointer-events-none"
              style={{ left: playhead * pixelsPerSecond }}
            />
          </div>

          {tracks.map((track, trackIdx) => {
            const trackClips = clips.filter((c) => c.trackIndex === trackIdx);
            return (
              <div
                key={track.id}
                className="relative border-b border-[#2a2a4a]"
                style={{ height: track.height }}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest(".clip-block")) return;
                  selectClip(null);
                }}
              >
                {trackClips.map((clip) => {
                  const asset = assets.find((a) => a.id === clip.assetId);
                  return (
                    <ClipBlock
                      key={clip.id}
                      clip={clip}
                      assetName={asset?.name ?? "Unknown"}
                      assetType={asset?.type ?? "video"}
                      pixelsPerSecond={pixelsPerSecond}
                      selected={clip.id === selectedClipId}
                      onSelect={() => selectClip(clip.id)}
                      onDelete={() => removeClip(clip.id)}
                      onMove={moveClip}
                      onTrim={trimClip}
                      onTrimStart={trimClipStart}
                      trackHeight={track.height}
                      assetDuration={asset?.duration ?? 0}
                    />
                  );
                })}
                <div
                  className="absolute top-0 w-px h-full bg-[#e94560]/60 pointer-events-none z-10"
                  style={{ left: playhead * pixelsPerSecond }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const ClipBlock: React.FC<{
  clip: TClip;
  assetName: string;
  assetType: string;
  pixelsPerSecond: number;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onMove: (clipId: string, newStart: number) => void;
  onTrim: (clipId: string, inPoint: number, outPoint: number) => void;
  onTrimStart: (clipId: string, inPoint: number, startTime: number) => void;
  trackHeight: number;
  assetDuration: number;
}> = ({
  clip,
  assetName,
  assetType,
  pixelsPerSecond,
  selected,
  onSelect,
  onDelete,
  onMove,
  onTrim,
  onTrimStart,
  trackHeight,
  assetDuration,
}) => {
  const left = clip.startTime * pixelsPerSecond;
  const width = Math.max((clip.endTime - clip.startTime) * pixelsPerSecond, 20);
  const dragStartRef = useRef<{ mouseX: number; startTime: number } | null>(null);

  const colorClass =
    assetType === "audio"
      ? "bg-purple-800 border-purple-500"
      : "bg-blue-900 border-blue-500";

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
    dragStartRef.current = { mouseX: e.clientX, startTime: clip.startTime };

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragStartRef.current) return;
      const delta = (ev.clientX - dragStartRef.current.mouseX) / pixelsPerSecond;
      onMove(clip.id, dragStartRef.current.startTime + delta);
    };

    const onMouseUp = () => {
      dragStartRef.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [clip.id, clip.startTime, pixelsPerSecond, onSelect, onMove]);

  const handleTrimLeft = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
    const startMouseX = e.clientX;
    const startIn = clip.inPoint;
    const startOut = clip.outPoint;
    const startTime = clip.startTime;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = (ev.clientX - startMouseX) / pixelsPerSecond;
      const minDelta = -startTime;
      const maxDelta = startOut - startIn - MIN_CLIP_DURATION;
      const safeDelta = Math.max(minDelta, Math.min(delta, maxDelta));
      onTrimStart(clip.id, startIn + safeDelta, startTime + safeDelta);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [clip.id, clip.inPoint, clip.outPoint, clip.startTime, pixelsPerSecond, onSelect, onTrimStart]);

  const handleTrimRight = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
    const startMouseX = e.clientX;
    const startOut = clip.outPoint;
    const minOut = clip.inPoint + MIN_CLIP_DURATION;
    const maxOut = assetDuration > 0 ? assetDuration : Number.POSITIVE_INFINITY;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = (ev.clientX - startMouseX) / pixelsPerSecond;
      const nextOut = Math.max(minOut, Math.min(startOut + delta, maxOut));
      onTrim(clip.id, clip.inPoint, nextOut);
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [assetDuration, clip.id, clip.inPoint, clip.outPoint, onSelect, onTrim, pixelsPerSecond]);

  return (
    <div
      className={`clip-block absolute top-0.5 rounded border overflow-hidden cursor-grab active:cursor-grabbing select-none flex items-center px-2 text-[10px] text-white transition-opacity ${colorClass} ${
        selected ? "ring-1 ring-[#e94560] opacity-100" : "opacity-80 hover:opacity-100"
      }`}
      style={{ left, width, height: trackHeight - 4 }}
      onMouseDown={handleMouseDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDelete();
      }}
      title={`${assetName} — double-click to remove`}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 bg-white/20 hover:bg-white/40 cursor-ew-resize"
        onMouseDown={handleTrimLeft}
        title="Trim start"
      />
      <span className="truncate pointer-events-none">{assetName}</span>
      <span className="ml-auto text-[9px] opacity-60 pointer-events-none">
        {formatTime(clip.endTime - clip.startTime)}
      </span>
      <div
        className="absolute right-0 top-0 bottom-0 w-1.5 bg-white/20 hover:bg-white/40 cursor-ew-resize"
        onMouseDown={handleTrimRight}
        title="Trim end"
      />
    </div>
  );
};
