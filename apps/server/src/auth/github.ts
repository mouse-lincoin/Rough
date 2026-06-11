import type { ServerConfig } from '../config.js';

export function getGithubAuthUrl(config: ServerConfig, state: string): string | null {
  if (!config.githubClientId) return null;
  const redirectUri = `${config.webOrigin}/auth/callback`;
  const params = new URLSearchParams({
    client_id: config.githubClientId,
    redirect_uri: redirectUri,
    scope: 'read:user',
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export async function exchangeGithubCode(
  code: string,
  config: ServerConfig,
): Promise<{ id: string; name: string; avatarUrl: string } | null> {
  if (!config.githubClientId || !config.githubClientSecret) return null;

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.githubClientId,
      client_secret: config.githubClientSecret,
      code,
    }),
  });
  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) return null;

  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/json' },
  });
  const user = (await userRes.json()) as {
    id: number;
    login: string;
    name: string | null;
    avatar_url: string;
  };

  return {
    id: String(user.id),
    name: user.name ?? user.login,
    avatarUrl: user.avatar_url,
  };
}
