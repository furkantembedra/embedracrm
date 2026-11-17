"use client";

// Tarayıcının yazdır penceresini açar ("PDF olarak kaydet" buradan seçilir)
import { Printer } from "lucide-react";

export default function YazdirButonu() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control bg-ink px-4 text-sm font-bold text-white hover:bg-ink-soft">
      <Printer size={16} aria-hidden="true" /> Yazdır / PDF
    </button>
  );
}
