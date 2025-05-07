// Script para verificar integridad de datos entre órdenes y transacciones
const { db } = require('./server/db');
const { orders, transactions } = require('./shared/schema');
const { eq, and } = require('drizzle-orm');

async function checkDataIntegrity() {
  try {
    console.log("\n===== VERIFICACIÓN DE INTEGRIDAD DE DATOS =====\n");
    
    // 1. Obtener todas las órdenes
    const allOrders = await db.select().from(orders);
    console.log(`Total de órdenes: ${allOrders.length}`);
    
    // 2. Obtener todas las transacciones
    const allTransactions = await db.select().from(transactions);
    console.log(`Total de transacciones: ${allTransactions.length}`);
    
    // 3. Contar órdenes por estado
    const orderStatuses = {
      pending: 0,
      processing: 0,
      delivered: 0,
      cancelled: 0,
      other: 0
    };
    
    for (const order of allOrders) {
      if (orderStatuses.hasOwnProperty(order.status)) {
        orderStatuses[order.status]++;
      } else {
        orderStatuses.other++;
      }
    }
    
    console.log("\nDistribución de órdenes por estado:");
    console.log(`- Pendientes: ${orderStatuses.pending}`);
    console.log(`- En proceso: ${orderStatuses.processing}`);
    console.log(`- Entregadas: ${orderStatuses.delivered}`);
    console.log(`- Canceladas: ${orderStatuses.cancelled}`);
    if (orderStatuses.other > 0) {
      console.log(`- Otros estados: ${orderStatuses.other}`);
    }
    
    // 4. Contar transacciones por tipo
    const transactionTypes = {
      deposit: 0,
      withdrawal: 0,
      payment: 0,
      refund: 0,
      other: 0
    };
    
    for (const transaction of allTransactions) {
      if (transactionTypes.hasOwnProperty(transaction.type)) {
        transactionTypes[transaction.type]++;
      } else {
        transactionTypes.other++;
      }
    }
    
    console.log("\nDistribución de transacciones por tipo:");
    console.log(`- Depósitos: ${transactionTypes.deposit}`);
    console.log(`- Retiros: ${transactionTypes.withdrawal}`);
    console.log(`- Pagos: ${transactionTypes.payment}`);
    console.log(`- Reembolsos: ${transactionTypes.refund}`);
    if (transactionTypes.other > 0) {
      console.log(`- Otros tipos: ${transactionTypes.other}`);
    }
    
    // 5. Verificar que todas las órdenes entregadas tengan una transacción de pago asociada
    const deliveredOrders = allOrders.filter(order => order.status === 'delivered');
    const paymentTransactions = allTransactions.filter(t => t.type === 'payment');
    
    let deliveredOrdersWithPayment = 0;
    let deliveredOrdersWithoutPayment = 0;
    let orphanPaymentTransactions = 0;
    const deliveredOrderReferences = new Set();
    
    for (const order of deliveredOrders) {
      let hasPayment = false;
      
      for (const transaction of paymentTransactions) {
        // Verificar si la referencia de la transacción contiene el número de orden
        if (transaction.reference && transaction.reference.includes(order.orderNumber)) {
          hasPayment = true;
          deliveredOrderReferences.add(order.orderNumber);
          break;
        }
      }
      
      if (hasPayment) {
        deliveredOrdersWithPayment++;
      } else {
        deliveredOrdersWithoutPayment++;
        console.log(`  - Orden entregada sin pago: ${order.orderNumber} (${order.totalAmount})`);
      }
    }
    
    // 6. Verificar que todas las transacciones de pago estén asociadas a órdenes entregadas
    for (const transaction of paymentTransactions) {
      let isOrphan = true;
      
      if (transaction.reference) {
        // Extraer el número de orden de la referencia
        const orderNumberMatch = transaction.reference.match(/PAY-(.+)/);
        if (orderNumberMatch && orderNumberMatch[1]) {
          const orderNumber = orderNumberMatch[1];
          
          // Verificar si existe una orden entregada con este número
          if (deliveredOrderReferences.has(orderNumber)) {
            isOrphan = false;
          }
        }
      }
      
      if (isOrphan) {
        orphanPaymentTransactions++;
        console.log(`  - Transacción de pago huérfana: ${transaction.reference} (${transaction.amount})`);
      }
    }
    
    console.log("\nVerificación de integridad entre órdenes entregadas y pagos:");
    console.log(`- Órdenes entregadas con pago: ${deliveredOrdersWithPayment}/${deliveredOrders.length}`);
    if (deliveredOrdersWithoutPayment > 0) {
      console.log(`- Órdenes entregadas sin pago: ${deliveredOrdersWithoutPayment}`);
    }
    if (orphanPaymentTransactions > 0) {
      console.log(`- Transacciones de pago sin orden entregada: ${orphanPaymentTransactions}`);
    }
    
    // 7. Verificar que todas las transacciones de reembolso estén asociadas a órdenes canceladas
    const cancelledOrders = allOrders.filter(order => order.status === 'cancelled');
    const refundTransactions = allTransactions.filter(t => t.type === 'refund');
    
    let cancelledOrdersWithRefund = 0;
    let cancelledOrdersWithoutRefund = 0;
    let orphanRefundTransactions = 0;
    const cancelledOrderReferences = new Set();
    
    for (const order of cancelledOrders) {
      let hasRefund = false;
      
      for (const transaction of refundTransactions) {
        if (transaction.reference && transaction.reference.includes(order.orderNumber)) {
          hasRefund = true;
          cancelledOrderReferences.add(order.orderNumber);
          break;
        }
      }
      
      if (hasRefund) {
        cancelledOrdersWithRefund++;
      } else {
        cancelledOrdersWithoutRefund++;
      }
    }
    
    // Verificar que todas las transacciones de reembolso estén asociadas a órdenes canceladas
    for (const transaction of refundTransactions) {
      let isOrphan = true;
      
      if (transaction.reference) {
        const orderNumberMatch = transaction.reference.match(/REF-(.+)/);
        if (orderNumberMatch && orderNumberMatch[1]) {
          const orderNumber = orderNumberMatch[1];
          
          if (cancelledOrderReferences.has(orderNumber)) {
            isOrphan = false;
          }
        }
      }
      
      if (isOrphan) {
        orphanRefundTransactions++;
        console.log(`  - Transacción de reembolso huérfana: ${transaction.reference} (${transaction.amount})`);
      }
    }
    
    console.log("\nVerificación de integridad entre órdenes canceladas y reembolsos:");
    console.log(`- Órdenes canceladas con reembolso: ${cancelledOrdersWithRefund}/${cancelledOrders.length}`);
    console.log(`- Órdenes canceladas sin reembolso: ${cancelledOrdersWithoutRefund} (normal, no todas tienen reembolso)`);
    if (orphanRefundTransactions > 0) {
      console.log(`- Transacciones de reembolso sin orden cancelada: ${orphanRefundTransactions}`);
    }
    
    console.log("\n===== FIN DE LA VERIFICACIÓN =====\n");
    
    // 8. Calcular saldo total
    const totalDeposits = allTransactions
      .filter(t => t.type === 'deposit' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);
      
    const totalWithdrawals = allTransactions
      .filter(t => t.type === 'withdrawal' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);
      
    const totalPayments = allTransactions
      .filter(t => t.type === 'payment' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);
      
    const totalRefunds = allTransactions
      .filter(t => t.type === 'refund' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalBalance = totalDeposits + totalWithdrawals + totalPayments + totalRefunds;
    
    console.log("Resumen de saldo:");
    console.log(`- Total depósitos: $${totalDeposits.toFixed(2)}`);
    console.log(`- Total retiros: $${totalWithdrawals.toFixed(2)}`);
    console.log(`- Total pagos: $${totalPayments.toFixed(2)}`);
    console.log(`- Total reembolsos: $${totalRefunds.toFixed(2)}`);
    console.log(`- Saldo actual: $${totalBalance.toFixed(2)}`);
    
  } catch (error) {
    console.error("Error al verificar integridad de datos:", error);
  } finally {
    // Cerrar la conexión a la base de datos
    process.exit(0);
  }
}

// Ejecutar verificación
checkDataIntegrity();