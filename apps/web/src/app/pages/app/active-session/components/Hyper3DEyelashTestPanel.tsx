import { useEffect, useState } from "react";
import {
  HYPER3D_EYELASH_TEST_DEFINITIONS,
  getHyper3dEyelashTestIntensity,
  getHyper3dEyelashTestState,
  hyper3dEyelashTestAvailable,
  setHyper3dEyelashTestIntensity,
  setHyper3dEyelashTestState,
  subscribeHyper3dEyelashTest,
  type Hyper3dEyelashTestState,
} from "@/lib/avatar/hyper3d/hyper3dEyelashTest";

/**
 * DEV-ONLY eyelash review controls. See `hyper3dEyelashTest` for the rules.
 *
 * The buttons set a semantic state and nothing else. They never touch
 * `Object_2002`, never touch a morph influence, and never touch the engine —
 * the frame path reads the state and pins the canonical eye channels, so what
 * the reviewer sees is the production mapping doing the work.
 *
 * Renders null unless `?hyper3dEyelashTest=1` in a DEV build, so it costs a
 * boolean in dev and does not exist in a production bundle.
 */
export function Hyper3DEyelashTestPanel() {
  const [state, setState] = useState<Hyper3dEyelashTestState>(getHyper3dEyelashTestState);
  const [intensity, setIntensity] = useState<number>(getHyper3dEyelashTestIntensity);

  useEffect(() => {
    if (!hyper3dEyelashTestAvailable) return;
    return subscribeHyper3dEyelashTest(() => {
      setState(getHyper3dEyelashTestState());
      setIntensity(getHyper3dEyelashTestIntensity());
    });
  }, []);

  if (!hyper3dEyelashTestAvailable) return null;

  const active = HYPER3D_EYELASH_TEST_DEFINITIONS.find((entry) => entry.id === state);

  return (
    <div
      className="pointer-events-auto absolute bottom-4 left-4 z-50 w-72 rounded-lg border border-white/20 bg-black/80 p-3 font-mono text-[11px] leading-snug text-white shadow-xl backdrop-blur"
      data-testid="hyper3d-eyelash-test-panel"
    >
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-semibold tracking-wide">EYELASH TEST</span>
        <span className="text-white/50">DEV</span>
      </div>

      <div className="mb-2 grid grid-cols-2 gap-1">
        {HYPER3D_EYELASH_TEST_DEFINITIONS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setHyper3dEyelashTestState(entry.id)}
            className={
              "rounded px-2 py-1 text-left transition-colors " +
              (entry.id === state ? "bg-emerald-500 text-black" : "bg-white/10 hover:bg-white/20")
            }
          >
            {entry.label}
          </button>
        ))}
      </div>

      <label className="mb-1 flex items-center gap-2">
        <span className="w-14 shrink-0 text-white/70">{intensity.toFixed(2)}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={intensity}
          disabled={!active?.usesIntensity}
          onChange={(event) => setHyper3dEyelashTestIntensity(Number(event.target.value))}
          className="w-full accent-emerald-400 disabled:opacity-30"
          aria-label="Eyelash test intensity"
        />
      </label>
      {/* The three values the brief asks each state to be inspected at. */}
      <div className="mb-2 flex gap-1">
        {[0, 0.5, 1].map((step) => (
          <button
            key={step}
            type="button"
            disabled={!active?.usesIntensity}
            onClick={() => setHyper3dEyelashTestIntensity(step)}
            className="flex-1 rounded bg-white/10 px-1 py-0.5 hover:bg-white/20 disabled:opacity-30"
          >
            {step.toFixed(1)}
          </button>
        ))}
      </div>

      <p className="text-white/60">{active?.question}</p>
    </div>
  );
}
