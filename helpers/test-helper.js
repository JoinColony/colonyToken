/* eslint-disable no-console, no-unused-expressions */
import shortid from "shortid";
import { sha3 } from "web3-utils";
import chai from "chai";

const { expect } = chai;

export function web3GetNetwork() {
  return new Promise((resolve, reject) => {
    web3.eth.net.getId((err, res) => {
      if (err !== null) return reject(err);
      return resolve(res);
    });
  });
}

export function web3GetClient() {
  return new Promise((resolve, reject) => {
    web3.eth.getNodeInfo((err, res) => {
      if (err !== null) return reject(err);
      return resolve(res);
    });
  });
}

export function web3GetBalance(account) {
  return new Promise((resolve, reject) => {
    web3.eth.getBalance(account, (err, res) => {
      if (err !== null) return reject(err);
      return resolve(res);
    });
  });
}

export function web3GetTransaction(txid) {
  return new Promise((resolve, reject) => {
    web3.eth.getTransaction(txid, (err, res) => {
      if (err !== null) return reject(err);
      return resolve(res);
    });
  });
}

export function web3GetTransactionReceipt(txid) {
  return new Promise((resolve, reject) => {
    web3.eth.getTransactionReceipt(txid, (err, res) => {
      if (err !== null) return reject(err);
      return resolve(res);
    });
  });
}

export function web3GetFirstTransactionHashFromLastBlock() {
  return new Promise((resolve, reject) => {
    web3.eth.getBlock("latest", true, (err, res) => {
      if (err !== null) return reject(err);
      return resolve(res.transactions[0].hash);
    });
  });
}

export function web3GetCode(a) {
  return new Promise((resolve, reject) => {
    web3.eth.getCode(a, (err, res) => {
      if (err !== null) return reject(err);
      return resolve(res);
    });
  });
}

export async function checkErrorRevert(promise, errorMessage) {
  // There is a discrepancy between how ganache-cli handles errors
  // (throwing an exception all the way up to these tests) and how geth/parity handle them
  // (still making a valid transaction and returning a txid). For the explanation of why
  // See https://github.com/ethereumjs/testrpc/issues/39
  //
  // Obviously, we want our tests to pass on all, so this is a bit of a problem.
  // We have to have this special function that we use to catch the error.
  let receipt;
  let reason;
  try {
    ({ receipt } = await promise);
    // If the promise is from Truffle, then we have the receipt already.
    // If this tx has come from the mining client, the promise has just resolved to a tx hash and we need to do the following
    if (!receipt) {
      const txid = await promise;
      receipt = await web3GetTransactionReceipt(txid);
    }
  } catch (err) {
    ({ receipt, reason } = err);
    expect(reason).to.equal(errorMessage);
  }
  // Check the receipt `status` to ensure transaction failed.
  expect(receipt.status, `Transaction succeeded, but expected error ${errorMessage}`).to.be.false;
}

export function checkErrorNonPayableFunction(tx) {
  expect(tx).to.equal("Error: Cannot send value to non-payable function");
}

export function getRandomString(_length) {
  const length = _length || 7;
  let randString = "";
  while (randString.length < length) {
    randString += shortid
      .generate()
      .replace(/_/g, "")
      .toLowerCase();
  }
  return randString.slice(0, length);
}

export function getTokenArgs() {
  return [getRandomString(5), getRandomString(3), 18];
}

export async function currentBlockTime() {
  const p = new Promise((resolve, reject) => {
    web3.eth.getBlock("latest", (err, res) => {
      if (err) {
        return reject(err);
      }
      return resolve(res.timestamp);
    });
  });
  return p;
}

export async function getBlockTime(blockNumber) {
  const p = new Promise((resolve, reject) => {
    web3.eth.getBlock(blockNumber, (err, res) => {
      if (err) {
        return reject(err);
      }
      return resolve(res.timestamp);
    });
  });
  return p;
}

export async function expectEvent(tx, eventName) {
  const { logs } = await tx;
  const event = logs.find(e => e.event === eventName);
  return expect(event).to.exist;
}

export function getFunctionSignature(sig) {
  return sha3(sig).slice(0, 10);
}

export async function forwardTime(seconds, test) {
  const client = await web3GetClient();
  const p = new Promise((resolve, reject) => {
    if (client.indexOf("TestRPC") === -1) {
      resolve(test.skip());
    } else {
      console.log(`Forwarding time with ${seconds}s ...`);
      web3.currentProvider.send(
        {
          jsonrpc: "2.0",
          method: "evm_increaseTime",
          params: [seconds],
          id: 0
        },
        err => {
          if (err) {
            return reject(err);
          }
          return web3.currentProvider.send(
            {
              jsonrpc: "2.0",
              method: "evm_mine",
              params: [],
              id: 0
            },
            (err2, res) => {
              if (err2) {
                return reject(err2);
              }
              return resolve(res);
            }
          );
        }
      );
    }
  });
  return p;
}
