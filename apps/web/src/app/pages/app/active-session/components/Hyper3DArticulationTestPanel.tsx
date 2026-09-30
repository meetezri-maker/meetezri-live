import { useEffect, useMemo, useState } from "react";
import {
  HYPER3D_ARTICULATION_TARGETS,
  HYPER3D_DELIVERY_MS,
  getHyper3dArticulationDelivered,
  getHyper3dArticulationTestDelivery,
  getHyper3dArticulationTestGlide,
  getHyper3dArticulationTestIntensity,
  getHyper3dArticulationTestMode,
  getHyper3dArticulationTestState,
  hyper3dArticulationChannelFacts,
  hyper3dArticulationHasGlide,
  hyper3dArticulationReadout,
  hyper3dArticulationTarget,
  hyper3dArticulationTestAvailable,
  setHyper3dArticulationTestDelivery,
  setHyper3dArticulationTestGlide,
  setHyper3dArticulationTestIntensity,
  setHyper3dArticulationTestMode,
  setHyper3dArticulationTestState,
  subscribeHyper3dArticulationTest,
  type Hyper3dArticulationDelivery,
  type Hyper3dArticulationGlide,
  type Hyper3dArticulationMode,
} from "@/lib/avatar/hyper3d/hyper3dArticulationTest";

/**
 * DEV-ONLY articulation review controls. See `hyper3dArticulationTest` for the rules.
 *
 * The buttons select a phoneme and nothing else. They never touch a morph
 * target, never touch the engine and never touch timing — the frame path reads
 * the state and pins the canonical lower-face channels, so what the reviewer
 * sees is the production phoneme table and the production calibration doing the
 * work with the envelope, the smoother and coarticulation taken out of the way.
 *
 * The table underneath is not a second calculation: it is the SAME object the
 * frame path writes, printed. `mm` is that influence against the channel's own
 * measured travel on `female_2291.glb`, and a channel below its measured
 * `usefulMin` is marked — that is the number that decides whether a shape exists
 * on screen at all.
 *
 * Renders null unless `?hyper3dArticulationTest=1` in a DEV build, so it costs a
 * boolean in dev and does not exist in a production bundle.
 */
export function Hyper3DArticulationTestPanel() {
  const [state, setState] = useState<string>(getHyper3dArticulationTestState);
  const [mode, setMode] = useState<Hyper3dArticulationMode>(getHyper3dArticulationTestMode);
  const [glide, setGlide] = useState<Hyper3dArticulationGlide>(getHyper3dArticulationTestGlide);
  const [delivery, setDelivery] = useState<Hyper3dArticulationDelivery>(getHyper3dArticulationTestDelivery);
  const [intensity, setIntensity] = useState<number>(getHyper3dArticulationTestIntensity);
  const [delivered, setDelivered] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!hyper3dArticulationTestAvailable) return;
    return subscribeHyper3dArticulationTest(() => {
      setState(getHyper3dArticulationTestState());
      setMode(getHyper3dArticulationTestMode());
      setGlide(getHyper3dArticulationTestGlide());
      setDelivery(getHyper3dArticulationTestDelivery());
      setIntensity(getHyper3dArticulationTestIntensity());
    });
  }, []);

  /**
   * The delivery run advances on the render loop, so the panel samples it rather
   * than being driven by it. The value shown is the PEAK over the last completed
   * label, which is the number the delivery tables quote and the only one that
   * holds still long enough to read.
   */
  useEffect(() => {
    if (!hyper3dArticulationTestAvailable || delivery === "held") return;
    let raf = 0;
    const tick = () => {
      setDelivered(getHyper3dArticulationDelivered());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [delivery, state, intensity]);

  const readout = useMemo(
    () => hyper3dArticulationReadout(state, mode, glide, intensity),
    [state, mode, glide, intensity],
  );

  const groups = useMemo(() => {
    const byFamily = new Map<string, typeof HYPER3D_ARTICULATION_TARGETS[number][]>();
    for (const target of HYPER3D_ARTICULATION_TARGETS) {
      const bucket = byFamily.get(target.family) ?? [];
      bucket.push(target);
      byFamily.set(target.family, bucket);
    }
    return [...byFamily.entries()];
  }, []);

  if (!hyper3dArticulationTestAvailable) return null;

  const active = hyper3dArticulationTarget(state);
  const showGlide = hyper3dArticulationHasGlide(state) && delivery === "held";
  const ceiling = readout.pose;
  const rows =
    delivery === "held"
      ? Object.entries(ceiling).sort((a, b) => b[1] - a[1])
      : Object.entries(ceiling)
          .map(([name]) => [name, delivered[name] ?? 0] as [string, number])
          .sort((a, b) => b[1] - a[1]);

  return (
    <div
      className="pointer-events-auto absolute bottom-4 right-4 z-50 flex max-h-[85vh] w-96 flex-col gap-2 overflow-y-auto rounded-lg border border-white/20 bg-black/85 p-3 font-mono text-[11px] leading-snug text-white shadow-xl backdrop-blur"
      data-testid="hyper3d-articulation-test-panel"
    >
      <div className="flex items-baseline justify-between">
        <span className="font-semibold tracking-wide">ARTICULATION TEST</span>
        <span className="text-white/50">DEV</span>
      </div>

      {groups.map(([family, targets]) => (
        <div key={family}>
          <div className="mb-1 text-white/40">{family}</div>
          <div className="flex flex-wrap gap-1">
            {targets.map((target) => (
              <button
                key={target.id}
                type="button"
                onClick={() => setHyper3dArticulationTestState(target.id)}
                className={
                  "rounded px-2 py-1 transition-colors " +
                  (target.id === state ? "bg-emerald-500 text-black" : "bg-white/10 hover:bg-white/20")
                }
              >
                {target.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="flex gap-1">
        {(["calibrated", "authored"] as const).map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => setHyper3dArticulationTestMode(entry)}
            className={
              "flex-1 rounded px-2 py-1 transition-colors " +
              (entry === mode ? "bg-sky-400 text-black" : "bg-white/10 hover:bg-white/20")
            }
          >
            {entry === "calibrated" ? "CALIBRATED (production)" : "AUTHORED (no gain/cap)"}
          </button>
        ))}
      </div>

      <div className="flex gap-1">
        {(["held", "d70", "d90", "d150"] as const).map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => setHyper3dArticulationTestDelivery(entry)}
            className={
              "flex-1 rounded px-2 py-1 transition-colors " +
              (entry === delivery ? "bg-violet-400 text-black" : "bg-white/10 hover:bg-white/20")
            }
          >
            {entry === "held" ? "HELD" : `${HYPER3D_DELIVERY_MS[entry]}ms`}
          </button>
        ))}
      </div>

      {showGlide && (
        <div className="flex gap-1">
          {(["onset", "mid", "offglide"] as const).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setHyper3dArticulationTestGlide(entry)}
              className={
                "flex-1 rounded px-2 py-1 uppercase transition-colors " +
                (entry === glide ? "bg-amber-400 text-black" : "bg-white/10 hover:bg-white/20")
              }
            >
              {entry}
            </button>
          ))}
        </div>
      )}

      <label className="flex items-center gap-2">
        <span className="w-10 shrink-0 text-white/70">{intensity.toFixed(2)}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={intensity}
          disabled={state === "runtime" || state === "neutral"}
          onChange={(event) => setHyper3dArticulationTestIntensity(Number(event.target.value))}
          className="w-full accent-emerald-400 disabled:opacity-30"
          aria-label="Articulation test intensity"
        />
      </label>

      {readout.phoneme && (
        <div className="text-white/60">
          {readout.phoneme} · viseme {readout.viseme} · defaultIntensity {readout.defaultIntensity.toFixed(2)}
          {readout.sealForced ? " · seal forced" : ""}
        </div>
      )}

      {rows.length > 0 ? (
        <table className="w-full border-collapse">
          <thead className="text-white/40">
            <tr>
              <th className="text-left font-normal">channel</th>
              <th className="text-right font-normal">{delivery === "held" ? "final" : "peak"}</th>
              <th className="text-right font-normal">mm</th>
              {delivery !== "held" && <th className="text-right font-normal">/ceil</th>}
              <th className="text-right font-normal">min</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, value]) => {
              const facts = hyper3dArticulationChannelFacts(name, value);
              const ceil = ceiling[name] ?? 0;
              return (
                <tr key={name} className={facts.visible === false ? "text-rose-400" : ""}>
                  <td className="pr-2">{name}</td>
                  <td className="text-right tabular-nums">{value.toFixed(3)}</td>
                  <td className="text-right tabular-nums">
                    {facts.millimetres === null ? "—" : facts.millimetres.toFixed(2)}
                  </td>
                  {delivery !== "held" && (
                    <td className="text-right tabular-nums text-violet-300">
                      {ceil > 0 ? `${Math.round((value / ceil) * 100)}%` : "—"}
                    </td>
                  )}
                  <td className="text-right tabular-nums text-white/40">
                    {facts.usefulMin === null ? "—" : facts.usefulMin.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div className="text-white/40">no lower-face channels written</div>
      )}

      <p className="text-white/50">{active?.note}</p>
      <p className="text-white/35">
        Red = below this channel&apos;s measured usefulMin on female_2291.glb, i.e. it cannot be seen.
        {delivery === "held"
          ? " HELD removes the envelope, the smoother and coarticulation: live speech renders at or below these values, never above."
          : ` Peak over the last completed ${HYPER3D_DELIVERY_MS[delivery]} ms label, through the shipped envelope and mouth smoother. /ceil is that peak against the HELD value.`}
      </p>
    </div>
  );
}
