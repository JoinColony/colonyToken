/* globals artifacts */

import BN from "bn.js";

const Token = artifacts.require("Token");
const TokenAuthority = artifacts.require("TokenAuthority");
const VestingSimple = artifacts.require("VestingSimple");
const DSAuth = artifacts.require("DSAuth");

contract("Gas Costs", accounts => {
  const USER0 = accounts[0];
  const USER1 = accounts[1];
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  const WAD = new BN(10).pow(new BN(18));
  const BASE = WAD.muln(250000);
  const GRANT = BASE.muln(5);

  const YEAR = 60 * 60 * 24 * 365;

  let token;
  let vesting;

  beforeEach(async () => {
    token = await Token.new("Colony token", "CLNY", 18);
    vesting = await VestingSimple.new(token.address, BASE, YEAR);

    const tokenAuthority = await TokenAuthority.new(token.address, ZERO_ADDRESS, [vesting.address]);
    const dsAuthToken = await DSAuth.at(token.address);
    await dsAuthToken.setAuthority(tokenAuthority.address);
  });

  describe("VestingSimple", () => {
    it("working with grants", async () => {
      await token.mint(vesting.address, GRANT);
      await vesting.setGrant(USER1, GRANT, {from: USER0});
      await vesting.activate({from: USER0});
      await vesting.claimGrant({from: USER1});
    });
  });
});
