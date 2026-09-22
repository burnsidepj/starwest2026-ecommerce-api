import http from 'k6/http';
import { check, sleep } from 'k6';

// Load test for the POST /login path described in swagger.yaml.
//
// Stages ramp to 30 virtual users across 30 seconds: 10 users in the first 5s,
// 30 users in the next 20s, then back to 0 over the final 5s.
// The 95th percentile of the response time must stay under 500ms.
export const options = {
  stages: [
    { duration: '5s', target: 10 },
    { duration: '20s', target: 30 },
    { duration: '5s', target: 0 }
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate==0'],
    checks: ['rate==1.0']
  }
};

const baseUrl = __ENV.BASE_URL || 'http://localhost:3000';

// Valid credentials taken from the "Existent Data" section of README.md.
const users = [
  { email: 'alice@example.com', password: 'Password123!' },
  { email: 'bruno@example.com', password: 'Bruno@2026' },
  { email: 'carla@example.com', password: 'Carla#456' }
];

export default function () {
  // Spread the load across the three seeded users.
  const user = users[__VU % users.length];

  const response = http.post(
    `${baseUrl}/login`,
    JSON.stringify({ email: user.email, password: user.password }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'login' }
    }
  );

  check(response, {
    'status is 200': (r) => r.status === 200,
    'token is returned': (r) => typeof r.json('token') === 'string' && r.json('token').length > 0,
    'user email matches the request': (r) => r.json('user.email') === user.email
  });

  sleep(1);
}
