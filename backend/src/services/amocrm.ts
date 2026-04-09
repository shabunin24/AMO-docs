import { config } from "../config.js";

type AmoTokenResponse = {
  token_type: string;
  expires_in: number;
  access_token: string;
  refresh_token: string;
  scope: string;
  created_at: number;
  base_domain?: string;
};

export type AmoTokenStore = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  baseDomain: string;
};

let tokenStore: AmoTokenStore | null = null;

function getOauthBaseUrl() {
  return `https://${config.AMO_SUBDOMAIN}.amocrm.ru`;
}

function assertAmoConfig() {
  if (!config.AMO_CLIENT_ID || !config.AMO_CLIENT_SECRET || !config.AMO_REDIRECT_URI || !config.AMO_SUBDOMAIN) {
    throw new Error("AMO env vars are not configured");
  }
}

async function requestToken(payload: Record<string, string>) {
  assertAmoConfig();

  const response = await fetch(`${getOauthBaseUrl()}/oauth2/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: config.AMO_CLIENT_ID,
      client_secret: config.AMO_CLIENT_SECRET,
      redirect_uri: config.AMO_REDIRECT_URI,
      ...payload
    })
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`amoCRM token request failed: ${response.status} ${raw}`);
  }

  const tokenData = (await response.json()) as AmoTokenResponse;
  tokenStore = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: Date.now() + tokenData.expires_in * 1000 - 60_000,
    baseDomain: tokenData.base_domain ?? `${config.AMO_SUBDOMAIN}.amocrm.ru`
  };

  return tokenStore;
}

export function getAmoAuthUrl() {
  assertAmoConfig();
  const params = new URLSearchParams({
    client_id: config.AMO_CLIENT_ID,
    mode: "post_message",
    redirect_uri: config.AMO_REDIRECT_URI,
    response_type: "code"
  });
  return `${getOauthBaseUrl()}/oauth?${params.toString()}`;
}

export async function exchangeCodeToToken(code: string) {
  return requestToken({
    grant_type: "authorization_code",
    code
  });
}

export async function refreshToken() {
  if (!tokenStore?.refreshToken) {
    throw new Error("No refresh token found");
  }
  return requestToken({
    grant_type: "refresh_token",
    refresh_token: tokenStore.refreshToken
  });
}

async function ensureActualToken() {
  if (!tokenStore) {
    throw new Error("amoCRM is not connected yet");
  }
  if (Date.now() >= tokenStore.expiresAt) {
    await refreshToken();
  }
  return tokenStore;
}

export async function amoApiRequest<T>(path: string, query?: Record<string, string>) {
  const actualToken = await ensureActualToken();
  const url = new URL(`https://${actualToken.baseDomain}${path}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${actualToken.accessToken}`,
      "Content-Type": "application/json"
    }
  });

  if (response.status === 401) {
    await refreshToken();
    return amoApiRequest<T>(path, query);
  }

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`amoCRM API request failed: ${response.status} ${raw}`);
  }

  return (await response.json()) as T;
}

type AmoRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string>;
  body?: unknown;
};

export async function amoApiRequestWithOptions<T>(path: string, options: AmoRequestOptions = {}) {
  const actualToken = await ensureActualToken();
  const url = new URL(`https://${actualToken.baseDomain}${path}`);
  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${actualToken.accessToken}`,
      "Content-Type": "application/json"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (response.status === 401) {
    await refreshToken();
    return amoApiRequestWithOptions<T>(path, options);
  }

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`amoCRM API request failed: ${response.status} ${raw}`);
  }

  return (await response.json()) as T;
}

export async function addLeadNote(leadId: number, text: string) {
  return amoApiRequestWithOptions<unknown>(`/api/v4/leads/${leadId}/notes`, {
    method: "POST",
    body: [
      {
        note_type: "common",
        params: { text }
      }
    ]
  });
}

export function getConnectionStatus() {
  return {
    connected: Boolean(tokenStore),
    baseDomain: tokenStore?.baseDomain ?? null,
    expiresAt: tokenStore?.expiresAt ?? null
  };
}
