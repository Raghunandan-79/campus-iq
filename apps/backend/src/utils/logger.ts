import { config } from "../config/env.js";

function log(level: "info" | "warn" | "error", msg: string, fields?: unknown) {
  const entry = {
    level,
    msg,
    time: new Date().toISOString(),
    ...(fields ? { fields } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (msg: string, fields?: unknown) => log("info", msg, fields),
  warn: (msg: string, fields?: unknown) => log("warn", msg, fields),
  error: (msg: string, fields?: unknown) => log("error", msg, fields),
};

export { config };
