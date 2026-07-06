/**
 * Self-hosted Convex production backup via logical CLI export.
 *
 * Export flow (convex@1.42.1):
 *   1. POST {CONVEX_SELF_HOSTED_URL}/api/export/request/zip?includeStorage=true
 *   2. WebSocket wss://{host}/api/{version}/sync monitors _system/cli/exports:getLatest
 *   3. GET {CONVEX_SELF_HOSTED_URL}/api/export/zip/{timestamp} downloads the ZIP
 *
 * --env-file is supported via shared deployment selection options but is not listed
 * in `convex export --help`. If a future CLI removes it, load .env.production into
 * childEnv manually (still stripping CONVEX_DEPLOYMENT).
 */
import { spawn } from "node:child_process";
import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const backupDir = path.join(backendRoot, "backup", "convex");
const MAX_BACKUPS = 30;
const BACKUP_PATTERN = /^convex-.*\.zip$/;

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");

  return (
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join(
      "-",
    ) +
    "_" +
    [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join(
      "-",
    )
  );
}

function runConvexExport(absoluteBackupPath) {
  const childEnv = { ...process.env };
  delete childEnv.CONVEX_DEPLOYMENT;

  const convexArgs = [
    "exec",
    "convex",
    "export",
    "--env-file",
    ".env.production",
    "--include-file-storage",
    "--path",
    absoluteBackupPath,
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

      reject(new Error(`Convex export exited with code ${code ?? "unknown"}`));
    });
  });
}

async function validateBackupZip(absoluteBackupPath) {
  let zipStat;

  try {
    zipStat = await stat(absoluteBackupPath);
  } catch {
    console.error(
      "Backup failed: export finished but ZIP is missing or empty.",
    );
    process.exit(1);
  }

  if (!zipStat.isFile() || zipStat.size === 0) {
    console.error(
      "Backup failed: export finished but ZIP is missing or empty.",
    );
    process.exit(1);
  }

  return zipStat;
}

function printZipVerificationHint(absoluteBackupPath) {
  console.log(
    "ZIP entry names were not auto-inspected (no zip library in this repo).",
  );
  console.log("Verify table data and _storage/ contents manually:");
  console.log("");
  console.log("  Windows (PowerShell):");
  console.log('    Add-Type -AssemblyName System.IO.Compression.FileSystem');
  console.log(
    `    $zip = [System.IO.Compression.ZipFile]::OpenRead("${absoluteBackupPath.replace(/\\/g, "\\\\")}")`,
  );
  console.log("    $zip.Entries | Select-Object -ExpandProperty FullName");
  console.log("    $zip.Dispose()");
  console.log("");
  console.log("  Linux/macOS:");
  console.log(`    unzip -l "${absoluteBackupPath}"`);
}

async function pruneOldBackups() {
  const entries = await readdir(backupDir);
  const backups = [];

  for (const entry of entries) {
    if (!BACKUP_PATTERN.test(entry)) {
      continue;
    }

    const filePath = path.join(backupDir, entry);
    const fileStat = await stat(filePath);
    backups.push({ name: entry, mtimeMs: fileStat.mtimeMs });
  }

  backups.sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const backup of backups.slice(MAX_BACKUPS)) {
    await unlink(path.join(backupDir, backup.name));
    console.log(`Deleted old backup: ${backup.name}`);
  }
}

async function main() {
  await mkdir(backupDir, { recursive: true });

  const timestamp = formatTimestamp(new Date());
  const filename = `convex-${timestamp}.zip`;
  const absoluteBackupPath = path.join(backupDir, filename);

  console.log(`Starting Convex export to ${filename}...`);

  try {
    await runConvexExport(absoluteBackupPath);
  } catch (error) {
    console.error("Backup failed.");
    console.error(
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }

  const zipStat = await validateBackupZip(absoluteBackupPath);

  await pruneOldBackups();

  console.log(`Backup complete: ${absoluteBackupPath}`);
  console.log(`Backup size: ${zipStat.size} bytes`);
  printZipVerificationHint(absoluteBackupPath);
}

await main();
