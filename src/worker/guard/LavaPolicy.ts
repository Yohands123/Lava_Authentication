import type { GuardMode, Verdict } from "../../shared/lavaguard";
import type { Detection } from "./LavaDetector";

export class LavaPolicy {
  decide(mode: GuardMode, evidence: Detection | null, restricted: boolean): Verdict {
    if (restricted) return "BLOCK";
    if (mode === "enforce" && evidence && evidence.enforcementRisk >= .5) return "FLAG";
    // Accessible flow is explicit and independently rate limited. An anomaly never BLOCKs.
    return "CLEAR";
  }
}
