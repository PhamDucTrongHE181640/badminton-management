import Link from "next/link";

export default function NotFound() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-8 text-center">
      <p className="text-sm uppercase tracking-[0.14em] text-slate-500">404</p>
      <h1 className="mt-3 font-heading text-2xl font-semibold text-ink">Không tìm thấy trang</h1>
      <p className="mt-2 text-sm text-slate-600">Liên kết có thể đã thay đổi hoặc không còn tồn tại.</p>
      <Link
        href="/"
        className="mt-5 inline-flex rounded bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
      >
        Về trang chủ
      </Link>
    </section>
  );
}
