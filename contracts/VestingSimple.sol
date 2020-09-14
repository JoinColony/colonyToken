/*
  This file is part of The Colony Network.

  The Colony Network is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  The Colony Network is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with The Colony Network. If not, see <http://www.gnu.org/licenses/>.
*/

pragma solidity 0.5.8;
pragma experimental ABIEncoderV2;

import "./Token.sol";
import "../lib/dappsys/auth.sol";
import "../lib/dappsys/math.sol";
import "../lib/dappsys/erc20.sol";


contract VestingSimple is DSMath, DSAuth {

  uint256 constant BASE = 250000 * WAD; // 250,000
  uint256 constant PERIOD = 365 days; // one year

  event GrantAdded(address recipient, uint256 amount);
  event GrantClaimed(address recipient, uint256 amount);

  Token public token;
  bool isActive;
  uint256 startTime;

  struct Grant {
    uint256 amount;
    uint256 claimed;
  }

  mapping (address => Grant) grants;

  modifier inactive() {
    require(!isActive, "vesting-simple-already-active");
    _;
  }

  modifier active() {
    require(isActive, "vesting-simple-not-active");
    _;
  }

  constructor(address _token) public {
    token = Token(_token);
  }

  function activate() public auth inactive {
    isActive = true;
    startTime = now;
  }

  // Public

  function addGrant(address _recipient, uint256 _amount) public auth inactive {
    grants[_recipient].amount = _amount;

    emit GrantAdded(_recipient, _amount);
  }

  function claimGrant() public active {
    Grant storage grant = grants[msg.sender];

    uint256 amountClaimable = min(
      sub(grant.amount, grant.claimed),
      getAmountClaimable(grant.amount)
    );

    require(amountClaimable > 0, "vesting-simple-nothing-to-claim");

    grant.claimed = add(grant.claimed, amountClaimable);
    token.transfer(msg.sender, amountClaimable);

    assert(grant.amount >= grant.claimed);

    emit GrantClaimed(msg.sender, amountClaimable);
  }

  // View

  function getGrant(address _recipient) public view returns (Grant memory grant) {
    grant = grants[_recipient];
  }

  function getAmountClaimable(uint256 _amount) public view returns (uint256) {
    uint256 fractionUnlocked = min(WAD, wdiv(now - startTime, PERIOD)); // Max 1
    uint256 remainder = sub(max(BASE, _amount), BASE); // Avoid underflows for small grants
    return min(_amount, add(BASE, wmul(fractionUnlocked, remainder)));
  }
}
