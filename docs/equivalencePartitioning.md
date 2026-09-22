# Equivalence Partitioning — 10% Discount Rule for Cash Payments

Test design for the checkout discount rule, produced by applying equivalence partitioning to
the business rule documented in [`../README.md`](../README.md) and the interface described in
[`../swagger.yaml`](../swagger.yaml).

Only equivalence partitioning is applied here. No boundary value analysis: there are no
`quantity` values of 0 or 1 chosen for their adjacency to a limit, no minimum or maximum
prices, and no empty strings.

## Step 1 — The business rule

From the Checkout Rules section of the README:

> `cash` payments receive a **10% discount** on the subtotal. `credit_card` payments receive no
> discount.

Two neighbouring rules constrain it: only `cash` or `credit_card` are accepted, and only
authenticated users can checkout.

## Steps 2 and 3 — Input variables and their partitions

| Variable | Partition | Class | Expected behaviour per the rule |
| -------- | --------- | ----- | ------------------------------- |
| `paymentMethod` | EP1 `"cash"` | valid | discount = 10% of subtotal |
| | EP2 `"credit_card"` | valid | discount = 0 |
| | EP3 any other non-empty value | invalid | rejected, no discount computed |
| | EP4 absent / null | invalid | rejected, no discount computed |
| `Authorization` token | EP5 valid JWT | valid | rule is evaluated |
| | EP6 absent | invalid | rejected before any discount is computed |
| `items` (subtotal source) | EP7 non-empty array of existing products | valid | 10% applies proportionally to any subtotal |

### Notes on scope

`items` has a **single valid partition** for this rule. The discount is proportional, so every
valid subtotal behaves identically and one randomly chosen value represents the whole class.
The invalid `items` classes — an empty array, an unknown `productId` — belong to the payload
validity rules rather than the discount rule, so they are not covered here.

The `Authorization` token is included because the discount is only ever computed for an
authenticated request. A cash payment without a token never reaches the discount calculation
at all, which is a distinct outcome worth asserting.

## Steps 4 and 5 — Test cases

One value is selected per partition, using valid test data from the Existent Data section of
the README.

**Precondition for TC01–TC04** — obtain a token:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Password123!"}' | jq -r .token)
```

Without `jq` installed, Node can extract the token instead:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Password123!"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token))")
```

| Test Case ID | cURL Request | Expected Response Status Code | Assertions for the Response (property and value) |
| ------------ | ------------ | ----------------------------- | ------------------------------------------------ |
| **TC01** — EP1 cash, discount applied | `curl -s -X POST http://localhost:3000/checkout -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"items":[{"productId":3,"quantity":2}],"paymentMethod":"cash"}'` | 200 | • `paymentMethod` = `"cash"` • `subtotal` = `798` • `discount` = `79.8` • `total` = `718.2` • `discount` equals `subtotal * 0.1` • `total` equals `subtotal - discount` • `userId` = `1` • `items[0].productId` = `3` • `items[0].unitPrice` = `399` • `items[0].quantity` = `2` • `items[0].total` = `798` • `message` = `"Checkout completed successfully"` |
| **TC02** — EP2 credit card, no discount | `curl -s -X POST http://localhost:3000/checkout -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"items":[{"productId":1,"quantity":3}],"paymentMethod":"credit_card","creditCard":{"number":"4111111111111111","holderName":"Alice Johnson","expirationDate":"12/2030","cvv":"123"}}'` | 200 | • `paymentMethod` = `"credit_card"` • `subtotal` = `89.7` • `discount` = `0` • `total` = `89.7` • `total` equals `subtotal` (no reduction) • `userId` = `1` • `items[0].productId` = `1` • `items[0].unitPrice` = `29.9` • `message` = `"Checkout completed successfully"` |
| **TC03** — EP3 unsupported payment method | `curl -s -X POST http://localhost:3000/checkout -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"items":[{"productId":2,"quantity":1}],"paymentMethod":"pix"}'` | 400 | • `error` = `"Payment method must be one of: cash, credit_card"` • `discount` property is absent • `total` property is absent • `subtotal` property is absent |
| **TC04** — EP4 payment method omitted | `curl -s -X POST http://localhost:3000/checkout -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"items":[{"productId":2,"quantity":1}]}'` | 400 | • `error` = `"Payment method must be one of: cash, credit_card"` • `discount` property is absent • `total` property is absent • `subtotal` property is absent |
| **TC05** — EP6 cash without authentication | `curl -s -X POST http://localhost:3000/checkout -H "Content-Type: application/json" -d '{"items":[{"productId":3,"quantity":2}],"paymentMethod":"cash"}'` | 401 | • `error` = `"Authorization header with Bearer token is required"` • `discount` property is absent • `total` property is absent • no discount is granted despite `paymentMethod` = `"cash"` |

Five test cases cover all seven partitions: EP5 is exercised by TC01–TC04, and EP7 by TC01 and
TC02. Combinations of partitions are not required — that would be a different technique.

## Observations from executing these cases

Every status code and assertion value above was taken from real responses rather than computed
by hand. Two things surfaced that are worth carrying into any automated implementation.

### JSON drops trailing zeros, and 10% is not exact in binary

The response is `"subtotal":798`, not `798.00`, and `"discount":79.8`, not `79.80`. More
importantly, `798 * 0.1` evaluates to `79.80000000000001` in JavaScript while the API rounds to
`79.8`. An assertion written as:

```js
expect(response.body.discount).to.equal(subtotal * 0.1);   // fails
```

fails for reasons that have nothing to do with the discount rule. Expected monetary values must
be rounded the same way the service rounds them. This is why
[`../test/config.js`](../test/config.js) exports a `round` helper.

### TC03 and TC04 currently share an error message

Both return `"Payment method must be one of: cash, credit_card"`, because the service validates
with `PAYMENT_METHODS.includes(paymentMethod)` and `undefined` fails that check the same way
`"pix"` does.

They remain distinct partitions — a missing field and a present-but-invalid field are different
inputs — they merely happen to produce the same output today. Keeping both means that if the
validation is ever split into a presence check and a membership check, the tests already
describe the two cases separately.
