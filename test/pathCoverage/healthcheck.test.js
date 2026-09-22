const request = require('supertest');
const { expect } = require('chai');
const { baseUrl } = require('../config');

describe('GET /healthcheck', () => {
  it('should return the API status when the API is up', async () => {
    const response = await request(baseUrl).get('/healthcheck');

    expect(response.status).to.equal(200);
    expect(response.body).to.have.property('status', 'UP');
    expect(response.body).to.have.property('uptime').that.is.a('number');
    expect(response.body).to.have.property('timestamp').that.is.a('string');
  });
});
