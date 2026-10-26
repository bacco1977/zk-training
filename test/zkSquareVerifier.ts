import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import { network } from "hardhat";

describe("Square proof", function () {
  it("accepts the generated proof and rejects a changed public output", async function () {
    const [a, b, c, input] = JSON.parse(fs.readFileSync("build/square/calldata.json", "utf8"));
    const { viem } = await network.connect();
    const client = await viem.getPublicClient();
    const verifier = await viem.deployContract("contracts/Verifier.sol:Groth16Verifier");
    const verify = (signals: readonly [bigint]) => client.readContract({
      address: verifier.address, abi: verifier.abi,
      functionName: "verifyProof", args: [a, b, c, signals],
    });
    assert.equal(await verify(input.map(BigInt)), true);
    assert.equal(await verify([BigInt(input[0]) + 1n]), false);
  });
});
