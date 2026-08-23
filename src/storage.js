// Drop-in replacement for Claude's artifact-only `window.storage` API,
// backed by the browser's localStorage instead. Same method names/shapes
// so the rest of the app doesn't need to change.
//
// NOTE: localStorage is per-browser, per-device — it does NOT sync across
// devices or persist if the user clears site data. There's no "shared"
// concept here (the `shared` param is accepted but ignored) since this is
// a single-user local tool, not a multi-user Claude artifact.

const PREFIX = "content-studio:";

function read() {
  try {
    const raw = localStorage.getItem(PREFIX + "__store__");
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function write(store) {
  localStorage.setItem(PREFIX + "__store__", JSON.stringify(store));
}

export const storage = {
  async get(key) {
    const store = read();
    if (!(key in store)) return null;
    return { key, value: store[key], shared: false };
  },
  async set(key, value) {
    const store = read();
    store[key] = value;
    write(store);
    return { key, value, shared: false };
  },
  async delete(key) {
    const store = read();
    const existed = key in store;
    delete store[key];
    write(store);
    return { key, deleted: existed, shared: false };
  },
  async list(prefix = "") {
    const store = read();
    const keys = Object.keys(store).filter((k) => k.startsWith(prefix));
    return { keys, prefix, shared: false };
  },
};

// Install it as window.storage so App.jsx (copied straight from the
// Claude artifact version) works completely unmodified.
if (typeof window !== "undefined") {
  window.storage = storage;
}
