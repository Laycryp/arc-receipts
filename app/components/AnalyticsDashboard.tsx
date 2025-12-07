"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

// تعريف ألوان المخطط لتتناسب مع الثيم الداكن (Dark Theme Palette)
const COLORS = [
  "#38bdf8", // Sky Blue
  "#818cf8", // Indigo
  "#34d399", // Emerald
  "#fbbf24", // Amber
  "#f472b6", // Pink
  "#a78bfa", // Violet
  "#94a3b8", // Slate (Others)
];

const categoryLabels: Record<number, string> = {
  0: "Salary",
  1: "Invoice",
  2: "Donation",
  3: "Subscription",
  4: "Test Purchase",
  5: "Loan repayment",
  6: "Other",
};

interface Receipt {
  id: bigint;
  from: string;
  to: string;
  amount: bigint;
  category: number;
}

interface Props {
  receipts: Receipt[];
  currentAddress: string | undefined;
}

// دالة مساعدة لتنسيق المبلغ
function formatUsdc(amount: bigint): string {
  const val = Number(amount) / 1000000;
  return val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function AnalyticsDashboard({ receipts, currentAddress }: Props) {
  // 1. معالجة البيانات (Data Processing)
  const stats = useMemo(() => {
    if (!currentAddress || receipts.length === 0) return null;

    const addrLower = currentAddress.toLowerCase();
    let totalSent = BigInt(0);
    let totalReceived = BigInt(0);
    const categoryMap: Record<string, number> = {};

    receipts.forEach((r) => {
      const isSent = r.from.toLowerCase() === addrLower;
      
      if (isSent) {
        totalSent += r.amount;
        // تجميع المصروفات حسب الفئة
        const catName = categoryLabels[r.category] || "Unknown";
        // نحول المبلغ لرقم عادي للرسم البياني (USDC decimals = 6)
        const val = Number(r.amount) / 1000000;
        categoryMap[catName] = (categoryMap[catName] || 0) + val;
      } else {
        totalReceived += r.amount;
      }
    });

    // تحويل الكائن لمصفوفة للرسم البياني
    const chartData = Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value); // الأكبر أولاً

    return { totalSent, totalReceived, chartData };
  }, [receipts, currentAddress]);

  if (!stats) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      {/* البطاقة 1: ملخص الأرقام */}
      <div className="lg:col-span-1 flex flex-col gap-4">
        <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex flex-col justify-center">
          <span className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Received</span>
          <div className="text-2xl font-bold text-emerald-400">
            + {formatUsdc(stats.totalReceived)} <span className="text-sm font-normal text-slate-500">USDC</span>
          </div>
        </div>
        <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex flex-col justify-center">
          <span className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Spent</span>
          <div className="text-2xl font-bold text-white">
            - {formatUsdc(stats.totalSent)} <span className="text-sm font-normal text-slate-500">USDC</span>
          </div>
        </div>
      </div>

      {/* البطاقة 2: الرسم البياني للمصروفات */}
      <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex flex-col">
        <h3 className="text-sm font-semibold text-slate-300 mb-4 px-2">Spending by Category</h3>
        
        {stats.chartData.length > 0 ? (
          <div className="flex-1 w-full h-[180px] text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {stats.chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                  itemStyle={{ color: '#f8fafc' }}
                  formatter={(value: number) => `${value.toFixed(2)} USDC`}
                />
                <Legend 
                  layout="vertical" 
                  verticalAlign="middle" 
                  align="right"
                  wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-xs italic">
            No spending data to display yet.
          </div>
        )}
      </div>
    </div>
  );
}