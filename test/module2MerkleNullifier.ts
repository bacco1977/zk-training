import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { network } from "hardhat";
import { buildMerkleTree, poseidonHash1 } from "../scripts/poseidonMerkle.js";
import { snarkjs, writeCalldata } from "../scripts/proofUtils.js";

const directory = "build/merkleNullifier";
const fixture = JSON.parse(fs.readFileSync(`${directory}/input.json`, "utf8"));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "zk-training-tests-"));
after(() => fs.rmSync(temporary, { recursive: true, force: true }));
const calldata = (dir: string) => JSON.parse(fs.readFileSync(`${dir}/calldata.json`, "utf8"));

function witness(name: string, input: Record<string, unknown>): string {
  const file = `${temporary}/${name}.json`;
  fs.writeFileSync(file, JSON.stringify(input));
  snarkjs("wtns", "calculate", `${directory}/merkleNullifier_js/merkleNullifier.wasm`,
    file, `${temporary}/${name}.wtns`);
  return `${temporary}/${name}.wtns`;
}

function proof(name: string, input: Record<string, unknown>) {
  const target = `${temporary}/${name}`;
  fs.mkdirSync(target);
  snarkjs("groth16", "prove", `${directory}/final.zkey`, witness(name, input),
    `${target}/proof.json`, `${target}/public.json`);
  snarkjs("groth16", "verify", `${directory}/verification_key.json`,
    `${target}/public.json`, `${target}/proof.json`);
  writeCalldata(target);
  return calldata(target);
}

async function deploy() {
  const { viem } = await network.connect();
  const client = await viem.getPublicClient();
  const verifier = await viem.deployContract("contracts/MerkleNullifierVerifier.sol:Groth16Verifier");
  const claim = await viem.deployContract("MerkleNullifierClaim", [
    verifier.address, BigInt(fixture.rootExpected), BigInt(fixture.context),
  ]);
  return { claim, client };
}

describe("Merkle membership and nullifiers", function () {
  it("accepts a member once and rejects reuse of the nullifier", async function () {
    const { claim, client } = await deploy();
    const args = calldata(directory);
    const hash = await claim.write.claim(args);
    assert.equal((await client.waitForTransactionReceipt({ hash })).status, "success");
    assert.equal(await claim.read.nullifierUsed([BigInt(args[3][0])]), true);
    await assert.rejects(claim.write.claim(args), /Nullifier already used/);
  });

  it("rejects another valid proof from the same member under a different context", async function () {
    const { claim, client } = await deploy();
    const hash = await claim.write.claim(calldata(directory));
    await client.waitForTransactionReceipt({ hash });
    const other = proof("other-context", { ...fixture, context: "12346" });
    assert.notEqual(BigInt(other[3][0]), BigInt(calldata(directory)[3][0]));
    await assert.rejects(claim.write.claim(other), /Wrong context/);
    assert.equal(await claim.read.nullifierUsed([BigInt(other[3][0])]), false);
  });

  it("rejects a proof for a different membership root", async function () {
    const { viem } = await network.connect();
    const verifier = await viem.deployContract("contracts/MerkleNullifierVerifier.sol:Groth16Verifier");
    const claim = await viem.deployContract("MerkleNullifierClaim", [
      verifier.address, BigInt(fixture.rootExpected) + 1n, BigInt(fixture.context),
    ]);
    await assert.rejects(claim.write.claim(calldata(directory)), /Wrong root/);
  });

  it("rejects a tampered proof", async function () {
    const { claim } = await deploy();
    const args = calldata(directory);
    args[3][0] = (BigInt(args[3][0]) + 1n).toString();
    await assert.rejects(claim.write.claim(args), /Invalid proof/);
  });

  it("rejects a nonmember using an otherwise valid path", function () {
    assert.throws(() => witness("nonmember", { ...fixture, secret: "999" }), /Assert Failed/);
  });

  it("rejects the previously accepted forged path with a nonbinary direction", async function () {
    const { poseidon, layers } = await buildMerkleTree([11n, 22n, 33n, 44n], 4);
    const prime = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    const mod = (value: bigint) => ((value % prime) + prime) % prime;
    function inverse(value: bigint): bigint {
      let result = 1n;
      let base = mod(value);
      assert.notEqual(base, 0n);
      for (let exponent = prime - 2n; exponent > 0n; exponent >>= 1n) {
        if (exponent & 1n) result = mod(result * base);
        base = mod(base * base);
      }
      return result;
    }
    const leaf = poseidonHash1(poseidon, 999n);
    const left = layers[0][2];
    const right = layers[0][3];
    const sibling = mod(left + right - leaf);
    const direction = mod((left - leaf) * inverse(sibling - leaf));
    assert.notEqual(direction, 0n);
    assert.notEqual(direction, 1n);
    // Without the bit constraint these values reproduce a legitimate parent.
    const swap = mod(direction * (sibling - leaf));
    assert.equal(mod(leaf + swap), left);
    assert.equal(mod(sibling - swap), right);
    assert.throws(() => witness("nonbinary", {
      ...fixture, secret: "999",
      pathElements: [sibling.toString(), ...fixture.pathElements.slice(1)],
      pathIndices: [direction.toString(), ...fixture.pathIndices.slice(1)],
    }), /Assert Failed/);
  });
});
