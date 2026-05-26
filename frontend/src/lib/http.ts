const DEFAULT_TIMEOUT_MS = 10000;

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

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
  const response = await withTimeout(
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

  const payload = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
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
