const path = require('path'); // Importa path primero
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') }); // Busca .env en el padre (dualnode)

const fs = require('fs');
const envPath = path.resolve(__dirname, '..', '.env'); // Ruta absoluta a .env en dualnode

console.log('Ruta absoluta calculada para .env:', envPath);
console.log('¿Existe el archivo? (usando fs para verificar):');
if (fs.existsSync(envPath)) {
  console.log('Sí, el archivo .env existe.');
  const content = fs.readFileSync(envPath, 'utf8');
  console.log('Contenido del .env (para depuración):', content);
} else {
  console.log('No, el archivo .env NO existe en esa ruta.');
}

console.log('GROQ_API_KEY después de cargar:', process.env.GROQ_API_KEY || 'undefined');
console.log('PORT después de cargar:', process.env.PORT || 'undefined');
console.log('MAX_STATIONS después de cargar:', process.env.MAX_STATIONS || 'undefined');

const { Groq } = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function testApi() {
  try {
    const response = await groq.chat.completions.create({
      // ...
      messages: [{ role: 'user', content: '¿Cuál es el pronóstico del clima para la Ciudad de México hoy?' }],
// ...
      model: 'llama-3.1-8b-instant', // Reemplazo recomendado
    });
    console.log('Respuesta de Groq:', response.choices[0]?.message?.content);
  } catch (error) {
    console.error('Error en Groq:', error.message);
  }
}

testApi();