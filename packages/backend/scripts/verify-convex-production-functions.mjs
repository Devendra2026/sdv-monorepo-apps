/**
 * Verify required public Convex functions exist on self-hosted production.
 * Prints only pass/fail lines — never logs env values or full function-spec output.
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

const REQUIRED = [
  "analytics/queries:homeBundle",
  "analytics/queries:recentActivity",
  "users/queries:currentUser",
];

function runFunctionSpec() {
  const childEnv = { ...process.env };
  delete childEnv.CONVEX_DEPLOYMENT;

  const convexArgs = [
    "exec",
    "convex",
    "function-spec",
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
    let stdout = "";
    let stderr = "";

    const child = spawn(command, args, {
      cwd: backendRoot,
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `function-spec exited with code ${code ?? "unknown"}${stderr ? `: ${stderr.trim()}` : ""}`,
          ),
        );
        return;
      }
      resolve(stdout);
    });
  });
}

function collectIdentifiers(spec) {
  const ids = new Set();

  const visit = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }
    if (value && typeof value === "object") {
      for (const key of ["identifier", "name", "path", "functionName"]) {
        if (typeof value[key] === "string") {
          ids.add(value[key]);
        }
      }
      for (const nested of Object.values(value)) {
        visit(nested);
      }
    }
  };

  visit(spec);
  return ids;
}

function normalizeIdentifier(id) {
  return id.replaceAll("/", ":").replace(/:+/g, ":");
}

function hasRequiredPath(identifiers, requiredPath) {
  const normalizedRequired = normalizeIdentifier(requiredPath);
  for (const id of identifiers) {
    const normalized = normalizeIdentifier(id);
    if (
      normalized === normalizedRequired ||
      normalized.endsWith(`:${requiredPath.split(":").at(-1)}`) &&
      normalized.includes(requiredPath.split("/")[0] ?? "")
    ) {
      return true;
    }
  }
  return identifiers.has(requiredPath);
}

async function main() {
  try {
    await access(envFile);
  } catch {
    console.error("Verify failed: packages/backend/.env.production is missing.");
    process.exit(1);
  }

  let raw;
  try {
    raw = await runFunctionSpec();
  } catch (error) {
    console.error("Verify failed.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  let spec;
  try {
    spec = JSON.parse(raw);
  } catch {
    console.error("Verify failed: could not parse function-spec JSON.");
    process.exit(1);
  }

  const identifiers = collectIdentifiers(spec);
  let missing = 0;

  for (const path of REQUIRED) {
    if (hasRequiredPath(identifiers, path)) {
      console.log(`OK ${path}`);
    } else {
      console.log(`MISSING ${path}`);
      missing += 1;
    }
  }

  if (missing > 0) {
    process.exit(1);
  }

  console.log("All required public functions are registered.");
}

await main();
