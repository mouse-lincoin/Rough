import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { githubCallback } from '../api/client';
import { useAuthStore } from '../stores/authStore';

export function AuthCallbackPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const init = useAuthStore((s) => s.init);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setError('缺少授权码');
      return;
    }

    void (async () => {
      try {
        await githubCallback(code);
        await init();
        navigate('/', { replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : '登录失败');
      }
    })();
  }, [searchParams, navigate, init]);

  if (error) {
    return <div className="doc-list-empty">GitHub 登录失败：{error}</div>;
  }

  return <div className="doc-list-empty">正在登录…</div>;
}
