import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const services = [
  {
    name: "backend",
    color: "\x1b[36m",
    command: npmCommand,
    args: ["--prefix", "backend", "run", "dev"],
  },
  {
    name: "frontend",
    color: "\x1b[32m",
    command: npmCommand,
    args: ["--prefix", "frontend", "run", "dev"],
  },
];

const resetColor = "\x1b[0m";
const children = [];

function prefixOutput(service, data, stream) {
  const lines = data.toString().split(/\r?\n/);

  for (const line of lines) {
    if (line.trim() === "") {
      continue;
    }

    stream.write(`${service.color}[${service.name}]${resetColor} ${line}\n`);
  }
}

function stopAll(signal = "SIGTERM") {
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

for (const service of services) {
  const child = spawn(service.command, service.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
  });

  children.push(child);

  child.stdout.on("data", (data) => prefixOutput(service, data, process.stdout));
  child.stderr.on("data", (data) => prefixOutput(service, data, process.stderr));

  child.on("exit", (code, signal) => {
    if (code && code !== 0) {
      console.error(
        `${service.color}[${service.name}]${resetColor} exited with code ${code}`
      );
      stopAll();
      process.exitCode = code;
    }

    if (signal) {
      console.error(
        `${service.color}[${service.name}]${resetColor} stopped by ${signal}`
      );
    }
  });
}

process.on("SIGINT", () => {
  stopAll("SIGINT");
  process.exit();
});

process.on("SIGTERM", () => {
  stopAll("SIGTERM");
  process.exit();
});
