import type { ComponentChildren } from 'preact';

export function TopBar({ title, back, right }: { title: ComponentChildren; back?: () => void; right?: ComponentChildren }) {
  return (
    <div class="topbar">
      {back && (
        <button class="icon-btn" onClick={back} aria-label="Retour">
          ←
        </button>
      )}
      <div class="title">{title}</div>
      {right}
    </div>
  );
}
