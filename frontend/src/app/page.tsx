import Link from "next/link";

const featureItems = [
  { label: "Elo lưu một lần", value: "Onboarding" },
  { label: "Ghép đối cùng trình", value: "Tự động" },
  { label: "Đặt sân Hòa Lạc", value: "Realtime" },
];

export default function HomePage() {
  return (
    <main className="fade-up space-y-8">
      <section className="relative overflow-hidden rounded-lg border border-slate-200 bg-[#eef0f3] px-5 py-8 shadow-sm sm:px-8 lg:min-h-[520px] lg:px-10 lg:py-10">
        <div className="absolute -right-10 top-8 h-32 w-56 rotate-12 rounded-full bg-red-500/90" />
        <div className="absolute right-16 top-36 h-20 w-64 -rotate-12 rounded-full bg-red-500/80" />
        <div className="absolute bottom-10 right-4 h-28 w-28 rounded-full border-[18px] border-red-500/80" />
        <div className="absolute bottom-24 left-1/2 hidden h-16 w-16 rotate-45 border-l-[18px] border-t-[18px] border-red-500/80 lg:block" />

        <div className="relative grid gap-8 lg:grid-cols-[1fr_430px] lg:items-center">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-800">netUP Hòa Lạc</p>
            <h1 className="mt-4 font-heading text-4xl font-semibold leading-[1.05] text-slate-950 sm:text-6xl lg:text-7xl">
              NỀN TẢNG ĐẶT SÂN TẠI{" "}
              <span className="block text-red-600 sm:inline">HÒA LẠC</span>{" "}
              ĐẦU TIÊN
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
              NetUp kết nối người chơi, chủ sân và các kèo thể thao địa phương trong một trải nghiệm đặt lịch rõ ràng,
              nhanh và dễ kiểm soát.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="#ai-assessment"
                className="inline-flex items-center justify-center rounded-full bg-red-800 px-7 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white shadow-sm transition hover:bg-red-900"
              >
                TÌM HIỂU THÊM
              </Link>
              <Link
                href="/player/discovery?mode=booking"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-7 py-3 text-sm font-semibold text-slate-900 transition hover:border-red-300 hover:bg-red-50"
              >
                Xem sân trống
              </Link>
            </div>
          </div>

          <div className="relative mx-auto aspect-[4/3] w-full max-w-[430px]">
            <div className="absolute inset-x-8 bottom-6 h-16 rounded-full bg-slate-950/10 blur-xl" />
            <div className="absolute right-4 top-4 h-28 w-28 rounded-full bg-white/70" />
            <div className="absolute left-6 top-10 h-32 w-20 -rotate-12 rounded-t-full bg-white shadow-lg">
              <div className="mx-auto mt-7 h-16 w-12 rounded-t-full border-x-[10px] border-t-[10px] border-slate-300" />
              <div className="mx-auto h-14 w-4 bg-red-500" />
            </div>
            <img
              src="/courts/badminton1.jpg"
              alt="Sân cầu lông trong hệ thống NetUp"
              className="absolute bottom-0 right-0 h-[78%] w-[82%] rounded-lg object-cover shadow-2xl"
            />
            <div className="absolute bottom-5 left-0 rounded-lg bg-white/95 px-4 py-3 shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Khung giờ gần nhất</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">05:00 - 24:00</p>
            </div>
          </div>
        </div>
      </section>

      <section id="ai-assessment" className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">
            <span aria-hidden="true">✦</span>
            Đánh giá năng lực bằng AI
          </div>
          <h2 className="mt-5 font-heading text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
            Tìm đúng đối thủ, đúng sân, đúng khung giờ.
          </h2>
          <p className="mt-4 text-sm font-semibold uppercase leading-7 text-slate-800 sm:text-base">
            MỚI TẬP ĐÁNH CẦU LÔNG HAY BÓNG ĐÁ, SỢ KHÔNG CÓ NGƯỜI CHƠI CÙNG MÌNH? ĐỪNG LO ĐÃ CÓ NETUP.
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
            Nền tảng NetUp giúp bạn tìm đối thủ cùng trình độ, cùng khu vực và lịch rảnh chỉ trong vài giây. Không còn
            nỗi lo chênh lệch trình độ hay chơi một mình nữa.
          </p>
          <Link
            href="/player/discovery?mode=matchmaking"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-red-800 px-7 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white shadow-sm transition hover:bg-red-900"
          >
            TÌM ĐỐI THỦ NGAY
          </Link>
        </div>

        <div className="relative min-h-[360px] overflow-hidden rounded-lg border border-slate-200 bg-slate-950 shadow-sm">
          <img
            src="/courts/badminton1.jpg"
            alt="Vận động viên cầu lông trong trải nghiệm ghép đối NetUp"
            className="absolute inset-0 h-full w-full scale-105 object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/15 via-red-900/20 to-slate-950/70" />
          <div className="absolute -right-8 top-10 h-36 w-36 rounded-full bg-red-500/80 blur-sm" />
          <div className="absolute bottom-6 left-5 right-5 grid gap-3 sm:grid-cols-3">
            {featureItems.map((item) => (
              <div key={item.label} className="rounded-lg border border-white/20 bg-white/90 p-4 text-slate-950 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
                <p className="mt-1 font-heading text-xl font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
