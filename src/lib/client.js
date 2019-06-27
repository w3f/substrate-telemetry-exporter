const WebSocket = require('ws');

const address = 'ws://localhost:8080';

module.exports = {
  start: () => {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(address);

      socket.on('open', () => {
        console.log(`Conected to substrate-telemetry on ${address}`);
        resolve();
      });

      socket.on('error', (err) => {
        console.log(`Could not connect to substrate-telemetry on ${address}: ${err}`);
        reject();
      });

      socket.on('message', (data) => {
        console.log(data);
      });
    });
  }
}
