require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
