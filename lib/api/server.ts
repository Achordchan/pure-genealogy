import { cookies } from "next/headers";

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | Record<string, unknown> | unknown[] | null;
  query?: Record<string, string | number | boolean | null | undefined>;
}

export class ApiFetchError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = "ApiFetchError";
  }
}

const DEFAULT_API_ERROR_MESSAGE = "接口请求失败，请稍后重试";

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const url = buildApiUrl(path, options.query);
  const headers = new Headers(options.headers);
  const body = serializeBody(options.body, headers);
  const cookieHeader = await buildCookieHeader();

  if (cookieHeader && !headers.has("cookie")) {
    headers.set("cookie", cookieHeader);
  }

  const response = await fetch(url, {
    ...options,
    body,
    headers,
  });

  await forwardSetCookie(response);

  if (!response.ok) {
    throw new ApiFetchError(await resolveErrorMessage(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function forwardSetCookie(response: Response) {
  const setCookie = response.headers.get("set-cookie");

  if (!setCookie) {
    return;
  }

  const [pair] = setCookie.split(";");
  const separatorIndex = pair.indexOf("=");

  if (separatorIndex <= 0) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(pair.slice(0, separatorIndex), pair.slice(separatorIndex + 1), {
    httpOnly: setCookie.toLowerCase().includes("httponly"),
    sameSite: "lax",
    path: "/",
  });
}

export function buildApiUrl(path: string, query?: ApiFetchOptions["query"]) {
  const baseUrl = getApiBaseUrl();
  const url = new URL(path.startsWith("/") ? path : `/${path}`, baseUrl);

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  return url;
}

export function getApiBaseUrl() {
  const baseUrl = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    throw new Error("缺少 API_BASE_URL 或 NEXT_PUBLIC_API_BASE_URL 配置");
  }

  return baseUrl;
}

async function buildCookieHeader() {
  const cookieStore = await cookies();

  return cookieStore
    .getAll()
    .map((item) => `${item.name}=${encodeURIComponent(item.value)}`)
    .join("; ");
}

function serializeBody(body: ApiFetchOptions["body"], headers: Headers) {
  if (body === undefined || body === null || isBodyInit(body)) {
    return body;
  }

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return JSON.stringify(body);
}

function isBodyInit(body: ApiFetchOptions["body"]): body is BodyInit {
  return (
    typeof body === "string" ||
    body instanceof Blob ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer
  );
}

async function resolveErrorMessage(response: Response) {
  const fallback = getFallbackErrorMessage(response.status);
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return fallback;
  }

  try {
    const payload = (await response.json()) as { message?: unknown; error?: unknown };
    const message = payload.message ?? (typeof payload.error === "object" && payload.error && "message" in payload.error
      ? (payload.error as { message?: unknown }).message
      : payload.error);

    return typeof message === "string" && message.trim() ? message : fallback;
  } catch {
    return fallback;
  }
}

function getFallbackErrorMessage(status: number) {
  if (status === 401) {
    return "登录已失效，请重新登录";
  }

  if (status === 403) {
    return "当前账号无权访问";
  }

  if (status === 404) {
    return "请求的数据不存在";
  }

  if (status >= 500) {
    return "服务器暂时不可用，请稍后重试";
  }

  return DEFAULT_API_ERROR_MESSAGE;
}
