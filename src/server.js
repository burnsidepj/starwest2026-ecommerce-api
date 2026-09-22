const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`E-commerce API running on http://localhost:${PORT}`);
  console.log(`Swagger documentation available on http://localhost:${PORT}/api-docs`);
});
