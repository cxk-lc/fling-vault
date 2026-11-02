import { useEffect, useState, type FC } from 'react';
import type { Settings } from '@shared/types';
import { IconClose } from './Icon';

interface SettingsModalProps {
  settings: Settings;
  onClose: () => void;
  onSave: (patch: Partial<Settings>) => void;
  onPickFolder: () => Promise<string | null>;
}

const Row: FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div className="field">
    <div className="field__label">
      {label}
      {hint ? <small>{hint}</small> : null}
    </div>
    <div className="field__control">{children}</div>
  </div>
);

const Toggle: FC<{ on: boolean; onChange: (value: boolean) => void }> = ({ on, onChange }) => (
  <button
    type="button"
    className="switch"
    data-on={on}
    onClick={() => onChange(!on)}
    aria-pressed={on}
    style={{ marginLeft: 'auto' }}
  />
);

export const SettingsModal: FC<SettingsModalProps> = ({ settings, onClose, onSave, onPickFolder }) => {
  const [form, setForm] = useState<Settings>(settings);
  const [hotkey, setHotkey] = useState(settings.hotkey);

  useEffect(() => setForm(settings), [settings]);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-label="设置">
        <div className="modal__head">
          <span className="modal__title">设置</span>
          <button type="button" className="drawer__close" style={{ position: 'static', marginLeft: 'auto' }} onClick={onClose}>
            <IconClose />
          </button>
        </div>

        <div className="modal__body">
          <Row label="下载目录" hint="修改器文件存放位置">
            <input type="text" value={form.downloadDir} readOnly />
            <button
              type="button"
              className="btn btn--sm"
              onClick={async () => {
                const dir = await onPickFolder();
                if (dir) update('downloadDir', dir);
              }}
            >
              选择
            </button>
          </Row>

          <Row label="管理员启动" hint="多数修改器需要">
            <Toggle on={form.launchAsAdmin} onChange={(value) => update('launchAsAdmin', value)} />
          </Row>

          <Row label="关闭到托盘" hint="保留后台与热键">
            <Toggle on={form.closeToTray} onChange={(value) => update('closeToTray', value)} />
          </Row>

          <Row label="自动检查更新" hint="启动后检查可更新项">
            <Toggle on={form.autoCheckUpdates} onChange={(value) => update('autoCheckUpdates', value)} />
          </Row>

          <Row label="快捷启动热键" hint="格式：Control+Alt+F">
            <input
              type="text"
              value={hotkey}
              spellCheck={false}
              onChange={(event) => setHotkey(event.target.value)}
              onBlur={() => {
                const value = hotkey.trim();
                if (value && value !== form.hotkey) update('hotkey', value);
              }}
            />
          </Row>

          <Row label="关于" hint="FLiNG Vault 1.0.0">
            <span style={{ fontSize: 11.5, color: 'var(--text-faint)', lineHeight: 1.7 }}>
              非官方客户端。修改器版权归 FLiNG 所有，仅从 flingtrainer.com 下载。
            </span>
          </Row>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              onSave({ ...form, hotkey });
              onClose();
            }}
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
};
