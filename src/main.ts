#!/usr/bin/env bun
import { closeDatabaseOnExit, handleFatalError, run } from "@/app";

closeDatabaseOnExit();

try {
  process.exit(await run());
} catch (err) {
  process.exit(await handleFatalError(err));
}
