import { experimentalModel } from "./experimental-model";
import type { Features } from "../../shared/lavaguard";

/** Pure portable inference. Activation is a separate server policy/configuration. */
export function experimentalInference(features: Features): { version: string; experimentalRisk: number } {
  let z = experimentalModel.intercept;
  experimentalModel.features.forEach((key, i) => {
    z += (features[key] - experimentalModel.mean[i]!) / experimentalModel.scale[i]! * experimentalModel.coefficients[i]!;
  });
  z = z * experimentalModel.calibrationSlope + experimentalModel.calibrationIntercept;
  return { version: experimentalModel.version, experimentalRisk: 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, z)))) };
}
