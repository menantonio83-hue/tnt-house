import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

export async function POST(request) {
  try {
    const body = await request.json();
    const { amountLamports } = body;

    if (!amountLamports || typeof amountLamports !== 'number' || amountLamports <= 0) {
      return Response.json({ error: 'Invalid amountLamports' }, { status: 400 });
    }

    const privateKeyBase58 = process.env.MIGRATOR_PRIVATE_KEY;
    if (!privateKeyBase58) {
      console.error('MIGRATOR_PRIVATE_KEY is not set in environment variables');
      return Response.json({ error: 'Server wallet not configured' }, { status: 500 });
    }

    // Decode private key
    let secretKey;
    try {
      secretKey = bs58.decode(privateKeyBase58);
    } catch (e) {
      return Response.json({ error: 'Invalid private key format (must be base58)' }, { status: 500 });
    }

    const keypair = Keypair.fromSecretKey(secretKey);
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

    // 1. Get quote from Jupiter v6
    const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=8Q22r9qUm4AzFzTpZgaPYMxqq4z5WxE9FVa7X9dsvmBg&amount=${amountLamports}&slippageBps=50&onlyDirectRoutes=false`;
    
    const quoteRes = await fetch(quoteUrl);
    if (!quoteRes.ok) {
      const errText = await quoteRes.text();
      return Response.json({ error: 'Failed to fetch quote from Jupiter', details: errText }, { status: 500 });
    }

    const quote = await quoteRes.json();

    if (!quote || quote.error) {
      return Response.json({ error: 'No valid quote returned from Jupiter', details: quote }, { status: 500 });
    }

    // 2. Get swap transaction from Jupiter
    const swapPayload = {
      quoteResponse: quote,
      userPublicKey: keypair.publicKey.toString(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto'
    };

    const swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(swapPayload)
    });

    if (!swapRes.ok) {
      const errText = await swapRes.text();
      return Response.json({ error: 'Failed to get swap transaction from Jupiter', details: errText }, { status: 500 });
    }

    const swapData = await swapRes.json();

    if (!swapData.swapTransaction) {
      return Response.json({ error: 'No swapTransaction returned from Jupiter' }, { status: 500 });
    }

    // 3. Deserialize VersionedTransaction and sign with server keypair
    const transactionBuffer = Buffer.from(swapData.swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(transactionBuffer);

    transaction.sign([keypair]);

    // 4. Send raw transaction
    const signature = await connection.sendRawTransaction(transaction.serialize());

    // 5. Confirm transaction
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      return Response.json({ error: 'Transaction failed on-chain', details: confirmation.value.err }, { status: 500 });
    }

    return Response.json({
      success: true,
      signature,
      amountOut: quote.outAmount,                    // raw amount (MRDT has 6 decimals)
      amountOutUi: (Number(quote.outAmount) / 1_000_000).toFixed(6)  // human readable
    });

  } catch (error) {
    console.error('swapSolToMrdt error:', error);
    return Response.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}
