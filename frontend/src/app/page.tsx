import Link from "next/link";

export default function HomePage() {
  return (
    <main className="w-full overflow-hidden bg-white">
      {/* ================= SECTION 1: HERO BANNER ================= */}
      <section className="relative w-full min-h-[90vh] flex items-center">
        <div className="absolute inset-0 w-full h-full z-0 overflow-hidden">
          <img
            src="/courts/anhnen1.png"
            alt="Hero Background"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/80 to-transparent w-full"></div>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 lg:px-12">
          <div className="max-w-2xl py-20 lg:py-0">
            <h1 className="text-5xl sm:text-7xl lg:text-[85px] font-black italic uppercase leading-[0.9] text-gray-950 drop-shadow-md">
              Nền tảng đặt sân <br />
              tại <span className="text-red-600 block mt-2">Hòa Lạc</span>
              <span className="block mt-2">Đầu tiên</span>
            </h1>
            <div className="mt-10">
              <Link
                href="#ai-assessment"
                className="inline-flex items-center justify-center rounded-full bg-black px-10 py-4 text-lg font-bold uppercase tracking-wider shadow-xl transition-transform hover:scale-105 hover:bg-gray-800"
                style={{ color: "#FFFFFF" }}
              >
                TÌM HIỂU THÊM
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SECTION 2: TÍNH NĂNG AI ================= */}
      <section id="ai-assessment" className="relative w-full min-h-[90vh] flex items-center bg-white border-t border-gray-100">
        <div className="absolute inset-0 w-full h-full z-0 overflow-hidden">
          <img
            src="/courts/anhnen2.png"
            alt="Ghép đối AI Background"
            className="w-full h-full object-cover object-[center_15%]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-white w-full"></div>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 lg:px-12 flex justify-end">
          <div className="max-w-2xl py-20 lg:py-0 text-left lg:text-right">
            <div className="inline-flex items-center justify-end rounded-[40px] bg-white/90 backdrop-blur px-6 sm:px-8 py-4 shadow-lg mb-8 border border-gray-200">
              <h2 className="text-3xl sm:text-4xl font-black italic uppercase leading-tight text-gray-900 flex items-center gap-4 sm:gap-6">
                <span>Đánh giá <br /> năng lực <br /> bằng </span>
                <span className="text-[80px] sm:text-[100px] leading-none text-black">AI</span>
              </h2>
            </div>

            <p className="text-xl sm:text-2xl font-bold uppercase text-gray-900 leading-snug mb-4">
              Mới tập đánh cầu lông hay bóng đá, sợ không có người chơi cùng mình?
            </p>
            <h3 className="text-4xl sm:text-5xl font-black italic text-red-600 uppercase mb-6 drop-shadow-md">
              Đừng lo đã có netup
            </h3>
            <p className="text-lg text-gray-800 leading-relaxed mb-10 font-semibold bg-white/50 inline-block p-2 rounded-lg">
              Nền tảng NetUp giúp bạn tìm đối thủ cùng trình độ, cùng khu vực và lịch rảnh chỉ trong vài giây. Không còn phải lo chênh lệch hay chơi một mình nữa.
            </p>
            <div className="block">
              <Link
                href="/player/discovery?mode=matchmaking"
                className="inline-flex items-center justify-center rounded-full bg-black px-10 py-4 text-lg font-bold uppercase tracking-wider shadow-xl transition-transform hover:scale-105 hover:bg-gray-800"
                style={{ color: "#FFFFFF" }}
              >
                TÌM ĐỐI THỦ NGAY
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SECTION 3: MOCKUP APP ================= */}
      <section className="relative w-full min-h-[85vh] flex items-center overflow-hidden border-t-4 border-red-600 bg-gray-950">
        <div className="absolute inset-0 w-full h-full z-0">
          <img
            src="/courts/anhnen3.png"
            alt="Đặt sân ngay Background"
            className="w-full h-full object-cover object-center opacity-100"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/10 via-black/60 to-black/95 w-full"></div>
        </div>

        {/* Ảnh bàn tay: Ép sát lề trái và đáy, block để xóa viền hở */}
        <div className="absolute bottom-0 left-0 h-[90%] z-10 pointer-events-none hidden lg:block">
          <img
            src="/courts/taycamdienthoai.png"
            alt="App đặt lịch trực quan"
            className="w-auto h-full object-contain object-left-bottom drop-shadow-[20px_10px_35px_rgba(0,0,0,0.8)] block"
          />
        </div>

        <div className="relative z-20 mx-auto w-full max-w-7xl px-6 lg:px-12 flex justify-end">
          <div className="w-full lg:w-[55%] py-24 lg:py-32 flex flex-col items-start lg:pl-10">
            <img src="/courts/quabong.png" alt="Quả bóng" className="w-24 md:w-32 drop-shadow-[0_10px_20px_rgba(255,255,255,0.15)] mb-8" />
            <p className="text-xl sm:text-2xl font-bold uppercase text-gray-300 leading-snug mb-4">
              Quá khó khăn khi đặt sân, ra sân lúc nào cũng "Hết sân rồi em ơi"
            </p>
            <h3 className="text-4xl sm:text-5xl font-black italic text-red-500 uppercase mb-6 drop-shadow-lg">
              Đừng lo đã có netup
            </h3>
            <p className="text-lg text-gray-300 leading-relaxed mb-12 font-medium">
              Nền tảng NetUp giúp bạn xem lịch sân trống trực quan theo thời gian thực. Đặt lịch, thanh toán tiện lợi chỉ với vài thao tác chạm trên điện thoại.
            </p>
            <Link
              href="/player/discovery?mode=booking"
              className="inline-flex items-center justify-center rounded-full bg-red-600 px-12 py-5 text-lg font-bold uppercase tracking-wider transition-all hover:scale-105 hover:bg-red-500"
              style={{ color: "#FFFFFF", boxShadow: "0 0 25px rgba(220,38,38,0.5)" }}
            >
              ĐẶT SÂN NGAY
            </Link>
          </div>
        </div>
      </section>

      {/* ================= SECTION 4: STATS ================= */}
      <section className="w-full bg-white border-y-2 border-gray-100 py-12">
        <div className="mx-auto w-full max-w-5xl px-6 grid grid-cols-1 sm:grid-cols-3 gap-8 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-gray-200 text-center">
          <div className="pt-4 sm:pt-0"><h4 className="text-5xl sm:text-6xl font-black italic text-gray-900">250+</h4><p className="mt-2 text-lg font-bold uppercase tracking-widest text-gray-500">Người dùng</p></div>
          <div className="pt-4 sm:pt-0"><h4 className="text-5xl sm:text-6xl font-black italic text-gray-900">10+</h4><p className="mt-2 text-lg font-bold uppercase tracking-widest text-gray-500">Chủ sân</p></div>
          <div className="pt-4 sm:pt-0"><h4 className="text-5xl sm:text-6xl font-black italic text-gray-900">30+</h4><p className="mt-2 text-lg font-bold uppercase tracking-widest text-gray-500">Sân đâu</p></div>
        </div>
      </section>

      {/* ================= SECTION 5: ĐĂNG KÝ CHỦ SÂN ================= */}
      <section className="relative w-full bg-[#E5E7EB] pt-20 pb-0 overflow-hidden">
        <div className="mx-auto w-full max-w-7xl px-6 lg:px-12 grid lg:grid-cols-2 gap-12 items-end">
          <div className="relative z-10 pb-20">
            <h2 className="text-5xl sm:text-7xl font-black italic uppercase leading-[0.9] text-gray-900">Dành cho <br /> chủ sân</h2>
            <p className="mt-4 text-2xl font-medium text-gray-700">Trở thành đối tác phân phối với chúng tôi</p>
            <div className="mt-12 relative h-[300px] sm:h-[400px]">
              <img src="/courts/vandongviencaulong3.png" alt="Đối tác NetUp" className="absolute bottom-[-80px] left-0 w-full max-w-[500px] object-contain drop-shadow-2xl" />
            </div>
          </div>

          <div className="relative z-20 bg-white rounded-t-[40px] lg:rounded-[40px] p-8 sm:p-12 shadow-2xl mb-0 lg:mb-20 border border-gray-100">
            <h3 className="text-3xl font-bold text-gray-900 mb-8">Đăng ký hệ thống</h3>
            <form className="space-y-6">
              <div><label className="block text-sm font-bold text-gray-700 mb-2">Tên chủ sân / Cụm sân thể thao</label><input type="text" placeholder="VD: Sân cầu lông Hòa Lạc" className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" /></div>
              <div><label className="block text-sm font-bold text-gray-700 mb-2">Số điện thoại liên hệ</label><input type="tel" placeholder="09xx xxx xxx" className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" /></div>
              <div><label className="block text-sm font-bold text-gray-700 mb-2">Địa chỉ cụm sân</label><input type="text" placeholder="Nhập địa chỉ chi tiết" className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" /></div>
              <button type="button" className="w-full mt-4 rounded-xl bg-red-600 px-4 py-4 text-lg font-bold transition hover:bg-red-700 shadow-lg" style={{ color: "#FFFFFF" }}>GỬI YÊU CẦU HỢP TÁC</button>
              <p className="text-xs text-center text-gray-400 mt-4">Đội ngũ NetUp sẽ liên hệ với bạn trong vòng 24h để xác minh.</p>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}