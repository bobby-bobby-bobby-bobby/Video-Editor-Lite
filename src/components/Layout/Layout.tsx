import React from "react";
import { FileBrowser } from "../FileBrowser/FileBrowser";
import { VideoPreview } from "../VideoPreview/VideoPreview";
import { Timeline } from "../Timeline/Timeline";
import { EffectsPanel } from "../EffectsPanel/EffectsPanel";
import { useKeyboard } from "../../hooks/useKeyboard";
import { useProjectStore } from "../../store/projectStore";
import { useMediaStore } from "../../store/mediaStore";
import { useExportStore } from "../../store/exportStore";

export const Layout: React.FC = () => {
  useKeyboard();

  const projectName = useProjectStore((s) => s.metadata.name);
  const isDirty = useProjectStore((s) => s.isDirty);
  const isSaving = useProjectStore((s) => s.isSaving);
  const saveProject = useProjectStore((s) => s.saveProject);
  const newProject = useProjectStore((s) => s.newProject);
  const loadProject = useProjectStore((s) => s.loadProject);
  const importFolder = useMediaStore((s) => s.importFolder);
  const importFiles = useMediaStore((s) => s.importFiles);
  const exportProject = useExportStore((s) => s.exportProject);
  const isExporting = useExportStore((s) => s.isExporting);
  const exportError = useExportStore((s) => s.error);
  const resolution = useExportStore((s) => s.resolution);
  const setResolution = useExportStore((s) => s.setResolution);

  return (
    <div className="flex flex-col h-screen bg-[#1a1a2e] text-[#e0e0e0] overflow-hidden">
      {/* ── Top Menu Bar ── */}
      <header className="flex items-center gap-3 px-4 py-2 bg-[#0f0f1e] border-b border-[#2a2a4a] text-xs shrink-0 z-10">
        <span className="font-bold text-[#e94560] text-sm">▶ VEL</span>
        <div className="flex gap-1">
          <MenuButton onClick={newProject}>New</MenuButton>
          <MenuButton onClick={() => saveProject()}>Save{isDirty ? " *" : ""}</MenuButton>
          <MenuButton onClick={() => saveProject(true)}>Save As…</MenuButton>
          <MenuButton onClick={() => loadProject()}>Open…</MenuButton>
        </div>
        <div className="w-px h-4 bg-[#2a2a4a]" />
        <div className="flex gap-1">
          <MenuButton onClick={importFolder}>Import Folder</MenuButton>
          <MenuButton onClick={importFiles}>Import Files</MenuButton>
        </div>
        <div className="w-px h-4 bg-[#2a2a4a]" />
        <div className="flex items-center gap-1">
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value as typeof resolution)}
            className="bg-[#1a1a2e] border border-[#2a2a4a] rounded px-1 py-0.5 text-[10px]"
          >
            <option value="1920x1080">1080p</option>
            <option value="1280x720">720p</option>
            <option value="854x480">480p</option>
          </select>
          <MenuButton onClick={exportProject}>{isExporting ? "Exporting…" : "Export"}</MenuButton>
        </div>
        <div className="flex-1" />
        <span className="text-[#888] truncate max-w-[200px]">
          {projectName}
          {isDirty ? " •" : ""}
        </span>
        {isSaving && <span className="text-[#e94560] text-[10px] animate-pulse">Saving…</span>}
      </header>

      {/* ── Main Content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: File Browser */}
        <div className="w-56 shrink-0 border-r border-[#2a2a4a] overflow-hidden flex flex-col">
          <FileBrowser />
        </div>

        {/* Centre: Preview + Timeline */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <VideoPreview />
          </div>

          {/* ── Timeline ── */}
          <div className="h-52 shrink-0 border-t border-[#2a2a4a]">
            <Timeline />
          </div>
        </div>

        {/* Right: Effects Panel */}
        <div className="w-56 shrink-0 border-l border-[#2a2a4a] overflow-hidden">
          <EffectsPanel />
        </div>
      </div>
      {exportError && (
        <div className="px-3 py-1.5 text-[11px] text-red-300 bg-red-950/40 border-t border-red-800/40">
          Export failed: {exportError}
        </div>
      )}
    </div>
  );
};

const MenuButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({
  onClick,
  children,
}) => (
  <button
    onClick={onClick}
    className="px-2 py-1 rounded hover:bg-[#2a2a4a] text-[#e0e0e0] transition-colors"
  >
    {children}
  </button>
);
