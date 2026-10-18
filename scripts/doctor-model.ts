import * as dotenv from "dotenv";
dotenv.config();

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

async function main() {
  console.log("=== ProofPay Model Layer Doctor (Google Gemini) ===");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes("your_gemini_api_key")) {
    console.error("\n[FAIL] GEMINI_API_KEY is missing or unconfigured in .env.");
    console.error("Please add a valid Google AI Studio key to your .env file.");
    process.exit(1);
  }

  const modelId = process.env.MODEL_ID || "gemini-3.8-flash";
  const fallbackModelId = process.env.MODEL_FALLBACK_ID || "gemini-3.5-flash-lite";

  const google = createGoogleGenerativeAI({ apiKey });

  console.log(`Checking Primary Model:  ${modelId}`);
  console.log(`Checking Fallback Model: ${fallbackModelId}\n`);

  let primaryWorking = false;
  let fallbackWorking = false;

  // 1. Test Primary Model
  try {
    const res = await generateText({
      model: google(modelId),
      prompt: "Respond with the single word: READY",
    });
    console.log(`[PASS] Primary Model (${modelId}) is ACTIVE: "${res.text.trim()}"`);
    primaryWorking = true;
  } catch (err: any) {
    console.error(`[FAIL] Primary Model (${modelId}) call failed: ${err.message}`);
  }

  // 2. Test Fallback Model
  try {
    const res = await generateText({
      model: google(fallbackModelId),
      prompt: "Respond with the single word: READY",
    });
    console.log(`[PASS] Fallback Model (${fallbackModelId}) is ACTIVE: "${res.text.trim()}"`);
    fallbackWorking = true;
  } catch (err: any) {
    console.warn(`[WARN] Fallback Model (${fallbackModelId}) failed: ${err.message}`);
  }

  if (!primaryWorking) {
    console.error(`\n[FATAL] Configured MODEL_ID (${modelId}) failed verification.`);
    console.error("Check Google AI Studio deprecations or update MODEL_ID in .env.");
    process.exit(1);
  }

  console.log("\n[PASS] Model Doctor successfully verified model availability!");
}

main().catch((err) => {
  console.error("Doctor script error:", err);
  process.exit(1);
});

