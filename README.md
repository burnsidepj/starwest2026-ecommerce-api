# starwest2026-ecommerce-api

StarWest 2026 - AI-Driven API Test and Automation (Julio de Lima). E-commerce REST API with JWT auth and checkout.

## Description

A REST API for an e-commerce, built with JavaScript and Express. It allows a consumer to
register, login to get a JWT token, and perform a checkout.

The API exposes four endpoints — `register`, `login`, `checkout`, and `healthcheck` — plus a
Swagger UI endpoint that renders the `swagger.yaml` file stored in the project root.

The code is organized under the `src` folder:

```
src/
├── app.js               Express app wiring (JSON parsing, Swagger UI, routes, error handling)
├── server.js            HTTP server entry point
├── routes/              Route definitions
├── middleware/          JWT authentication and error handling
├── controllers/         Request/response handling
├── services/            Business rules (auth and checkout)
└── models/              In-memory users and products
```

Test automation lives under the `test` folder:

```
test/
├── config.js            Base URL and test data shared by the suites
└── pathCoverage/        One test per API path
```

Everything runs in memory — no database is created. Data resets every time the API restarts.

## Installation

Requires [Node.js](https://nodejs.org/) 18 or newer.

```bash
git clone https://github.com/burnsidepj/starwest2026-ecommerce-api.git
cd starwest2026-ecommerce-api
npm install
```

## How to Run

```bash
npm start
```

The API starts on `http://localhost:3000`. Set the `PORT` environment variable to use a
different port.

| Resource           | URL                              |
| ------------------ | -------------------------------- |
| API base URL       | http://localhost:3000            |
| Swagger UI         | http://localhost:3000/api-docs   |
| Health check       | http://localhost:3000/healthcheck |

## How to Run the Tests

The test suite uses [Mocha](https://mochajs.org/), [Supertest](https://www.npmjs.com/package/supertest),
and [Chai](https://www.chaijs.com/guide/styles/#expect). Supertest runs against the HTTP address
of a running instance, so **the API must be started before the tests**:

```bash
npm start          # in one terminal
npm test           # in another terminal
```

| Command                    | Description                                    |
| -------------------------- | ---------------------------------------------- |
| `npm test`                 | Run the whole suite using `.mocharc.json`      |
| `npm run test:pathCoverage`| Run only the path coverage suite               |

Point the tests at a different host with the `BASE_URL` environment variable:

```bash
BASE_URL=http://localhost:4000 npm test
```

[Mochawesome](https://www.npmjs.com/package/mochawesome) writes the execution report to
`mochawesome-report/path-coverage.html` (plus a `.json` alongside it). The folder is generated
and not committed.

### Path Coverage

Path coverage is the number of paths exercised divided by the total number of paths the API
exposes. `swagger.yaml` declares 4 paths, so 4 tests — one per path — reach 100%.

| Test file                            | Path exercised        |
| ------------------------------------ | --------------------- |
| `test/pathCoverage/register.test.js` | `POST /register`      |
| `test/pathCoverage/login.test.js`    | `POST /login`         |
| `test/pathCoverage/checkout.test.js` | `POST /checkout`      |
| `test/pathCoverage/healthcheck.test.js` | `GET /healthcheck` |

### Load Testing

Load test scripts live in `test/loadTesting` and run with [k6](https://grafana.com/docs/k6/latest/).
The API must be running first.

```bash
npm start            # in one terminal
npm run test:load    # in another terminal
```

`test/loadTesting/login.js` exercises `POST /login` with the three seeded users, ramping to
30 virtual users over 30 seconds:

| Stage | Duration | Target VUs |
| ----- | -------- | ---------- |
| Ramp up   | 5s  | 10 |
| Peak load | 20s | 30 |
| Ramp down | 5s  | 0  |

Thresholds: the 95th percentile of `http_req_duration` must stay under **500ms**, no request
may fail, and every check must pass. Point the script at another host with `BASE_URL`:

```bash
BASE_URL=http://localhost:4000 k6 run test/loadTesting/login.js
```

#### The same scenario in PewPew

`test/loadTesting/login.yml` runs the same scenario with
[PewPew](https://familysearch.github.io/pewpew), so the two tools can be compared:

```bash
npm run test:load:pewpew
```

PewPew drives load as a **request rate** rather than as virtual users, so the scenario is
expressed as a peak rate with the ramp described in percentages. 30 users each issuing one
request per second is 30 hits per second, which makes `30hps` the peak and 10 users a third
of it.

| Stage | Duration | Percentage of peak |
| ----- | -------- | ------------------ |
| Ramp up   | 5s  | 0% → 33%   |
| Peak load | 20s | 33% → 100% |
| Ramp down | 5s  | 100% → 0%  |

PewPew reports statistics but has no built-in pass/fail thresholds, so it exits successfully
no matter how slow the run was. `test/loadTesting/checkThreshold.js` reads PewPew's JSON output
and fails the run when the p95 breaches the threshold, a login returns anything other than
200, or a request times out. Override the threshold with `P95_THRESHOLD_MS`.

### Continuous Integration

[`.github/workflows/api-tests.yml`](.github/workflows/api-tests.yml) runs the suite on GitHub
Actions whenever a pull request targets `main`, and again once the merge lands on `main`.

The job clones the repository, runs `npm install`, starts the API in the background, polls
`/healthcheck` until the API reports it is up, then runs the test scripts. The Mochawesome
report is uploaded as a build artifact, and the API log is printed if the job fails.

## Rules

### Checkout Rules

1. The checkout accepts only `cash` or `credit_card` as the payment method. Any other value is
   rejected with `400 Bad Request`.
2. `cash` payments receive a **10% discount** on the subtotal. `credit_card` payments receive
   no discount.
3. Only authenticated users can do checkout. A valid JWT token must be sent in the
   `Authorization: Bearer <token>` header, otherwise the request is rejected with
   `401 Unauthorized`.

### Additional Rules

- When `paymentMethod` is `credit_card`, the `creditCard` object is required and must contain
  `number`, `holderName`, `expirationDate`, and `cvv`.
- `items` must be a non-empty array. Each item needs an integer `productId` and an integer
  `quantity` of at least 1.
- A `productId` that does not exist returns `404 Not Found`.
- Registration requires `name`, a valid `email`, and a `password` of at least 6 characters.
  A duplicated email returns `409 Conflict`.
- The JWT token expires in 1 hour.

## Existent Data

### Users

The API starts with 3 users. Passwords are hashed in memory on startup.

| ID | Name          | Email               | Password       |
| -- | ------------- | ------------------- | -------------- |
| 1  | Alice Johnson | alice@example.com   | `Password123!` |
| 2  | Bruno Costa   | bruno@example.com   | `Bruno@2026`   |
| 3  | Carla Mendes  | carla@example.com   | `Carla#456`    |

### Products

The API starts with 3 products.

| ID | Name                        | Price  | Stock |
| -- | --------------------------- | ------ | ----- |
| 1  | Wireless Mouse              | 29.90  | 50    |
| 2  | Mechanical Keyboard         | 149.50 | 20    |
| 3  | Noise Cancelling Headphones | 399.00 | 10    |

## How to Use the Rest API

### 1. Health check

```bash
curl -X GET http://localhost:3000/healthcheck
```

```json
{ "status": "UP", "uptime": 12, "timestamp": "2026-09-22T14:05:00.000Z" }
```

### 2. Register a user

```bash
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Daniel Oliveira","email":"daniel@example.com","password":"Daniel@789"}'
```

```json
{
  "message": "User registered successfully",
  "user": { "id": 4, "name": "Daniel Oliveira", "email": "daniel@example.com" }
}
```

### 3. Login to get a JWT token

```bash
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Password123!"}'
```

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": 1, "name": "Alice Johnson", "email": "alice@example.com" }
}
```

### 4. Checkout with cash (10% discount)

```bash
curl -X POST http://localhost:3000/checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"items":[{"productId":1,"quantity":2}],"paymentMethod":"cash"}'
```

```json
{
  "userId": 1,
  "items": [
    { "productId": 1, "name": "Wireless Mouse", "quantity": 2, "unitPrice": 29.9, "total": 59.8 }
  ],
  "paymentMethod": "cash",
  "subtotal": 59.8,
  "discount": 5.98,
  "total": 53.82,
  "message": "Checkout completed successfully"
}
```

### 5. Checkout with credit card (no discount)

```bash
curl -X POST http://localhost:3000/checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"items":[{"productId":2,"quantity":1}],"paymentMethod":"credit_card","creditCard":{"number":"4111111111111111","holderName":"Alice Johnson","expirationDate":"12/2030","cvv":"123"}}'
```

```json
{
  "userId": 1,
  "items": [
    { "productId": 2, "name": "Mechanical Keyboard", "quantity": 1, "unitPrice": 149.5, "total": 149.5 }
  ],
  "paymentMethod": "credit_card",
  "subtotal": 149.5,
  "discount": 0,
  "total": 149.5,
  "message": "Checkout completed successfully"
}
```

### 6. Explore the API documentation

Open <http://localhost:3000/api-docs> in a browser to browse and try the endpoints through
Swagger UI. The raw specification is in [`swagger.yaml`](./swagger.yaml).

### Endpoint Summary

| Method | Path           | Auth required | Description                     |
| ------ | -------------- | ------------- | ------------------------------- |
| POST   | `/register`    | No            | Register a new user             |
| POST   | `/login`       | No            | Authenticate and get a JWT      |
| POST   | `/checkout`    | Yes (Bearer)  | Perform a checkout              |
| GET    | `/healthcheck` | No            | Check whether the API is up     |
| GET    | `/api-docs`    | No            | Render the Swagger UI           |
