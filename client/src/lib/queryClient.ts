import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Resolution order:
//   1. VITE_API_BASE  — set at build time when deploying to Cloudflare Pages
//                       (points at the Fly.io backend, e.g. https://tender-api.fly.dev)
//   2. __PORT_5000__  — replaced by Perplexity deploy_website with a proxy path
//   3. ""             — same-origin (local dev, fullstack single-port)
const BUILD_API = (import.meta.env.VITE_API_BASE as string | undefined) || "";
const PROXY_TOKEN = "__PORT_5000__";
const API_BASE = BUILD_API
  ? BUILD_API.replace(/\/$/, "")
  : PROXY_TOKEN.startsWith("__") ? "" : PROXY_TOKEN;

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(`${API_BASE}${queryKey.join("/")}`);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
