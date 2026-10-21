#!/usr/bin/env node
import { spawn } from "child_process";

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: node scripts/run-with-timeout.mjs <timeoutSeconds> <command> [args...]");
  process.exit(1);
}

const timeoutSec = parseInt(args[0], 10);
if (isNaN(timeoutSec) || timeoutSec <= 0) {
  console.error("Error: timeoutSeconds must be a positive integer");
  process.exit(1);
}

const command = args[1];
const cmdArgs = args.slice(2);

console.log(`[run-with-timeout] Executing "${command} ${cmdArgs.join(" ")}" with ${timeoutSec}s timeout...`);

// Spawn in detached mode to create a new process group for clean group termination
const fullCommand = [command, ...cmdArgs].join(" ");
const child = spawn(fullCommand, {
  stdio: ["inherit", "pipe", "pipe"],
  detached: true,
  shell: true,
});

const outputLines = [];
const MAX_TAIL = 50;

function recordOutput(chunk, isStderr = false) {
  const text = chunk.toString();
  if (isStderr) {
    process.stderr.write(text);
  } else {
    process.stdout.write(text);
  }
  const lines = text.split("\n");
  for (const line of lines) {
    if (line.length > 0) {
      outputLines.push(line);
      if (outputLines.length > MAX_TAIL) {
        outputLines.shift();
      }
    }
  }
}

child.stdout.on("data", (chunk) => recordOutput(chunk, false));
child.stderr.on("data", (chunk) => recordOutput(chunk, true));

let timedOut = false;

const timer = setTimeout(() => {
  timedOut = true;
  console.error(`\n[run-with-timeout] TIMEOUT EXCEEDED: Command ran longer than ${timeoutSec} seconds!`);
  console.error(`[run-with-timeout] Killing process group -${child.pid}...`);

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch (e) {
    // Process group may have already exited
  }

  setTimeout(() => {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (e) {
      // Ignored
    }

    console.error(`\n[run-with-timeout] Log tail (last ${outputLines.length} lines):`);
    console.error("--------------------------------------------------------------------------------");
    for (const l of outputLines) {
      console.error(l);
    }
    console.error("--------------------------------------------------------------------------------");
    process.exit(124);
  }, 2000);
}, timeoutSec * 1000);

child.on("close", (code) => {
  clearTimeout(timer);
  if (!timedOut) {
    process.exit(code ?? 0);
  }
});

child.on("error", (err) => {
  clearTimeout(timer);
  console.error(`[run-with-timeout] Failed to start command:`, err);
  process.exit(1);
});
