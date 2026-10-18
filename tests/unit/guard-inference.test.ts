import { it, expect } from "vitest";
import { experimentalInference } from "../../src/worker/guard/inference";
import { experimentalModel } from "../../src/worker/guard/experimental-model";
it("matches Python's calibrated logistic prediction for a synthetic parity fixture", () => {
  const result = experimentalInference(experimentalModel.parityFixture.features);
  expect(result.experimentalRisk).toBeCloseTo(experimentalModel.parityFixture.expectedRisk, 10);
  expect(experimentalModel.enabled).toBe(false);
});
