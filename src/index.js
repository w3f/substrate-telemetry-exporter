const Backoff = require('backoff-promise');
const express = require('express');

const client = require('./lib/client');
const prometheus = require('./lib/prometheus');

const app = express();
const port = 3000;
const backoff = new Backoff();

async function start() {
  prometheus.injectMetricsRoute(app);
  prometheus.startCollection();

  await backoff.run(() => {
    return client.start();
  });

  app.listen(port, () => console.log(`substrate-telemtry-exporter listening on port ${port}`))
}

start();
