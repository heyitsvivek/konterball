import deepstream from 'deepstream.io-client-js';
import randomstring from 'randomstring';
import {ACTION, INITIAL_CONFIG, EVENT} from './constants';
import $ from 'jquery';

export default class Communication {
  constructor(emitter) {
    this.emitter = emitter;
    this.callbacks = {};
    this.opponentConnected = false;
    this.latency = 100;
    this.conn = null;
    this.isHost = undefined;
    this.pingNumber = 0;
    this.pingInterval = null;
    this.availableServers = [
      '138.68.98.41:6020',
      'localhost:6020',
    ];

    this.pings = {};
    this.roundTripTimes = [];
  }

  setCallbacks(callbacks) {
    this.callbacks = callbacks;
  }

  pingServer(hostIndex) {
    return new Promise((resolve, reject) => {
      let client = deepstream(this.availableServers[hostIndex]);
      client.on('connectionStateChanged', e => {
        client.close();
        resolve(hostIndex);
        return;
      });
      setTimeout(5000, () => {
        reject('timeout');
      });
    });
  }

  chooseClosestServer() {
    return new Promise((resolve, reject) => {
      Promise.race(this.availableServers.map((server, index) => {
        return this.pingServer(index);
      })).then(fastestServer => {
        this.chosenServer = fastestServer;
        return this.connectToServer(this.availableServers[fastestServer]);
      }).then(() => {
        resolve();
      });
    });
  }

  connectToServer(host) {
    // connect to the deepstream server
    return new Promise((resolve, reject) => {
      this.client = deepstream(host, {
        mergeStrategy: deepstream.MERGE_STRATEGIES.REMOTE_WINS
      });
      this.client.login();
      this.client.on('connectionStateChanged', e => {
        if (e === deepstream.CONSTANTS.CONNECTION_STATE.OPEN) {
          resolve();
        }
      });
      setTimeout(2000, () => {
        reject('timeout');
      });
    });
  }

  tryConnecting(id) {
    return new Promise((resolve, reject) => {
      let serverIndex = parseInt(id[0]);
      this.connectToServer(this.availableServers[serverIndex]).then(() => {
        this.GAME_ID = id;
        this.isHost = false;
        this.setRecords();
        this.startListening();
        this.statusRecord.set('player-2', {action: ACTION.CONNECT});
        setTimeout(this.sendPings.bind(this), 1000);
        resolve();
      }).catch(e => {
        reject(e);
      });
    });
  }

  openRoom() {
    this.isHost = true;
    this.GAME_ID = this.chosenServer + randomstring.generate({
      length: 3,
      capitalization: 'uppercase',
      readable: true,
    });
    this.setRecords();
    this.startListening();
    return this.GAME_ID;
  }

  setRecords() {
    this.statusRecord = this.client.record.getRecord(`${this.GAME_ID}-status`);
    this.paddle1Record = this.client.record.getRecord(`${this.GAME_ID}-paddle1`);
    this.paddle2Record = this.client.record.getRecord(`${this.GAME_ID}-paddle2`);
    this.hitRecord = this.client.record.getRecord(`${this.GAME_ID}-hit`);
    this.missRecord = this.client.record.getRecord(`${this.GAME_ID}-miss`);
    this.pingRecord = this.client.record.getRecord(`${this.GAME_ID}-ping`);
  }

  sendPings() {
    this.pingInterval = setInterval(() => {
      this.pings[this.pingNumber] = Date.now();
      this.pingRecord.set(`player-${this.isHost ? 1 : 2}-ping-${this.pingNumber}`, {
        index: this.pingNumber,
        ping: true
      });
      this.pingNumber++;
      if (this.pingNumber >= 20) {
        clearInterval(this.pingInterval);
      }
    }, 1000);
  }

  receivedPong(data) {
    let rtt = Date.now() - this.pings[data.index];
    this.roundTripTimes.push(rtt);
    this.roundTripTimes.sort((a, b) => a - b);
    this.latency = this.roundTripTimes[Math.floor(this.roundTripTimes.length / 2)] / 2;
    console.log(this.latency);
  }

  startListening() {
    this.statusRecord.subscribe(`player-${this.isHost ? 2 : 1}`, value => {
      switch (value.action) {
        case ACTION.CONNECT:
          setTimeout(this.sendPings.bind(this), 1000);
          this.emitter.emit(EVENT.OPPONENT_CONNECTED);
          break;
        case ACTION.DISCONNECT:
          this.emitter.emit(EVENT.OPPONENT_DISCONNECTED);
          break;
        case ACTION.REQUEST_COUNTDOWN:
          this.callbacks.requestCountdown();
          break;
        case ACTION.RESTART_GAME:
          this.callbacks.restartGame();
          break;
      }
    });
    if (this.isHost) {
      this.paddle2Record.subscribe(`position`, value => {
        this.callbacks.move(value);
      });
    } else {
      this.paddle1Record.subscribe(`position`, value => {
        this.callbacks.move(value);
      });
    }
    this.hitRecord.subscribe(`player-${this.isHost ? 2 : 1}`, value => {
      this.callbacks.hit(value);
    });
    this.missRecord.subscribe(`player-${this.isHost ? 2 : 1}`, value => {
      this.callbacks.miss(value);
    });
    for (let i = 0; i < 20; i++) {
      this.pingRecord.subscribe(`player-${this.isHost ? 2 : 1}-ping-${i}`, value => {
        if (value.ping) {
          this.pingRecord.set(`player-${this.isHost ? 1 : 2}-ping-${value.index}`, {
            index: value.index,
            pong: true,
          });
        } else {
          this.receivedPong(value);
        }
      });
    }
  }

  sendMove(position, rotation) {
    if (this.isHost) {
      this.paddle1Record.set(`position`, {position, rotation});
    } else {
      this.paddle2Record.set(`position`, {position, rotation});
    }
  }

  sendHit(point, velocity, addBall=false) {
    this.hitRecord.set(`player-${this.isHost ? 1 : 2}`, {point, velocity, addBall});
  }

  sendMiss(point, velocity, ballHasHitEnemyTable) {
    this.missRecord.set(`player-${this.isHost ? 1 : 2}`, {point, velocity, ballHasHitEnemyTable});
  }

  sendRestartGame() {
    this.statusRecord.set(`player-${this.isHost ? 1 : 2}`, {action: ACTION.RESTART_GAME});
  }

  sendRequestCountdown() {
    this.statusRecord.set(`player-${this.isHost ? 1 : 2}`, {action: ACTION.REQUEST_COUNTDOWN});
  }
}
