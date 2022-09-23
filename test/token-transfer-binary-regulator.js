/* globals artifacts */

import chai from "chai";
import bnChai from "bn-chai";

import { checkErrorRevert, expectEvent } from "../helpers/test-helper";

const { expect } = chai;
chai.use(bnChai(web3.utils.BN));

const TokenTransferBinaryRegulator = artifacts.require("TokenTransferBinaryRegulator");
const Token = artifacts.require("Token");
const MultiSigWallet = artifacts.require("MultiSigWallet");

contract("Binary Regulator", (accounts) => {
  const ADDRESS_1 = accounts[1];
  const ADDRESS_2 = accounts[2];
  const ADDRESS_3 = accounts[3];

  let regulator;
  let token;
  let colonyMultiSig;

  before(async () => {
    regulator = await TokenTransferBinaryRegulator.deployed();
    token = await Token.deployed();
    colonyMultiSig = await MultiSigWallet.deployed();
  });

  describe("when working with a locked token", () => {
    it("should be able to submit transfers", async () => {
      let txData = await token.contract.methods.mint(500).encodeABI();
      await colonyMultiSig.submitTransaction(token.address, 0, txData);
      txData = await token.contract.methods.transfer(ADDRESS_1, 500).encodeABI();
      await colonyMultiSig.submitTransaction(token.address, 0, txData);

      const a1BalanceBefore = await token.balanceOf(ADDRESS_1);
      const a2BalanceBefore = await token.balanceOf(ADDRESS_2);

      // Confirm we cannot send directly
      await checkErrorRevert(token.transfer(ADDRESS_2, 500, { from: ADDRESS_1 }), "colony-token-unauthorised");

      // Make request to regulator
      await token.approve(regulator.address, 500, { from: ADDRESS_1 });
      await regulator.requestTransfer(ADDRESS_1, ADDRESS_2, 500, { from: ADDRESS_1 });

      const transferCount = await regulator.transferCount();

      // Approve request through multisig
      txData = await regulator.contract.methods.executeTransfer(transferCount.toNumber()).encodeABI();
      await colonyMultiSig.submitTransaction(regulator.address, 0, txData);

      // Check it worked
      const a1BalanceAfter = await token.balanceOf(ADDRESS_1);
      expect(a1BalanceBefore.sub(a1BalanceAfter)).to.eq.BN(500);

      const a2BalanceAfter = await token.balanceOf(ADDRESS_2);
      expect(a2BalanceAfter.sub(a2BalanceBefore)).to.eq.BN(500);
    });

    it("shouldn't allow me to propose a transfer of someone else's tokens", async () => {
      await checkErrorRevert(regulator.requestTransfer(ADDRESS_2, ADDRESS_1, 500, { from: ADDRESS_1 }), "colony-token-regulator-not-from-address");
    });

    it("should't allow anyone but the owner to execute transfer", async () => {
      const txData = await token.contract.methods.mint(ADDRESS_1, 1000).encodeABI();
      await colonyMultiSig.submitTransaction(token.address, 0, txData);

      // Make request to regulator
      await token.approve(regulator.address, 1000, { from: ADDRESS_1 });
      await regulator.requestTransfer(ADDRESS_1, ADDRESS_2, 500, { from: ADDRESS_1 });

      const transferCount = await regulator.transferCount();
      await checkErrorRevert(regulator.executeTransfer(transferCount.toNumber()), "colony-token-regulator-only-owner-can-execute");
    });

    it("shouldn't allow me to cancel someone else's transfer", async () => {
      await regulator.requestTransfer(ADDRESS_1, ADDRESS_2, 500, { from: ADDRESS_1 });
      const transferCount = await regulator.transferCount();
      await checkErrorRevert(regulator.invalidateRequest(transferCount), "colony-token-regulator-not-from-address");
    });

    it("should allow me to cancel a transfer I proposed", async () => {
      await regulator.requestTransfer(ADDRESS_1, ADDRESS_2, 500, { from: ADDRESS_1 });
      const transferCount = await regulator.transferCount();
      await regulator.invalidateRequest(transferCount, { from: ADDRESS_1 });
      const transfer = await regulator.transfers(transferCount);
      expect(transfer.valid).to.be.false;
    });

    it("should allow an admin to decline a transfer", async () => {
      await regulator.requestTransfer(ADDRESS_1, ADDRESS_2, 500, { from: ADDRESS_1 });
      let transferCount = await regulator.transferCount();
      transferCount = transferCount.toNumber();

      let transfer = await regulator.transfers(transferCount);
      expect(transfer.valid).to.be.true;

      const txData = await regulator.contract.methods.invalidateRequest(transferCount).encodeABI();
      await colonyMultiSig.submitTransaction(regulator.address, 0, txData);

      transfer = await regulator.transfers(transferCount);
      expect(transfer.valid).to.be.false;
    });

    it("should not allow a transfer to be approved more than once", async () => {
      let txData = await token.contract.methods.mint(1000).encodeABI();
      await colonyMultiSig.submitTransaction(token.address, 0, txData);
      txData = await token.contract.methods.transfer(ADDRESS_1, 1000).encodeABI();
      await colonyMultiSig.submitTransaction(token.address, 0, txData);

      // Make request to regulator
      await token.approve(regulator.address, 1000, { from: ADDRESS_1 });
      await regulator.requestTransfer(ADDRESS_1, ADDRESS_2, 500, { from: ADDRESS_1 });

      let transferCount = await regulator.transferCount();
      transferCount = transferCount.toNumber();

      // Approve request through multisig
      txData = await regulator.contract.methods.executeTransfer(transferCount).encodeABI();
      await colonyMultiSig.submitTransaction(regulator.address, 0, txData);

      const a1BalanceBefore = await token.balanceOf(ADDRESS_1);
      const a2BalanceBefore = await token.balanceOf(ADDRESS_2);

      await expectEvent(colonyMultiSig.submitTransaction(regulator.address, 0, txData), "ExecutionFailure");

      // Double check balances didn't change
      const a1BalanceAfter = await token.balanceOf(ADDRESS_1);
      const a2BalanceAfter = await token.balanceOf(ADDRESS_2);

      expect(a1BalanceAfter).to.eq.BN(a1BalanceBefore);
      expect(a2BalanceAfter).to.eq.BN(a2BalanceBefore);
    });

    it("should allow transfer approvals to work with cumulative approvals of token tranfers", async () => {
      let txData = await token.contract.methods.mint(500).encodeABI();
      await colonyMultiSig.submitTransaction(token.address, 0, txData);
      txData = await token.contract.methods.transfer(ADDRESS_1, 500).encodeABI();
      await colonyMultiSig.submitTransaction(token.address, 0, txData);

      // Confirm we cannot send directly
      await checkErrorRevert(token.transfer(ADDRESS_2, 500, { from: ADDRESS_1 }), "colony-token-unauthorised");

      // Make 2 separate requests to regulator totalling the entire amount
      await token.approve(regulator.address, 500, { from: ADDRESS_1 });
      await regulator.requestTransfer(ADDRESS_1, ADDRESS_2, 100, { from: ADDRESS_1 });
      await regulator.requestTransfer(ADDRESS_1, ADDRESS_3, 400, { from: ADDRESS_1 });

      let transferCount = await regulator.transferCount();
      transferCount = transferCount.toNumber();

      let a1BalanceBefore = await token.balanceOf(ADDRESS_1);
      const a2BalanceBefore = await token.balanceOf(ADDRESS_2);
      // Approve first request through multisig
      txData = await regulator.contract.methods.executeTransfer(transferCount - 1).encodeABI();
      await colonyMultiSig.submitTransaction(regulator.address, 0, txData);
      // Check it worked
      let a1BalanceAfter = await token.balanceOf(ADDRESS_1);
      expect(a1BalanceBefore.sub(a1BalanceAfter)).to.eq.BN(100);
      const a2BalanceAfter = await token.balanceOf(ADDRESS_2);
      expect(a2BalanceAfter.sub(a2BalanceBefore)).to.eq.BN(100);

      a1BalanceBefore = await token.balanceOf(ADDRESS_1);
      const a3BalanceBefore = await token.balanceOf(ADDRESS_3);
      // Approve second request through multisig
      txData = await regulator.contract.methods.executeTransfer(transferCount).encodeABI();
      await colonyMultiSig.submitTransaction(regulator.address, 0, txData);
      // Check it worked
      a1BalanceAfter = await token.balanceOf(ADDRESS_1);
      expect(a1BalanceBefore.sub(a1BalanceAfter)).to.eq.BN(400);
      const a3BalanceAfter = await token.balanceOf(ADDRESS_3);
      expect(a3BalanceAfter.sub(a3BalanceBefore)).to.eq.BN(400);
    });
  });
});
