#!/usr/bin/env node
import { usage } from "./help.ts";
import { version } from "./version.ts";

const cliFlags = ["--demo", "--summary", "--out", "--site", "--at", "--help", "-h", "--version", "-v"];

function flagName(arg: string): string {
  return arg.split("=")[0] ?? arg;
}

function wantsCli(argv: string[]): boolean {
  return argv.some((arg) => cliFlags.includes(flagName(arg)));
}

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write(usage);
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  process.stdout.write(`${version}\n`);
  process.exit(0);
}

if (wantsCli(args)) {
  await import("./cli.ts");
} else {
  await import("./server.ts");
}
