/* globals artifacts */

import BN from "bn.js";
import web3Utils from "web3-utils";
import { forwardTime } from "../helpers/test-helper";

const Token = artifacts.require("Token");
const Vesting = artifacts.require("Vesting");

contract("Vesting", accounts => {
  const SECONDS_PER_MONTH = 2628000;
  const COLONY_ACCOUNT = accounts[0];
  const ACCOUNT_1 = accounts[1];

  const ACCOUNT_1_GRANT_AMOUNT = new BN(web3Utils.toWei("998", "finney"));

  let token;
  let vesting;

  beforeEach(async () => {
    token = await Token.new("Colony token", "CLNY", 18);
    await token.mint(ACCOUNT_1_GRANT_AMOUNT.toString());

    vesting = await Vesting.new(token.address, COLONY_ACCOUNT);
    // Approve the total balance to be tranferred by the vesting contract as part of the `addTokenGrant` call
    await token.approve(vesting.address, ACCOUNT_1_GRANT_AMOUNT.toString());
  });

  describe("Gas costs", () => {
    it("working with grants", async () => {
      await vesting.addTokenGrant(ACCOUNT_1, ACCOUNT_1_GRANT_AMOUNT.toString(), 0, 24, 6);
      await forwardTime(SECONDS_PER_MONTH * 7);
      await vesting.claimVestedTokens({ from: ACCOUNT_1 });
      await vesting.removeTokenGrant(ACCOUNT_1);
    });
  });
});
