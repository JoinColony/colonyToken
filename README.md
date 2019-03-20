![Colony Logo](./horizontal_color.png)

# Colony Token and Vesting contracts

## About

This is the repository for the Colony token (CLNY) and Token Vesting contracts.

The contracts contained in this repo have been released under a GPL-3.0 license. 

It should go without saying, but the code contained herein is designed to handle potentially large amounts of Ether, and as such should be deployed at your own risk and sole responsibility.  

If you've found a bug, please reach out to us here on github or by [email](mailto:hello@colony.io).

## Install

```
git clone https://github.com/JoinColony/colonyToken.git
cd colonyToken
yarn
git submodule update --remote --init
yarn run provision:multisig:contract
```

## Contracts

[Token.sol](./contracts/Token.sol)
CLNY Token contract based on an ERC20 token with `mint` and `burn` functionality. The Token is based on the `DSToken` implementation from [Dappsys library](https://github.com/dapphub/dappsys). Additionally implements a one-way unlock switch to open the token to transfers to all token holders. When deployed initially, token transfers will only be allowed for the Colony MultiSig and Vesting contracts, see `TokenAuthority` contract for details. 

[TokenAuthority.sol](./contracts/TokenAuthority.sol)
Acts as the Token Authority while CLNY Token is locked for token transfers. Implements `DSAuthority` to allow Colony MultiSig, Vesting and other necessary contracts to be able to transfer tokens for the purposes of pre-allocating tokens and token grants as well as the general functioning of the Colony Network. This is an immutable set of permissions which can be reviewed in the contract itself.

[Vesting.sol](./contracts/Vesting.sol) 
Stores and manages the CLNY Token grants via the following functions:

Secured to Colony MultiSig only:
* `addTokenGrant` - Adds a new token grant for a given user. Only one grant per user is allowed. The amount of CLNY grant tokens here need to be preapproved by the Colony MultiSig (which mints and owns the tokens) for transfer by the `Vesting` contract before this call. There is an option to backdate the grant here if needed.

* `removeTokenGrant` - Terminate token grant for a given user transferring all vested tokens to the user and returning all non-vested tokens to the Colony MultiSig.

Public functions:
* `claimVestedTokens` - Allows a grant recipient to claim their vested tokens. Errors if no tokens have vested. Note that it is advised recipients check they are entitled to claim via `calculateGrantClaim` before calling this.

* `calculateGrantClaim` - Calculates the vested and unclaimed months and tokens available for a given user to claim. Due to rounding errors once grant duration is reached, returns the entire left grant amount. Returns (0, 0) if cliff has not been reached.

The Colony Multisignature contract is defined in gnosis-multisig/contracts/MultiSigWallet.sol and based on the [Gnosis MultiSig](https://github.com/gnosis/MultiSigWallet)

## Testing

To run all tests:
```
yarn test:contracts
```
To run tests with code coverage using [solidity-coverage](https://github.com/sc-forks/solidity-coverage):
```
yarn test:contracts:coverage
```
To lint contracts using [Solium](https://github.com/duaraghav8/Solium)
```
yarn lint:contracts
```

## Deployment

We use a hosted Ethereum node cluster - [Infura](https://infura.io) for deployment to main and test networks.

Flattened contracts are in source control under `flattened` folder and can be generated via `yarn run flatten:contracts` which uses [/solidity-steamroller](https://github.com/JoinColony/solidity-steamroller)
