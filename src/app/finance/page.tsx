import { PageHeader } from "@/components/ui/primitives";
import { FinanceWorkspace } from "@/components/finance/FinanceWorkspace";
import * as Q from "@/lib/data/queries";
export const metadata = { title: "Finance — EduFlow" };
export default function Finance() {
  const income = Q.payments.filter((p) => p.status === "Confirmed").reduce((a, p) => a + p.amount, 0);
  return (<><PageHeader title="Finance & Accounting" sub="General ledger, expenses, approvals and budgets — fee collection is not profit" />
    <FinanceWorkspace expenses={Q.expenses} tb={Q.trialBalance()} budget={Q.budget} recon={Q.subledgerRecon()} cash={Q.cashPosition()} incExp={Q.incomeVsExpense()} breakdown={Q.expenseBreakdown()} income={income} expenseTotal={Q.totalExpenditure()} /></>);
}
