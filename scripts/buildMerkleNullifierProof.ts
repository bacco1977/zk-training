import fs from "fs";
import { execSync } from "child_process";
import { buildMerkleTree, getMerkleProof } from "./poseidonMerkle.js";

function run(cmd: string) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

function runCapture(cmd: string): string {
  console.log(`\n> ${cmd}`);
  return execSync(cmd).toString();
}

async function main() {
  const depth = 4;

  fs.mkdirSync("build", { recursive: true });
  fs.mkdirSync("contracts", { recursive: true });

  // 1) Compile circuit (use -l to specify circomlib location)
  run("circom circuits/merkleNullifier.circom --r1cs --wasm --sym -o build -l node_modules");

  // 2) Build tree from secrets
  const secrets = [11n, 22n, 33n, 44n]; // training set members
  const { poseidon, layers, root } = await buildMerkleTree(secrets, depth);

  // pick member index 2 (secret = 33)
  const memberIndex = 2;
  const secret = secrets[memberIndex];

  const proof = await getMerkleProof(layers, memberIndex);

  // 3) Context (bind proof to action)
  const context = 12345n; // "airdropId", could also be chainid/contract binding later

  // 4) Write input.json for witness gen
  const input = {
    secret: secret.toString(),
    pathElements: proof.pathElements.map(x => x.toString()),
    pathIndices: proof.pathIndices,
    rootExpected: proof.root.toString(),
    context: context.toString()
  };

  fs.writeFileSync("build/input.json", JSON.stringify(input, null, 2));

  // 5) Generate witness
  // Circom outputs CommonJS helpers; copy both to .cjs and rewrite the internal require
  run("cp build/merkleNullifier_js/generate_witness.js build/merkleNullifier_js/generate_witness.cjs");
  run("cp build/merkleNullifier_js/witness_calculator.js build/merkleNullifier_js/witness_calculator.cjs");
  const generateWitnessPath = "build/merkleNullifier_js/generate_witness.cjs";
  const generateWitnessSource = fs.readFileSync(generateWitnessPath, "utf8");
  fs.writeFileSync(
    generateWitnessPath,
    generateWitnessSource.replace(
      "./witness_calculator.js",
      "./witness_calculator.cjs"
    )
  );
  run(
    "node build/merkleNullifier_js/generate_witness.cjs build/merkleNullifier_js/merkleNullifier.wasm build/input.json build/witness.wtns"
  );

  // 6) Powers of Tau (reuse from module1 if you want; for now generate a new one)
  run("npx snarkjs powersoftau new bn128 12 build/pot12_0000.ptau -v");
  run(
    "npx snarkjs powersoftau contribute build/pot12_0000.ptau build/pot12_0001.ptau --name='demo' -v"
  );
  run(
    "npx snarkjs powersoftau prepare phase2 build/pot12_0001.ptau build/pot12_final.ptau -v"
  );

  // 7) Setup zkey
  run(
    "npx snarkjs groth16 setup build/merkleNullifier.r1cs build/pot12_final.ptau build/mn_0000.zkey"
  );
  run(
    "npx snarkjs zkey contribute build/mn_0000.zkey build/mn_final.zkey --name='demo2' -v"
  );

  run(
    "npx snarkjs zkey export verificationkey build/mn_final.zkey build/verification_key.json"
  );

  // 8) Prove
  run(
    "npx snarkjs groth16 prove build/mn_final.zkey build/witness.wtns build/proof.json build/public.json"
  );

  // 9) Verify off-chain
  run(
    "npx snarkjs groth16 verify build/verification_key.json build/public.json build/proof.json"
  );

  // 10) Export Solidity verifier
  run(
    "npx snarkjs zkey export solidityverifier build/mn_final.zkey contracts/MerkleNullifierVerifier.sol"
  );

  // 11) Generate calldata
  const calldata = runCapture("npx snarkjs generatecall build/public.json build/proof.json");
  fs.writeFileSync("build/mn_calldata.txt", calldata);

  // Save public signals for convenience
  const publicSignals = JSON.parse(fs.readFileSync("build/public.json", "utf8"));
  fs.writeFileSync("build/root.txt", proof.root.toString());
  fs.writeFileSync("build/context.txt", context.toString());
  fs.writeFileSync("build/nullifier.txt", publicSignals[0]); // output nullifier is first public signal

  console.log("\n✅ Wrote calldata + root/context/nullifier to build/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
