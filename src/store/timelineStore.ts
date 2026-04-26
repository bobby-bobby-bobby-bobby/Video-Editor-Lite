import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { TimelineClip, TimelineTrack, MediaAsset } from "../types";
import { generateId } from "../utils/id";
import { useProjectStore } from "./projectStore";

const DEFAULT_TRACKS: TimelineTrack[] = [
  { id: "track-v1", label: "Video 1", type: "video", muted: false, locked: false, height: 60 },
  { id: "track-v2", label: "Video 2", type: "video", muted: false, locked: false, height: 60 },
  { id: "track-a1", label: "Audio 1", type: "audio", muted: false, locked: false, height: 40 },
];

interface TimelineState {
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  selectedClipId: string | null;
  /** Playhead position in seconds */
  playhead: number;
  /** Total computed duration of the timeline */
  duration: number;
  /** Pixels per second for timeline zoom */
  pixelsPerSecond: number;

  // Actions
  addClipFromAsset: (asset: MediaAsset, trackIndex?: number) => void;
  removeClip: (clipId: string) => void;
  moveClip: (clipId: string, newStartTime: number, newTrackIndex?: number) => void;
  trimClip: (clipId: string, inPoint: number, outPoint: number) => void;
  selectClip: (id: string | null) => void;
  setPlayhead: (time: number) => void;
  setZoom: (pps: number) => void;
  setTimeline: (clips: TimelineClip[], tracks: TimelineTrack[]) => void;
  clearTimeline: () => void;
  computeDuration: () => void;
}

export const useTimelineStore = create<TimelineState>()(
  immer((set, get) => ({
    clips: [],
    tracks: DEFAULT_TRACKS,
    selectedClipId: null,
    playhead: 0,
    duration: 0,
    pixelsPerSecond: 50,

    addClipFromAsset: (asset, trackIndex = 0) => {
      const { clips } = get();

      // Find the end of the last clip on the target track
      const trackClips = clips.filter((c) => c.trackIndex === trackIndex);
      const startTime =
        trackClips.length > 0 ? Math.max(...trackClips.map((c) => c.endTime)) : 0;

      const duration = asset.duration > 0 ? asset.duration : 5; // 5s default for images
      const clip: TimelineClip = {
        id: generateId(),
        assetId: asset.id,
        trackIndex,
        startTime,
        endTime: startTime + duration,
        inPoint: 0,
        outPoint: duration,
        effectIds: [],
      };

      set((s) => {
        s.clips.push(clip);
      });
      get().computeDuration();
      useProjectStore.getState().markDirty();
    },

    removeClip: (clipId) => {
      set((s) => {
        s.clips = s.clips.filter((c) => c.id !== clipId);
        if (s.selectedClipId === clipId) s.selectedClipId = null;
      });
      get().computeDuration();
      useProjectStore.getState().markDirty();
    },

    moveClip: (clipId, newStartTime, newTrackIndex) => {
      set((s) => {
        const clip = s.clips.find((c) => c.id === clipId);
        if (!clip) return;
        const dur = clip.endTime - clip.startTime;
        clip.startTime = Math.max(0, newStartTime);
        clip.endTime = clip.startTime + dur;
        if (newTrackIndex !== undefined) clip.trackIndex = newTrackIndex;
      });
      get().computeDuration();
      useProjectStore.getState().markDirty();
    },

    trimClip: (clipId, inPoint, outPoint) => {
      set((s) => {
        const clip = s.clips.find((c) => c.id === clipId);
        if (!clip) return;
        clip.inPoint = inPoint;
        clip.outPoint = outPoint;
        clip.endTime = clip.startTime + (outPoint - inPoint);
      });
      get().computeDuration();
      useProjectStore.getState().markDirty();
    },

    selectClip: (id) =>
      set((s) => {
        s.selectedClipId = id;
      }),

    setPlayhead: (time) =>
      set((s) => {
        s.playhead = Math.max(0, Math.min(time, s.duration));
      }),

    setZoom: (pps) =>
      set((s) => {
        s.pixelsPerSecond = Math.max(10, Math.min(200, pps));
      }),

    setTimeline: (clips, tracks) =>
      set((s) => {
        s.clips = clips;
        s.tracks = tracks.length ? tracks : DEFAULT_TRACKS;
      }),

    clearTimeline: () =>
      set((s) => {
        s.clips = [];
        s.tracks = DEFAULT_TRACKS;
        s.selectedClipId = null;
        s.playhead = 0;
        s.duration = 0;
      }),

    computeDuration: () => {
      const { clips } = get();
      const maxEnd = clips.length > 0 ? Math.max(...clips.map((c) => c.endTime)) : 0;
      set((s) => {
        s.duration = maxEnd;
      });
    },
  }))
);
