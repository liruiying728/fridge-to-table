import { fetch as undiciFetch, ProxyAgent } from "undici";

export function outboundProxyUrl(): string {
  return (
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim() ||
    process.env.ALL_PROXY?.trim() ||
    ""
  );
}

/**
 * 访问 OhMyGPT 等外网 API。Node 默认 fetch 不会读系统代理。
 */
export async function aiOutboundFetch(url: string, init: RequestInit): Promise<Response> {
  const proxy = outboundProxyUrl();
  if (!proxy) {
    return fetch(url, init);
  }
  const opts: Parameters<typeof undiciFetch>[1] = {
    method: init.method,
    headers: init.headers as Record<string, string>,
    body: init.body as string | undefined,
    dispatcher: new ProxyAgent(proxy),
  };
  const res = await undiciFetch(url, opts);
  return res as unknown as Response;
}

export function stripJsonFence(text: string): string {
  let t = (text ?? "").trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  return t.trim();
}
