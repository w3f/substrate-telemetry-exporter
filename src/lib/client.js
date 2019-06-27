const WebSocket = require('ws');

const address = 'ws://localhost:8080';

module.exports = {
  start: () => {
    let subscribed = false;
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(address);

      socket.on('open', () => {
        console.log(`Conected to substrate-telemetry on ${address}`);
        resolve();
      });

      socket.on('close', () => {
        console.log(`Conection to substrate-telemetry on ${address} closed`);
      });

      socket.on('error', (err) => {
        console.log(`Could not connect to substrate-telemetry on ${address}: ${err}`);
        reject();
      });

      socket.on('message', (data) => {
        console.log(data);
        const parsedData = JSON.parse(data);
        if (!subscribed) {
          const chain = parsedData[3][0];
          socket.send(`subscribe:${chain}`);
          subscribed = true;
        }
      });
    });
  }
}
