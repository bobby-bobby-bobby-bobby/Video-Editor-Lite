import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { Effect, EffectDefinition, EffectType } from "../types";
import { generateId } from "../utils/id";
import { useTimelineStore } from "./timelineStore";
import { useProjectStore } from "./projectStore";

/** Catalogue of all supported effects with their parameter definitions */
export const EFFECT_DEFINITIONS: EffectDefinition[] = [
  {
    type: "brightness",
    label: "Brightness",
    params: [{ key: "value", label: "Value", min: -1, max: 1, step: 0.01, default: 0 }],
  },
  {
    type: "contrast",
    label: "Contrast",
    params: [{ key: "value", label: "Value", min: -1, max: 1, step: 0.01, default: 0 }],
  },
  {
    type: "saturation",
    label: "Saturation",
    params: [{ key: "value", label: "Value", min: -1, max: 1, step: 0.01, default: 0 }],
  },
  {
    type: "blur",
    label: "Blur",
    params: [{ key: "radius", label: "Radius", min: 0, max: 50, step: 0.5, default: 0 }],
  },
  {
    type: "speed",
    label: "Speed",
    params: [{ key: "multiplier", label: "Multiplier", min: 0.1, max: 4, step: 0.1, default: 1 }],
  },
  {
    type: "grayscale",
    label: "Grayscale",
    params: [{ key: "amount", label: "Amount", min: 0, max: 1, step: 0.01, default: 0 }],
  },
  {
    type: "opacity",
    label: "Opacity",
    params: [{ key: "value", label: "Value", min: 0, max: 1, step: 0.01, default: 1 }],
  },
];

interface EffectsState {
  effects: Effect[];

  // Actions
  addEffect: (clipId: string, type: EffectType) => void;
  removeEffect: (clipId: string, effectId: string) => void;
  toggleEffect: (effectId: string) => void;
  updateEffectParam: (effectId: string, key: string, value: number) => void;
  reorderEffect: (clipId: string, effectId: string, direction: "up" | "down") => void;
  getClipEffects: (clipId: string) => Effect[];
  setEffects: (effects: Effect[]) => void;
  clearEffects: () => void;
}

export const useEffectsStore = create<EffectsState>()(
  immer((set, get) => ({
    effects: [],

    addEffect: (clipId, type) => {
      const definition = EFFECT_DEFINITIONS.find((d) => d.type === type);
      if (!definition) return;

      const defaultParams: Record<string, number> = {};
      definition.params.forEach((p) => {
        defaultParams[p.key] = p.default;
      });

      const effect: Effect = {
        id: generateId(),
        type,
        enabled: true,
        params: defaultParams,
      };

      set((s) => {
        s.effects.push(effect);
      });

      // Register effect ID on the clip
      const { clips } = useTimelineStore.getState();
      const clip = clips.find((c) => c.id === clipId);
      if (clip) {
        useTimelineStore.setState((s: any) => {
          const c = s.clips.find((cl: any) => cl.id === clipId);
          if (c) c.effectIds.push(effect.id);
        });
      }

      useProjectStore.getState().markDirty();
    },

    removeEffect: (clipId, effectId) => {
      set((s) => {
        s.effects = s.effects.filter((e) => e.id !== effectId);
      });

      useTimelineStore.setState((s: any) => {
        const clip = s.clips.find((c: any) => c.id === clipId);
        if (clip) clip.effectIds = clip.effectIds.filter((id: string) => id !== effectId);
      });

      useProjectStore.getState().markDirty();
    },

    toggleEffect: (effectId) => {
      set((s) => {
        const effect = s.effects.find((e) => e.id === effectId);
        if (effect) effect.enabled = !effect.enabled;
      });
      useProjectStore.getState().markDirty();
    },

    updateEffectParam: (effectId, key, value) => {
      set((s) => {
        const effect = s.effects.find((e) => e.id === effectId);
        if (effect) effect.params[key] = value;
      });
      useProjectStore.getState().markDirty();
    },

    reorderEffect: (clipId, effectId, direction) => {
      const clip = useTimelineStore.getState().clips.find((c) => c.id === clipId);
      if (!clip) return;

      const ids = [...clip.effectIds];
      const idx = ids.indexOf(effectId);
      if (idx === -1) return;

      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= ids.length) return;

      [ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]];

      useTimelineStore.setState((s: any) => {
        const c = s.clips.find((cl: any) => cl.id === clipId);
        if (c) c.effectIds = ids;
      });
      useProjectStore.getState().markDirty();
    },

    getClipEffects: (clipId) => {
      const clip = useTimelineStore.getState().clips.find((c) => c.id === clipId);
      if (!clip) return [];
      const { effects } = get();
      return clip.effectIds
        .map((id) => effects.find((e) => e.id === id))
        .filter(Boolean) as Effect[];
    },

    setEffects: (effects) =>
      set((s) => {
        s.effects = effects;
      }),

    clearEffects: () =>
      set((s) => {
        s.effects = [];
      }),
  }))
);
