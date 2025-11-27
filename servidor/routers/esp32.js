async function sendToESP32(ip, endpoint, data = {}) {
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`http://${ip}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data),
      timeout: 5000
    });
    
    if (!response.ok) {
      throw new Error(`ESP32 respondió: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    throw new Error(`Error comunicación con ESP32: ${error.message}`);
  }
}

async function pingESP32(ip) {
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`http://${ip}/ping`, {
      method: 'GET',
      timeout: 2000
    });
    
    return response.ok;
  } catch (error) {
    return false;
  }
}

module.exports = {
  sendToESP32,
  pingESP32
};