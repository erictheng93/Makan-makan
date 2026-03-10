/**
 * 簡單的測試 processor - 用於診斷
 */

const API_BASE_URL = process.env.API_URL || "http://localhost:8787";

async function testTokenGeneration(context, events, done) {
  console.log("🔍 Processor 函數被調用了！");
  events.emit("counter", "processor.called", 1);

  try {
    console.log(
      "🌐 發送 token 請求到:",
      `${API_BASE_URL}/api/v1/realtime/auth/token`,
    );

    const response = await fetch(`${API_BASE_URL}/api/v1/realtime/auth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        roomType: "kitchen",
        roomId: "1",
        restaurantId: "1",
        sessionId: "test",
      }),
    });

    console.log("📡 Response status:", response.status);
    const data = await response.json();
    console.log("📦 Response data:", JSON.stringify(data, null, 2));

    if (response.ok && data.success) {
      events.emit("counter", "token.success", 1);
      context.vars.token = data.data.token;
      console.log("✅ Token 生成成功！");
    } else {
      events.emit("counter", "token.failed", 1);
      console.log("❌ Token 生成失敗:", data.error);
    }
  } catch (error) {
    events.emit("counter", "token.error", 1);
    console.log("💥 錯誤:", error.message);
  }

  return done();
}

module.exports = {
  testTokenGeneration,
};
