const DEFAULT_API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export const getApiBaseUrl = () => DEFAULT_API_BASE;

export const buildApiUrl = (path: string) => {
  let normalizedPath = path.startsWith("/") ? path : `/${path}`;
  
  if (!DEFAULT_API_BASE) {
    return normalizedPath;
  }

  // Prevent duplication of /api if both DEFAULT_API_BASE and the path contain it.
  const baseEndsWithApi = DEFAULT_API_BASE.endsWith("/api") || DEFAULT_API_BASE === "/api";
  if (baseEndsWithApi && (normalizedPath === "/api" || normalizedPath.startsWith("/api/"))) {
    normalizedPath = normalizedPath.substring(4);
  }

  return `${DEFAULT_API_BASE}${normalizedPath}`;
};

export const apiFetch = async (path: string, init: RequestInit = {}) => {
  const url = buildApiUrl(path);
  const headers = new Headers(init.headers || {});

  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const errorPayload = await response.json();
      message = errorPayload?.message || errorPayload?.error || message;
    } catch {
      // Ignore parse errors and fall back to the default message.
    }

    throw new Error(message);
  }

  return response;
};

export const apiJson = async (path: string, init: RequestInit = {}) => {
  const response = await apiFetch(path, init);
  if (response.status === 204) return null;
  return response.json();
};
