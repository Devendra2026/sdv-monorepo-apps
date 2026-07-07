"use client";

export function BilingualLabel({ en, hi }: { en: string; hi: string }) {
  return (
    <span>
      {en}
      <span className="demand-notice-bilingual-sep"> / </span>
      <span className="demand-notice-bilingual-hi demand-notice-hi font-medium text-muted-foreground">{hi}</span>
    </span>
  );
}
