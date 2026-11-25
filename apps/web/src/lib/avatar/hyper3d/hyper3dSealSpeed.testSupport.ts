import { vi } from "vitest";
import { FacialPoseMixer } from "./engine/engine/avatar/FacialPoseMixer";

/**
 * TEST-ONLY. Imported by tests and by nothing on a render path.
 *
 * Runs `fn` with every mouth transition profile's Stage 2 Step 3b `sealSpeed`
 * removed at the one place it is read (`FacialPoseMixer.smooth`). Without it the
 * mixer takes `openSpeed` on a closing seal frame, which is the pre-Step-3b path
 * exactly, so a regression test can keep its original comparison on the
 * configuration it was written for, in BOTH of the paths it compares.
 */
export function withoutSealSpeed<T>(fn: () => T): T {
  const original = FacialPoseMixer.prototype.smooth;
  const spy = vi.spyOn(FacialPoseMixer.prototype, "smooth").mockImplementation(function (
    this: FacialPoseMixer,
    ...args: Parameters<FacialPoseMixer["smooth"]>
  ) {
    const mouth = args[3];
    args[3] = mouth ? { ...mouth, sealSpeed: undefined } : mouth;
    return original.apply(this, args);
  });
  try {
    return fn();
  } finally {
    spy.mockRestore();
  }
}
