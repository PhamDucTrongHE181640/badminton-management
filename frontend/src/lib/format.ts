export function formatVnd(value: number | null | undefined): string {
  return `${new Intl.NumberFormat("vi-VN").format(value ?? 0)}đ`;
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("vi-VN").format(value ?? 0);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "Chưa có thời gian";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có thời gian";
  return date.toLocaleString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatFullDateTime(value: string | Date | null | undefined): string {
  if (!value) return "Chưa có thời gian";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có thời gian";
  return date.toLocaleString("vi-VN");
}

export function formatTimeRange(startsAt: string | Date, durationMinutes: number): string {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return "Chưa có thời gian";
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const dateText = start.toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
  const startText = start.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const endText = end.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  return `${dateText} · ${startText} - ${endText}`;
}

export function sportLabel(value: string | null | undefined): string {
  const labels: Record<string, string> = {
    Badminton: "Cầu lông",
    Football: "Bóng đá",
    Tennis: "Tennis",
  };
  return labels[value ?? ""] ?? value ?? "Thể thao";
}

export function postTypeLabel(value: string | null | undefined): string {
  const labels: Record<string, string> = {
    pool: "Kèo chờ ghép",
    rental: "Thuê nguyên sân",
  };
  return labels[value ?? ""] ?? value ?? "Phiên sân";
}

export function bookingModeLabel(value: string | null | undefined): string {
  const labels: Record<string, string> = {
    solo: "Ghép lẻ",
    full_court: "Bao sân",
  };
  return labels[value ?? ""] ?? value ?? "Booking";
}

export function paymentMethodLabel(value: string | null | undefined): string {
  const labels: Record<string, string> = {
    cash: "Cọc online, trả còn lại tại sân",
    vnpay: "Thanh toán VNPay",
  };
  return labels[value ?? ""] ?? value ?? "Thanh toán";
}

export function bookingStatusLabel(value: string | null | undefined): string {
  const labels: Record<string, string> = {
    awaiting_deposit: "Chờ đặt cọc",
    deposit_paid: "Đã đặt cọc",
    confirmed: "Đã xác nhận",
    checked_in: "Đã check-in",
    completed: "Hoàn tất",
    cancelled: "Đã hủy",
    expired: "Hết hạn",
  };
  return labels[value ?? ""] ?? value ?? "Không rõ";
}

export function requestStatusLabel(value: string | null | undefined): string {
  const labels: Record<string, string> = {
    pending: "Đang chờ duyệt",
    approved: "Đã duyệt",
    rejected: "Đã từ chối",
    cancelled: "Đã hủy",
  };
  return labels[value ?? ""] ?? value ?? "Không rõ";
}

export function recommendationLabel(value: string | null | undefined): string {
  const labels: Record<string, string> = {
    high: "Rất phù hợp",
    medium: "Phù hợp",
    low: "Có thể thử",
  };
  return labels[value ?? ""] ?? "Gợi ý";
}

export function courtImageForSport(sport: string | null | undefined): string {
  if (sport === "Football") return "/courts/football1.jpeg";
  if (sport === "Tennis") return "/courts/tennis1.jpg";
  return "/courts/badminton1.jpg";
}

export function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error && caught.message ? caught.message : fallback;
}
