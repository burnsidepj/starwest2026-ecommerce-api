const request = require('supertest');
const { expect } = require('chai');
const { baseUrl } = require('../config');

describe('POST /register', () => {
  it('should register a new user', async () => {
    // The API keeps users in memory, so a fixed email would return 409 on the
    // second run against the same instance. The name and password follow the
    // example in README.md; only the email is made unique per run.
    const newUser = {
      name: 'Daniel Oliveira',
      email: `daniel.${Date.now()}@example.com`,
      password: 'Daniel@789'
    };

    const response = await request(baseUrl).post('/register').send(newUser);

    expect(response.status).to.equal(201);
    expect(response.body).to.have.property('message', 'User registered successfully');
    expect(response.body.user).to.have.property('id').that.is.a('number');
    expect(response.body.user).to.have.property('name', newUser.name);
    expect(response.body.user).to.have.property('email', newUser.email);
    expect(response.body.user).to.not.have.property('password');
  });
});
