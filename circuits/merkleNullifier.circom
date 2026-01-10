pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";

// Poseidon-based Merkle proof verifier for a fixed depth tree.
// We'll build it ourselves for clarity and control.

template MerkleProof(depth) {
    signal input leaf;
    signal input pathElements[depth];
    signal input pathIndices[depth]; // 0 = left, 1 = right
    signal output root;

    component hashers[depth];

    // Signals must be declared at template level, not inside loops
    signal left[depth];
    signal right[depth];
    signal swap[depth];  // Intermediate signal for quadratic constraint
    signal cur[depth + 1];

    cur[0] <== leaf;

    for (var i = 0; i < depth; i++) {
        hashers[i] = Poseidon(2);

        // Conditional swap using quadratic constraints:
        // swap = idx * (sibling - cur)
        // If idx=0: swap=0, left=cur, right=sibling
        // If idx=1: swap=sibling-cur, left=sibling, right=cur
        swap[i] <== pathIndices[i] * (pathElements[i] - cur[i]);
        left[i] <== cur[i] + swap[i];
        right[i] <== pathElements[i] - swap[i];

        hashers[i].inputs[0] <== left[i];
        hashers[i].inputs[1] <== right[i];

        cur[i + 1] <== hashers[i].out;
    }

    root <== cur[depth];
}

template MerkleNullifier(depth) {
    // Private inputs
    signal input secret;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    // Public inputs
    signal input rootExpected;      // on-chain stored root
    signal input context;           // e.g. airdropId / contract domain separator

    // Public output
    signal output nullifier;

    // 1) leaf = Poseidon(secret)
    component leafHasher = Poseidon(1);
    leafHasher.inputs[0] <== secret;
    signal leaf;
    leaf <== leafHasher.out;

    // 2) Compute root from leaf + path
    component mp = MerkleProof(depth);
    mp.leaf <== leaf;
    for (var i = 0; i < depth; i++) {
        mp.pathElements[i] <== pathElements[i];
        mp.pathIndices[i] <== pathIndices[i];
    }

    // 3) Enforce computed root equals expected root (public)
    mp.root === rootExpected;

    // 4) nullifier = Poseidon(secret, context)
    component nullHasher = Poseidon(2);
    nullHasher.inputs[0] <== secret;
    nullHasher.inputs[1] <== context;
    nullifier <== nullHasher.out;
}

// Declare rootExpected and context as public inputs (in addition to nullifier output)
component main {public [rootExpected, context]} = MerkleNullifier(4);
