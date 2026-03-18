import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const packageJsonPath = path.join(rootDir, "package.json");
const dryRun = process.argv.includes("--dry-run");

async function main() {
  ensureCleanWorktree();
  ensureGhAuthenticated();

  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
  const currentVersion = String(packageJson.version || "").trim();
  if (!isValidVersion(currentVersion)) {
    throw new Error(`package.json has an invalid version: ${currentVersion || "<empty>"}`);
  }

  const releasePlan = await promptForReleasePlan(currentVersion);
  const nextVersion = releasePlan.version;
  const tagName = `v${nextVersion}`;

  ensureTagDoesNotExist(tagName);

  if (releasePlan.bumped && !dryRun) {
    packageJson.version = nextVersion;
    await fs.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
  }

  logStep(`Preparing release ${tagName}${dryRun ? " (dry run)" : ""}`);
  run("npm", ["run", "lint"]);
  run("npm", ["test"]);
  run("npm", ["run", "build"]);
  run("npm", ["run", "test:e2e"]);

  if (releasePlan.bumped) {
    run("git", ["add", "package.json"]);
    run("git", ["commit", "-m", `Bump version to ${nextVersion}`]);
  }

  run("git", ["push", "origin", "main"]);
  run("git", ["tag", tagName]);
  run("git", ["push", "origin", `refs/tags/${tagName}`]);
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
    throw new Error(`Tag ${tagName} already exists locally.`);
  }
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
      return {
        bumped: false,
        version: currentVersion
      };
    }

    if (selection === "5") {
      const customVersion = (await rl.question("Enter the version to publish (for example 1.2.3): ")).trim();
      if (!isValidVersion(customVersion)) {
        throw new Error(`Invalid version: ${customVersion}`);
      }
      return {
        bumped: customVersion !== currentVersion,
        version: customVersion
      };
    }

    const bumpKind = selection === "2" ? "patch" : selection === "3" ? "minor" : "major";
    return {
      bumped: true,
      version: bumpVersion(currentVersion, bumpKind)
    };
  } finally {
    rl.close();
  }
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
