/**
 * Script de diagnóstico para verificar configuración de Shopify
 *
 * Ejecutar: tsx check-shopify-setup.ts
 */

import { db } from './server/db';
import { shopifyStores, leads } from './shared/schema';
import { desc, eq, gte } from 'drizzle-orm';

async function checkShopifySetup() {
  console.log('🔍 Verificando configuración de Shopify...\n');

  try {
    // 1. Verificar tiendas conectadas
    console.log('📊 TIENDAS CONECTADAS:');
    console.log('─'.repeat(80));

    const stores = await db.select().from(shopifyStores).orderBy(desc(shopifyStores.installedAt));

    if (stores.length === 0) {
      console.log('❌ No hay tiendas conectadas.');
      console.log('   Solución: Instala la app desde Shopify Admin\n');
      return;
    }

    stores.forEach((store, index) => {
      console.log(`\n${index + 1}. Tienda: ${store.shop}`);
      console.log(`   Estado: ${store.status}`);
      console.log(`   Instalada: ${store.installedAt}`);
      console.log(`   Token: ${store.accessToken ? '✅ Presente' : '❌ Faltante'}`);
      console.log(`   Webhooks: ${store.webhookIds ? JSON.stringify(store.webhookIds) : '❌ No registrados'}`);

      const settings = store.settings as any;
      const autoImport = settings?.autoImportOrders;
      console.log(`   Auto-import: ${autoImport ? '✅ ACTIVADO' : '❌ DESACTIVADO'}`);

      if (!autoImport) {
        console.log(`   ⚠️  PROBLEMA: Auto-import está desactivado!`);
        console.log(`   Solución SQL:`);
        console.log(`   UPDATE shopify_stores SET settings = '{"autoImportOrders": true}'::jsonb WHERE shop = '${store.shop}';`);
      }
    });

    // 2. Verificar pedidos de Shopify
    console.log('\n\n📦 PEDIDOS DE SHOPIFY:');
    console.log('─'.repeat(80));

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const shopifyLeads = await db
      .select()
      .from(leads)
      .where(gte(leads.createdAt, sevenDaysAgo))
      .orderBy(desc(leads.createdAt))
      .limit(20);

    const shopifyOrders = shopifyLeads.filter(lead =>
      lead.utmSource === 'shopify' || lead.leadNumber?.startsWith('SHOPIFY-')
    );

    if (shopifyOrders.length === 0) {
      console.log('❌ No hay pedidos de Shopify en los últimos 7 días.');
      console.log('   Posibles causas:');
      console.log('   1. Auto-import desactivado (ver arriba)');
      console.log('   2. Webhooks no registrados');
      console.log('   3. Credenciales incorrectas en Railway');
      console.log('   4. No has creado pedidos en Shopify todavía\n');
    } else {
      console.log(`✅ Se encontraron ${shopifyOrders.length} pedidos de Shopify:\n`);

      shopifyOrders.slice(0, 5).forEach((order, index) => {
        console.log(`${index + 1}. ${order.leadNumber}`);
        console.log(`   Cliente: ${order.customerName}`);
        console.log(`   Valor: $${order.value}`);
        console.log(`   Fecha: ${order.createdAt}`);
        console.log(`   Estado: ${order.status}\n`);
      });

      if (shopifyOrders.length > 5) {
        console.log(`   ...y ${shopifyOrders.length - 5} más\n`);
      }
    }

    // 3. Resumen y acciones
    console.log('\n📋 RESUMEN:');
    console.log('─'.repeat(80));

    const activeStores = stores.filter(s => s.status === 'active');
    const storesWithAutoImport = stores.filter(s => (s.settings as any)?.autoImportOrders);
    const storesWithWebhooks = stores.filter(s => s.webhookIds && (s.webhookIds as number[]).length > 0);

    console.log(`Tiendas activas: ${activeStores.length}/${stores.length}`);
    console.log(`Con auto-import: ${storesWithAutoImport.length}/${stores.length}`);
    console.log(`Con webhooks: ${storesWithWebhooks.length}/${stores.length}`);
    console.log(`Pedidos (7 días): ${shopifyOrders.length}`);

    console.log('\n🎯 PRÓXIMOS PASOS:');
    console.log('─'.repeat(80));

    if (storesWithAutoImport.length === 0) {
      console.log('1. ⚠️  URGENTE: Activa auto-import para todas las tiendas');
      console.log('   SQL: UPDATE shopify_stores SET settings = \'{"autoImportOrders": true}\'::jsonb;');
    } else {
      console.log('1. ✅ Auto-import está activado');
    }

    if (storesWithWebhooks.length === 0) {
      console.log('2. ⚠️  Webhooks no están registrados. Reinstala la app.');
    } else {
      console.log('2. ✅ Webhooks registrados');
    }

    console.log('3. Crea un pedido de prueba en Shopify Admin');
    console.log('4. Monitorea los logs de Railway en tiempo real');
    console.log('5. Refresca /shopify/orders después de 30 segundos\n');

  } catch (error) {
    console.error('❌ Error al verificar configuración:', error);
  }
}

checkShopifySetup()
  .then(() => {
    console.log('✅ Diagnóstico completado\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
