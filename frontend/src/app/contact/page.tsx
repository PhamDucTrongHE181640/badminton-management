import Link from "next/link";

const fanpageUrl = process.env.NEXT_PUBLIC_NETUP_FACEBOOK_URL ?? "https://www.facebook.com/netup.vn";

const contactCards = [
  {
    title: "Dành cho người chơi",
    description: "Cần hỗ trợ đặt sân, ghép kèo, thanh toán cọc hoặc check-in tại sân.",
    details: ["Hotline: 0900 000 000", "Email: player@netup.vn", "Khu vực ưu tiên: Hòa Lạc"],
  },
  {
    title: "Dành cho chủ sân",
    description: "Đăng ký vận hành sân, mở lịch đặt, xử lý booking và quản lý check-in.",
    details: ["Hotline: 0911 000 000", "Email: owner@netup.vn", "Duyệt hồ sơ qua tài khoản Google"],
  },
];

export default function ContactPage() {
  return (
    <main className="fade-up mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8 space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-800">Liên hệ NetUp</p>
        <h1 className="mt-3 max-w-3xl font-heading text-3xl font-semibold leading-tight text-slate-950 sm:text-5xl">
          Một điểm hỗ trợ cho cả người chơi và chủ sân.
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
          Gửi yêu cầu để đội NetUp tư vấn luồng đặt sân, xếp đối, vận hành cụm sân và các vấn đề thanh toán.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={fanpageUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            Mở Fanpage chính thức
          </a>
          <Link
            href="/player/discovery?mode=matchmaking"
            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
          >
            Thử xếp đối ngay
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {contactCards.map((card) => (
          <article key={card.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-heading text-xl font-semibold text-slate-950">{card.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
            <div className="mt-4 grid gap-2">
              {card.details.map((item) => (
                <p key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {item}
                </p>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
