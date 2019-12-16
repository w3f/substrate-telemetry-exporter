const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const program = require('commander');
const yaml = require('js-yaml');

const { Client } = require('./lib/client');
const prometheus = require('./lib/prometheus');

const app = express();
const port = 3000;

program
  .option('-c, --config [path]', 'Path to config file.', '../config/main.yaml');

async function start(options={}) {
  prometheus.injectMetricsRoute(app);
  prometheus.startCollection();
  app.listen(port, () => console.log(`substrate-telemetry-exporter listening on port ${port}`))

  const cfg = readYAML(options.config);
  const client = new Client(cfg);
  await client.start();
}

function  readYAML(filePath) {
  const rawContent = fs.readFileSync(path.resolve(__dirname, filePath));

  return yaml.safeLoad(rawContent);
}

program.parse(process.argv);
start(program);
