import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";

function createNpmCommand(args) {
  if (isWindows) {
    return [
      {
        command: "npm.cmd",
        args,
      },
      {
        command: "cmd.exe",
        args: ["/d", "/s", "/c", ["npm", ...args].join(" ")],
      },
    ];
  }

  return [
    {
      command: "npm",
      args,
    },
  ];
}

const services = [
  {
    name: "backend",
    color: "\x1b[36m",
    commands: createNpmCommand(["--prefix", "backend", "run", "dev"]),
  },
  {
    name: "frontend",
    color: "\x1b[32m",
    commands: createNpmCommand(["--prefix", "frontend", "run", "dev"]),
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
  let child;
  let lastError;

  for (const candidate of service.commands) {
    try {
      child = spawn(candidate.command, candidate.args, {
        cwd: process.cwd(),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!child) {
    console.error(
      `${service.color}[${service.name}]${resetColor} could not start: ${lastError.message}`
    );
    stopAll();
    process.exit(1);
  }

  children.push(child);

  child.stdout.on("data", (data) => prefixOutput(service, data, process.stdout));
  child.stderr.on("data", (data) => prefixOutput(service, data, process.stderr));

  child.on("error", (error) => {
    console.error(
      `${service.color}[${service.name}]${resetColor} could not start: ${error.message}`
    );
    stopAll();
    process.exitCode = 1;
  });

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
