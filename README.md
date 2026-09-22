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
