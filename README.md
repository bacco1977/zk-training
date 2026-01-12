# Sample Hardhat 3 Beta Project (`node:test` and `viem`)

This project showcases a Hardhat 3 Beta project using the native Node.js test runner (`node:test`) and the `viem` library for Ethereum interactions.

To learn more about the Hardhat 3 Beta, please visit the [Getting Started guide](https://hardhat.org/docs/getting-started#getting-started-with-hardhat-3). To share your feedback, join our [Hardhat 3 Beta](https://hardhat.org/hardhat3-beta-telegram-group) Telegram group or [open an issue](https://github.com/NomicFoundation/hardhat/issues/new) in our GitHub issue tracker.

## Project Overview

This example project includes:

- A simple Hardhat configuration file.
- Foundry-compatible Solidity unit tests.
- TypeScript integration tests using [`node:test`](nodejs.org/api/test.html), the new Node.js native test runner, and [`viem`](https://viem.sh/).
- Examples demonstrating how to connect to different types of networks, including locally simulating OP mainnet.

## Usage

### Running Tests

To run all the tests in the project, execute the following command:

```shell
npx hardhat test
```

You can also selectively run the Solidity or `node:test` tests:

```shell
npx hardhat test solidity
npx hardhat test nodejs
```

### Make a deployment to Sepolia

This project includes an example Ignition module to deploy the contract. You can deploy this module to a locally simulated chain or to Sepolia.

To run the deployment to a local chain:

```shell
npx hardhat ignition deploy ignition/modules/Counter.ts
```

To run the deployment to Sepolia, you need an account with funds to send the transaction. The provided Hardhat configuration includes a Configuration Variable called `SEPOLIA_PRIVATE_KEY`, which you can use to set the private key of the account you want to use.

You can set the `SEPOLIA_PRIVATE_KEY` variable using the `hardhat-keystore` plugin or by setting it as an environment variable.

To set the `SEPOLIA_PRIVATE_KEY` config variable using `hardhat-keystore`:

```shell
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
```

After setting the variable, you can run the deployment with the Sepolia network:

```shell
npx hardhat ignition deploy --network sepolia ignition/modules/Counter.ts
```

---

## Additional Example: ZK Proof Circuit Integration

This project extends beyond the standard Hardhat template by showcasing a full workflow for compiling and testing zero-knowledge (ZK) circuits with Circom and using SNARKs in your Solidity contracts and TypeScript integration tests.

### ZK Proof Setup Workflow

You will find an end-to-end pipeline for ZK circuit development in the `scripts/buildProof.ts` file. This script demonstrates how to:

- Compile a Circom circuit (see `circuits/square.circom`) to produce R1CS and WASM files.
- Generate witness values and input JSONs for proof creation.
- Perform a trusted setup using the Powers of Tau and Groth16 phase 2 ceremonies (via [snarkjs](https://github.com/iden3/snarkjs)).
- Generate a Groth16 zkSNARK proof with associated public outputs.
- Export a Solidity verifier contract to the `contracts/` directory for use in smart contract testing.
- Generate the calldata for Solidity test input.

All buildup products (proofs, keys, calldata, etc.) are emitted in a `build/` directory for traceability and reproducibility.

### Testing: Integration with Node.js and Viem

Test files in `test/` are written in TypeScript using Node.js's built-in test runner (`node:test`) and leverage [viem](https://viem.sh/) for modern contract interactions.

For example:
- `test/Counter.ts` deploys the contract via Viem and asserts correct event emissions.
- The test framework does not rely on legacy test libraries (e.g., Mocha), instead using native Node.js idioms.

### Circuit Artifacts Provided

**Square Circuit (Module 1):**
- `build/proof.json`: Example Groth16 proof output for `x=7` in the `square.circom` circuit.
- `build/public.json`: Public inputs corresponding to the proof.
- `build/square_calldata.txt`: Pre-generated calldata for the square verifier.

**Merkle Nullifier Circuit (Module 2):**
- `build/mn_calldata.txt`: Pre-generated calldata for the merkle nullifier verifier.
- `build/root.txt`: The Merkle tree root.
- `build/nullifier.txt`: The generated nullifier for the test claim.
- `build/context.txt`: The context used for nullifier derivation.

**Shared:**
- `build/ptau/pot12_final.ptau`: Cached Powers of Tau ceremony output (reused across circuits).

---

## Module 2: Merkle Tree Nullifier (Anonymous Claims)

This project includes a more advanced ZK circuit demonstrating **anonymous membership proofs** with **anti-replay protection** - the foundation for privacy-preserving applications like anonymous airdrops, voting, and mixers.

### What It Does

The `MerkleNullifier` circuit proves:
1. **"I know a secret whose hash is in a Merkle tree"** (membership proof)
2. **"Here's a unique nullifier for this action"** (prevents double-claiming)

All while keeping **which leaf you are** completely private!

### Files

| File | Purpose |
|------|---------|
| `circuits/merkleNullifier.circom` | ZK circuit for Merkle membership + nullifier |
| `scripts/buildMerkleNullifierProof.ts` | Build script for the circuit |
| `scripts/poseidonMerkle.ts` | TypeScript utilities for Merkle tree operations |
| `contracts/MerkleNullifierVerifier.sol` | Auto-generated Groth16 verifier |
| `contracts/MerkleNullifierClaim.sol` | Claim contract with nullifier tracking |
| `test/module2MerkleNullifier.ts` | Integration test |

### Running the Example

```bash
# Build the proof (first run generates ptau, subsequent runs reuse it)
npx tsx scripts/buildMerkleNullifierProof.ts

# Run tests
npm test
```

### How It Works

```
1. SETUP
   - Build Merkle tree from user secrets: leaf = hash(secret)
   - Publish tree root on-chain

2. CLAIM (off-chain proof generation)
   - User proves: "I know a secret in the tree"
   - User reveals: nullifier = hash(secret, context)
   - User hides: which leaf, the secret itself

3. VERIFY (on-chain)
   - Contract verifies ZK proof
   - Contract checks: nullifier not used before
   - Contract marks: nullifier as spent
   - Contract sends: reward to user
```

---

## ⚠️ Why This Is NOT Production-Ready

This project is for **learning and experimentation only**. Here's what would need to change for production:

### 1. Powers of Tau Ceremony

**Current (training):**
```typescript
// Generated locally - YOU know the toxic waste!
run("npx snarkjs powersoftau new bn128 12 ...");
```

**Production requirement:**
- Use public ceremony artifacts (Hermez, Polygon)
- Or run your own multi-party ceremony
- Verify checksums before use

```bash
# Download trusted ceremony output
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau
```

### 2. Privacy Limitations

**Current limitation:** The recipient address (`msg.sender`) is visible on-chain.

```
Observer sees: "0xABC... received tokens"
Observer doesn't see: "Which leaf in the tree was 0xABC..."
```

**For full privacy:**
- Use a relayer network (Tornado Cash pattern)
- Withdraw to fresh addresses with no transaction history
- Use account abstraction with paymasters

### 3. No Actual Reward

**Current:** The claim function just emits an event.

```solidity
// TODO: Add actual token transfer
emit Claimed(nullifier, msg.sender);
// payable(msg.sender).transfer(amount); // Not implemented!
```

**Production:** Add ERC20/ETH transfer or NFT minting.

### 4. Hardcoded Parameters

**Current:** Tree depth, context, secrets are hardcoded.

```typescript
const depth = 4;  // Fixed
const context = 12345n;  // Fixed
const secrets = [11n, 22n, 33n, 44n];  // Fixed
```

**Production:**
- Dynamic tree building from user registrations
- Context derived from chain ID + contract address
- Secure secret generation and storage

### 5. No Input Validation

**Current:** Minimal validation in contracts.

**Production:**
- Validate all public signal ranges
- Add reentrancy guards
- Comprehensive access control
- Audit by security professionals

### 6. Circuit Not Audited

ZK circuits require specialized audits:
- Constraint completeness
- No under-constrained signals
- Sound constraint logic

---

## Production Checklist

Before deploying ZK systems with real value:

- [ ] Use public ceremony ptau (Hermez/Polygon)
- [ ] Implement relayer for full privacy
- [ ] Add actual token/ETH rewards
- [ ] Dynamic tree management
- [ ] Comprehensive input validation
- [ ] Smart contract audit
- [ ] ZK circuit audit
- [ ] Bug bounty program

---

**This project thus serves as a minimal, reproducible template showing how to:**

- Write ZK circuits with Circom
- Build Merkle tree membership proofs
- Implement nullifiers for anti-replay protection
- Compile, generate proofs, and verify off-chain
- Export Solidity verifiers in an automated fashion
- Integrate ZK verification into a Hardhat/TypeScript/Node.js workflow

_You can use this project as a starting point to integrate ZK-SNARK verification in your own contracts and TypeScript-based tests._

