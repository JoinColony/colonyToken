DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

cd $DIR
cd ..

test ! -d ./build/contracts/ && mkdir -p ./build/contracts/

# Provision the gnosis MultiSig contract used in tests only
# Note that the contract artefact is pre-compiled here, if you want to compile from source, use the https://github.com/gnosis/MultiSigWallet
cp lib/gnosis/build/contracts/MultiSigWallet.json ./build/contracts/MultiSigWallet.json