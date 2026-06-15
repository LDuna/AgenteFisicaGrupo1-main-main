require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
async function testAll() {
  const models = [
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-2.5-flash-lite',
    'gemini-3.1-flash-lite'
  ];
  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        model: model,
        contents: 'Hola',
      });
      console.log(`[SUCCESS] ${model}:`, res.text);
    } catch (err) {
      console.error(`[FAIL] ${model}:`, err.message.slice(0, 100) + '...');
    }
  }
}
testAll();
