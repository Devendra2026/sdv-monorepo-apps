/**
 * Self-hosted Convex production backup via logical CLI export (documents ZIP).
 *
 * Primary DR for large DBs: use scripts/backup-convex-volume.sh (copies /convex/data,
 * including _storage). This script is for portable document restore — default is
 * documents-only. Prefer scheduling at ~03:00 UTC (well clear of retention at 21:00 UTC).
 *
 * Export flow (convex@1.42.1):
 *   1. POST {CONVEX_SELF_HOSTED_URL}/api/export/request/zip[?includeStorage=true]
 *   2. WebSocket wss://{host}/api/{version}/sync monitors _system/cli/exports:getLatest
 *   3. GET {CONVEX_SELF_HOSTED_URL}/api/export/zip/{timestamp} downloads the ZIP
 *
 * Safety:
 *   - Writes only under packages/backend/backup/convex (or BACKUP_DIR).
 *   - Prunes oldest matching ZIPs beyond MAX_BACKUPS (default 30).
 *   - Does not VACUUM SQLite, delete Docker volumes, or touch production mounts.
 *   - Copy successful ZIPs off the Dokploy host; same-disk copies are not DR.
 *   - Do not restart the Convex backend mid-export; on failure wait for healthy
 *     GET /version then re-run this script.
 *   - Aborts during retention quiet window (20:30–22:30 UTC) unless
 *     BACKUP_FORCE=1 — overlapping retention deletes cause queryPage timeouts.
 *   - Default documents-only; BACKUP_INCLUDE_STORAGE=1 is discouraged (use volume
 *     backup for _storage). Never stack storage-inclusive exports under low disk.
 *
 * --env-file is supported via shared deployment selection options but is not listed
 * in `convex export --help`. If a future CLI removes it, load .env.production into
 * childEnv manually (still stripping CONVEX_DEPLOYMENT).
 */
import { spawn } from "node:child_process";
import { mkdir, open, readdir, stat, statfs, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const backupDir = process.env.BACKUP_DIR
  ? path.resolve(process.env.BACKUP_DIR)
  : path.join(backendRoot, "backup", "convex");
const MAX_BACKUPS = Math.max(
  1,
  Number.parseInt(process.env.MAX_BACKUPS ?? "30", 10) || 30,
);
const MIN_FREE_BYTES = Math.max(
  512 * 1024 * 1024,
  Number.parseInt(process.env.BACKUP_MIN_FREE_BYTES ?? String(2 * 1024 * 1024 * 1024), 10) ||
  2 * 1024 * 1024 * 1024,
);
const BACKUP_PATTERN = /^convex-.*\.zip$/;
const ZIP_LOCAL_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/**
 * App retention cron fires at 21:00 UTC (`convex/crons.ts`). Overlapping a platform
 * ZIP export with those deletes causes SQLite contention and 15s queryPage timeouts.
 * Block logical exports in [20:30, 22:30) UTC unless BACKUP_FORCE=1.
 */
const RETENTION_QUIET_START_MINUTES_UTC = 20 * 60 + 30;
const RETENTION_QUIET_END_MINUTES_UTC = 22 * 60 + 30;

function utcMinutesOfDay(date = new Date()) {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function isInsideRetentionQuietWindow(date = new Date()) {
  const minutes = utcMinutesOfDay(date);
  return (
    minutes >= RETENTION_QUIET_START_MINUTES_UTC &&
    minutes < RETENTION_QUIET_END_MINUTES_UTC
  );
}

function assertOutsideRetentionQuietWindow() {
  const force =
    process.env.BACKUP_FORCE === "1" || process.env.BACKUP_FORCE === "true";
  if (!isInsideRetentionQuietWindow()) {
    return;
  }
  if (force) {
    console.warn(
      "WARN: BACKUP_FORCE=1 — running logical export inside retention quiet window (20:30–22:30 UTC). Expect SQLite contention / queryPage timeouts.",
    );
    return;
  }
  console.error(
    "Backup aborted: inside retention quiet window (20:30–22:30 UTC).",
  );
  console.error(
    "App retention (demand-notice jobs + notifications) runs at 21:00 UTC and contends with platform export queryPage reads.",
  );
  console.error(
    "Preferred schedule: ~03:00 UTC. For full DR including _storage, use scripts/backup-convex-volume.sh.",
  );
  console.error("Override only if necessary: BACKUP_FORCE=1");
  process.exit(1);
}

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

async function assertEnoughDiskSpace(targetDir) {
  try {
    const fsStat = await statfs(targetDir);
    const free = fsStat.bavail * fsStat.bsize;
    if (free < MIN_FREE_BYTES) {
      console.error(
        `Backup aborted: only ${free} bytes free under ${targetDir}; need at least ${MIN_FREE_BYTES} (set BACKUP_MIN_FREE_BYTES to override).`,
      );
      process.exit(1);
    }
    console.log(`Free disk for backups: ${free} bytes (min ${MIN_FREE_BYTES}).`);

    // Non-destructive heuristic: warn (do not abort) if free < 2× newest prior ZIP.
    const prior = await findNewestPriorBackupSize(targetDir);
    if (prior !== null) {
      const needed = prior * 2;
      if (free < needed) {
        console.warn(
          `WARN: free disk (${free} bytes) is less than 2× newest prior backup (${prior} bytes → need ~${needed}). Export may fail mid-write; free space or set BACKUP_DIR on a larger volume. Continuing.`,
        );
      } else {
        console.log(
          `Prior backup size check OK: newest ZIP ${prior} bytes; free ${free} ≥ 2× (${needed}).`,
        );
      }
    }
  } catch (error) {
    console.warn(
      "Could not check free disk space (statfs failed); continuing.",
      error instanceof Error ? error.message : String(error),
    );
  }
}

/** Newest matching ZIP size in bytes, or null if none. Read-only. */
async function findNewestPriorBackupSize(targetDir) {
  try {
    const entries = await readdir(targetDir);
    let newest = null;
    for (const entry of entries) {
      if (!BACKUP_PATTERN.test(entry)) {
        continue;
      }
      const filePath = path.join(targetDir, entry);
      const fileStat = await stat(filePath);
      if (!fileStat.isFile() || fileStat.size === 0) {
        continue;
      }
      if (newest === null || fileStat.mtimeMs > newest.mtimeMs) {
        newest = { mtimeMs: fileStat.mtimeMs, size: fileStat.size };
      }
    }
    return newest?.size ?? null;
  } catch {
    return null;
  }
}

function runConvexExport(absoluteBackupPath) {
  const childEnv = { ...process.env };
  delete childEnv.CONVEX_DEPLOYMENT;

  // Default: DB-only export. Including file storage (_storage) is very heavy on
  // self-hosted SQLite hosts and has caused process restarts / queryPage timeouts.
  // Prefer scripts/backup-convex-volume.sh for _storage DR. Opt in only off-peak.
  const includeStorage =
    process.env.BACKUP_INCLUDE_STORAGE === "1" ||
    process.env.BACKUP_INCLUDE_STORAGE === "true";

  const convexArgs = [
    "exec",
    "convex",
    "export",
    "--env-file",
    ".env.production",
    ...(includeStorage ? ["--include-file-storage"] : []),
    "--path",
    absoluteBackupPath,
  ];

  if (includeStorage) {
    console.warn(
      "WARN: BACKUP_INCLUDE_STORAGE=1 — documents + _storage ZIP. Prefer volume backup for file storage DR; this mode is heavy on SQLite.",
    );
  } else {
    console.log(
      "Backup mode: documents only. For _storage / full DR use scripts/backup-convex-volume.sh (not BACKUP_INCLUDE_STORAGE).",
    );
  }

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

  const handle = await open(absoluteBackupPath, "r");
  try {
    const header = Buffer.alloc(4);
    const { bytesRead } = await handle.read(header, 0, 4, 0);
    if (
      bytesRead < 4 ||
      !header.equals(ZIP_LOCAL_HEADER)
    ) {
      console.error(
        "Backup failed: file exists but is not a ZIP local-file header (PK\\x03\\x04).",
      );
      process.exit(1);
    }
  } finally {
    await handle.close();
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
  console.log("");
  console.log(
    "Copy this ZIP off the application host (object storage / offline media).",
  );
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
  assertOutsideRetentionQuietWindow();

  await mkdir(backupDir, { recursive: true });
  await assertEnoughDiskSpace(backupDir);

  const timestamp = formatTimestamp(new Date());
  const filename = `convex-${timestamp}.zip`;
  const absoluteBackupPath = path.join(backupDir, filename);

  console.log(`Starting Convex export to ${filename}...`);
  console.log(
    "Schedule tip: prefer ~03:00 UTC; avoid 20:30–22:30 UTC (app retention).",
  );
  console.log(`Local ZIP retention: keep newest ${MAX_BACKUPS} matching ZIP(s).`);

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
  console.log(
    "DR reminder: copy this ZIP off the Dokploy/EC2 host (object storage or offline media).",
  );
  console.log(
    "Same-disk copies are not disaster recovery. Do not restart Convex mid-export next time.",
  );
  printZipVerificationHint(absoluteBackupPath);
}

await main();
