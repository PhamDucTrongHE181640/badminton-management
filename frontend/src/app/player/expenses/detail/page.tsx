"use client";

import { useSearchParams } from "next/navigation";
import ExpenseForm from "../ExpenseForm";

export default function IndependentExpenseDetailPage() {
  const searchParams = useSearchParams();
  const expenseId = searchParams.get("id") || "";

  return <ExpenseForm expenseId={expenseId} />;
}
