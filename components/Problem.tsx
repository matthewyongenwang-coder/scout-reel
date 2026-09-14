import type { ReactNode } from "react";

export function Problem({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return (
    <div role="alert" className="rounded-md border border-line bg-panel p-6">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted">{detail}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
