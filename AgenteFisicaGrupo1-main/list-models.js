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
