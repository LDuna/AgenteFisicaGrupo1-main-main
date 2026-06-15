require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

async function listModels() {
  try {
    const response = await ai.models.list();
    for await (const model of response) {
      if (model.name.includes('flash')) {
        console.log(model.name);
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

listModels();
