// lib/pino-browser.ts
// Minimal stub for pino to avoid pulling in Node-only logging deps in the browser.

type LogLevel = "info" | "error" | "warn" | "debug" | "trace" | "fatal";

const noop = (..._args: unknown[]) => {};

function createLogger() {
  const logger: any = {};
  const levels: LogLevel[] = ["info", "error", "warn", "debug", "trace", "fatal"];

  for (const level of levels) {
    logger[level] = noop;
  }

  // child logger just returns the same no-op logger
  logger.child = () => logger;

  // support pino.transport() style usage if any lib calls it
  logger.transport = () => ({ on: noop });

  return logger;
}

const pino = (..._args: unknown[]) => createLogger();

// Also expose transport on the main function (some libs call pino.transport)
(pino as any).transport = () => ({ on: noop });

export default pino;
