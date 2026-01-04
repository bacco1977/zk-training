import { describe, it } from "mocha";
import { expect } from "chai";
import fs from "fs";
import hardhat from "hardhat";

const viem = (hardhat as any).viem;

function parseGenerateCallOutput(output: string) {
  // snarkjs prints something like:
  // ["0x..","0x.."],[[...],[...]],["0x..","0x.."],["0x.."]
  // We’ll extract the array expression and eval it for training.
  const start = output.indexOf("[");
  const arrStr = output.slice(start);
  // eslint-disable-next-line no-eval
  return eval(arrStr);
}

describe("ZK Square Proof On-Chain Verification", function () {
  it("verifies Groth16 proof using generated Verifier.sol", async function () {
    const raw = fs.readFileSync("build/calldata.txt", "utf8");
    const [a, b, c, input] = parseGenerateCallOutput(raw);

    const publicClient = await viem.getPublicClient();
    const verifier = await viem.deployContract("Verifier");

    const ok = await verifier.read.verifyProof([a, b, c, input]);
    expect(ok).to.equal(true);

    // Gas estimate (Lesson 3)
    const gas = await verifier.estimateGas.verifyProof([a, b, c, input]);
    console.log("verifyProof gas estimate:", gas.toString());
  });
});

