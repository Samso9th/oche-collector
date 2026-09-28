declare global {
  interface Window {
    __OCHE__?: { apiUrl?: string };
  }
}

/** Runtime config (written by the container at start) wins over the build-time value. */
export const API_URL = (window.__OCHE__?.apiUrl || import.meta.env.VITE_API_URL || "http://localhost:3100").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? "GET",
      credentials: "include",
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, `Can't reach the Oche server at ${API_URL}.`);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    const message = data.error ?? `Request failed (${res.status}).`;
    throw new ApiError(res.status, message.length > 300 ? `${message.slice(0, 300)}…` : message);
  }
  return data;
}

export const loginUrl = `${API_URL}/auth/login`;
export const setupUrl = (name?: string) => `${API_URL}/setup/start${name ? `?name=${encodeURIComponent(name)}` : ""}`;
