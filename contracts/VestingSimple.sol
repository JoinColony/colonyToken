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

pragma solidity 0.8.10;
pragma experimental ABIEncoderV2;

import "./Token.sol";
import "../lib/dappsys/auth.sol";
import "../lib/dappsys/math.sol";
import "../lib/dappsys/erc20.sol";


contract VestingSimple is DSMath, DSAuth {

  event GrantSet(address recipient, uint256 amount);
  event GrantClaimed(address recipient, uint256 claimed);

  Token public token; // The token being distributed

  uint256 public initialClaimable; // The amount of tokens claimable upon activation
  uint256 public vestingDuration; // The period of time (in seconds) over which the vesting occurs
  uint256 public startTime; // The timestamp of activation, when vesting begins

  uint256 public totalGrants; // Sum of all grants
  uint256 public totalClaimed; // Sum of all claimed tokens

  struct Grant {
    uint256 amount;
    uint256 claimed;
  }

  mapping (address => Grant) public grants;

  constructor(address _token, uint256 _initialClaimable, uint256 _vestingDuration) public {
    require(_token != address(0x0), "vesting-simple-invalid-token");

    token = Token(_token);
    initialClaimable = _initialClaimable;
    vestingDuration = _vestingDuration;
  }

  function withdraw(uint256 _amount) external auth {
    require(token.transfer(msg.sender, _amount), "vesting-simple-transfer-failed");
  }

  function activate() external auth {
    require(startTime == 0, "vesting-simple-already-active");
    startTime = block.timestamp;
  }

  function setGrant(address _recipient, uint256 _amount) public auth {
    Grant storage grant = grants[_recipient];
    require(grant.claimed <= _amount, "vesting-simple-bad-amount");

    totalGrants = add(_amount, sub(totalGrants, grant.amount));
    grant.amount = _amount;

    emit GrantSet(_recipient, _amount);
  }

  function setGrants(address[] calldata _recipients, uint256[] calldata _amounts) external auth {
    require(_recipients.length == _amounts.length, "vesting-simple-bad-inputs");

    for (uint256 i; i < _recipients.length; i++) {
      setGrant(_recipients[i], _amounts[i]);
    }
  }

  function claimGrant() external {
    Grant storage grant = grants[msg.sender];
    uint256 claimable = sub(getClaimable(grant.amount), grant.claimed);
    require(claimable > 0, "vesting-simple-nothing-to-claim");

    grant.claimed = add(grant.claimed, claimable);
    totalClaimed = add(totalClaimed, claimable);
    assert(grant.amount >= grant.claimed);

    require(token.transfer(msg.sender, claimable), "vesting-simple-transfer-failed");

    emit GrantClaimed(msg.sender, claimable);
  }

  function getClaimable(uint256 _amount) public view returns (uint256) {
    if (startTime == 0) { return 0; }
    uint256 fractionUnlocked = min(WAD, wdiv((block.timestamp - startTime), vestingDuration)); // Max 1
    uint256 remainder = sub(max(initialClaimable, _amount), initialClaimable); // Avoid underflows for small grants
    return min(_amount, add(initialClaimable, wmul(fractionUnlocked, remainder)));
  }
}
