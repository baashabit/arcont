import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../../");

async function hasCommand(command: string, args: string[] = ["--version"]) {
  try {
    const result = await execFileAsync(command, args, { timeout: 5000 });
    return {
      ok: true,
      output: `${result.stdout}${result.stderr}`.trim()
    };
  } catch (error) {
    return {
      ok: false,
      output: error instanceof Error ? error.message : String(error)
    };
  }
}

async function hasFile(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function printStatus(label: string, ok: boolean, detail: string) {
  console.log(`${ok ? "OK" : "MISSING"}  ${label}: ${detail}`);
}

async function main() {
  const nodeVersion = process.version;
  const docker = await hasCommand("docker");
  const dockerCompose = docker.ok ? await hasCommand("docker", ["compose", "version"]) : { ok: false, output: "docker missing" };
  const psql = await hasCommand("psql");
  const envExample = await hasFile(path.join(repoRoot, ".env.example"));
  const envFile = await hasFile(path.join(repoRoot, ".env"));

  console.log("ARCONT local environment doctor");
  console.log(`Node: ${nodeVersion}`);

  printStatus("docker", docker.ok, docker.ok ? docker.output : "Install Docker/Podman-compatible runtime");
  printStatus(
    "docker compose",
    dockerCompose.ok,
    dockerCompose.ok ? dockerCompose.output : "Required for `docker compose up -d postgres`"
  );
  printStatus("psql", psql.ok, psql.ok ? psql.output : "Optional, but useful for direct DB inspection");
  printStatus(".env.example", envExample, envExample ? "Template available" : "Repository template missing");
  printStatus(".env", envFile, envFile ? "Local overrides present" : "Optional; scripts can run with inline env vars");

  if (!docker.ok || !dockerCompose.ok) {
    console.log("");
    console.log("Next action:");
    console.log("1. Install Docker Desktop or Docker Engine with Compose support.");
    console.log("2. Run `docker compose up -d postgres`.");
    console.log("3. Run `npm run db:migrate -w @arcont/api`.");
    console.log("4. Run `npm run db:bootstrap-local -w @arcont/api`.");
    console.log("5. Run `npm run db:seed-demo-operations -w @arcont/api`.");
    process.exitCode = 1;
    return;
  }

  console.log("");
  console.log("Runtime baseline is good enough to provision the local demo database.");
}

await main();
