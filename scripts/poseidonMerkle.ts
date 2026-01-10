import { buildPoseidon, PoseidonHash } from "circomlibjs";

export type MerkleProof = {
  root: bigint;
  pathElements: bigint[];
  pathIndices: number[];
};

export function poseidonHash2(poseidon: PoseidonHash, a: bigint, b: bigint): bigint {
  return poseidon.F.toObject(poseidon([a, b]));
}

export function poseidonHash1(poseidon: PoseidonHash, a: bigint): bigint {
  return poseidon.F.toObject(poseidon([a]));
}

// Build a full binary tree with Poseidon(2) internal nodes.
// Leaves are Poseidon(1)(secret).
export async function buildMerkleTree(secrets: bigint[], depth: number) {
  const poseidon = await buildPoseidon();

  const leafHashes = secrets.map(s => poseidonHash1(poseidon, s));

  // pad leaves to full size
  const leafCount = 1 << depth;
  const leaves = leafHashes.slice();
  while (leaves.length < leafCount) leaves.push(0n);

  const layers: bigint[][] = [];
  layers.push(leaves);

  for (let d = 0; d < depth; d++) {
    const prev = layers[d];
    const next: bigint[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      next.push(poseidonHash2(poseidon, prev[i], prev[i + 1]));
    }
    layers.push(next);
  }

  return { poseidon, layers, root: layers[depth][0], leaves };
}

export async function getMerkleProof(layers: bigint[][], index: number): Promise<MerkleProof> {
  const depth = layers.length - 1;
  const pathElements: bigint[] = [];
  const pathIndices: number[] = [];

  let idx = index;

  for (let d = 0; d < depth; d++) {
    const isRight = idx % 2;
    const siblingIdx = isRight ? idx - 1 : idx + 1;

    pathElements.push(layers[d][siblingIdx]);
    pathIndices.push(isRight);

    idx = Math.floor(idx / 2);
  }

  return {
    root: layers[depth][0],
    pathElements,
    pathIndices
  };
}
