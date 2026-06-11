import { useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';

export function AuthButton(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const initialized = useAuthStore((s) => s.initialized);
  const init = useAuthStore((s) => s.init);
  const login = useAuthStore((s) => s.login);
  const signOut = useAuthStore((s) => s.signOut);

  useEffect(() => {
    if (!initialized) void init();
  }, [initialized, init]);

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
    <button type="button" className="toolbar-btn" onClick={() => void login()}>
      登录同步
    </button>
  );
}
