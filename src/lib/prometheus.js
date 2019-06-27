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
}
