const Backoff = require('backoff-promise');
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const program = require('commander');
const yaml = require('js-yaml');

const client = require('./lib/client');
const prometheus = require('./lib/prometheus');

const app = express();
const port = 3000;
const backoff = new Backoff();

program
  .option('-c, --config [path]', 'Path to config file.', '../config/main.yaml');

async function start(options={}) {
  prometheus.injectMetricsRoute(app);
  prometheus.startCollection();

  const cfg = readJSON(options.config);

  await backoff.run(() => {
    return client.start(cfg);
  });

  app.listen(port, () => console.log(`substrate-telemetry-exporter listening on port ${port}`))
}

function  readJSON(filePath) {
  const rawContent = fs.readFileSync(path.resolve(__dirname, filePath));

  return yaml.safeLoad(rawContent);
}

start(program);
