// Before starting the dashboard, excuse me, BATTLE STATION
//   ensure we can connect to the RPC
import { attemptConnect } from './utils/connect'
import blessed from 'blessed'
import { render } from 'react-blessed'
import { Dashboard} from "./battle-station";
import React from 'react'

attemptConnect().then(({ wss, client }) => {
  if (client) {
    const screen = blessed.screen({
      autoPadding: true,
      smartCSR: true,
      title: 'wasmd dashboard'
    });

    screen.key(['escape', 'q', 'C-c'], function () {
      return process.exit(0);
    });

    render(<Dashboard
      screen={screen}
      client={client}
      wss={wss}
    />, screen);
  } else {
    console.log('Exiting so you can address the error, friend.')
    // "Learn NodeJS," they said. Go to hell.
    setTimeout(function() { process.exit(0); }, 666);
  }
})
