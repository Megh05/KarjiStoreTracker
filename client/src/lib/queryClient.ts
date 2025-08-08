import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(url: string, options?: {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}): Promise<any> {
  const method = options?.method || 'GET';
  console.log(`API Request: ${method} ${url}`, options?.body ? JSON.parse(options.body) : '');
  
  try {
    // Merge default headers with custom headers
    const headers: Record<string, string> = {
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...(options?.headers || {})
    };
    
    // Add session ID from localStorage if available and not already in headers
    const sessionId = localStorage.getItem('chatSessionId');
    if (sessionId && !headers['X-Session-ID']) {
      headers['X-Session-ID'] = sessionId;
    }
    
    const res = await fetch(url, {
      method,
      headers,
      body: options?.body,
      credentials: "include",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`API Error: ${res.status} ${res.statusText}`, text);
      throw new Error(`${res.status}: ${text || res.statusText}`);
    }
    
    const data = await res.json();
    console.log(`API Response: ${method} ${url}`, data);
    return data;
  } catch (error) {
    console.error(`API Request failed: ${method} ${url}`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

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
