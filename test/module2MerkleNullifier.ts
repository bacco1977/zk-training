import { describe, it } from "node:test";
import { expect } from "chai";
import fs from "fs";
import { network } from "hardhat";

function parseGenerateCallOutput(output: string) {
  const start = output.indexOf("[");
  const arrStr = output.slice(start);
  // eslint-disable-next-line no-eval
  return eval(`[${arrStr}]`);
}

describe("Module 2: Merkle Membership + Nullifier", function () {
  it("verifies proof and prevents replay with nullifier", async function () {
    const raw = fs.readFileSync("build/mn_calldata.txt", "utf8");
    const [a, b, c, input] = parseGenerateCallOutput(raw);

    const publicSignals = JSON.parse(fs.readFileSync("build/public.json", "utf8"));
    console.log("public.json:", publicSignals);

    const root = BigInt(fs.readFileSync("build/root.txt", "utf8").trim());

    const { viem } = await network.connect();
    const publicClient = await viem.getPublicClient();

    // Deploy verifier (use fully qualified name to avoid ambiguity)
    const verifier = await viem.deployContract("contracts/MerkleNullifierVerifier.sol:Groth16Verifier");

    // Deploy claim contract
    const claim = await viem.deployContract("MerkleNullifierClaim", [verifier.address, root]);

    // First claim should succeed
    const hash = await claim.write.claim([a, b, c, input]);
    await publicClient.waitForTransactionReceipt({ hash });
    console.log("First claim succeeded");

    // Second claim (same proof/nullifier) should fail
    try {
      await claim.write.claim([a, b, c, input]);
      expect.fail("Should have reverted");
    } catch (e: any) {
      expect(e.message).to.include("Nullifier already used");
      console.log("Second claim correctly rejected");
    }
  });
});
