export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { amountLamports } = await request.json();
    if (!amountLamports || amountLamports <= 0) {
      return Response.json({ error: 'Invalid amount' }, { status: 400 });
    }
    return Response.json({
      success: true,
      signature: `mock_${Date.now()}`,
      amountOut: String(amountLamports * 1000),
      amountOutUi: (amountLamports / 1e9).toFixed(6)
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
