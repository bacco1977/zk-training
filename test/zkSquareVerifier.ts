import { describe, it } from "node:test";
import { expect } from "chai";
import fs from "fs";
import { network } from "hardhat";

function parseGenerateCallOutput(output: string) {
  // snarkjs prints something like:
  // ["0x..","0x.."],[[...],[...]],["0x..","0x.."],["0x.."]
  // We’ll extract the array expression and eval it for training.
  const start = output.indexOf("[");
  const arrStr = output.slice(start);
  // eslint-disable-next-line no-eval
  return eval(`[${arrStr}]`);
}

describe("ZK Square Proof On-Chain Verification", function () {
  it("verifies Groth16 proof using generated Verifier.sol", async function () {
    const raw = fs.readFileSync("build/square_calldata.txt", "utf8");
    const [a, b, c, input] = parseGenerateCallOutput(raw);

    const { viem } = await network.connect();
    const publicClient = await viem.getPublicClient();
    const verifier = await viem.deployContract("contracts/Verifier.sol:Groth16Verifier");

    // viem’s auto-generated read helpers do not surface for this ABI; call via public client instead
    const ok = await publicClient.readContract({
      address: verifier.address,
      abi: verifier.abi,
      functionName: "verifyProof",
      args: [a, b, c, input],
    });
    expect(ok).to.equal(true);

    // Gas estimate (Lesson 3)
    const gas = await publicClient.estimateContractGas({
      address: verifier.address,
      abi: verifier.abi,
      functionName: "verifyProof",
      args: [a, b, c, input],
    });
    console.log("verifyProof gas estimate:", gas.toString());
  });
});

