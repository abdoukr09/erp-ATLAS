const express = require('express');
const request = require('supertest');
const { Order, OrderItem, Customer } = require('./models');

// We just do a mock update via the real DB but using the request pattern
async function run() {
  const o = await Order.findByPk(3, { include: ['items'] });
  
  // mock request payload exactly as frontend sends it
  const payload = {
    customerId: o.customerId,
    items: o.items.map(i => ({
      id: i.id, sofaModel: i.sofaModel, quantity: i.quantity, unitPrice: i.unitPrice, discountPercentage: 0
    })),
    salesmen: [],
    discountPercentage: 6.47,
    totalPrice: 1300000
  };
  
  // the exact lines from route
  const explicitTotalPrice = payload.totalPrice;
  
  let computedTotal = 0;
  for (const item of payload.items) {
    const qty = item.quantity !== undefined ? item.quantity : 1;
    const price = item.unitPrice !== undefined ? item.unitPrice : 0;
    const disc = item.discountPercentage !== undefined ? item.discountPercentage : 0;
    computedTotal += qty * price * (1 - disc / 100);
  }
  
  payload.totalPrice = (explicitTotalPrice !== undefined && explicitTotalPrice !== null)
        ? explicitTotalPrice 
        : Math.round(computedTotal);
        
  console.log("PAYLOAD TOTAL:", payload.totalPrice);
}
run();
