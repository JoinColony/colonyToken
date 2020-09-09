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

import "./Token.sol";
import "../lib/dappsys/auth.sol";
import "../lib/dappsys/math.sol";
import "../lib/dappsys/erc20.sol";


contract VestingSimple is DSMath, DSAuth {

  event TokensClaimed(address grantee, uint256 amount);

  Token public token;

  constructor(address _token) public {
    token = Token(_token);
  }

  struct Grant {
    uint256 amount;
    uint256 claimed;
  }

  mapping (address => Grant) grants;

}
