// 1️⃣ Modules
const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const TonWeb = require('tonweb');
const serviceAccount = require('./firebase-key.json'); // Firebase private key

// 2️⃣ Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// 3️⃣ Telegram Bot
const token = '8242964153:AAF5kXqb9S5CxDA1dprg_99RFMEcKO5GO0w';  // <-- Replace
const bot = new TelegramBot(token, { polling: true });

// 4️⃣ TON API (Mainnet)
const tonweb = new TonWeb(
  new TonWeb.HttpProvider("https://toncenter.com/api/v2/jsonRPC", {
    apiKey: "YOUR_TONCENTER_API_KEY"  // <-- Replace
  })
);

// Sender wallet (Bot payout wallet)
const senderSecretKey = TonWeb.utils.base64ToBytes("YOUR_SECRET_KEY"); 
const senderPublicKey = TonWeb.utils.base64ToBytes("YOUR_PUBLIC_KEY"); 
const WalletClass = tonweb.wallet.all.v3R2;
const senderWallet = new WalletClass(tonweb.provider, { publicKey: senderPublicKey });

// 5️⃣ Ads Links
const adsLinks = [
  "https://www.revenuecpmgate.com/vtd3twkp?key=3b796508e758cb2d252c4fcf3b771f6f",
  "https://www.revenuecpmgate.com/vd79x0gi0f?key=09030777f5b829d3dd342620d9efa5ab",
  "https://www.revenuecpmgate.com/tm05yq1b?key=8c8e39dd7e718eff7b7874a959dcdcbd",
  "https://www.revenuecpmgate.com/au7uzpr9e6?key=05aaeda7fd45f1c5834673bab84dd53e",
  "https://www.revenuecpmgate.com/s1ie44dct?key=578419020f88b26265c21ad4aa86a2d7",
  "https://www.revenuecpmgate.com/g7ects0xf4?key=f1cdd63398c2697927773551ad6b8715",
  "https://www.revenuecpmgate.com/yev00gg4?key=68c5e70125364a9c75ca9c10ae072f04",
  "https://www.revenuecpmgate.com/xppgxy7zf9?key=11c1c409f21b8bc99cf79409e81ebf78",
  "https://www.revenuecpmgate.com/uy3mrkhf?key=769e8c7e3ce21e54ff42168ac42d0efe",
  "https://www.revenuecpmgate.com/r38vw4hed?key=080e7883c7a3d852ab2e8abd39636a5b",
  "https://www.revenuecpmgate.com/c1md5teac?key=8331fd9fd75e3ca6453333e8202b34c9",
];
function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 6️⃣ Firestore Functions
async function initUser(userId) {
  const userRef = db.collection('users').doc(userId.toString());
  const doc = await userRef.get();
  if (!doc.exists) {
    await userRef.set({ coins: 0, pending_ad: null, last_daily_bonus: null, ton_wallet: "" });
  }
}
async function addCoins(userId, amount) {
  const userRef = db.collection('users').doc(userId.toString());
  await db.runTransaction(async (t) => {
    const doc = await t.get(userRef);
    const current = doc.exists ? doc.data().coins : 0;
    t.set(userRef, { ...doc.data(), coins: current + amount });
  });
}

// 7️⃣ Pending Ad Handling
async function setPendingAd(userId, link) {
  const userRef = db.collection('users').doc(userId.toString());
  await userRef.update({
    pending_ad: {
      link,
      start_time: admin.firestore.Timestamp.now(),
      rewarded: false
    }
  });
}
async function verifyAdClick(userId) {
  const userRef = db.collection('users').doc(userId.toString());
  const doc = await userRef.get();
  const pending = doc.data().pending_ad;
  if (!pending || pending.rewarded) return false;
  const now = new Date();
  const adStart = pending.start_time.toDate();
  if ((now - adStart) / 1000 >= 50) {   // ✅ 50 seconds
    await userRef.update({
      pending_ad: { ...pending, rewarded: true }
    });
    await addCoins(userId, 100); // 100 coins per ad
    return true;
  }
  return false;
}

// 8️⃣ Bot Commands
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await initUser(chatId);
  bot.sendMessage(chatId,
    "👋 Welcome!\n\n" +
    "👉 /ad - Watch ads to earn coins\n" +
    "👉 /verify - Verify ad watch & get coins\n" +
    "👉 /balance - Check your balance\n" +
    "👉 /redeem - Redeem coins (Binance/PayPal)\n" +
    "👉 /dailybonus - Claim daily reward"
  );
});

bot.onText(/\/ad/, async (msg) => {
  const chatId = msg.chat.id;
  await initUser(chatId);
  const link = getRandom(adsLinks);
  await setPendingAd(chatId, link);
  bot.sendMessage(chatId, `🔥 New Ad\n👉 Click here and watch for 50 seconds: ${link}\nCoins will be added after 50 seconds watch!`);
});

bot.onText(/\/balance/, async (msg) => {
  const chatId = msg.chat.id;
  const userRef = db.collection('users').doc(chatId.toString());
  const doc = await userRef.get();
  bot.sendMessage(chatId, `💰 Your balance: ${doc.data().coins} coins`);
});

bot.onText(/\/verify/, async (msg) => {
  const chatId = msg.chat.id;
  const success = await verifyAdClick(chatId);
  if (success) {
    const userRef = db.collection('users').doc(chatId.toString());
    const doc = await userRef.get();
    bot.sendMessage(chatId, `🎉 Coins added! Current balance: ${doc.data().coins} coins`);
  } else {
    bot.sendMessage(chatId, `⏳ Please watch the ad for 50 seconds first.`);
  }
});

// 🔟 Redeem Coins → Manual Request (Binance / PayPal)
bot.onText(/\/redeem/, async (msg) => {
  const chatId = msg.chat.id;
  const userRef = db.collection('users').doc(chatId.toString());
  const doc = await userRef.get();
  const coins = doc.exists ? doc.data().coins : 0;

  if (coins < 500000) {
    bot.sendMessage(chatId, `❌ You need at least 500,000 coins to redeem. Current: ${coins}`);
    return;
  }

  bot.sendMessage(chatId, "💰 Please choose your redeem method:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Binance", callback_data: "redeem_binance" }],
        [{ text: "PayPal", callback_data: "redeem_paypal" }]
      ]
    }
  });
});

// Handle redeem method
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === "redeem_binance") {
    bot.sendMessage(chatId, "🔑 Please enter your Binance ID:");
    db.collection("temp_redeem").doc(chatId.toString()).set({
      method: "binance",
      step: "waiting_account"
    });
  } else if (data === "redeem_paypal") {
    bot.sendMessage(chatId, "📧 Please enter your PayPal email:");
    db.collection("temp_redeem").doc(chatId.toString()).set({
      method: "paypal",
      step: "waiting_account"
    });
  }
});

// Handle account input after method chosen
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  if (!msg.text || msg.text.startsWith("/")) return;

  const tempRef = db.collection("temp_redeem").doc(chatId.toString());
  const tempDoc = await tempRef.get();
  if (!tempDoc.exists) return;

  const { method, step } = tempDoc.data();
  if (step === "waiting_account") {
    const account = msg.text;

    const userRef = db.collection("users").doc(chatId.toString());
    const userDoc = await userRef.get();
    const coins = userDoc.exists ? userDoc.data().coins : 0;

    if (coins < 500000) {
      bot.sendMessage(chatId, "❌ You don't have enough coins to redeem.");
      await tempRef.delete();
      return;
    }

    const redeemRef = db.collection("redeem_requests").doc();
    await redeemRef.set({
      user_id: chatId,
      username: msg.from.username || msg.from.first_name,
      coins,
      method,
      account,
      status: "pending",
      requested_at: admin.firestore.Timestamp.now()
    });

    const redeemId = redeemRef.id;

    await userRef.update({ coins: 0 });
    await tempRef.delete();

    bot.sendMessage(chatId, `✅ Your redeem request has been submitted!\nMethod: ${method}\nAccount: ${account}\n⏳ Please wait for admin to process.`);

    const ADMIN_ID = "7903784090"; // Replace
    bot.sendMessage(
      ADMIN_ID,
      `📢 New Redeem Request!\n` +
      `🆔 Request ID: ${redeemId}\n` +
      `👤 User: ${msg.from.username || msg.from.first_name} (ID: ${chatId})\n` +
      `💰 Coins: ${coins}\n` +
      `🔑 Method: ${method}\n` +
      `📩 Account: ${account}\n\n` +
      `👉 Confirm: /confirmredeem ${redeemId}\n` +
      `👉 Reject: /rejectredeem ${redeemId}`
    );
  }
});

// 1️⃣1️⃣ Daily Bonus
bot.onText(/\/dailybonus/, async (msg) => {
  const chatId = msg.chat.id;
  const userRef = db.collection('users').doc(chatId.toString());
  const doc = await userRef.get();
  const lastBonus = doc.data().last_daily_bonus;
  const now = new Date();
  if (lastBonus && (now - lastBonus.toDate()) / (1000 * 60 * 60 * 24) < 1) {
    bot.sendMessage(chatId, `❌ You already claimed today's bonus.`);
    return;
  }
  await addCoins(chatId, 50);
  await userRef.update({ last_daily_bonus: admin.firestore.Timestamp.now() });
  bot.sendMessage(chatId, `🎁 Daily bonus claimed: +50 coins`);
});

// 1️⃣2️⃣ Admin confirm redeem
bot.onText(/\/confirmredeem (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const ADMIN_ID = "7903784090";

  if (chatId.toString() !== ADMIN_ID) {
    bot.sendMessage(chatId, "❌ You are not authorized to confirm redeems.");
    return;
  }

  const redeemId = match[1].trim();

  const redeemRef = db.collection("redeem_requests").doc(redeemId);
  const redeemDoc = await redeemRef.get();

  if (!redeemDoc.exists) {
    bot.sendMessage(chatId, "❌ Invalid redeem request ID.");
    return;
  }

  const redeemData = redeemDoc.data();
  if (redeemData.status === "completed") {
    bot.sendMessage(chatId, "⚠️ This redeem request is already completed.");
    return;
  }

  await redeemRef.update({ status: "completed", completed_at: admin.firestore.Timestamp.now() });

  bot.sendMessage(
    redeemData.user_id,
    `✅ Your redeem has been processed!\n\n💰 ${redeemData.coins} coins redeemed\n🔑 Method: ${redeemData.method}\n📩 Account: ${redeemData.account}\n\n🎉 Thank you for using our service!`
  );

  bot.sendMessage(chatId, `✅ Redeem request confirmed for user ${redeemData.username} (ID: ${redeemData.user_id}).`);
});

// 1️⃣3️⃣ Admin reject redeem
bot.onText(/\/rejectredeem (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const ADMIN_ID = "7903784090";

  if (chatId.toString() !== ADMIN_ID) {
    bot.sendMessage(chatId, "❌ You are not authorized to reject redeems.");
    return;
  }

  const redeemId = match[1].trim();

  const redeemRef = db.collection("redeem_requests").doc(redeemId);
  const redeemDoc = await redeemRef.get();

  if (!redeemDoc.exists) {
    bot.sendMessage(chatId, "❌ Invalid redeem request ID.");
    return;
  }

  const redeemData = redeemDoc.data();
  if (redeemData.status === "completed" || redeemData.status === "rejected") {
    bot.sendMessage(chatId, "⚠️ This redeem request is already resolved.");
    return;
  }

  await redeemRef.update({ status: "rejected", rejected_at: admin.firestore.Timestamp.now() });

  await addCoins(redeemData.user_id, redeemData.coins);

  bot.sendMessage(
    redeemData.user_id,
    `❌ Your redeem request has been rejected by admin.\n💰 ${redeemData.coins} coins refunded back to your balance.`
  );

  bot.sendMessage(chatId, `✅ Redeem request rejected and ${redeemData.coins} coins refunded to user ${redeemData.username} (ID: ${redeemData.user_id}).`);
});
