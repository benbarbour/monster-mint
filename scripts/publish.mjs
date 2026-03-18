import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const packageJsonPath = path.join(rootDir, "package.json");
const packageLockPath = path.join(rootDir, "package-lock.json");
const dryRun = process.argv.includes("--dry-run");

async function main() {
  ensureCleanWorktree();
  ensureGhAuthenticated();

  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
  const packageLock = JSON.parse(await fs.readFile(packageLockPath, "utf8"));
  const currentVersion = String(packageJson.version || "").trim();
  if (!isValidVersion(currentVersion)) {
    throw new Error(`package.json has an invalid version: ${currentVersion || "<empty>"}`);
  }
  const lockfileVersion = getLockfileVersion(packageLock);
  if (!isValidVersion(lockfileVersion)) {
    throw new Error(`package-lock.json has an invalid version: ${lockfileVersion || "<empty>"}`);
  }
  if (lockfileVersion !== currentVersion) {
    throw new Error(`package.json (${currentVersion}) and package-lock.json (${lockfileVersion}) are out of sync.`);
  }

  const latestTagVersion = getLatestVersionTag();
  if (latestTagVersion && latestTagVersion !== currentVersion) {
    throw new Error(`package version (${currentVersion}) does not match the latest git tag (${latestTagVersion}).`);
  }

  const releasePlan = await promptForReleasePlan(currentVersion);
  const nextVersion = releasePlan.version;
  const tagName = `v${nextVersion}`;

  if (!releasePlan.overwrite) {
    ensureTagDoesNotExist(tagName);
  }

  if (releasePlan.bumped && !dryRun) {
    packageJson.version = nextVersion;
    applyVersionToLockfile(packageLock, nextVersion);
    await fs.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
    await fs.writeFile(packageLockPath, `${JSON.stringify(packageLock, null, 2)}\n`, "utf8");
  }

  logStep(`Preparing release ${tagName}${dryRun ? " (dry run)" : ""}`);
  run("npm", ["run", "lint"]);
  run("npm", ["test"]);
  run("npm", ["run", "build"]);
  run("npm", ["run", "test:e2e"]);

  if (releasePlan.bumped) {
    run("git", ["add", "package.json", "package-lock.json"]);
    run("git", ["commit", "-m", `Bump version to ${nextVersion}`]);
  }

  run("git", ["push", "origin", "main"]);
  if (releasePlan.overwrite) {
    run("git", ["tag", "-f", tagName]);
    run("git", ["push", "origin", `refs/tags/${tagName}`, "--force"]);
    run("gh", ["release", "delete", tagName, "--yes"]);
  } else {
    run("git", ["tag", tagName]);
    run("git", ["push", "origin", `refs/tags/${tagName}`]);
  }
  run("gh", ["release", "create", tagName, "--generate-notes"]);

  output.write(`\n${dryRun ? "Dry run complete for" : "Published"} ${tagName}.\n`);
}

function ensureCleanWorktree() {
  if (dryRun) {
    return;
  }
  const status = capture("git", ["status", "--porcelain"]);
  if (status.stdout.trim()) {
    throw new Error("Refusing to publish with a dirty worktree. Commit or stash your changes first.");
  }
}

function ensureGhAuthenticated() {
  if (dryRun) {
    return;
  }
  run("gh", ["auth", "status"], { quiet: true });
}

function ensureTagDoesNotExist(tagName) {
  const localTag = capture("git", ["tag", "--list", tagName]).stdout.trim();
  if (localTag === tagName) {
    throw new Error(`Tag ${tagName} already exists locally. Choose a version bump or custom version.`);
  }
}

function getLatestVersionTag() {
  const latestTag = capture("git", ["tag", "--list", "v*", "--sort=-version:refname"]).stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!latestTag) {
    return "";
  }
  return latestTag.replace(/^v/, "");
}

async function promptForReleasePlan(currentVersion) {
  const rl = readline.createInterface({ input, output });
  try {
    output.write(`Current version: ${currentVersion}\n`);
    output.write("Select a version bump:\n");
    output.write(`  1. None (keep ${currentVersion})\n`);
    output.write(`  2. Patch (${bumpVersion(currentVersion, "patch")})\n`);
    output.write(`  3. Minor (${bumpVersion(currentVersion, "minor")})\n`);
    output.write(`  4. Major (${bumpVersion(currentVersion, "major")})\n`);
    output.write("  5. Custom version\n");

    const selection = (await rl.question("Choice [1-5]: ")).trim() || "1";
    if (!["1", "2", "3", "4", "5"].includes(selection)) {
      throw new Error(`Invalid choice: ${selection}`);
    }

    if (selection === "1") {
      const overwrite = await confirmOverwriteCurrentVersion(rl, currentVersion);
      return {
        bumped: false,
        overwrite: overwrite,
        version: currentVersion
      };
    }

    if (selection === "5") {
      const customVersion = (await rl.question("Enter the version to publish (for example 1.2.3): ")).trim();
      if (!isValidVersion(customVersion)) {
        throw new Error(`Invalid version: ${customVersion}`);
      }
      const overwrite = customVersion === currentVersion
        ? await confirmOverwriteCurrentVersion(rl, currentVersion)
        : false;
      return {
        bumped: customVersion !== currentVersion,
        overwrite: overwrite,
        version: customVersion
      };
    }

    const bumpKind = selection === "2" ? "patch" : selection === "3" ? "minor" : "major";
    return {
      bumped: true,
      overwrite: false,
      version: bumpVersion(currentVersion, bumpKind)
    };
  } finally {
    rl.close();
  }
}

async function confirmOverwriteCurrentVersion(rl, currentVersion) {
  const confirmation = (await rl.question(
    `Overwrite the existing ${currentVersion} release and retag it to the current commit? [y/N]: `
  )).trim().toLowerCase();
  if (!["y", "yes"].includes(confirmation)) {
    throw new Error("Release overwrite cancelled.");
  }
  return true;
}

function bumpVersion(version, kind) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Cannot ${kind}-bump non-semver version: ${version}`);
  }

  let major = Number(match[1]);
  let minor = Number(match[2]);
  let patch = Number(match[3]);

  if (kind === "patch") {
    patch += 1;
  } else if (kind === "minor") {
    minor += 1;
    patch = 0;
  } else if (kind === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  }

  return `${major}.${minor}.${patch}`;
}

function isValidVersion(version) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version);
}

function getLockfileVersion(packageLock) {
  if (packageLock && typeof packageLock.version === "string" && packageLock.version.trim()) {
    return packageLock.version.trim();
  }
  if (
    packageLock &&
    packageLock.packages &&
    packageLock.packages[""] &&
    typeof packageLock.packages[""].version === "string" &&
    packageLock.packages[""].version.trim()
  ) {
    return packageLock.packages[""].version.trim();
  }
  return "";
}

function applyVersionToLockfile(packageLock, version) {
  packageLock.version = version;
  if (packageLock.packages && packageLock.packages[""]) {
    packageLock.packages[""].version = version;
  }
}

function run(command, args, options = {}) {
  const display = `${command} ${args.join(" ")}`;
  if (!options.quiet) {
    logStep(display);
  }
  if (dryRun) {
    return;
  }

  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: options.quiet ? "ignore" : "inherit",
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${display}`);
  }
}

function capture(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8"
  });
  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    throw new Error(stderr || `Command failed: ${command} ${args.join(" ")}`);
  }
  return result;
}

function logStep(message) {
  output.write(`\n> ${message}\n`);
}

main().catch((error) => {
  console.error(`\nPublish failed: ${error.message}`);
  process.exitCode = 1;
});
