const path = require('path');
const fs = require('fs');
const apiKeyPath = path.join(__dirname, 'config', 'apikey.txt');
let apiKey = '';
if (fs.existsSync(apiKeyPath)) {
  apiKey = fs.readFileSync(apiKeyPath, 'utf8').trim();
}
if (!apiKey) {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
  apiKey = process.env.API_KEY;
}
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: apiKey });

async function testAll() {
  const models = [
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash'
  ];
  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        model: model,
        contents: 'Hola',
      });
      console.log(`[SUCCESS] ${model}:`, res.text.trim());
    } catch (err) {
      console.error(`[FAIL] ${model}:`, err.message.slice(0, 150) + '...');
    }
  }
}
testAll();
