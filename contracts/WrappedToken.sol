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

import "../lib/dappsys/base.sol";
import "./Token.sol";
import "./Lockable.sol";

contract WrappedToken is DSTokenBase(0), Lockable {
  event  Deposit(address indexed dst, uint256 wad);
  event  Withdrawal(address indexed src, uint256 wad);

  address public token;

  constructor(address _token) public {
    token = _token;
  }

  function decimals() public view returns (uint8) {
    return Token(token).decimals();
  }

  function name() public view returns (string memory) {
    return string(abi.encodePacked("Wrapped ", Token(token).name()));
  }

  function symbol() public view returns (string memory) {
    return string(abi.encodePacked("W", Token(token).symbol()));
  }

  function deposit(uint256 wad) public unlocked {
    _balances[msg.sender] = add(_balances[msg.sender], wad);
    _supply = add(_supply, wad);

    require(ERC20(token).transferFrom(msg.sender, address(this), wad), "wrapped-token-transfer-failed");

    emit Deposit(msg.sender, wad);
  }

  function withdraw(uint256 wad) public unlocked {
    _balances[msg.sender] = sub(_balances[msg.sender], wad);
    _supply = sub(_supply, wad);

    // This can't fail, since there's no way to underflow
    ERC20(token).transfer(msg.sender, wad);

    emit Withdrawal(msg.sender, wad);
  }

  // Note that transfer() calls this internally, so it's also lockable
  function transferFrom(address src, address dst, uint wad)
    public
    override
    unlocked
    returns (bool)
  {
    return super.transferFrom(src, dst, wad);
  }
}
