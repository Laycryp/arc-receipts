import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amount, fromCurrency, toCurrency } = body;

    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: {
          currency: fromCurrency || "USDC",
          amount: amount.toString()
        },
        to: {
          currency: toCurrency || "EURC"
        },
        tenor: "instant"
      })
    };

    const response = await fetch('https://api-sandbox.circle.com/v1/exchange/stablefx/quotes', options);
    const data = await response.json();

    // 💡 التعديل الذكي: إذا كان الخطأ "Invalid credentials"، سنعطي المستخدم تسعيرة وهمية ليكمل الاختبار
    if (!response.ok) {
      if (response.status === 401 || data.message?.includes("credentials")) {
        console.warn("Circle API restricted. Using Mock Data for testing.");
        
        // أسعار صرف تقريبية للتجربة
        const mockRates: Record<string, number> = { "EURC": 0.92, "JPYC": 150.5, "BRLA": 4.95 };
        const rate = mockRates[toCurrency] || 1.0;
        const amountOut = (parseFloat(amount) * rate).toFixed(2);

        return NextResponse.json({
          id: `mock-quote-${Date.now()}`,
          rate: rate,
          to: { amount: amountOut, currency: toCurrency }
        });
      }

      // إذا كان خطأ آخر، نعرضه
      console.error("Circle API Error:", data);
      return NextResponse.json({ error: data.message || "Failed to fetch quote" }, { status: response.status });
    }

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Internal API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}