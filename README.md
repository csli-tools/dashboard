# csli Dashboard

We've accidentally created a terminal block explorer, but for now this is aimed at developers writing CosmWasm smart contracts.

## Problem

1. As we develop our contracts, we have no idea what the hell is going on inside the blockchain.
2. We need more people to chip in and help use and test all the CosmJS libraries.

## Solution

We'll use CosmJS libraries to set up a terminal dashboard capable of being a full dark-room, hacker* battle station.
**Trance music not included.*

## Setup

### Get `wasmd`

Grab `wasmd` from the instructions here:
https://github.com/CosmWasm/wasmd

(You can use other daemons like `junod` but we'll keep it simple for this guide.)

### Set up the local blockchain

If you've already run these or similar commands and wish to start a fresh blockchain and blow away everything, you may run:

    rm -rf ~/.wasmd/

```sh
wasmd init jabroni --chain-id cc-23
wasmd keys add validator
wasmd keys show validator
# Copy the address and replace the Juno address in the next command
wasmd add-genesis-account $(wasmd keys show validator -a) 10000000000000000000000000stake
wasmd gentx validator 1000000000000000stake --chain-id cc-23
wasmd collect-gentxs
wasmd start
```

**Note**: we made up `jabroni` and the chain ID `cc-23` so feel free to change those.

### Supplemental info

Read this:
https://tutorials.cosmos.network/academy/3-my-own-chain/cosmwasm.html

and set up your local chain. If you get any errors, please [contribute here](https://github.com/cosmos/sdk-tutorials).

### Start the dashboard

After you've run the commands from the previous section and `wasmd start` is running and making blocks, start the CSLI dashboard with:

    npm run start

In another terminal window, you can also start a "breakout pane" that shows a specific aspect of the transaction, like the Messages.

To list the available breakout panes, run:

    npm run pane

To start the breakout pane for Messages run:

    npm run pane msg

This will connect to the dashboard using [websockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket).

### Execute a simple Bank Message

Let's send the smallest amount of `stake` tokens from our `validator` to another account.

First, we'll create an account named `alice` by running:

    wasmd keys add alice

and in the future we can get the wasm address with:

    wasm keys show alice

Let's send *from* `validator` *to* `alice` with:

    wasmd tx bank send $(wasmd keys show validator -a) $(wasmd keys show alice -a) 1stake --chain-id cc-23 -y --output json

**Note**: if you're on Windows, you may need to fiddle with the command above, replacing the `$(…)` code with the wasm addresses for `validator` and `alice`.

You should see the Bank Message in the breakout pane, and the transaction information come through.

### Configuration

The app will look for the file `csli.json` in your current working directory (eventually your home directory, too). See csli.json.example in the project root for reference. Your csli.json file should conform to this typescript interface definition:

```typescript
interface CSLIConfig {
    contracts: {
        [address: string]: {
            queries: {
                name: string
                key: string
                mandatory?: {
                    key: string
                    valueType: "string" | "number"
                }[]
                optional?: {
                    key: string
                    valueType: "string" | "number"
                }[]
            }[]
        }
    }
}
```
