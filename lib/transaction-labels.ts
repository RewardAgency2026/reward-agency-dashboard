// Shared transaction type labels and styles — single source of truth

export const TXN_LABEL: Record<string, string> = {
  payment: "Credit Client Wallet",
  topup: "Top Up",
  commission_fee: "Client Commission Fee",
  ad_account_withdrawal: "Withdrawal",
  commission_refund: "Commission Refund",
  supplier_fee_refund: "Provider Fee Refund",
  withdraw: "Client Wallet Withdrawal",
  refund: "Refund",
  spend_record: "Spend Record",
};

export const TXN_BADGE: Record<string, string> = {
  payment: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  topup: "bg-blue-50 text-blue-700 border border-blue-200",
  commission_fee: "bg-orange-50 text-orange-700 border border-orange-200",
  ad_account_withdrawal: "bg-orange-50 text-orange-700 border border-orange-200",
  commission_refund: "bg-orange-50 text-orange-700 border border-orange-200",
  supplier_fee_refund: "bg-orange-50 text-orange-700 border border-orange-200",
  withdraw: "bg-orange-50 text-orange-700 border border-orange-200",
  refund: "bg-red-50 text-red-700 border border-red-200",
  spend_record: "bg-gray-100 text-gray-600",
};

export const TXN_AMOUNT_CLASS: Record<string, string> = {
  payment: "text-emerald-600",
  topup: "text-blue-600",
  commission_fee: "text-orange-600",
  ad_account_withdrawal: "text-emerald-600",
  commission_refund: "text-emerald-600",
  supplier_fee_refund: "text-emerald-600",
  withdraw: "text-orange-600",
  refund: "text-red-600",
  spend_record: "text-gray-500",
};

// Types that credit the CLIENT wallet (shown with + sign)
export const TXN_CREDIT_TYPES = new Set([
  "payment",
  "ad_account_withdrawal",
  "commission_refund",
]);
