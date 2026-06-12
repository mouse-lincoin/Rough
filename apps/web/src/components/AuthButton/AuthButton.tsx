import { useEffect, useState } from 'react';
import { getGithubAuthUrl } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';

export function AuthButton(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const initialized = useAuthStore((s) => s.initialized);
  const init = useAuthStore((s) => s.init);
  const login = useAuthStore((s) => s.login);
  const signOut = useAuthStore((s) => s.signOut);
  const [githubUrl, setGithubUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!initialized) void init();
  }, [initialized, init]);

  useEffect(() => {
    void getGithubAuthUrl().then(setGithubUrl);
  }, []);

  if (loading) return <span className="auth-status">…</span>;

  if (user) {
    return (
      <div className="auth-user">
        <span>{user.name}</span>
        <button type="button" className="toolbar-btn" onClick={() => void signOut()}>
          退出
        </button>
      </div>
    );
  }

  return (
    <div className="auth-actions">
      {githubUrl && (
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => {
            window.location.href = githubUrl;
          }}
        >
          GitHub 登录
        </button>
      )}
      <button type="button" className="toolbar-btn" onClick={() => void login()}>
        开发登录
      </button>
    </div>
  );
}
