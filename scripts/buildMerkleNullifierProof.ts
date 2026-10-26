import { buildMerkleTree, getMerkleProof } from "./poseidonMerkle.js";
import { buildProof } from "./proofUtils.js";

const secrets = [11n, 22n, 33n, 44n]; // Public, deliberately insecure demo values.
const { layers } = await buildMerkleTree(secrets, 4);
const memberIndex = 2;
const path = await getMerkleProof(layers, memberIndex);

buildProof("merkleNullifier", {
  secret: secrets[memberIndex].toString(),
  pathElements: path.pathElements.map(String),
  pathIndices: path.pathIndices,
  rootExpected: path.root.toString(),
  // The claim contract is deployed with this same context and enforces it.
  context: "12345",
}, "contracts/MerkleNullifierVerifier.sol");
