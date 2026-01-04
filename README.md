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

- `build/proof.json`: Example Groth16 proof output for `x=7` in the `square.circom` circuit.
- `build/public.json`: Public inputs corresponding to the proof.
- `build/calldata.txt`: Pre-generated calldata to use with Solidity verifier contracts in your own scripts or tests.

---

**This project thus serves as a minimal, reproducible template showing how to:**

- Write ZK circuits with Circom
- Compile, generate proofs, and verify off-chain
- Export Solidity verifiers in an automated fashion
- Integrate ZK verification into a Hardhat/TypeScript/Node.js workflow

_You can use this project as a starting point to integrate ZK-SNARK verification in your own contracts and TypeScript-based tests._


