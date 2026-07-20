// Drop-in replacement for the Claude-artifact `window.storage` API,
// backed by the browser's own localStorage so quotes persist between
// visits on this device without any server or account.
//
// Same shape as before: get / set / delete / list, all async.
// "shared" is ignored here — this app is single-user on one device.

function safeParseKeys() {
  try {
    return Object.keys(window.localStorage);
  } catch {
    return [];
  }
}

const storage = {
  async get(key) {
    try {
      const value = window.localStorage.getItem(key);
      return value === null ? null : { key, value, shared: false };
    } catch (e) {
      throw e;
    }
  },

  async set(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return { key, value, shared: false };
    } catch (e) {
      // Most likely quota exceeded (rare — quotes are text-only, photos are stripped before save)
      throw e;
    }
  },

  async delete(key) {
    try {
      window.localStorage.removeItem(key);
      return { key, deleted: true, shared: false };
    } catch (e) {
      throw e;
    }
  },

  async list(prefix) {
    const keys = safeParseKeys().filter((k) => !prefix || k.startsWith(prefix));
    return { keys, prefix, shared: false };
  },
};

if (typeof window !== "undefined") {
  window.storage = storage;
}

export default storage;
