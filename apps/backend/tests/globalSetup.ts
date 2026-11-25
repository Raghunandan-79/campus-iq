import { rm } from "node:fs/promises";
import path from "node:path";

export default async function setup() {
  await rm(path.resolve(".pglite-test"), { recursive: true, force: true });
  await rm(path.resolve(".uploads-test"), { recursive: true, force: true });
}
