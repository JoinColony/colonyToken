/* globals artifacts */

import { assert } from "chai";
import BN from "bn.js";
import web3Utils from "web3-utils";
import { forwardTime, expectEvent, checkErrorRevert } from "../helpers/test-helper";

const Token = artifacts.require("Token");
const Vesting = artifacts.require("Vesting");
const MultiSigWallet = artifacts.require("gnosis/MultiSigWallet.sol");

contract("Vesting", accounts => {
  const SECONDS_PER_MONTH = 2628000;
  const COLONY_ACCOUNT = accounts[0];
  const ACCOUNT_1 = accounts[1];
  const ACCOUNT_2 = accounts[2];
  const ACCOUNT_3 = accounts[3];
  const ACCOUNT_4 = accounts[4];
  const ACCOUNT_5 = accounts[5];
  const ACCOUNT_6 = accounts[6];
  const ACCOUNT_7 = accounts[7];
  const ACCOUNT_8 = accounts[8];
  const ACCOUNT_9 = accounts[9];
  const ACCOUNT_10 = accounts[10];
  const OTHER_ACCOUNT = accounts[11];

  const ACCOUNT_1_GRANT_AMOUNT = new BN(web3Utils.toWei("998", "finney"));
  const ACCOUNT_2_GRANT_AMOUNT = new BN(web3Utils.toWei("10001", "szabo"));
  const ACCOUNT_3_GRANT_AMOUNT = new BN(web3Utils.toWei("2", "ether"));
  const ACCOUNT_4_GRANT_AMOUNT = new BN(web3Utils.toWei("10001", "szabo"));
  const ACCOUNT_5_GRANT_AMOUNT = new BN(web3Utils.toWei("20", "finney"));
  const ACCOUNT_6_GRANT_AMOUNT = new BN(web3Utils.toWei("10001", "szabo"));
  const ACCOUNT_7_GRANT_AMOUNT = new BN(web3Utils.toWei("998", "finney"));
  const ACCOUNT_8_GRANT_AMOUNT = new BN(web3Utils.toWei("10001", "szabo"));
  const ACCOUNT_9_GRANT_AMOUNT = new BN(web3Utils.toWei("998", "finney"));
  const ACCOUNT_10_GRANT_AMOUNT = new BN(web3Utils.toWei("10001", "szabo"));

  const TOTAL_SUPPLY = ACCOUNT_1_GRANT_AMOUNT.add(ACCOUNT_2_GRANT_AMOUNT)
    .add(ACCOUNT_3_GRANT_AMOUNT)
    .add(ACCOUNT_4_GRANT_AMOUNT)
    .add(ACCOUNT_5_GRANT_AMOUNT)
    .add(ACCOUNT_6_GRANT_AMOUNT)
    .add(ACCOUNT_7_GRANT_AMOUNT)
    .add(ACCOUNT_8_GRANT_AMOUNT)
    .add(ACCOUNT_9_GRANT_AMOUNT)
    .add(ACCOUNT_10_GRANT_AMOUNT);

  let colonyMultiSig;
  let token;
  let vesting;

  before(async () => {
    colonyMultiSig = await MultiSigWallet.new([COLONY_ACCOUNT], 1);
  });

  beforeEach(async () => {
    token = await Token.new("Colony token", "CLNY", 18);
    await token.setOwner(colonyMultiSig.address);

    let txData = await token.contract.mint.getData(TOTAL_SUPPLY.toString());
    await colonyMultiSig.submitTransaction(token.address, 0, txData);

    const totalBalance = await token.balanceOf.call(colonyMultiSig.address);
    assert.equal(totalBalance.toString(), TOTAL_SUPPLY.toString());

    vesting = await Vesting.new(token.address, colonyMultiSig.address);

    // Approve the total balance to be tranferred by the vesting contract as part of the `addTokenGrant` call
    txData = await token.contract.approve.getData(vesting.address, TOTAL_SUPPLY.toString());
    await colonyMultiSig.submitTransaction(token.address, 0, txData);
  });

  describe("when initialised", () => {
    it("should set the Token correctly", async () => {
      const tokenAddress = await vesting.token.call();
      assert.equal(token.address, tokenAddress);
    });

    it("should set the MultiSig correctly", async () => {
      const multiSigAddress = await vesting.colonyMultiSig.call();
      assert.equal(colonyMultiSig.address, multiSigAddress);
    });
  });

  describe("when creating token grants", () => {
    it("should create the correct grant", async () => {
      const txData = await vesting.contract.addTokenGrant.getData(ACCOUNT_1, 1000, 24, 6);
      await colonyMultiSig.submitTransaction(vesting.address, 0, txData);

      const grant = await vesting.tokenGrants.call(ACCOUNT_1);
      assert.equal(grant[0].toNumber(), 1000);
      // TODO: allow backdating of grants
      // assert.equal(grant[1].toNumber(), )
      assert.equal(grant[2].toNumber(), 24);
      assert.equal(grant[3].toNumber(), 6);
      assert.equal(grant[4].toNumber(), 0);
      assert.equal(grant[5].toNumber(), 0);
    });

    it("should log correct event", async () => {
      const txData = await vesting.contract.addTokenGrant.getData(ACCOUNT_1, 1000, 24, 6);
      await expectEvent(colonyMultiSig.submitTransaction(vesting.address, 0, txData), "Execution");
    });

    it("should error if called by anyone but the Colony multisig", async () => {
      await checkErrorRevert(vesting.addTokenGrant(ACCOUNT_1, 1000, 24, 6), { from: ACCOUNT_3 });
    });

    it("should error if duration is 0", async () => {
      const txData = await vesting.contract.addTokenGrant.getData(ACCOUNT_1, 1000, 0, 6);
      await expectEvent(colonyMultiSig.submitTransaction(vesting.address, 0, txData), "ExecutionFailure");
    });

    it("should error if cliff is 0", async () => {
      const txData = await vesting.contract.addTokenGrant.getData(ACCOUNT_1, 1000, 24, 0);
      await expectEvent(colonyMultiSig.submitTransaction(vesting.address, 0, txData), "ExecutionFailure");
    });

    it("should error if amount/duration is not greater than zero", async () => {
      const txData = await vesting.contract.addTokenGrant.getData(ACCOUNT_1, 1000, 1001, 6);
      await expectEvent(colonyMultiSig.submitTransaction(vesting.address, 0, txData), "ExecutionFailure");
    });
  });

  describe("when claiming vested tokens", () => {
    it("should NOT be able to claim within the first month", async () => {
      const txData = await vesting.contract.addTokenGrant.getData(ACCOUNT_1, ACCOUNT_1_GRANT_AMOUNT.toString(10), 24, 6);
      await colonyMultiSig.submitTransaction(vesting.address, 0, txData);
      forwardTime(3600);
      const balanceBefore = await token.balanceOf.call(ACCOUNT_1);
      assert.equal(balanceBefore.toNumber(), 0);

      await checkErrorRevert(vesting.claimVestedTokens({ from: ACCOUNT_1 }));

      const balanceAfter = await token.balanceOf.call(ACCOUNT_1);
      assert.equal(balanceAfter.toNumber(), 0);
    });

    it("should NOT be able to claim before cliff reached", async () => {
      const txData = await vesting.contract.addTokenGrant.getData(ACCOUNT_1, ACCOUNT_1_GRANT_AMOUNT.toString(10), 24, 6);
      await colonyMultiSig.submitTransaction(vesting.address, 0, txData);
      forwardTime(SECONDS_PER_MONTH * 6 - 3600);
      const balanceBefore = await token.balanceOf.call(ACCOUNT_1);
      assert.equal(balanceBefore.toNumber(), 0);

      await checkErrorRevert(vesting.claimVestedTokens({ from: ACCOUNT_1 }));

      const balanceAfter = await token.balanceOf.call(ACCOUNT_1);
      assert.equal(balanceAfter.toNumber(), 0);
    });

    const grantProperties = [
      {
        duration: 24,
        cliff: 6,
        monthsElapsed: 6
      },
      {
        duration: 24,
        cliff: 6,
        monthsElapsed: 7
      },
      {
        duration: 24,
        cliff: 6,
        monthsElapsed: 8
      },
      {
        duration: 24,
        cliff: 6,
        monthsElapsed: 9
      },
      {
        duration: 24,
        cliff: 6,
        monthsElapsed: 10
      },
      {
        duration: 24,
        cliff: 6,
        monthsElapsed: 11
      },
      {
        duration: 24,
        cliff: 6,
        monthsElapsed: 12
      },
      {
        duration: 24,
        cliff: 6,
        monthsElapsed: 18
      },
      {
        duration: 24,
        cliff: 6,
        monthsElapsed: 24
      }
    ];

    grantProperties.forEach(async grantProp => {
      it(`${grantProp.monthsElapsed} months after grant start date, user should be able to claim
       ${grantProp.monthsElapsed}/${grantProp.duration} of their total token grant`, async () => {
        const txData = await vesting.contract.addTokenGrant.getData(
          ACCOUNT_1,
          ACCOUNT_1_GRANT_AMOUNT.toString(10),
          grantProp.duration,
          grantProp.cliff
        );
        await colonyMultiSig.submitTransaction(vesting.address, 0, txData);

        const timeToForward = SECONDS_PER_MONTH * grantProp.monthsElapsed;
        await forwardTime(timeToForward, this);
        const balanceBefore = await token.balanceOf.call(ACCOUNT_1);
        assert.equal(balanceBefore.toNumber(), 0);

        await vesting.claimVestedTokens({ from: ACCOUNT_1 });

        const balanceAfter = await token.balanceOf.call(ACCOUNT_1);
        assert.equal(
          balanceAfter.toNumber(),
          ACCOUNT_1_GRANT_AMOUNT.divn(grantProp.duration)
            .muln(grantProp.monthsElapsed)
            .toString()
        );

        const tokenGrant = await vesting.tokenGrants.call(ACCOUNT_1);
        assert.equal(tokenGrant[4].toNumber(), grantProp.monthsElapsed);
        assert.equal(
          tokenGrant[5].toNumber(),
          ACCOUNT_1_GRANT_AMOUNT.divn(grantProp.duration)
            .muln(grantProp.monthsElapsed)
            .toString()
        );
      });
    });
  });
});
