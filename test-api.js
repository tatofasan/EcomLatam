#!/usr/bin/env node

/**
 * Script externo para probar la API de ingesta y consulta de estado
 * 
 * Uso:
 * node test-api.js <API_KEY> <BASE_URL>
 * 
 * Ejemplo:
 * node test-api.js "d29fb280-9cce-4e4a-a751-74ad2..." "http://localhost:5000"
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

class APITester {
  constructor(apiKey, baseUrl) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.createdOrders = [];
  }

  // Función helper para hacer peticiones HTTP/HTTPS
  makeRequest(url, options, data = null) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          ...options.headers
        }
      };

      if (data) {
        const jsonData = JSON.stringify(data);
        requestOptions.headers['Content-Length'] = Buffer.byteLength(jsonData);
      }

      const req = client.request(requestOptions, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: parsed
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: responseData
            });
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  // Test de ingesta de órdenes
  async testOrderIngestion() {
    console.log('\n=== PRUEBA DE INGESTA DE ÓRDENES ===');
    
    const testCases = [
      {
        name: "Orden completa con todos los campos",
        data: {
          productId: 1,
          quantity: 2,
          salePrice: 999.99, // Este precio será ignorado, se usará el del producto
          customerName: "Juan Pérez",
          customerPhone: "+34612345678",
          customerAddress: "Calle Mayor 123",
          postalCode: "28001",
          city: "Madrid",
          province: "Madrid",
          customerEmail: "juan.perez@email.com",
          notes: "Entrega urgente"
        }
      },
      {
        name: "Orden mínima (solo campos obligatorios)",
        data: {
          productId: 1,
          customerName: "María García",
          customerPhone: "+34687654321"
        }
      },
      {
        name: "Orden con quantity vacía (debe asumir 1)",
        data: {
          productId: 1,
          customerName: "Carlos López",
          customerPhone: "+34611223344",
          customerAddress: "Avenida de la Paz 45",
          city: "Barcelona"
        }
      },
      {
        name: "Orden con productId inexistente (debe fallar)",
        data: {
          productId: 99999,
          customerName: "Test Error",
          customerPhone: "+34600000000"
        }
      },
      {
        name: "Orden sin campos obligatorios (debe fallar)",
        data: {
          productId: 1,
          quantity: 1
          // Faltan customerName y customerPhone
        }
      }
    ];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`\n${i + 1}. ${testCase.name}`);
      console.log('Datos enviados:', JSON.stringify(testCase.data, null, 2));
      
      try {
        const response = await this.makeRequest(
          `${this.baseUrl}/api/external/orders`,
          { method: 'POST' },
          testCase.data
        );
        
        console.log(`Estado: ${response.status}`);
        console.log('Respuesta:', JSON.stringify(response.data, null, 2));
        
        // Si la orden se creó exitosamente, guardar el número de orden
        if (response.status === 201 && response.data.success && response.data.order) {
          this.createdOrders.push(response.data.order.orderNumber);
          console.log(`✅ Orden creada: ${response.data.order.orderNumber}`);
        } else if (response.status >= 400) {
          console.log(`❌ Error esperado: ${response.data.message || 'Sin mensaje'}`);
        }
        
      } catch (error) {
        console.log('❌ Error de conexión:', error.message);
      }
      
      // Pausa entre requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Test de consulta de estado
  async testOrderStatusQuery() {
    console.log('\n=== PRUEBA DE CONSULTA DE ESTADO ===');
    
    if (this.createdOrders.length === 0) {
      console.log('❌ No hay órdenes creadas para consultar');
      return;
    }

    for (let i = 0; i < this.createdOrders.length; i++) {
      const orderNumber = this.createdOrders[i];
      console.log(`\n${i + 1}. Consultando orden: ${orderNumber}`);
      
      try {
        const response = await this.makeRequest(
          `${this.baseUrl}/api/external/orders/${orderNumber}/status`,
          { method: 'GET' }
        );
        
        console.log(`Estado: ${response.status}`);
        console.log('Respuesta:', JSON.stringify(response.data, null, 2));
        
        if (response.status === 200) {
          console.log(`✅ Estado consultado exitosamente`);
        } else {
          console.log(`❌ Error: ${response.data.message || 'Sin mensaje'}`);
        }
        
      } catch (error) {
        console.log('❌ Error de conexión:', error.message);
      }
      
      // Pausa entre requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Test con orden inexistente
    console.log('\n' + (this.createdOrders.length + 1) + '. Consultando orden inexistente');
    try {
      const response = await this.makeRequest(
        `${this.baseUrl}/api/external/orders/ORD-INEXISTENTE-123/status`,
        { method: 'GET' }
      );
      
      console.log(`Estado: ${response.status}`);
      console.log('Respuesta:', JSON.stringify(response.data, null, 2));
      
      if (response.status === 404) {
        console.log(`✅ Error 404 esperado para orden inexistente`);
      }
      
    } catch (error) {
      console.log('❌ Error de conexión:', error.message);
    }
  }

  // Ejecutar todas las pruebas
  async runAllTests() {
    console.log('🚀 Iniciando pruebas de API');
    console.log(`Base URL: ${this.baseUrl}`);
    console.log(`API Key: ${this.apiKey.substring(0, 8)}...`);
    
    try {
      await this.testOrderIngestion();
      await this.testOrderStatusQuery();
      
      console.log('\n=== RESUMEN ===');
      console.log(`✅ Órdenes creadas exitosamente: ${this.createdOrders.length}`);
      console.log('Números de orden:', this.createdOrders);
      console.log('\n🎉 Pruebas completadas');
      
    } catch (error) {
      console.log('❌ Error durante las pruebas:', error.message);
    }
  }
}

// Función principal
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('❌ Uso incorrecto');
    console.log('Uso: node test-api.js <API_KEY> <BASE_URL>');
    console.log('');
    console.log('Ejemplo:');
    console.log('  node test-api.js "d29fb280-9cce-4e4a-a751-74ad2..." "http://localhost:5000"');
    console.log('  node test-api.js "tu-api-key" "https://tu-dominio.replit.app"');
    console.log('');
    console.log('Para obtener una API key:');
    console.log('  1. Inicia sesión en la aplicación');
    console.log('  2. Ve a tu perfil/configuración');
    console.log('  3. Genera una nueva API key');
    process.exit(1);
  }

  const [apiKey, baseUrl] = args;
  
  // Validar formato de URL
  try {
    new URL(baseUrl);
  } catch (error) {
    console.log('❌ URL base inválida:', baseUrl);
    process.exit(1);
  }

  // Validar API key básico
  if (!apiKey || apiKey.length < 10) {
    console.log('❌ API key parece inválida (muy corta)');
    process.exit(1);
  }

  const tester = new APITester(apiKey, baseUrl);
  await tester.runAllTests();
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = APITester;