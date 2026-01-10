import { execSync } from "child_process";
import fs from "fs";
import path from "path";

function run(cmd: string) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

function runCapture(cmd: string): string {
  console.log(`\n> ${cmd}`);
  return execSync(cmd).toString();
}

// Shared ptau path - reused across all circuits
const PTAU_DIR = "build/ptau";
const PTAU_FINAL = `${PTAU_DIR}/pot12_final.ptau`;

/**
 * Generate or reuse Powers of Tau ceremony artifacts.
 * 
 * ⚠️ PRODUCTION NOTE:
 * - Do NOT generate ptau locally in production
 * - Use a public ceremony artifact (e.g., Hermez, Polygon)
 * - Or run your own multi-party ceremony
 * - Store checksums/transcripts and verify before use
 */
function ensurePtau() {
  fs.mkdirSync(PTAU_DIR, { recursive: true });
  
  if (fs.existsSync(PTAU_FINAL)) {
    console.log("\n✅ Reusing existing ptau:", PTAU_FINAL);
    return;
  }

  console.log("\n⚙️ Generating Powers of Tau (one-time setup)...");
  run(`npx snarkjs powersoftau new bn128 12 ${PTAU_DIR}/pot12_0000.ptau -v`);
  run(
    `npx snarkjs powersoftau contribute ${PTAU_DIR}/pot12_0000.ptau ${PTAU_DIR}/pot12_0001.ptau --name='demo' -v`
  );
  run(
    `npx snarkjs powersoftau prepare phase2 ${PTAU_DIR}/pot12_0001.ptau ${PTAU_FINAL} -v`
  );
  console.log("\n✅ Powers of Tau ceremony complete:", PTAU_FINAL);
}

async function main() {
  fs.mkdirSync("build", { recursive: true });
  fs.mkdirSync("contracts", { recursive: true });
  fs.mkdirSync("circuits", { recursive: true });

  // 1) Compile circuit -> R1CS + WASM
  run("circom circuits/square.circom --r1cs --wasm --sym -o build");

  // 2) Create input
  const input = { x: 7 };
  fs.writeFileSync("build/input.json", JSON.stringify(input, null, 2));

  // 3) Generate witness
  // Circom outputs CommonJS helpers; copy both to .cjs and rewrite the internal require
  run("cp build/square_js/generate_witness.js build/square_js/generate_witness.cjs");
  run("cp build/square_js/witness_calculator.js build/square_js/witness_calculator.cjs");
  const generateWitnessPath = "build/square_js/generate_witness.cjs";
  const generateWitnessSource = fs.readFileSync(generateWitnessPath, "utf8");
  fs.writeFileSync(
    generateWitnessPath,
    generateWitnessSource.replace(
      "./witness_calculator.js",
      "./witness_calculator.cjs"
    )
  );
  run(
    "node build/square_js/generate_witness.cjs build/square_js/square.wasm build/input.json build/witness.wtns"
  );

  // 4) Powers of Tau ceremony (cached - only runs once)
  ensurePtau();

  // 5) Groth16 setup + zkey
  run(
    `npx snarkjs groth16 setup build/square.r1cs ${PTAU_FINAL} build/square_0000.zkey`
  );
  run(
    "npx snarkjs zkey contribute build/square_0000.zkey build/square_final.zkey --name='demo2' -v"
  );
  run(
    "npx snarkjs zkey export verificationkey build/square_final.zkey build/verification_key.json"
  );

  // 6) Prove
  run(
    "npx snarkjs groth16 prove build/square_final.zkey build/witness.wtns build/proof.json build/public.json"
  );

  // 7) Verify off-chain
  run(
    "npx snarkjs groth16 verify build/verification_key.json build/public.json build/proof.json"
  );

  // 8) Export Solidity verifier
  run(
    "npx snarkjs zkey export solidityverifier build/square_final.zkey contracts/Verifier.sol"
  );

  // 9) Generate Solidity calldata and save for tests
  const calldata = runCapture(
    "npx snarkjs generatecall build/public.json build/proof.json"
  );

  fs.writeFileSync("build/square_calldata.txt", calldata);
  console.log("\n✅ Calldata written to build/square_calldata.txt");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
