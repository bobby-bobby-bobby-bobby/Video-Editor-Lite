import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { invoke } from "@tauri-apps/api/tauri";
import { save } from "@tauri-apps/api/dialog";
import { ProjectFile, ProjectMetadata } from "../types";
import { generateId } from "../utils/id";
import { useMediaStore } from "./mediaStore";
import { useTimelineStore } from "./timelineStore";
import { useEffectsStore } from "./effectsStore";

const PROJECT_VERSION = "0.1.0";
const AUTOSAVE_KEY = "vel_last_project_path";

interface ProjectState {
  metadata: ProjectMetadata;
  isDirty: boolean;
  isSaving: boolean;

  // Actions
  newProject: () => void;
  saveProject: (asNew?: boolean) => Promise<void>;
  loadProject: (filePath?: string) => Promise<void>;
  markDirty: () => void;
}

const defaultMetadata = (): ProjectMetadata => ({
  id: generateId(),
  name: "Untitled Project",
  filePath: null,
  createdAt: Date.now(),
  lastSavedAt: 0,
});

export const useProjectStore = create<ProjectState>()(
  immer((set, get) => ({
    metadata: defaultMetadata(),
    isDirty: false,
    isSaving: false,

    newProject: () => {
      set((s) => {
        s.metadata = defaultMetadata();
        s.isDirty = false;
      });
      useMediaStore.getState().clearAssets();
      useTimelineStore.getState().clearTimeline();
      useEffectsStore.getState().clearEffects();
    },

    saveProject: async (asNew = false) => {
      const { metadata } = get();
      let filePath = metadata.filePath;

      if (!filePath || asNew) {
        const chosen = await save({
          title: "Save Project",
          defaultPath: `${metadata.name}.velp`,
          filters: [{ name: "Video Editor Lite Project", extensions: ["velp"] }],
        });
        if (!chosen) return;
        filePath = chosen;
      }

      const projectFile: ProjectFile = {
        version: PROJECT_VERSION,
        metadata: { ...metadata, filePath, lastSavedAt: Date.now() },
        assets: useMediaStore.getState().assets,
        clips: useTimelineStore.getState().clips,
        tracks: useTimelineStore.getState().tracks,
        effects: useEffectsStore.getState().effects,
      };

      set((s) => {
        s.isSaving = true;
      });

      try {
        await invoke("save_project", {
          projectJson: JSON.stringify(projectFile, null, 2),
          filePath,
        });
        // Remember last saved path for autosave recovery
        localStorage.setItem(AUTOSAVE_KEY, filePath);
        set((s) => {
          s.metadata = projectFile.metadata;
          s.isDirty = false;
          s.isSaving = false;
        });
      } catch (err) {
        console.error("Failed to save project:", err);
        set((s) => {
          s.isSaving = false;
        });
      }
    },

    loadProject: async (filePath?: string) => {
      let targetPath = filePath;

      if (!targetPath) {
        // Try recovering from last session
        const lastPath = localStorage.getItem(AUTOSAVE_KEY);
        if (!lastPath) return;
        targetPath = lastPath;
      }

      try {
        const json: string = await invoke("load_project", { filePath: targetPath });
        const projectFile: ProjectFile = JSON.parse(json);

        set((s) => {
          s.metadata = projectFile.metadata;
          s.isDirty = false;
        });

        useMediaStore.getState().setAssets(projectFile.assets ?? []);
        useTimelineStore.getState().setTimeline(projectFile.clips ?? [], projectFile.tracks ?? []);
        useEffectsStore.getState().setEffects(projectFile.effects ?? []);
      } catch (err) {
        console.warn("Could not load project:", err);
      }
    },

    markDirty: () =>
      set((s) => {
        s.isDirty = true;
      }),
  }))
);
