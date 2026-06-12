const sessions = new Map();

export function getMemory(sessionId) {
  return sessions.get(sessionId) || {};
}

export function updateMemory(sessionId, updates) {
  const current = getMemory(sessionId);

  sessions.set(sessionId, {
    ...current,
    ...updates,
  });
}