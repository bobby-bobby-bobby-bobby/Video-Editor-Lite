import React, { useState } from "react";
import { FileBrowser } from "../FileBrowser/FileBrowser";
import { MediaGrid } from "../MediaGrid/MediaGrid";
import { VideoPreview } from "../VideoPreview/VideoPreview";
import { Timeline } from "../Timeline/Timeline";
import { EffectsPanel } from "../EffectsPanel/EffectsPanel";
import { useKeyboard } from "../../hooks/useKeyboard";
import { useProjectStore } from "../../store/projectStore";
import { useMediaStore } from "../../store/mediaStore";

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

  const [showMediaGrid, setShowMediaGrid] = useState(true);

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

        {/* Centre: Media Grid + Preview */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Toggle bar */}
          <div className="flex text-xs border-b border-[#2a2a4a] bg-[#16213e] shrink-0">
            <TabButton active={showMediaGrid} onClick={() => setShowMediaGrid(true)}>
              Media
            </TabButton>
            <TabButton active={!showMediaGrid} onClick={() => setShowMediaGrid(false)}>
              Preview
            </TabButton>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {showMediaGrid ? (
              <div className="flex-1 overflow-auto">
                <MediaGrid />
              </div>
            ) : (
              <div className="flex-1 overflow-hidden">
                <VideoPreview />
              </div>
            )}

            {/* Always-visible preview alongside media grid on wide screens */}
            <div className="hidden xl:block w-80 shrink-0 border-l border-[#2a2a4a]">
              <VideoPreview />
            </div>
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

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-4 py-1.5 transition-colors border-b-2 ${
      active
        ? "border-[#e94560] text-[#e0e0e0]"
        : "border-transparent text-[#888] hover:text-[#e0e0e0]"
    }`}
  >
    {children}
  </button>
);
