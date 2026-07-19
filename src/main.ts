#!/usr/bin/env bun
import { closeDatabaseOnExit, handleFatalError, run } from "./app";

closeDatabaseOnExit();
run().catch(handleFatalError);
