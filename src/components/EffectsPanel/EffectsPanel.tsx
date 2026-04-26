import React from "react";
import { useTimelineStore } from "../../store/timelineStore";
import { useEffectsStore, EFFECT_DEFINITIONS } from "../../store/effectsStore";
import { Effect, EffectType } from "../../types";

/** Right-side panel: shows effects stack for the selected timeline clip */
export const EffectsPanel: React.FC = () => {
  const selectedClipId = useTimelineStore((s) => s.selectedClipId);
  const getClipEffects = useEffectsStore((s) => s.getClipEffects);
  const addEffect = useEffectsStore((s) => s.addEffect);
  const removeEffect = useEffectsStore((s) => s.removeEffect);
  const toggleEffect = useEffectsStore((s) => s.toggleEffect);
  const updateEffectParam = useEffectsStore((s) => s.updateEffectParam);
  const reorderEffect = useEffectsStore((s) => s.reorderEffect);

  const effects = selectedClipId ? getClipEffects(selectedClipId) : [];

  const handleAddEffect = (type: EffectType) => {
    if (!selectedClipId) return;
    addEffect(selectedClipId, type);
  };

  return (
    <div className="flex flex-col h-full text-xs bg-[#16213e]">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#2a2a4a] shrink-0">
        <span className="font-semibold text-[#e0e0e0] uppercase tracking-wider text-[10px]">
          Effects
        </span>
        {selectedClipId && (
          <span className="ml-1 text-[#555]">({effects.length})</span>
        )}
      </div>

      {!selectedClipId ? (
        <div className="flex-1 flex items-center justify-center text-[#555] px-4 text-center">
          Select a clip on the timeline to add effects
        </div>
      ) : (
        <>
          {/* Add effect dropdown */}
          <div className="px-2 py-1.5 border-b border-[#2a2a4a] shrink-0">
            <select
              className="w-full bg-[#0f0f1e] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-[#e0e0e0] focus:outline-none focus:border-[#e94560]"
              value=""
              onChange={(e) => handleAddEffect(e.target.value as EffectType)}
            >
              <option value="" disabled>
                + Add effect…
              </option>
              {EFFECT_DEFINITIONS.map((def) => (
                <option key={def.type} value={def.type}>
                  {def.label}
                </option>
              ))}
            </select>
          </div>

          {/* Effects stack */}
          <div className="flex-1 overflow-y-auto">
            {effects.length === 0 && (
              <div className="px-3 py-6 text-center text-[#555]">
                No effects applied
              </div>
            )}
            {effects.map((effect, idx) => (
              <EffectRow
                key={effect.id}
                effect={effect}
                index={idx}
                total={effects.length}
                clipId={selectedClipId}
                onToggle={() => toggleEffect(effect.id)}
                onRemove={() => removeEffect(selectedClipId, effect.id)}
                onParamChange={(key, val) => updateEffectParam(effect.id, key, val)}
                onMoveUp={() => reorderEffect(selectedClipId, effect.id, "up")}
                onMoveDown={() => reorderEffect(selectedClipId, effect.id, "down")}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const EffectRow: React.FC<{
  effect: Effect;
  index: number;
  total: number;
  clipId: string;
  onToggle: () => void;
  onRemove: () => void;
  onParamChange: (key: string, value: number) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}> = ({ effect, index, total, onToggle, onRemove, onParamChange, onMoveUp, onMoveDown }) => {
  const definition = EFFECT_DEFINITIONS.find((d) => d.type === effect.type);
  if (!definition) return null;

  return (
    <div
      className={`border-b border-[#2a2a4a] ${
        effect.enabled ? "opacity-100" : "opacity-40"
      }`}
    >
      {/* Effect header */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#0f3460]/30">
        {/* Enable/disable toggle */}
        <button
          onClick={onToggle}
          className={`w-3.5 h-3.5 rounded-sm border transition-colors ${
            effect.enabled ? "bg-[#e94560] border-[#e94560]" : "bg-transparent border-[#555]"
          }`}
          title={effect.enabled ? "Disable" : "Enable"}
        />
        <span className="flex-1 font-medium text-[#e0e0e0]">{definition.label}</span>
        {/* Reorder */}
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          className="text-[#555] hover:text-[#e0e0e0] disabled:opacity-30 px-0.5"
          title="Move up"
        >
          ▲
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="text-[#555] hover:text-[#e0e0e0] disabled:opacity-30 px-0.5"
          title="Move down"
        >
          ▼
        </button>
        <button
          onClick={onRemove}
          className="text-[#555] hover:text-[#e94560] transition-colors px-0.5"
          title="Remove effect"
        >
          ✕
        </button>
      </div>

      {/* Parameters */}
      {effect.enabled &&
        definition.params.map((param) => (
          <div key={param.key} className="px-3 py-1.5 flex items-center gap-2">
            <label className="text-[#888] w-16 shrink-0 truncate">{param.label}</label>
            <input
              type="range"
              min={param.min}
              max={param.max}
              step={param.step}
              value={effect.params[param.key] ?? param.default}
              onChange={(e) => onParamChange(param.key, parseFloat(e.target.value))}
              className="flex-1 h-1 accent-[#e94560] cursor-pointer"
            />
            <span className="text-[#666] w-8 text-right text-[10px]">
              {(effect.params[param.key] ?? param.default).toFixed(2)}
            </span>
          </div>
        ))}
    </div>
  );
};
