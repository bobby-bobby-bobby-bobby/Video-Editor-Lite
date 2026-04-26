import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { save } from "@tauri-apps/api/dialog";
import { invoke } from "@tauri-apps/api/tauri";
import { useEffectsStore } from "./effectsStore";
import { useMediaStore } from "./mediaStore";
import { useTimelineStore } from "./timelineStore";

export type ExportResolution = "1920x1080" | "1280x720" | "854x480";

interface ExportState {
  isExporting: boolean;
  error: string | null;
  resolution: ExportResolution;
  setResolution: (resolution: ExportResolution) => void;
  exportProject: () => Promise<void>;
}

function parseResolution(res: ExportResolution): { width: number; height: number } {
  const [w, h] = res.split("x").map((v) => parseInt(v, 10));
  return { width: w, height: h };
}

export const useExportStore = create<ExportState>()(
  immer((set, get) => ({
    isExporting: false,
    error: null,
    resolution: "1280x720",

    setResolution: (resolution) =>
      set((s) => {
        s.resolution = resolution;
      }),

    exportProject: async () => {
      const { clips } = useTimelineStore.getState();
      const { assets } = useMediaStore.getState();
      const { effects } = useEffectsStore.getState();

      if (clips.length === 0) {
        set((s) => {
          s.error = "No clips to export.";
        });
        return;
      }

      const outputPath = await save({
        title: "Export Video",
        defaultPath: "video-export.mp4",
        filters: [{ name: "MP4 Video", extensions: ["mp4"] }],
      });
      if (!outputPath) return;

      const { width, height } = parseResolution(get().resolution);

      const exportClips = clips
        .slice()
        .sort((a, b) => a.startTime - b.startTime)
        .map((clip) => {
          const asset = assets.find((a) => a.id === clip.assetId);
          if (!asset) {
            throw new Error(`Missing asset for clip: ${clip.id}`);
          }
          const clipEffects = clip.effectIds
            .map((effectId) => effects.find((e) => e.id === effectId))
            .filter(Boolean);

          return {
            assetPath: asset.path,
            inPoint: clip.inPoint,
            outPoint: clip.outPoint,
            trackIndex: clip.trackIndex,
            startTime: clip.startTime,
            effects: clipEffects,
          };
        });

      set((s) => {
        s.isExporting = true;
        s.error = null;
      });

      try {
        await invoke("export_video", {
          params: {
            clips: exportClips,
            outputPath,
            width,
            height,
            fps: 30,
            crf: 20,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        set((s) => {
          s.error = message;
        });
      } finally {
        set((s) => {
          s.isExporting = false;
        });
      }
    },
  }))
);
