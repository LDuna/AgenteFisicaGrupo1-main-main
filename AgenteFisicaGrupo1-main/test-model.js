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
async function test() {
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: 'Hola',
    });
    console.log("Response:", res.text);
  } catch (err) {
    console.error("Error:", err.message);
  }
}
test();
