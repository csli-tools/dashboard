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

### Make local chain, nameservice contract

Read this:
https://tutorials.cosmos.network/academy/3-my-own-chain/cosmwasm.html

and set up your local chain. If you get any errors, please [contribute here](https://github.com/cosmos/sdk-tutorials).

### Start the dashboard

Start the dashboard with:

    npm run start

In another terminal window, you can also start a "breakout pane" that shows a specific aspect of the transaction, like the Messages.

To list the available breakout panes, run:

    npm run pane

To start the breakout pane for Messages run:

    npm run pane msg

This will connect to the dashboard using [websockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket).
