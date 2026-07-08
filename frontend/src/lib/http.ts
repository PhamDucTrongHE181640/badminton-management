const DEFAULT_TIMEOUT_MS = 10000;

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  code: string;

  constructor({ message, status, code }: { message: string; status: number; code: string }) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function withTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  options?: { timeoutMs?: number; allowNoContent?: boolean }
): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  let response: Response;

  try {
    response = await withTimeout(
      `${API_BASE_URL}${path}`,
      {
        ...init,
        cache: "no-store",
        headers: {
          ...(isFormData ? {} : { "Content-Type": "application/json" }),
          ...(init?.headers ?? {}),
        },
      },
      options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );
  } catch (caught) {
    const isTimeout = caught instanceof Error && caught.name === "AbortError";
    throw new ApiError({
      status: 0,
      code: isTimeout ? "api_timeout" : "network_error",
      message: isTimeout
        ? "API phản hồi quá lâu. Vui lòng thử lại sau."
        : `Không kết nối được API tại ${API_BASE_URL || "/api"}. Hãy kiểm tra backend đang chạy và đúng NEXT_PUBLIC_API_BASE_URL.`,
    });
  }

  const payload = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && !path.includes("/auth/refresh")) {
      try {
        // Gọi API refresh token chạy ngầm. Gửi kèm credentials để tự động đính kèm cookie.
        await apiFetch("/api/v1/auth/refresh", {
          method: "POST",
          body: JSON.stringify({ refresh_token: null }),
          credentials: "include",
        });
        // Gọi lại yêu cầu ban đầu sau khi gia hạn phiên thành công
        return await apiFetch<T>(path, init, options);
      } catch (refreshErr) {
        console.error("Gia hạn phiên làm việc tự động thất bại:", refreshErr);
      }
    }

    throw new ApiError({
      status: response.status,
      code: payload?.error?.code ?? "api_error",
      message: payload?.error?.message ?? "Yêu cầu thất bại",
    });
  }

  if (response.status === 204 && !options?.allowNoContent) {
    return null as T;
  }

  return payload as T;
}
