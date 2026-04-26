import React from "react";
import { useMediaStore } from "../../store/mediaStore";
import { useTimelineStore } from "../../store/timelineStore";
import { MediaAsset } from "../../types";
import { formatTime, formatBytes } from "../../utils/formatTime";

/** Grid view of imported media assets — double-click adds to timeline */
export const MediaGrid: React.FC = () => {
  const assets = useMediaStore((s) => s.assets);
  const selectedAssetId = useMediaStore((s) => s.selectedAssetId);
  const selectAsset = useMediaStore((s) => s.selectAsset);
  const importFolder = useMediaStore((s) => s.importFolder);
  const importFiles = useMediaStore((s) => s.importFiles);
  const addClipFromAsset = useTimelineStore((s) => s.addClipFromAsset);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");
    // File drops from OS are handled via Tauri drag-drop event (see tauri.conf.json)
    // Here we handle re-ordering from the file browser
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("drag-over");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("drag-over");
  };

  if (assets.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full text-[#555] text-sm gap-3 p-8"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="text-5xl">🎬</div>
        <div className="text-center">
          <p className="mb-1 text-[#888]">No media imported yet</p>
          <p className="text-xs text-[#555]">Drag files here, or use Import</p>
        </div>
        <div className="flex gap-2 mt-2">
          <button
            onClick={importFolder}
            className="px-3 py-1.5 bg-[#0f3460] hover:bg-[#1a4a7a] rounded text-xs text-[#e0e0e0] transition-colors"
          >
            Import Folder
          </button>
          <button
            onClick={importFiles}
            className="px-3 py-1.5 bg-[#e94560] hover:bg-[#c73550] rounded text-xs text-white transition-colors"
          >
            Import Files
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="p-3 grid gap-2"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {assets.map((asset) => (
        <MediaCard
          key={asset.id}
          asset={asset}
          selected={asset.id === selectedAssetId}
          onClick={() => selectAsset(asset.id)}
          onDoubleClick={() => addClipFromAsset(asset, 0)}
        />
      ))}
    </div>
  );
};

const MediaCard: React.FC<{
  asset: MediaAsset;
  selected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}> = ({ asset, selected, onClick, onDoubleClick }) => {
  const typeIcon =
    asset.type === "video" ? "🎬" : asset.type === "audio" ? "🎵" : "🖼️";

  const proxyBadge =
    asset.proxyStatus === "generating" ? (
      <span className="absolute top-1 right-1 bg-yellow-600 text-white text-[9px] px-1 rounded">
        PROXY
      </span>
    ) : asset.proxyStatus === "ready" && asset.type === "video" ? (
      <span className="absolute top-1 right-1 bg-green-700 text-white text-[9px] px-1 rounded">
        ✓ PROXY
      </span>
    ) : null;

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title="Double-click to add to timeline"
      className={`relative flex flex-col rounded-md overflow-hidden cursor-pointer border transition-all ${
        selected
          ? "border-[#e94560] shadow-lg shadow-[#e94560]/20"
          : "border-[#2a2a4a] hover:border-[#3a3a6a]"
      } bg-[#16213e]`}
    >
      {/* Thumbnail area */}
      <div className="flex items-center justify-center h-20 bg-[#0f0f1e] text-3xl">
        {typeIcon}
      </div>
      {proxyBadge}

      {/* Info */}
      <div className="px-2 py-1.5 text-xs">
        <div className="truncate font-medium text-[#e0e0e0]" title={asset.name}>
          {asset.name}
        </div>
        <div className="flex justify-between text-[10px] text-[#666] mt-0.5">
          {asset.duration > 0 ? (
            <span>{formatTime(asset.duration)}</span>
          ) : (
            <span>—</span>
          )}
          <span>{formatBytes(asset.size)}</span>
        </div>
      </div>
    </div>
  );
};
