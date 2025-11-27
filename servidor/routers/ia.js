const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

async function generateLEDCode(prompt) {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `Eres un experto en programación de microcontroladores ESP32 con ESP-IDF.

HARDWARE DISPONIBLE:
- ESP32-C6 con 10 LEDs conectados
- GPIO 4:  LED Verde
- GPIO 5:  LED Amarillo  
- GPIO 6:  LED Rojo
- GPIO 7:  LED Azul
- GPIO 10: LED Naranja
- GPIO 11: LED Naranja
- GPIO 15: LED Azul
- GPIO 18: LED Rojo
- GPIO 19: LED Amarillo
- GPIO 20: LED Verde

INSTRUCCIONES:
1. Genera código C para ESP-IDF
2. Usa gpio_set_level(gpio_num, 0/1) para controlar LEDs
3. Usa vTaskDelay(ms / portTICK_PERIOD_MS) para delays
4. NO uses includes, setup o loop
5. Solo código ejecutable directo
6. Máximo 50 líneas
7. Comenta brevemente qué hace

EJEMPLO:
Usuario: "Enciende todos los LEDs"
Código:
// Encender todos los LEDs
int leds[] = {4, 5, 6, 7, 10, 11, 15, 18, 19, 20};
for(int i = 0; i < 10; i++) {
    gpio_set_level(leds[i], 1);
}

Ahora genera código para: "${prompt}"`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "llama-3.1-70b-versatile",
      temperature: 0.3,
      max_tokens: 1000
    });
    
    return completion.choices[0].message.content;
  } catch (error) {
    throw new Error(`Error de IA: ${error.message}`);
  }
}

module.exports = {
  generateLEDCode
};