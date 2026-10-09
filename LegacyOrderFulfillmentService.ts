/**
 * LEGACY CODEBASE: OrderFulfillmentService.ts
 * =====================================================================
 * Code Smells Present:
 * - God Method / Monolith: Over 120 lines handling everything in one scope
 * - Arrow Anti-pattern: Deeply nested conditionals (7 levels)
 * - Primitive Obsession & Float Math: Currency floating point bugs (0.1 + 0.2)
 * - O(N*M) Unindexed Inventory Search: Linear scans inside nested loops
 * - Open-Closed Violation: Hardcoded switch-case discount logic
 * - State Mutation Bug: Decrements stock BEFORE payment without rollback
 * - PCI-DSS Breach: Plaintext credit card numbers logged to stdout
 * - Uncaught Promises & Memory Leaks: Unbounded audit history array
 * =====================================================================
 */

// Global state and unbounded memory leak
let auditLogs: any[] = [];
let totalOrdersProcessed = 0;

export function processOrderBatch(orders: any[], inventory: any[], config: any): any {
  let results: any[] = [];
  
  if (orders) {
    if (orders.length > 0) {
      for (let i = 0; i < orders.length; i++) {
        let order = orders[i];
        
        // Deep nesting level 3
        if (order != null && order.id) {
          if (order.items && order.items.length > 0) {
            let orderTotal = 0.0; // Primitive float math bug!
            let hasStockIssue = false;
            let stockIssueMessage = "";
            
            // Nested loop doing linear O(M) search inside O(N) orders
            for (let j = 0; j < order.items.length; j++) {
              let item = order.items[j];
              
              // O(M) linear scan on inventory array!
              let foundInv: any = null;
              for (let k = 0; k < inventory.length; k++) {
                if (inventory[k].sku === item.sku) {
                  foundInv = inventory[k];
                  break;
                }
              }
              
              if (!foundInv) {
                hasStockIssue = true;
                stockIssueMessage = "Item not found: " + item.sku;
                break;
              } else {
                if (foundInv.stock < item.quantity) {
                  hasStockIssue = true;
                  stockIssueMessage = "Out of stock: " + item.sku;
                  break;
                } else {
                  // Direct mutation of global inventory BEFORE payment!
                  // If payment fails later, this stock is permanently lost!
                  foundInv.stock = foundInv.stock - item.quantity;
                  
                  // Floating point arithmetic inaccuracies
                  let linePrice = item.quantity * item.unitPrice;
                  orderTotal = orderTotal + linePrice;
                }
              }
            }
            
            if (!hasStockIssue) {
              // Deep nesting level 5: Hardcoded switch-case discount rules (Violates OCP)
              let discountMultiplier = 1.0;
              if (order.discountCode) {
                switch (order.discountCode) {
                  case "SUMMER20":
                    if (orderTotal > 50.0) {
                      discountMultiplier = 0.80; // 20% off
                    }
                    break;
                  case "VIP_PLATINUM":
                    discountMultiplier = 0.70; // 30% off
                    break;
                  case "BULK_TIER":
                    if (order.items.length >= 5) {
                      discountMultiplier = 0.85; // 15% off
                    }
                    break;
                  default:
                    discountMultiplier = 1.0;
                }
              }
              
              // More floating point rounding errors
              let discountedSubtotal = orderTotal * discountMultiplier;
              let taxRate = config && config.taxRate ? config.taxRate : 0.0825;
              let taxAmount = discountedSubtotal * taxRate;
              let finalAmount = discountedSubtotal + taxAmount;
              
              // Deep nesting level 6: Security breach - plaintext credit card in logs!
              console.log("Charging card for order: " + order.id, {
                card: order.paymentInfo ? order.paymentInfo.cardNumber : "N/A", // PCI-DSS LEAK!
                cvv: order.paymentInfo ? order.paymentInfo.cvv : "N/A",        // PCI-DSS LEAK!
                amount: finalAmount
              });
              
              // Payment charging simulation
              let paymentSuccess = true;
              if (order.paymentInfo && order.paymentInfo.forceFail) {
                paymentSuccess = false;
              }
              
              if (paymentSuccess) {
                // Unbounded memory leak: array grows forever without eviction
                auditLogs.push({
                  orderId: order.id,
                  rawOrder: order,
                  timestamp: Date.now(),
                  amount: finalAmount
                });
                totalOrdersProcessed++;
                
                // Deep nesting level 7: Unhandled Promise rejection on notification!
                if (config && config.webhookUrl) {
                  fetch(config.webhookUrl, {
                    method: 'POST',
                    body: JSON.stringify({ event: 'ORDER_PLACED', id: order.id })
                  }); // Missing .catch() -> Node.js unhandled rejection crash!
                }
                
                results.push({
                  orderId: order.id,
                  status: "SUCCESS",
                  chargedAmount: Number(finalAmount.toFixed(2)),
                  itemsProcessed: order.items.length
                });
              } else {
                // Bug: inventory was already decremented and is NEVER rolled back!
                results.push({
                  orderId: order.id,
                  status: "PAYMENT_FAILED",
                  reason: "Declined by gateway",
                  chargedAmount: 0
                });
              }
            } else {
              results.push({
                orderId: order.id,
                status: "INVENTORY_ERROR",
                reason: stockIssueMessage
              });
            }
          }
        }
      }
    }
  }
  
  return {
    processed: results,
    totalAudited: auditLogs.length
  };
}