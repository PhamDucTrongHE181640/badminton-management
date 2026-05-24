const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export function getAdminAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("netup_admin_access_token");
}

function getAdminRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("netup_admin_refresh_token");
}

function clearAdminTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("netup_admin_access_token");
  window.localStorage.removeItem("netup_admin_refresh_token");
}

async function refreshAdminTokens(): Promise<boolean> {
  const refreshToken = getAdminRefreshToken();
  if (!refreshToken) return false;

  const response = await fetch(`${apiBaseUrl}/api/v1/admin/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    clearAdminTokens();
    return false;
  }

  const payload = await response.json();
  if (!payload?.access_token || !payload?.refresh_token) {
    clearAdminTokens();
    return false;
  }

  window.localStorage.setItem("netup_admin_access_token", payload.access_token);
  window.localStorage.setItem("netup_admin_refresh_token", payload.refresh_token);
  return true;
}

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = getAdminAccessToken();
  if (!accessToken) {
    throw new Error("admin_unauthorized");
  }

  const send = async (token: string) => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    return response;
  };

  let response = await send(accessToken);
  if (response.status === 401) {
    const refreshed = await refreshAdminTokens();
    if (!refreshed) {
      throw new Error("admin_unauthorized");
    }
    const nextToken = getAdminAccessToken();
    if (!nextToken) {
      throw new Error("admin_unauthorized");
    }
    response = await send(nextToken);
  }

  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "admin_api_error");
  }

  return payload as T;
}

export async function adminLogout(): Promise<void> {
  const refreshToken = getAdminRefreshToken();
  if (refreshToken) {
    await fetch(`${apiBaseUrl}/api/v1/admin/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  }
  clearAdminTokens();
}
