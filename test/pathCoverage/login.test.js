const request = require('supertest');
const { expect } = require('chai');
const { baseUrl, seededUser } = require('../config');

describe('POST /login', () => {
  it('should return a JWT token for a valid user', async () => {
    const response = await request(baseUrl)
      .post('/login')
      .send({ email: seededUser.email, password: seededUser.password });

    expect(response.status).to.equal(200);
    expect(response.body).to.have.property('token').that.is.a('string').and.is.not.empty;
    expect(response.body.user).to.deep.equal({
      id: seededUser.id,
      name: seededUser.name,
      email: seededUser.email
    });
  });
});
