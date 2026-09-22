const path = require('path');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const swaggerDocument = YAML.load(path.join(__dirname, '..', 'swagger.yaml'));

const app = express();

app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
