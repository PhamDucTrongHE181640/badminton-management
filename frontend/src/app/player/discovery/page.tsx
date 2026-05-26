import { Suspense } from "react";

import { BookingMarketplace } from "@/components/marketplace/BookingMarketplace";
import { EmptyState } from "@/components/ui";

export default function PlayerDiscoveryPage() {
  return (
    <Suspense fallback={<EmptyState title="Đang mở danh sách sân" description="NetUp đang chuẩn bị bộ lọc đặt sân." />}>
      <BookingMarketplace variant="player" />
    </Suspense>
  );
}
