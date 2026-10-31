import { spawnSync } from "node:child_process";

const names = ["ADMITAD_CLIENT_ID", "ADMITAD_CLIENT_SECRET", "base64_header"];
for (const name of names) {
  const value = process.env[name];
  if (!value) {
    console.log("Skipping absent build secret:", name);
    continue;
  }
  const result = spawnSync("npx", ["wrangler", "secret", "put", name], {
    input: value,
    encoding: "utf8",
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    // Never print secret values or the command's stdin.
    process.stderr.write("Failed to provision Worker runtime secret " + name + ": " + (result.stderr || "unknown error"));
    process.exit(result.status || 1);
  }
  console.log("Provisioned Worker runtime secret:", name);
}
const deploy = spawnSync("npx", ["wrangler", "deploy"], {
  encoding: "utf8",
  env: process.env,
  stdio: "inherit"
});
process.exit(deploy.status || 0);
