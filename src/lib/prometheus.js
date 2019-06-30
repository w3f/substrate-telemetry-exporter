const { register } = require('prom-client');
const promClient = require('prom-client');


module.exports = {
  startCollection: () =>{
    console.log('Starting the collection of metrics, the metrics are available on /metrics');
    promClient.collectDefaultMetrics();
  },
  injectMetricsRoute: (app) => {
    app.get('/metrics', (req, res) => {
      res.set('Content-Type', register.contentType);
      res.end(register.metrics());
    });
  },

  timeToFinality: new promClient.Summary({
    name: 'time_to_finality',
    help: 'Time from block production to block finalized',
    labels: ['node']
  }),
  bestBlock: new promClient.Gauge({
    name: 'best_block',
    help: 'Maximum height of the chain'
  }),
  bestFinalized: new promClient.Gauge({
    name: 'best_finalized',
    help: 'Highest finalized block'
  }),
  blockProductionTime: new promClient.Gauge({
    name: 'block_production_time',
    help: 'Average time to produce a block as reported by telemetry'
  }),
}
