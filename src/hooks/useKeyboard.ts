import { useEffect } from "react";
import { useProjectStore } from "../store/projectStore";
import { useTimelineStore } from "../store/timelineStore";

/** Global keyboard shortcuts */
export function useKeyboard() {
  const saveProject = useProjectStore((s) => s.saveProject);
  const removeClip = useTimelineStore((s) => s.removeClip);
  const selectedClipId = useTimelineStore((s) => s.selectedClipId);
  const setPlayhead = useTimelineStore((s) => s.setPlayhead);
  const playhead = useTimelineStore((s) => s.playhead);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      // Cmd/Ctrl + S → save
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveProject();
      }

      // Delete / Backspace → remove selected clip
      if ((e.key === "Delete" || e.key === "Backspace") && selectedClipId) {
        e.preventDefault();
        removeClip(selectedClipId);
      }

      // Space → play/pause (placeholder — actual playback handled in VideoPreview)
      if (e.key === " ") {
        e.preventDefault();
      }

      // Left/Right → nudge playhead by 1 second
      if (e.key === "ArrowLeft") {
        setPlayhead(playhead - 1);
      }
      if (e.key === "ArrowRight") {
        setPlayhead(playhead + 1);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveProject, removeClip, selectedClipId, setPlayhead, playhead]);
}
