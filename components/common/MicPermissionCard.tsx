
import React from 'react';
import { MicOff, AlertCircle, RotateCcw } from 'lucide-react';

export type MicPermissionReason = 'denied' | 'unsupported' | 'unknown';

interface Props {
  reason: MicPermissionReason;
  onRetry?: () => void;
}

const COPY: Record<MicPermissionReason, { title: string; body: React.ReactNode }> = {
  denied: {
    title: '麥克風存取被拒',
    body: (
      <>
        <p className="text-xs text-tx-muted leading-relaxed mb-2">
          這個功能需要麥克風才能偵測你的音準或唱歌音高。請在瀏覽器設定中允許本網站使用麥克風後再試一次。
        </p>
        <ul className="text-[11px] text-tx-muted space-y-1 list-disc pl-4">
          <li>Chrome / Edge：網址列左側的鎖頭圖示 → 「網站設定」→ 允許麥克風</li>
          <li>Safari：偏好設定 → 網站 → 麥克風 → 允許本站</li>
          <li>Firefox：網址列左側的鎖頭圖示 → 解除權限封鎖</li>
        </ul>
      </>
    ),
  },
  unsupported: {
    title: '瀏覽器不支援麥克風',
    body: (
      <p className="text-xs text-tx-muted leading-relaxed">
        目前的瀏覽器或裝置不支援 Web Audio 麥克風存取。請改用最新版的 Chrome、Edge、Firefox 或 Safari 開啟本網站。
      </p>
    ),
  },
  unknown: {
    title: '無法啟用麥克風',
    body: (
      <p className="text-xs text-tx-muted leading-relaxed">
        系統暫時無法啟用麥克風。請確認沒有其他應用程式正在使用，或重新整理頁面後再試一次。
      </p>
    ),
  },
};

const MicPermissionCard: React.FC<Props> = ({ reason, onRetry }) => {
  const { title, body } = COPY[reason];
  return (
    <div
      role="alert"
      className="card p-4 max-w-md w-full animate-fade-in"
      style={{ borderColor: 'var(--status-danger-border)' }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'var(--status-danger-bg)', color: 'var(--status-danger)' }}
        >
          {reason === 'unsupported' ? <AlertCircle size={20} /> : <MicOff size={20} />}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm text-tx mb-1.5">{title}</h4>
          {body}
          {onRetry && reason !== 'unsupported' && (
            <button
              onClick={onRetry}
              className="btn-ghost mt-3 px-4 py-2 text-xs flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw size={13} /> 重試
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Classifies a getUserMedia rejection. NotAllowedError is what every major
// browser throws on explicit deny; the others are environmental.
export function classifyMicError(err: unknown): MicPermissionReason {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return 'unsupported';
  }
  if (err && typeof err === 'object' && 'name' in err) {
    const name = (err as { name: string }).name;
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'denied';
    if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError') return 'unsupported';
  }
  return 'unknown';
}

export default MicPermissionCard;
