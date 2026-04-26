import React, { useState } from "react";
import { useMediaStore } from "../../store/mediaStore";
import { MediaAsset } from "../../types";
import { formatBytes, formatTime } from "../../utils/formatTime";

/** Left-sidebar file browser showing imported assets in a tree/list */
export const FileBrowser: React.FC = () => {
  const assets = useMediaStore((s) => s.assets);
  const selectedAssetId = useMediaStore((s) => s.selectedAssetId);
  const selectAsset = useMediaStore((s) => s.selectAsset);
  const importFolder = useMediaStore((s) => s.importFolder);
  const importFiles = useMediaStore((s) => s.importFiles);

  const [filter, setFilter] = useState("");

  const filtered = assets.filter((a) =>
    a.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full text-xs bg-[#16213e]">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#2a2a4a] flex items-center justify-between shrink-0">
        <span className="font-semibold text-[#e0e0e0] uppercase tracking-wider text-[10px]">
          Media
        </span>
        <div className="flex gap-1">
          <ActionIcon title="Import Folder" onClick={importFolder}>
            📂
          </ActionIcon>
          <ActionIcon title="Import Files" onClick={importFiles}>
            ➕
          </ActionIcon>
        </div>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 shrink-0">
        <input
          type="text"
          placeholder="Filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full bg-[#0f0f1e] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-[#e0e0e0] placeholder-[#555] focus:outline-none focus:border-[#e94560]"
        />
      </div>

      {/* Asset list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="px-3 py-8 text-center text-[#555]">
            <div className="text-2xl mb-2">🎬</div>
            <div>Import media to start</div>
          </div>
        )}
        {filtered.map((asset) => (
          <AssetRow
            key={asset.id}
            asset={asset}
            selected={asset.id === selectedAssetId}
            onSelect={() => selectAsset(asset.id)}
          />
        ))}
      </div>

      {/* Status bar */}
      <div className="px-3 py-1 border-t border-[#2a2a4a] text-[10px] text-[#555] shrink-0">
        {assets.length} item{assets.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
};

const AssetRow: React.FC<{
  asset: MediaAsset;
  selected: boolean;
  onSelect: () => void;
}> = ({ asset, selected, onSelect }) => {
  const typeIcon =
    asset.type === "video" ? "🎬" : asset.type === "audio" ? "🎵" : "🖼️";

  const proxyIndicator =
    asset.proxyStatus === "generating"
      ? "⏳"
      : asset.proxyStatus === "ready" && asset.type === "video"
      ? "✅"
      : asset.proxyStatus === "failed"
      ? "⚠️"
      : "";

  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors border-b border-[#1a1a2e] ${
        selected ? "bg-[#e94560]/20 text-[#e0e0e0]" : "hover:bg-[#0f3460]/40 text-[#ccc]"
      }`}
    >
      <span className="shrink-0">{typeIcon}</span>
      <div className="flex-1 overflow-hidden">
        <div className="truncate font-medium">{asset.name}</div>
        <div className="text-[10px] text-[#666] flex gap-2">
          {asset.duration > 0 && <span>{formatTime(asset.duration)}</span>}
          <span>{formatBytes(asset.size)}</span>
        </div>
      </div>
      {proxyIndicator && <span className="text-[10px] shrink-0">{proxyIndicator}</span>}
    </div>
  );
};

const ActionIcon: React.FC<{
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ title, onClick, children }) => (
  <button
    title={title}
    onClick={onClick}
    className="p-0.5 rounded hover:bg-[#2a2a4a] transition-colors"
  >
    {children}
  </button>
);
