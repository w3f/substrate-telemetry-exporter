const express = require('express');

const prometheus = require('./lib/prometheus');

const app = express();
const port = 3000;

prometheus.injectMetricsRoute(app);
prometheus.startCollection();

app.listen(port, () => console.log(`substrate-telemtry-exporter listening on port ${port}!`))
