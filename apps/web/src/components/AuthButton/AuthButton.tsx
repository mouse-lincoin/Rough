import { useEffect, useState } from 'react';
import { devLogin, getMe, logout, type ApiUser } from '../../api/client';

export function AuthButton(): JSX.Element {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getMe()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <span className="auth-status">…</span>;

  if (user) {
    return (
      <div className="auth-user">
        <span>{user.name}</span>
        <button type="button" className="toolbar-btn" onClick={() => void logout().then(() => setUser(null))}>
          退出
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="toolbar-btn"
      onClick={() => void devLogin('本地用户').then(setUser)}
    >
      登录同步
    </button>
  );
}
