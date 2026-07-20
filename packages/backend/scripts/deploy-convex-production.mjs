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
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const envFile = path.join(backendRoot, ".env.production");

function parseEnvFile(contents) {
  /** @type {Record<string, string>} */
  const env = {};
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

/**
 * Traefik/Dokploy returns plain "404 page not found" when no router matches.
 * A healthy Convex backend responds on GET / with deployment running text
 * (or at least not Traefik's bare 404 body).
 */
async function preflightSelfHostedUrl(baseUrl) {
  const url = baseUrl.replace(/\/$/, "");
  let response;
  try {
    response = await fetch(`${url}/`, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Cannot reach CONVEX_SELF_HOSTED_URL (${url}): ${message}\n` +
      "Check DNS, TLS, and that the Convex backend container is running.",
    );
  }

  const body = (await response.text()).trim();
  const traefik404 =
    response.status === 404 &&
    (body === "404 page not found" || body.toLowerCase().includes("404 page not found"));

  if (traefik404) {
    throw new Error(
      [
        `CONVEX_SELF_HOSTED_URL (${url}) is not routing to Convex.`,
        'Public GET / returned Traefik\'s "404 page not found" — no Host router matches.',
        "",
        "Fix on the Dokploy host (not a local CLI bug):",
        "  1. Ensure the convex-backend container is running and healthy on port 3210.",
        "  2. Attach domain api.sdvedutech.in → that service on port 3210 (not 3211).",
        "  3. Confirm Traefik has Host(`api.sdvedutech.in`) → service:3210.",
        "  4. Re-test: curl -i https://api.sdvedutech.in/  (expect Convex running text, not Traefik 404).",
        "  5. Apply infra/convex-self-hosted/docker-compose.yml on Dokploy (api → :3210, site → :3211).",
        "  6. On the host: bash infra/convex-self-hosted/verify-convex-traefik-routing.sh",
        "  7. Optional: packages/backend/scripts/diagnose-convex-export-404.sh",
        "",
        "Until routing is fixed, convex deploy will keep failing on /api/get_config_hashes.",
      ].join("\n"),
    );
  }

  if (response.status >= 500) {
    throw new Error(
      `CONVEX_SELF_HOSTED_URL (${url}) returned HTTP ${response.status}. ` +
      "Convex backend may be down — check Dokploy container logs.",
    );
  }
}

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

  const fileEnv = parseEnvFile(await readFile(envFile, "utf8"));
  const selfHostedUrl =
    process.env.CONVEX_SELF_HOSTED_URL || fileEnv.CONVEX_SELF_HOSTED_URL;

  if (!selfHostedUrl) {
    console.error(
      "Deploy failed: CONVEX_SELF_HOSTED_URL is missing in .env.production.",
    );
    process.exit(1);
  }

  if (!process.env.CONVEX_SELF_HOSTED_ADMIN_KEY && !fileEnv.CONVEX_SELF_HOSTED_ADMIN_KEY) {
    console.error(
      "Deploy failed: CONVEX_SELF_HOSTED_ADMIN_KEY is missing in .env.production.",
    );
    process.exit(1);
  }

  console.log("Checking self-hosted Convex is reachable...");
  try {
    await preflightSelfHostedUrl(selfHostedUrl);
  } catch (error) {
    console.error("Deploy failed.");
    console.error(error instanceof Error ? error.message : String(error));
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
