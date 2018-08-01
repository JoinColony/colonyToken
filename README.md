![Colony Logo](https://user-images.githubusercontent.com/9886144/31672259-f9586cc4-b353-11e7-97fd-486069cbd256.png)

# Colony Token and Vesting contracts

## About

This is the repository for the Colony token and Token Vesting contracts.

The contracts contained in this repo have been released under a GPL-3.0 license. 

It should go without saying, but the code contained herein is designed to handle potentially large amounts of Ether, and as such should be deployed at your own risk and sole responsibility.  

If you've found a bug, please reach out to us here on github or by [email](mailto:hello@colony.io).

## Install

```
git clone https://github.com/JoinColony/colonySale.git
cd colonySale
yarn
git submodule update --init
```

## Contracts

[Token.sol](./contracts/Token.sol)
Deployed on mainnet at `0x06441deaf11d60d77e5e42d4f644c64ca05c2fce`

CLNY Token contract based on an ERC20 token with `mint` functionality. The Token largely reuses the `DSToken` implementation from [Dappsys library](https://github.com/dapphub/dappsys). Additionally implements a one-way unlock switch to open the token to transfers to all token holders. When deployed initially, token transfers will only be allowed for the Colony MultiSig and Vesting contracts, see `TokenAuthority` contract for details. 

[TokenAuthority.sol](./contracts/TokenAuthority.sol)
Deployed on mainnet at `0xcac5519b7efe284386c286787b099b391a092d15`

Acts as the Token Authority while CLNY Token is locked for token transfers. Implements `DSAuthority` to allow Colony MultiSig and Vesting contracts to be the only two that can transfer tokens for the purposes of pre-allocating tokens and token grants.

[Vesting.sol](./contracts/Vesting.sol) 
Deployed on mainnet at `0x48d8a487a90207e371acd3ded547e5c6afe90332`

Stores and manages the CLNY Token grants via the following functions:

Secured to Colony MultiSig only:
* `addTokenGrant` - Adds a new token grant for a given user. Only one grant per user is allowed. The amount of CLNY grant tokens here need to be preapproved by the Colony MultiSig (which mints and owns the tokens) for transfer by the `Vesting` contract before this call. There is an option to backdate the grant here if needed.

* `removeTokenGrant` - Terminate token grant for a given user transferring all vested tokens to the user and returning all non-vested tokens to the Colony MultiSig.

Public functions:
* `claimVestedTokens` - Allows a grant recipient to claim their vested tokens. Errors if no tokens have vested. Note that it is advised recipients check they are entitled to claim via `calculateGrantClaim` before calling this.

* `calculateGrantClaim` - Calculates the vested and unclaimed months and tokens available for a given user to claim. Due to rounding errors once grant duration is reached, returns the entire left grant amount. Returns (0, 0) if cliff has not been reached.

The Colony Multisignature contract is defined in gnosis/MultiSigWallet.sol and based on the [Gnosis MultiSig](https://github.com/gnosis/MultiSigWallet)

## Testing

To run all tests:
```
gulp test:contracts
```
To run tests with code coverage using [solidity-coverage](https://github.com/sc-forks/solidity-coverage):
```
gulp test:contracts:coverage
```
To lint contracts using [Solium](https://github.com/duaraghav8/Solium)
```
gulp lint:contracts
```

## Deployment

We use a hosted Ethereum node cluster - [Infura](https://infura.io) for deployment to main and test networks.

Flattened contracts are in source control under `flattened` folder and can be generated via `yarn run flatten:contracts` which uses [/solidity-steamroller](https://github.com/JoinColony/solidity-steamroller)
