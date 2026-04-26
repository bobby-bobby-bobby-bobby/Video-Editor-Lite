import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { invoke } from "@tauri-apps/api/tauri";
import { open } from "@tauri-apps/api/dialog";
import { MediaAsset, ScannedFile, VideoMetadata } from "../types";
import { generateId } from "../utils/id";
import { useProjectStore } from "./projectStore";

const VIDEO_EXTENSIONS = ["mp4", "mov", "avi", "mkv", "webm", "m4v", "mts"];
const AUDIO_EXTENSIONS = ["mp3", "wav", "aac", "flac", "ogg", "m4a"];
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff"];

interface MediaState {
  assets: MediaAsset[];
  selectedAssetId: string | null;

  // Actions
  importFolder: () => Promise<void>;
  importFiles: () => Promise<void>;
  addAssetFromFile: (scannedFile: ScannedFile) => Promise<void>;
  setAssets: (assets: MediaAsset[]) => void;
  clearAssets: () => void;
  selectAsset: (id: string | null) => void;
  updateProxyStatus: (id: string, status: MediaAsset["proxyStatus"], proxyPath?: string) => void;
}

function detectMediaType(ext: string): MediaAsset["type"] {
  if (VIDEO_EXTENSIONS.includes(ext)) return "video";
  if (AUDIO_EXTENSIONS.includes(ext)) return "audio";
  return "image";
}

export const useMediaStore = create<MediaState>()(
  immer((set, get) => ({
    assets: [],
    selectedAssetId: null,

    importFolder: async () => {
      const folderPath = await open({
        title: "Import Folder",
        directory: true,
        multiple: false,
      });
      if (!folderPath || Array.isArray(folderPath)) return;

      const scanned: ScannedFile[] = await invoke("scan_folder", { folderPath });
      // Flatten recursive results and filter for supported media
      const flatten = (files: ScannedFile[]): ScannedFile[] =>
        files.flatMap((f) =>
          f.isDirectory && f.children ? flatten(f.children) : [f]
        );

      const mediaFiles = flatten(scanned).filter((f) => {
        const ext = f.extension.toLowerCase();
        return (
          VIDEO_EXTENSIONS.includes(ext) ||
          AUDIO_EXTENSIONS.includes(ext) ||
          IMAGE_EXTENSIONS.includes(ext)
        );
      });

      await Promise.all(mediaFiles.map((file) => get().addAssetFromFile(file)));

      useProjectStore.getState().markDirty();
    },

    importFiles: async () => {
      const chosen = await open({
        title: "Import Media",
        multiple: true,
        filters: [
          {
            name: "Media Files",
            extensions: [...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS, ...IMAGE_EXTENSIONS],
          },
        ],
      });
      if (!chosen) return;
      const files = Array.isArray(chosen) ? chosen : [chosen];

      await Promise.all(files.map(async (path) => {
        const parts = path.replace(/\\/g, "/").split("/");
        const name = parts[parts.length - 1];
        const ext = name.split(".").pop() ?? "";
        await get().addAssetFromFile({ name, path, size: 0, extension: ext, isDirectory: false });
      }));

      useProjectStore.getState().markDirty();
    },

    addAssetFromFile: async (scannedFile: ScannedFile) => {
      // Skip duplicates
      const exists = get().assets.some((a) => a.path === scannedFile.path);
      if (exists) return;

      const ext = scannedFile.extension.toLowerCase();
      const type = detectMediaType(ext);
      let metadata: VideoMetadata = {
        duration: 0, width: 0, height: 0, fps: 0, codec: "", size: scannedFile.size
      };

      if (type === "video" || type === "audio") {
        try {
          metadata = await invoke("get_video_metadata", { filePath: scannedFile.path });
        } catch (e) {
          console.warn("Could not read metadata for", scannedFile.path, e);
        }
      }

      const asset: MediaAsset = {
        id: generateId(),
        name: scannedFile.name,
        path: scannedFile.path,
        proxyPath: null,
        type,
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
        fps: metadata.fps,
        size: metadata.size || scannedFile.size,
        proxyStatus: type === "video" ? "pending" : "ready",
        importedAt: Date.now(),
      };

      set((s) => {
        s.assets.push(asset);
      });

      // Kick off proxy generation for video assets
      if (type === "video") {
        set((s) => {
          const a = s.assets.find((a) => a.id === asset.id);
          if (a) a.proxyStatus = "generating";
        });

        invoke("generate_proxy", {
          assetId: asset.id,
          inputPath: asset.path,
        })
          .then((proxyPath) => {
            get().updateProxyStatus(asset.id, "ready", proxyPath as string);
          })
          .catch(() => {
            get().updateProxyStatus(asset.id, "failed");
          });
      }
    },

    setAssets: (assets) =>
      set((s) => {
        s.assets = assets;
      }),

    clearAssets: () =>
      set((s) => {
        s.assets = [];
        s.selectedAssetId = null;
      }),

    selectAsset: (id) =>
      set((s) => {
        s.selectedAssetId = id;
      }),

    updateProxyStatus: (id, status, proxyPath) => {
      set((s) => {
        const asset = s.assets.find((a) => a.id === id);
        if (asset) {
          asset.proxyStatus = status;
          if (proxyPath) asset.proxyPath = proxyPath;
        }
      });
      useProjectStore.getState().markDirty();
    },
  }))
);
