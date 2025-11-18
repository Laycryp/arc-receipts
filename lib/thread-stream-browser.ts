// Minimal browser stub for `thread-stream` so Turbopack doesn't try to bundle the real Node.js version.

type ThreadStreamOptions = Record<string, unknown>;

export default class ThreadStream {
  constructor(_opts?: ThreadStreamOptions) {
    // no-op
  }

  write(_chunk: unknown) {
    // no-op
  }

  end() {
    // no-op
  }
}
