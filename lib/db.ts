import "server-only";

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { neon } from "@neondatabase/serverless";

/** Postgres (Neon) when DATABASE_URL is set, else null. */
export function database() {
  const url = process.env.DATABASE_URL?.trim();
  return url ? neon(url) : null;
}

/** Local stand-in when there's no database: a JSON file under .data/, outside production only. */
export function localFile(name: string) {
  if (process.env.NODE_ENV === "production") return null;
  const file = path.join(process.cwd(), ".data", name);
  return {
    async load<T>(fallback: T): Promise<T> {
      try {
        return JSON.parse(await readFile(file, "utf8")) as T;
      } catch {
        return fallback;
      }
    },
    async save(data: unknown) {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify(data, null, 2));
    },
  };
}
