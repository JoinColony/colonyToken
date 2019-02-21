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

pragma solidity >=0.4.23;

import "./ERC20Extended.sol";


contract TokenTransferBinaryRegulator {
  struct Transfer {
    address from;
    address to;
    address token;
    uint256 amount;
    bool valid;
  }

  mapping (uint256 => Transfer) public transfers;
  uint public transferCount = 0;
  address public owner;

  constructor(address _owner) {
    owner = _owner;
  }

  function invalidateRequest(uint256 _id) public {
    require(transfers[_id].from == msg.sender || msg.sender == owner, "colony-token-regulator-not-from-address");
    transfers[_id].valid = false;
  }

  function requestTransfer(address _from, address _to, address _token, uint256 _amount) public {
    require(_from == msg.sender, "colony-token-regulator-not-from-address");
    transfers[transferCount] = Transfer(_from, _to, _token, _amount, true);
    transferCount += 1;
  }

  function executeTransfer(uint256 _id) public {
    require(transfers[_id].valid == true, "colony-token-regulator-transfer-invalid-or-already-executed");
    require(msg.sender == owner, "colony-token-regulator-only-owner-can-execute");
    transfers[_id].valid = false;
    ERC20Extended(transfers[_id].token).transferFrom(transfers[_id].from, transfers[_id].to, transfers[_id].amount);
  }
}
