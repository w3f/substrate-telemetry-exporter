const ReconnectingWebSocket = require('reconnecting-websocket');
const WS = require('ws');

const { timeToFinality,
        bestBlock,
        bestFinalized,
        blockProductionTime,
        blockPropagationTime,
        validatorPrecommitReceived,
        validatorPrevoteReceived,
        newBlockProduced,
      } = require('./prometheus');

const address = 'ws://localhost:8080';
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

class Client {
  constructor(cfg) {
    this.cfg = cfg;
    const options = {
      WebSocket: WS, // custom WebSocket constructor
      connectionTimeout: 1000,
      maxRetries: 10,
    };
    this.socket = new ReconnectingWebSocket(address, [], options);
    this.timestamps = {};
    this.nodes = {};
  }

  start() {
    return new Promise((resolve, reject) => {
      this.socket.onopen = () => {
        console.log(`Conected to substrate-telemetry on ${address}`);
        resolve();
      };

      this.socket.onclose = () => {
        console.log(`Conection to substrate-telemetry on ${address} closed`);
        reject();
      };

      this.socket.onerror = (err) => {
        console.log(`Could not connect to substrate-telemetry on ${address}: ${JSON.stringify(err)}`);
        reject();
      };

      this.socket.onmessage = (data) => {
        const currentTimestamp = Date.now();
        const messages = this._deserialize(data);
        for (let count = 0; count < messages.length; count++) {
          if (messages[count].action === Actions.BestBlock) {
            messages[count].nextMessage = messages[count + 1];
          }
          this._handle(messages[count], currentTimestamp);
        }
      };
    });
  }

  _deserialize(msg) {
    const data = JSON.parse(msg.data);

    const messages = new Array(data.length / 2);

    for (const index of messages.keys()) {
      const [ action, payload] = data.slice(index * 2);

      messages[index] = { action, payload };
    }
    return messages;
  }

  _handle(message, currentTimestamp) {
    const { action, payload, nextMessage } = message;

    switch(action) {
    case Actions.AddedChain:
      {
        const chain = payload[0];

        let shouldSubscribe = false;

        if(this._isChainWatched(chain)) {
          shouldSubscribe = true;
        }
        if (shouldSubscribe) {
          this.socket.send(`subscribe:${chain}`);
          console.log(`Subscribed to chain '${chain}'`);

          this.socket.send('send-finality:1');
          console.log('Requested finality data');
        }
      }
      break;

    case Actions.AddedNode:
      {
        const nodeID = payload[0];
        const nodeName = payload[1][0];

        this.nodes[nodeID] = nodeName;

        console.log(`New node ${nodeName} (${nodeID})`);
      }
      break;

    case Actions.RemovedNode:
      {
        const nodeID = payload[0];
        const nodeName = this.nodes[nodeID];

        delete this.nodes[nodeID];

        console.log(`Node departed ${nodeName} (${nodeID})`);
      }
      break;

    case Actions.BestBlock:
      {
        const blockNumber = payload[0];
        bestBlock.set(blockNumber);

        const productionTime = payload[2] / 1000;
        blockProductionTime.observe(productionTime);

        this.timestamps[blockNumber] = currentTimestamp;

        console.log(`New best block ${blockNumber}`);

        const nodeID = nextMessage.payload[0];
        const producer = this.nodes[nodeID];
        if (nextMessage &&
            this._isProducerWatched(nextMessage, producer)) {
          console.log(`Detected block produced by ${producer}`)
          newBlockProduced.inc({ producer });
        }
      }
      break;

    case Actions.ImportedBlock:
      {
        const blockNumber = payload[1][0];
        const nodeID = payload[0];
        const node = this.nodes[nodeID];

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

        const productionTime = this.timestamps[blockNumber];

        if (productionTime) {
          const finalityTime = (currentTimestamp - productionTime) / 1000;
          console.log(`finality time: ${finalityTime}`)
          timeToFinality.observe(finalityTime);

          delete this.timestamps[blockNumber];
        }

        console.log(`New best finalized block ${blockNumber}`)
      }
      break;

    case Actions.AfgReceivedPrevote:
      {
        const address = payload[3];

        const name = this._watchedValidatorName(address);
        if(name) {
          console.log(`AfgReceivedPrevote from validator ${name}, address: ${address}`);

          validatorPrevoteReceived.inc({ address, name });
        }
      }
      break;

    case Actions.AfgReceivedPrecommit:
      {
        const address = payload[3];

        const name = this._watchedValidatorName(address);
        if(name) {
          console.log(`AfgReceivedPrecommit from validator ${name}, address: ${address}`);

          validatorPrecommitReceived.inc({ address, name });
        }
      }
      break;
    }
  }

  _isChainWatched(chain) {
    return this.cfg.subscribe &&
      this.cfg.subscribe.chains.length > 0 &&
      this.cfg.subscribe.chains.includes(chain.toLowerCase());
  }

  _isProducerWatched(nextMessage, producer) {
    if (nextMessage.action !== Actions.ImportedBlock) {
      return false;
    }

    const propagationTime = nextMessage.payload[1][4];
    if (propagationTime !== 0){
      return false;
    }

    if(!this.cfg.subscribe ||
       !this.cfg.subscribe.producers ||
       this.cfg.subscribe.producers.length == 0) {
      return false;
    }

    let output = false;
    this.cfg.subscribe.producers.forEach((watchedProducer) => {
      if(producer.startsWith(watchedProducer)) {
        output = true;
      }
    });
    return output;
  }

  _watchedValidatorName(address) {
    if(!this.cfg.subscribe ||
       !this.cfg.subscribe.validators ||
       this.cfg.subscribe.validators.length === 0) {
      return "";
    }
    let name = "";
    this.cfg.subscribe.validators.forEach((validator) => {
      if(address === validator.address) {
        name = validator.name;
        return;
      }
    })
    return name;
  }
}

module.exports = {
  Client
}
