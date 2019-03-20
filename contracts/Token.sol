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

pragma solidity >=0.5.3;

import "../lib/dappsys/token.sol";


contract Token is DSToken {
  bool public locked;

  modifier unlocked {
    if (locked) {
      require(isAuthorized(msg.sender, msg.sig), "colony-token-unauthorised");
    }
    _;
  }

  constructor(bytes32 _name, bytes32 _symbol, uint8 _decimals)  DSToken(_symbol) public {
    locked = true;

    name = _name;
    decimals = _decimals;
  }

  function transferFrom(address src, address dst, uint wad) public 
  unlocked
  returns (bool)
  {
    return super.transferFrom(src, dst, wad);
  }

  function unlock() public
  auth
  {
    locked = false;
  }
}
