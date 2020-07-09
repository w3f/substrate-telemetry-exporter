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


  timeToFinality: new promClient.Histogram({
    name: 'polkadot_block_finality_seconds',
    help: 'Time from block production to block finalized',
    buckets: [10, 14, 18, 22, 26, 30]
  }),

  bestBlock: new promClient.Gauge({
    name: 'polkadot_best_block',
    help: 'Maximum height of the chain'
  }),

  bestFinalized: new promClient.Gauge({
    name: 'polkadot_best_finalized',
    help: 'Highest finalized block'
  }),

  blockProductionTime: new promClient.Histogram({
    name: 'polkadot_block_production_seconds',
    help: 'Time to produce a block as reported by telemetry'
  }),

  blockPropagationTime: new promClient.Histogram({
    name: 'polkadot_block_propagation_seconds',
    help: 'Time to receive a block as reported by telemetry',
    labelNames: ['node']
  }),
}
