// lib/csvExporter.ts

const categoryLabels: Record<number, string> = {
  0: "Salary",
  1: "Invoice",
  2: "Donation",
  3: "Subscription",
  4: "Test Purchase",
  5: "Loan repayment",
  6: "Other",
};

function formatDate(timestamp: bigint): string {
  return new Date(Number(timestamp) * 1000).toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatUsdc(amount: bigint): string {
  return (Number(amount) / 1000000).toFixed(2);
}

export function exportReceiptsToCsv(receipts: any[], currentAddress: string | undefined) {
  if (!receipts || receipts.length === 0) {
    alert("No receipts to export.");
    return;
  }

  // 1. تعريف رؤوس الأعمدة
  const headers = [
    "Receipt ID",
    "Date",
    "Type",
    "Amount (USDC)",
    "Category",
    "From Address",
    "To Address",
    "Route",
    "Description",
    "Explorer Link"
  ];

  // 2. تحويل البيانات
  const rows = receipts.map((r) => {
    const isSent = currentAddress && r.from.toLowerCase() === currentAddress.toLowerCase();
    const type = isSent ? "SENT (OUT)" : "RECEIVED (IN)";
    
    // تنظيف النصوص من أي فواصل قد تكسر الملف
    const cleanReason = r.reason ? r.reason.replace(/"/g, '""') : "";
    const link = `https://testnet.arcscan.app/address/${r.to}`; 

    // ✅ التعديل: نضع كل قيمة داخل علامات تنصيص لضمان التنسيق
    return [
      `"${r.id.toString()}"`,
      `"${formatDate(r.timestamp)}"`,
      `"${type}"`,
      `"${formatUsdc(r.amount)}"`,
      `"${categoryLabels[r.category] || "Other"}"`,
      `"${r.from}"`,
      `"${r.to}"`,
      `"${r.corridor}"`,
      `"${cleanReason}"`,
      `"${link}"`
    ].join(",");
  });

  const csvContent = [headers.join(","), ...rows].join("\n");

  // ✅ السحر هنا: إضافة \uFEFF في البداية (BOM)
  // هذا يجبر Excel على قراءة الملف بترميز UTF-8 وفهم الفواصل
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Arc_Receipts_${new Date().toISOString().slice(0, 10)}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}