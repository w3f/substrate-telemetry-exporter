const WebSocket = require('ws');
const { timeToFinality,
        bestBlock,
        bestFinalized,
        blockProductionTime,
        blockPropagationTime
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
const state = {};
const nodes = {};

module.exports = {
  start: () => {
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
        const messages = deserialize(data);
        messages.forEach((message) => {
          handle(message);
        });
      });
    });
  }
}

function deserialize(data) {
  console.log(data)
  const json = JSON.parse(data);

  const messages = new Array(json.length / 2);

  for (const index of messages.keys()) {
    const [ action, payload] = json.slice(index * 2);

    messages[index] = { action, payload };
  }
  return messages;
}

function handle(message) {
  const { action, payload } = message;

  switch(action) {
  case Actions.AddedChain:
    {
      const chain = payload[0];
      socket.send(`subscribe:${chain}`);

      console.log(`Subscribed to chain '${chain}'`)
    }
    break;

  case Actions.AddedNode:
    {
      const nodeID = payload[0];
      const nodeName = payload[1][0];

      nodes[nodeID] = nodeName;
      state[nodeID] = {};

      console.log(`New node ${nodeName} (${nodeID})`);
    }
    break;

  case Actions.RemovedNode:
    {
      const nodeID = payload[0];

      delete statte[nodeID];
      delete nodes[nodeID];

      console.log(`Node departed ${nodeName} (${nodeID})`);
    }
    break;

  case Actions.BestBlock:
    {
      const blockNumber = payload[0];
      bestBlock.set(blockNumber);

      const productionTime = payload[2];
      blockProductionTime.set(productionTime);

      console.log(`New best block ${blockNumber}`)
    }
    break;

  case Actions.ImportedBlock:
    {
      const blockNumber = payload[1][0];
      const nodeID = payload[0];
      const node = nodes[nodeID];

      const propagationTime = payload[1][2];
      blockPropagationTime.set({ node }, propagationTime);

      const timestamp = payload[1][3];
      state[nodeID][blockNumber] = timestamp;

      console.log(`Block ${blockNumber} imported at node ${nodeID}`);
    }
    break;

  case Actions.FinalizedBlock:
    {
      const currentTimestamp = Date.now();

      const blockNumber = payload[1];
      const nodeID = payload[0];
      const productionTime = state[nodeID][blockNumber];

      if (productionTime) {
        const node = nodes[nodeID];
        const finalityTime = currentTimestamp - productionTime;
        timeToFinality.observe({ node }, finalityTime);

        delete state[nodeID][blockNumber];
      }
      console.log(`New finalized block ${blockNumber}`)
    }
    break;

  case Actions.BestFinalized:
    {
      const blockNumber = payload[0];
      bestFinalized.set(blockNumber);

      console.log(`New best finalized block ${blockNumber}`)
    }
    break;
  }
}
