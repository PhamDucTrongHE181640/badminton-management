"use client";

import { useSearchParams } from "next/navigation";
import ExpenseForm from "../ExpenseForm";

export default function SessionExpenseDetailPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("id") || "";

  return <ExpenseForm sessionId={sessionId} />;
}
