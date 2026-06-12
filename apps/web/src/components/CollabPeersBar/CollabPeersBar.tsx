import type { Editor } from '@rough/editor';
import { useEditorStore } from '../../stores/editorStore';

interface CollabPeersBarProps {
  editorRef: React.RefObject<Editor | null>;
}

export function CollabPeersBar({ editorRef }: CollabPeersBarProps): JSX.Element | null {
  const remotePeers = useEditorStore((s) => s.remotePeers);
  const followingClientId = useEditorStore((s) => s.followingClientId);
  const setFollowingClientId = useEditorStore((s) => s.setFollowingClientId);

  if (remotePeers.length === 0) return null;

  return (
    <div className="collab-peers-bar" title="点击跟随协作者视口">
      {remotePeers.map((peer) => {
        const initial = (peer.state.user?.name?.trim()?.[0] ?? '?').toUpperCase();
        const color = peer.state.user?.color ?? '#6965DB';
        const active = followingClientId === peer.clientId;
        return (
          <button
            key={peer.clientId}
            type="button"
            className={`collab-peer-avatar ${active ? 'active' : ''}`}
            style={{ backgroundColor: color }}
            title={`跟随 ${peer.state.user?.name ?? '协作者'}`}
            onClick={() => {
              const editor = editorRef.current;
              if (!editor) return;
              if (active) {
                editor.clearSpotlightFollow();
                setFollowingClientId(null);
              } else {
                editor.followRemotePeer(peer.clientId);
                setFollowingClientId(peer.clientId);
              }
            }}
          >
            {initial}
          </button>
        );
      })}
    </div>
  );
}
