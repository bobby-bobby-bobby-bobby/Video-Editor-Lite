// ─── Media ───────────────────────────────────────────────────────────────────

export type MediaType = "video" | "audio" | "image";

export type ProxyStatus = "pending" | "generating" | "ready" | "failed";

/** A media asset imported into the project */
export interface MediaAsset {
  id: string;
  name: string;
  /** Absolute path to the original file */
  path: string;
  /** Absolute path to the lower-resolution proxy file, or null */
  proxyPath: string | null;
  type: MediaType;
  /** Duration in seconds (0 for images) */
  duration: number;
  width: number;
  height: number;
  /** Frames per second */
  fps: number;
  /** Size in bytes */
  size: number;
  proxyStatus: ProxyStatus;
  /** Unix timestamp (ms) when the asset was imported */
  importedAt: number;
}

// ─── Timeline ────────────────────────────────────────────────────────────────

/** A single clip placed on the timeline */
export interface TimelineClip {
  id: string;
  /** Reference to the MediaAsset id */
  assetId: string;
  /** Zero-based track index */
  trackIndex: number;
  /** Start position on the timeline in seconds */
  startTime: number;
  /** End position on the timeline in seconds (startTime + trimmed duration) */
  endTime: number;
  /** In-point within the source asset (trim start, seconds) */
  inPoint: number;
  /** Out-point within the source asset (trim end, seconds) */
  outPoint: number;
  /** List of Effect IDs applied to this clip (ordered, bottom → top) */
  effectIds: string[];
}

/** Represents a horizontal track lane on the timeline */
export interface TimelineTrack {
  id: string;
  label: string;
  type: "video" | "audio";
  muted: boolean;
  locked: boolean;
  height: number;
}

// ─── Effects ─────────────────────────────────────────────────────────────────

export type EffectType =
  | "brightness"
  | "contrast"
  | "saturation"
  | "blur"
  | "speed"
  | "greenscreen"
  | "grayscale"
  | "opacity";

export interface EffectParam {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

/** Metadata describing a supported effect type */
export interface EffectDefinition {
  type: EffectType;
  label: string;
  params: EffectParam[];
}

/** An instance of an effect applied to a clip */
export interface Effect {
  id: string;
  type: EffectType;
  enabled: boolean;
  /** Parameter values keyed by EffectParam.key */
  params: Record<string, number>;
}

// ─── Project ─────────────────────────────────────────────────────────────────

export interface ProjectMetadata {
  id: string;
  name: string;
  /** Absolute path to the .velp project file on disk */
  filePath: string | null;
  /** Unix timestamp (ms) of project creation */
  createdAt: number;
  /** Unix timestamp (ms) of last save */
  lastSavedAt: number;
}

/** Full serialisable project state written to disk */
export interface ProjectFile {
  version: string;
  metadata: ProjectMetadata;
  assets: MediaAsset[];
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  effects: Effect[];
}

// ─── File-system helpers ─────────────────────────────────────────────────────

/** Raw file info returned by the Rust scan command */
export interface ScannedFile {
  name: string;
  path: string;
  size: number;
  extension: string;
  isDirectory: boolean;
  children?: ScannedFile[];
}

/** Video metadata returned by the Rust get_video_metadata command */
export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  size: number;
}
