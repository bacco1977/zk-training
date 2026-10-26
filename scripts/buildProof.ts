import { buildProof } from "./proofUtils.js";

// Public y = 49 makes the possible values of x easy to derive. This circuit
// teaches the proof lifecycle; it is not a useful secret-hiding application.
buildProof("square", { x: 7 }, "contracts/Verifier.sol");
