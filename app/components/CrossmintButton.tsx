"use client";

import React, { useState } from "react";

export default function CrossmintButton(props: any) {
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    setLoading(true);
    
    // 1. إعداد رابط الدفع (Staging Environment)
    // ملاحظة: هذا الرابط يحتاج ClientID حقيقي ليعمل 100%، لكنه سيفتح النافذة الآن للتجربة
    const baseUrl = "https://staging.crossmint.com/checkout/request";
    const params = new URLSearchParams({
      clientId: props.clientId || "YOUR_CLIENT_ID", // سيتم استبداله لاحقاً
      mintConfig: JSON.stringify(props.mintConfig || {}),
      locale: "en-US",
      currency: "USD",
    });

    // 2. فتح نافذة الدفع
    const url = `${baseUrl}?${params.toString()}`;
    window.open(url, "_blank", "width=400,height=700,scrollbars=yes,resizable=yes");
    
    // إعادة تعيين الزر بعد فترة قصيرة
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <button
      type="button" // مهم لمنع تقديم النموذج عند الضغط
      onClick={handleClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 bg-[#00D180] hover:bg-[#00b570] text-black font-bold py-3 px-4 rounded-lg transition-all duration-200 shadow-[0_0_15px_rgba(0,209,128,0.3)] hover:shadow-[0_0_20px_rgba(0,209,128,0.5)]"
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
      ) : (
        // أيقونة Crossmint (تقريبية)
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z" fill="black"/>
        </svg>
      )}
      {loading ? "Opening Secure Checkout..." : "Pay with Card"}
    </button>
  );
}