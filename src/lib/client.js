const WebSocket = require('ws');
const { timeToFinality,
        bestBlock,
        bestFinalized,
        blockProductionTime,
        blockPropagationTime,
        validatorPrecommitReceived,
        validatorPrevoteReceived,
      } = require('./prometheus');

const address = 'ws://localhost:8080';
const socket = new WebSocket(address);
const Actions = {
  FeedVersion      : 0,
  BestBlock        : 1,
  BestFinalized    : 2,
  AddedNode        : 3,
  RemovedNode      : 4,
  LocatedNode      : 5,
  ImportedBlock    : 6,
  FinalizedBlock   : 7,
  NodeStats        : 8,
  NodeHardware     : 9,
  TimeSync         : 10,
  AddedChain       : 11,
  RemovedChain     : 12,
  SubscribedTo     : 13,
  UnsubscribedFrom : 14,
  Pong             : 15,
  AfgFinalized         : 16,
  AfgReceivedPrevote   : 17,
  AfgReceivedPrecommit : 18,
  AfgAuthoritySet      : 19
};
const timestamps = {};
const nodes = {};

module.exports = {
  start: (cfg = {}) => {
    return new Promise((resolve, reject) => {
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
        const currentTimestamp = Date.now();
        const messages = deserialize(data);
        messages.forEach((message) => {
          handle(message, currentTimestamp, cfg);
        });
      });
    });
  }
}

function deserialize(data) {
  //console.log(`data: ${data}`)
  const json = JSON.parse(data);

  const messages = new Array(json.length / 2);

  for (const index of messages.keys()) {
    const [ action, payload] = json.slice(index * 2);

    messages[index] = { action, payload };
  }
  return messages;
}

function handle(message, currentTimestamp, cfg) {
  const { action, payload } = message;

  switch(action) {
  case Actions.AddedChain:
    {
      const chain = payload[0];

      let shouldSubscribe = true;

      if(cfg.subscribe && cfg.subscribe.chains.length > 0 && !cfg.subscribe.chains.includes(chain.toLowerCase())) {
        shouldSubscribe = false;
      }
      if (shouldSubscribe) {
        socket.send(`subscribe:${chain}`);
        console.log(`Subscribed to chain '${chain}'`);

        socket.send('send-finality:1');
        console.log('Requested finality data');
      }
    }
    break;

  case Actions.AddedNode:
    {
      const nodeID = payload[0];
      const nodeName = payload[1][0];

      nodes[nodeID] = nodeName;

      console.log(`New node ${nodeName} (${nodeID})`);
    }
    break;

  case Actions.RemovedNode:
    {
      const nodeID = payload[0];
      const nodeName = nodes[nodeID];

      delete nodes[nodeID];

      console.log(`Node departed ${nodeName} (${nodeID})`);
    }
    break;

  case Actions.BestBlock:
    {
      const blockNumber = payload[0];
      bestBlock.set(blockNumber);

      const productionTime = payload[2] / 1000;
      blockProductionTime.observe(productionTime);

      timestamps[blockNumber] = currentTimestamp;

      console.log(`New best block ${blockNumber}`)
    }
    break;

  case Actions.ImportedBlock:
    {
      const blockNumber = payload[1][0];
      const nodeID = payload[0];
      const node = nodes[nodeID];

      const propagationTime = payload[1][4] / 1000;
      blockPropagationTime.observe({ node }, propagationTime);

      console.log(`Block ${blockNumber} imported at node ${nodeID}`);
    }
    break;

  case Actions.FinalizedBlock:
    {
      const blockNumber = payload[1];

      console.log(`New finalized block ${blockNumber}`)
    }
    break;

  case Actions.BestFinalized:
    {
      const blockNumber = payload[0];
      bestFinalized.set(blockNumber);

      const productionTime = timestamps[blockNumber];

      if (productionTime) {
        const finalityTime = (currentTimestamp - productionTime) / 1000;
        console.log(`finality time: ${finalityTime}`)
        timeToFinality.observe(finalityTime);

        delete timestamps[blockNumber];
      }

      console.log(`New best finalized block ${blockNumber}`)
    }
    break;

  case Actions.AfgReceivedPrevote:
    {
      const address = payload[3];

      console.log(`AfgReceivedPrevote from addr: ${address}`);

      validatorPrevoteReceived.inc({ address });
    }
    break;

  case Actions.AfgReceivedPrecommit:
    {
      const address = payload[3];

      console.log(`AfgReceivedPrecommit from addr: ${address}`);

      validatorPrecommitReceived.inc({ address });
    }
    break;
  }
}
