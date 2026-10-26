# Zero-knowledge proof training

Two small examples for learning how Circom circuits become Groth16 proofs,
how to verify them off-chain with snarkjs, and how to use generated Solidity
verifiers in local Hardhat tests.

This is a learning project. The setup, secrets, and claim application are
deliberately simplified and are not suitable for protecting real assets.

## Quick start

Prerequisites:

- Node.js 22.13 or newer (the checked-in `.nvmrc` uses 22.23.3).
- npm.
- The **Circom 2 compiler** on your PATH. Tested with Circom 2.2.3.
  Follow the [official installation guide](https://docs.circom.io/getting-started/installation/).
  The old npm package named `circom` is not a replacement for Circom 2.

```sh
git clone https://github.com/bacco1977/zk-training.git
cd zk-training
nvm use                 # if you use nvm
npm ci
npm test
```

`npm test` first builds both circuits, generates fresh proofs and matching
Solidity verifiers, and then runs the tests. The first build creates a local
Powers of Tau setup; subsequent builds reuse it. Contributions use fresh
random entropy without interactive prompts. This remains a single-machine
training setup, not a production ceremony.

Tests use a locally simulated chain. No wallet, funds, RPC endpoint, or
deployment to a public network is needed. Hardhat may download its Solidity
compiler on the first run.

## Module 1: the proof lifecycle

`circuits/square.circom` enforces `y = x * x`. The example uses `x = 7`,
so the public output is `49`.

This is a mechanics exercise: compilation, witness generation, setup, proof
generation, and verification. It is not a useful secret-hiding application:
the public square makes its possible roots easy to compute. Zero knowledge
does not hide information already implied by the public statement.

```sh
npm run proof
```

Artifacts are written to `build/square/`, including `input.json`,
`witness.wtns`, `final.zkey`, `verification_key.json`, `proof.json`,
`public.json`, and `calldata.json`.

## Module 2: membership and a single claim per context

`circuits/merkleNullifier.circom` demonstrates a depth-four Poseidon Merkle
tree. The prover supplies a private secret and membership path, while the
root, context, and nullifier are public.

The circuit checks that:

1. The leaf is the Poseidon hash of the supplied secret.
2. Every path direction is exactly 0 or 1.
3. The path reaches the expected root.
4. The nullifier is `Poseidon(secret, context)`.

`MerkleNullifierClaim` is deployed with a verifier address, an accepted
root, and an accepted context. It verifies the proof, enforces that root and
context, and rejects a nullifier that has already been used. A successful
claim emits an event; it does not transfer funds or mint anything.

```sh
npm run m2:proof
```

Artifacts are written to `build/merkleNullifier/`. The demo uses public
training secrets `11, 22, 33, 44` and context `12345`.

The tests cover successful verification, repeat claims, a valid proof with
a different context, an unexpected root, tampered public signals, a
nonmember, and the previously possible forgery using a nonbinary path
direction.

## Build and test commands

```sh
npm run build:proofs     # build both modules and verify their proofs off-chain
npm test                # rebuild proofs, compile contracts, run all tests
npm run typecheck       # check TypeScript after generating contract artifacts
npx hardhat test        # rerun tests against the most recently built artifacts
```

Build scripts call the locally installed snarkjs CLI. Each module has its
own artifact directory so building one cannot overwrite the other's
inputs, witnesses, keys, or public outputs.

Generated files under `build/` and the two generated verifier contracts
are ignored by Git. They must be rebuilt after changing a circuit. Removing
`build/ptau/` also creates a new training setup on the next build.

## What this does not guarantee

- **Production setup security:** use appropriate, verified ceremony
  artifacts and a properly conducted Groth16 phase-two ceremony for a real
  deployment. Generating random contributions on one machine is not an
  independent multiparty ceremony.
- **Secret security:** demo secrets are public and written to local input
  files. A real system needs secure secret generation, storage, and membership
  registration.
- **One claim across every deployment:** the fixed context is enforced
  within this demo contract. A real application's context must distinguish
  the intended chain, contract, and action.
- **Recipient binding or transaction privacy:** proofs are not bound to
  `msg.sender`; someone who obtains a proof can submit it first. The caller
  address is public. Do not add rewards without designing recipient binding
  and considering transaction ordering and privacy.
- **A production identity or AI system:** these are small building blocks,
  not complete applications, and have not received a cryptographic audit.

The Counter contract, its tests, and its Ignition module are retained from
the original Hardhat template as separate examples.
