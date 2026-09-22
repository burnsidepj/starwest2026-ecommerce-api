const request = require('supertest');
const { expect } = require('chai');
const { baseUrl, seededUser, products, round } = require('../config');

describe('POST /checkout', () => {
  let token;

  // Checkout requires authentication, so a token is obtained first.
  before(async () => {
    const response = await request(baseUrl)
      .post('/login')
      .send({ email: seededUser.email, password: seededUser.password });

    token = response.body.token;
  });

  it('should complete a checkout applying the 10% cash discount', async () => {
    const quantity = 2;
    const product = products.headphones;
    const subtotal = round(product.price * quantity);
    const discount = round(subtotal * 0.1);
    const total = round(subtotal - discount);

    const response = await request(baseUrl)
      .post('/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product.id, quantity }],
        paymentMethod: 'cash'
      });

    expect(response.status).to.equal(200);
    expect(response.body).to.have.property('userId', seededUser.id);
    expect(response.body).to.have.property('paymentMethod', 'cash');
    expect(response.body).to.have.property('subtotal', subtotal);
    expect(response.body).to.have.property('discount', discount);
    expect(response.body).to.have.property('total', total);
    expect(response.body).to.have.property('message', 'Checkout completed successfully');
    expect(response.body.items).to.have.lengthOf(1);
    expect(response.body.items[0]).to.deep.equal({
      productId: product.id,
      name: product.name,
      quantity,
      unitPrice: product.price,
      total: subtotal
    });
  });
});
