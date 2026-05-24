"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="rounded-xl border border-red-200 bg-white p-8">
      <h2 className="font-heading text-2xl font-semibold text-ink">Ứng dụng gặp lỗi</h2>
      <p className="mt-2 text-sm text-slate-600">{error.message || "Đã xảy ra lỗi không mong muốn."}</p>
      <button
        className="mt-5 rounded bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        onClick={reset}
      >
        Thử lại
      </button>
    </section>
  );
}
