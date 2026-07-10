/**
 * Deploy Convex functions to the self-hosted production backend.
 *
 * Uses CONVEX_SELF_HOSTED_URL and CONVEX_SELF_HOSTED_ADMIN_KEY from
 * packages/backend/.env.production (never commit that file).
 *
 * Strips CONVEX_DEPLOYMENT so the CLI does not route to Convex Cloud when
 * .env.local also defines a dev deployment.
 */
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const envFile = path.join(backendRoot, ".env.production");

function runConvexDeploy() {
  const childEnv = { ...process.env };
  delete childEnv.CONVEX_DEPLOYMENT;

  const convexArgs = [
    "exec",
    "convex",
    "deploy",
    "--env-file",
    ".env.production",
  ];

  const isWindows = process.platform === "win32";

  const command = isWindows
    ? process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe"
    : "pnpm";

  const args = isWindows
    ? ["/d", "/s", "/c", "pnpm", ...convexArgs]
    : convexArgs;

  return new Promise((resolve, reject) => {
    let settled = false;

    const child = spawn(command, args, {
      cwd: backendRoot,
      env: childEnv,
      stdio: "inherit",
      shell: false,
    });

    child.once("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    });

    child.once("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;

      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Convex deploy exited with code ${code ?? "unknown"}`));
    });
  });
}

async function main() {
  try {
    await access(envFile);
  } catch {
    console.error(
      "Deploy failed: packages/backend/.env.production is missing.",
    );
    console.error(
      "Copy packages/backend/.env.example to .env.production and set CONVEX_SELF_HOSTED_URL and CONVEX_SELF_HOSTED_ADMIN_KEY.",
    );
    process.exit(1);
  }

  console.log("Deploying Convex functions to self-hosted production...");

  try {
    await runConvexDeploy();
  } catch (error) {
    console.error("Deploy failed.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  console.log("Self-hosted Convex deploy complete.");
}

await main();
