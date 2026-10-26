import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Run the installed CLI directly: no implicit downloads and no shell parsing.
export function snarkjs(...args: string[]): string {
  try {
    return execFileSync(process.execPath, [
      path.resolve("node_modules/snarkjs/build/cli.cjs"), ...args,
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; status?: number };
    // Show useful CLI diagnostics without printing contribution entropy.
    throw new Error(`snarkjs ${args[0]} failed (exit ${failure.status}):\n${failure.stdout ?? ""}${failure.stderr ?? ""}`);
  }
}

function ensureTrainingPtau(): string {
  const directory = "build/ptau";
  const final = `${directory}/pot12_final.ptau`;
  if (fs.existsSync(final)) return final;

  console.log("Creating a local, training-only Powers of Tau setup...");
  fs.mkdirSync(directory, { recursive: true });
  snarkjs("powersoftau", "new", "bn128", "12", `${directory}/initial.ptau`);
  snarkjs("powersoftau", "contribute", `${directory}/initial.ptau`,
    `${directory}/contributed.ptau`, "--name=local-training",
    `-e=${randomBytes(32).toString("hex")}`);
  const prepared = `${directory}/prepared.ptau`;
  snarkjs("powersoftau", "prepare", "phase2", `${directory}/contributed.ptau`, prepared);
  snarkjs("powersoftau", "verify", prepared);
  fs.renameSync(prepared, final);
  return final;
}

export function buildProof(circuit: string, input: Record<string, unknown>, verifier: string): void {
  const directory = `build/${circuit}`;
  fs.mkdirSync(directory, { recursive: true });
  fs.mkdirSync("contracts", { recursive: true });
  console.log(`Compiling and proving ${circuit}...`);
  execFileSync("circom", [
    `circuits/${circuit}.circom`, "--r1cs", "--wasm", "--sym",
    "-o", directory, "-l", "node_modules",
  ], { stdio: "inherit" });

  const r1cs = `${directory}/${circuit}.r1cs`;
  const wasm = `${directory}/${circuit}_js/${circuit}.wasm`;
  const witness = `${directory}/witness.wtns`;
  const key = `${directory}/final.zkey`;
  fs.writeFileSync(`${directory}/input.json`, JSON.stringify(input, null, 2));
  snarkjs("wtns", "calculate", wasm, `${directory}/input.json`, witness);
  snarkjs("wtns", "check", r1cs, witness);

  const ptau = ensureTrainingPtau();
  snarkjs("groth16", "setup", r1cs, ptau, `${directory}/initial.zkey`);
  snarkjs("zkey", "contribute", `${directory}/initial.zkey`, key,
    "--name=local-training", `-e=${randomBytes(32).toString("hex")}`);
  snarkjs("zkey", "verify", r1cs, ptau, key);
  snarkjs("zkey", "export", "verificationkey", key, `${directory}/verification_key.json`);
  snarkjs("groth16", "prove", key, witness, `${directory}/proof.json`, `${directory}/public.json`);
  snarkjs("groth16", "verify", `${directory}/verification_key.json`,
    `${directory}/public.json`, `${directory}/proof.json`);
  snarkjs("zkey", "export", "solidityverifier", key, verifier);
  writeCalldata(directory);
  console.log(`Verified ${circuit}; artifacts are in ${directory}/`);
}

export function writeCalldata(directory: string): void {
  const text = snarkjs("zkey", "export", "soliditycalldata",
    `${directory}/public.json`, `${directory}/proof.json`);
  fs.writeFileSync(`${directory}/calldata.json`, JSON.stringify(JSON.parse(`[${text}]`), null, 2));
}
