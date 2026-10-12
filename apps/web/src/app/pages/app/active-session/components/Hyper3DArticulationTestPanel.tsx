import { useEffect, useMemo, useState } from "react";
import {
  HYPER3D_ARTICULATION_TARGETS,
  HYPER3D_DEADLINE_MODE_LABELS,
  HYPER3D_DEADLINE_PRIMARY_MODES,
  HYPER3D_DEADLINE_REGRESSION_MODES,
  HYPER3D_DELIVERY_MS,
  getHyper3dArticulationDelivered,
  getHyper3dArticulationDeliveryStats,
  getHyper3dArticulationTestDelivery,
  getHyper3dArticulationTestGlide,
  getHyper3dArticulationTestJawMode,
  getHyper3dArticulationTestIntensity,
  getHyper3dArticulationTestMode,
  getHyper3dArticulationTestState,
  hyper3dArticulationChannelFacts,
  hyper3dArticulationHasGlide,
  hyper3dArticulationReadout,
  hyper3dArticulationTarget,
  getHyper3dDeadlineMode,
  getHyper3dDeadlineReadout,
  hyper3dArticulationTestAvailable,
  setHyper3dDeadlineMode,
  setHyper3dArticulationTestDelivery,
  setHyper3dArticulationTestGlide,
  setHyper3dArticulationTestJawMode,
  setHyper3dArticulationTestIntensity,
  setHyper3dArticulationTestMode,
  setHyper3dArticulationTestState,
  subscribeHyper3dArticulationTest,
  type Hyper3dArticulationDelivery,
  type Hyper3dArticulationGlide,
  type Hyper3dArticulationJawMode,
  type Hyper3dArticulationMode,
  type Hyper3dDeadlineMode,
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
  const [stats, setStats] = useState(getHyper3dArticulationDeliveryStats);
  const [jawMode, setJawMode] = useState<Hyper3dArticulationJawMode>(getHyper3dArticulationTestJawMode);
  const [deadlineMode, setDeadlineMode] = useState<Hyper3dDeadlineMode>(getHyper3dDeadlineMode);
  const [deadline, setDeadline] = useState(getHyper3dDeadlineReadout);

  useEffect(() => {
    if (!hyper3dArticulationTestAvailable) return;
    return subscribeHyper3dArticulationTest(() => {
      setState(getHyper3dArticulationTestState());
      setMode(getHyper3dArticulationTestMode());
      setGlide(getHyper3dArticulationTestGlide());
      setDelivery(getHyper3dArticulationTestDelivery());
      setJawMode(getHyper3dArticulationTestJawMode());
      setDeadlineMode(getHyper3dDeadlineMode());
      setIntensity(getHyper3dArticulationTestIntensity());
      // The readout carries the live selection, so a mode change must refresh it
      // here rather than waiting for the next animation frame to sample it.
      setDeadline(getHyper3dDeadlineReadout());
    });
  }, []);

  /**
   * The delivery run advances on the render loop, so the panel samples it rather
   * than being driven by it. The value shown is the PEAK over the last completed
   * label, which is the number the delivery tables quote and the only one that
   * holds still long enough to read.
   */
  useEffect(() => {
    if (!hyper3dArticulationTestAvailable) return;
    let raf = 0;
    const tick = () => {
      setDelivered(getHyper3dArticulationDelivered());
      setStats(getHyper3dArticulationDeliveryStats());
      setDeadline(getHyper3dDeadlineReadout());
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
  const isSequence = Boolean(active?.phonemes);
  // A connected sequence has no held pose, so it always runs at a length.
  const effectiveDelivery = isSequence && delivery === "held" ? "d90" : delivery;
  const showGlide = hyper3dArticulationHasGlide(state) && delivery === "held" && !isSequence;
  const ceiling = readout.pose;
  const rows =
    effectiveDelivery === "held"
      ? Object.entries(ceiling).sort((a, b) => b[1] - a[1])
      : // A sequence has no single ceiling, so every channel it reached is shown.
        Object.entries(isSequence ? delivered : ceiling)
          .map(([name]) => [name, delivered[name] ?? 0] as [string, number])
          .filter(([, value]) => value > 0.0005)
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

      {/*
        TARGET CONVERGENCE. First control on the panel and never hidden, because
        it applies to the RUNTIME target as well as to the connected-speech
        runner — the comparison is the same utterance in two modes, and the
        reviewer must be able to switch while live speech is playing.

        THE TWO PRIMARY MODES ARE LARGE AND ALONE. The pre-deadline follower and
        the three rejected candidates sit behind a disclosure: §16 asks for the
        two relevant choices to be extremely clear, and a row of six buttons is
        not that.
      */}
      <div className="rounded border border-white/15 px-2 py-1.5">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-white/40">target convergence</span>
          <span
            className={deadlineMode === "production" ? "text-emerald-300" : "text-cyan-300"}
            data-testid="hyper3d-deadline-active-mode"
          >
            {HYPER3D_DEADLINE_MODE_LABELS[deadlineMode]}
          </span>
        </div>
        <div className="flex gap-1">
          {HYPER3D_DEADLINE_PRIMARY_MODES.map((entry) => (
            <button
              key={entry}
              type="button"
              data-testid={`hyper3d-deadline-mode-${entry}`}
              onClick={() => setHyper3dDeadlineMode(entry)}
              className={
                "flex-1 rounded px-2 py-2 font-semibold tracking-wide transition-colors " +
                (entry === deadlineMode
                  ? entry === "production"
                    ? "bg-emerald-400 text-black"
                    : "bg-cyan-400 text-black"
                  : "bg-white/10 hover:bg-white/20")
              }
            >
              {HYPER3D_DEADLINE_MODE_LABELS[entry]}
            </button>
          ))}
        </div>
        <details className="mt-1">
          <summary className="cursor-pointer text-white/30">regression modes</summary>
          <div className="mt-1 flex flex-wrap gap-1">
            {HYPER3D_DEADLINE_REGRESSION_MODES.map((entry) => (
              <button
                key={entry}
                type="button"
                data-testid={`hyper3d-deadline-mode-${entry}`}
                onClick={() => setHyper3dDeadlineMode(entry)}
                className={
                  "rounded px-2 py-1 text-[10px] transition-colors " +
                  (entry === deadlineMode ? "bg-amber-400 text-black" : "bg-white/10 hover:bg-white/20")
                }
              >
                {HYPER3D_DEADLINE_MODE_LABELS[entry]}
              </button>
            ))}
          </div>
        </details>
        <div className="mt-1 grid grid-cols-2 gap-x-2 tabular-nums">
          <div className="flex justify-between">
            <span className="text-white/50">phoneme</span>
            <span>{deadline.phoneme ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">cap</span>
            <span>{deadline.maxSpeed === null ? "—" : deadline.maxSpeed}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">landing</span>
            <span className={deadline.landing === null ? "text-white/40" : "text-emerald-300"}>
              {deadline.landing === null ? "OFF" : `^${deadline.landing}`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">label</span>
            <span>{deadline.labelMs.toFixed(0)} ms</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">left</span>
            <span>{deadline.remainingMs.toFixed(0)} ms</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">accel</span>
            <span className={deadline.accelerating ? "text-cyan-300" : "text-white/40"}>
              {deadline.accelerating ? `YES ×${deadline.acceleratedChannels}` : "NO"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">speed</span>
            <span>{deadline.peakSpeed > 0 ? deadline.peakSpeed.toFixed(1) : "24.0"}</span>
          </div>
        </div>
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

      {readout.phoneme && !isSequence && (
        <div className="text-white/60">
          {readout.phoneme} · viseme {readout.viseme} · defaultIntensity {readout.defaultIntensity.toFixed(2)}
          {readout.sealForced ? " · seal forced" : ""}
        </div>
      )}

      {effectiveDelivery !== "held" && (
        <div className="flex gap-1">
          {(["asymmetric", "symmetric"] as const).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setHyper3dArticulationTestJawMode(entry)}
              className={
                "flex-1 rounded px-2 py-1 transition-colors " +
                (entry === jawMode ? "bg-amber-400 text-black" : "bg-white/10 hover:bg-white/20")
              }
            >
              {entry === "asymmetric" ? "JAW: ASYM (production)" : "JAW: SYMMETRIC (pre-G)"}
            </button>
          ))}
        </div>
      )}

      {effectiveDelivery !== "held" && (
        <div className="rounded bg-white/5 px-2 py-1">
          <div className="text-white/40">transition character, last cycle</div>
          <div className="flex justify-between tabular-nums">
            <span>peak speed</span>
            <span className="text-violet-300">{stats.peakVelocityMMPerSecond.toFixed(0)} mm/s</span>
          </div>
          <div className="flex justify-between tabular-nums">
            <span>carried by jaw</span>
            <span className={stats.jawShare > 0.6 ? "text-rose-400" : "text-violet-300"}>
              {(stats.jawShare * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex justify-between tabular-nums">
            <span>path length</span>
            <span className="text-white/60">{stats.pathLengthMM.toFixed(1)} mm</span>
          </div>
          <div className="flex justify-between tabular-nums">
            <span>sentence settle</span>
            <span className={stats.settling ? "text-emerald-300" : "text-white/40"}>
              {stats.settling ? "ACTIVE" : "—"}
            </span>
          </div>
        </div>
      )}

      {/*
        §9 OF THE BRIEF. The same ruler in all three modes: reach is peak
        rendered against peak demanded, in the follower's own domain, over the
        last completed cycle. Drift and closure timing are printed because they
        must NOT move — they are the evidence the timeline and the seal were left
        alone, not a tuning readout.
      */}
      {effectiveDelivery !== "held" && (
        <div className="rounded bg-white/5 px-2 py-1" data-testid="hyper3d-deadline-instrumentation">
          <div className="text-white/40">target reach, last cycle ({stats.reach.samples} samples)</div>
          <div className="flex justify-between tabular-nums">
            <span>overall</span>
            <span className="text-cyan-300">{(stats.reach.overall * 100).toFixed(0)}%</span>
          </div>
          {(
            [
              ["jaw", stats.reach.byChannelGroup.jaw],
              ["vertical lip", stats.reach.byChannelGroup.vertical],
              ["width", stats.reach.byChannelGroup.width],
              ["rounding", stats.reach.byChannelGroup.rounding],
              ["OPEN vowels", stats.reach.byPhonemeClass.open],
              ["FRONT vowels", stats.reach.byPhonemeClass.front],
              ["ROUNDED vowels", stats.reach.byPhonemeClass.rounded],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="flex justify-between tabular-nums">
              <span className="text-white/60">{label}</span>
              <span className={value > 0 ? "text-white/80" : "text-white/30"}>
                {value > 0 ? `${(value * 100).toFixed(0)}%` : "—"}
              </span>
            </div>
          ))}
          <div className="mt-1 text-white/40">motion</div>
          <div className="flex justify-between tabular-nums">
            <span className="text-white/60">path rate</span>
            <span>{stats.motion.pathRateMMPerSecond.toFixed(1)} mm/s</span>
          </div>
          <div className="flex justify-between tabular-nums">
            <span className="text-white/60">velocity p90</span>
            <span>{stats.motion.velocityP90MMPerSecond.toFixed(1)} mm/s</span>
          </div>
          <div className="flex justify-between tabular-nums">
            <span className="text-white/60">jaw cycles</span>
            <span>{stats.motion.jawCyclesPerSecond.toFixed(2)} /s</span>
          </div>
          <div className="mt-1 text-white/40">must not move</div>
          <div className="flex justify-between tabular-nums">
            <span className="text-white/60">timeline drift</span>
            <span className={Math.abs(stats.timelineDriftSeconds) > 1e-9 ? "text-rose-400" : "text-emerald-300"}>
              {(stats.timelineDriftSeconds * 1000).toFixed(3)} ms
            </span>
          </div>
          <div className="flex justify-between tabular-nums">
            <span className="text-white/60">closure timing</span>
            <span>{stats.closureTimingErrorMs.toFixed(1)} ms</span>
          </div>
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
