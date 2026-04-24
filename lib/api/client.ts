export function isGoApiClientEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_API_BASE_URL);
}

export function buildClientApiUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error("缺少 NEXT_PUBLIC_API_BASE_URL 配置");
  }

  return new URL(path.startsWith("/") ? path : `/${path}`, baseUrl).toString();
}

export async function clientApiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(buildClientApiUrl(path), {
    ...options,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error("接口请求失败，请稍后重试");
  }

  return response.json() as Promise<T>;
}
