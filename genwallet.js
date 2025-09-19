const TonWeb = require("tonweb");

async function main() {
  // 🔑 Keypair generate
  const keyPair = TonWeb.utils.newKeyPair();

  console.log("✅ Public Key (base64):", TonWeb.utils.bytesToBase64(keyPair.publicKey));
  console.log("✅ Secret Key (base64):", TonWeb.utils.bytesToBase64(keyPair.secretKey));

  // 🌐 Provider (Mainnet အတွက်)
  const tonweb = new TonWeb(new TonWeb.HttpProvider("https://toncenter.com/api/v2/jsonRPC"));

  // Wallet V3R2 (TON မှာ သုံးသည့် default wallet)
  const WalletClass = tonweb.wallet.all.v3R2;
  const wallet = new WalletClass(tonweb.provider, { publicKey: keyPair.publicKey });

  const walletAddress = await wallet.getAddress();
  console.log("✅ Wallet Address:", walletAddress.toString(true, true, true));
}

main();
