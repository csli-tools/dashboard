import * as dotenv from 'dotenv'
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { blue, yellow, red } from "chalk";
import { WebSocketServer } from 'ws';

// Load the environment variables in .env
dotenv.config()
const rpcEndpoint = `${process.env.RPC_PROTOCOL ?? 'http'}://${process.env.RPC_URL ?? '127.0.0.1'}:${process.env.RPC_PORT ?? 26657}`

const helpFileTicketPlz = (u) => {
  console.error(red(`Issue connecting to RPC at ${yellow(rpcEndpoint)}\nWanna file a ticket, ol' buddy ol' pal?`))
  console.log('https://github.com/csli-tools/dashboard/issues/new')
}

export const attemptConnect = async () => {
  let wss
  try {
    wss = new WebSocketServer({
      port: 63736 // dtool s2h csli
    });

    wss.on('connection', function connection(ws) {
      ws.on('message', function message(data) {
        console.log('received: %s', data);
      });

      // ws.send('something');
    });
    console.log('Accepting all websocket connections that give me some aloha.')
  } catch (e) {
    console.error('Issue creating the websocket server', e)
  }

  let client
  try {
    console.log('aloha2')
    client = await CosmWasmClient.connect(rpcEndpoint)
    console.log('aloha3')
  } catch (e) {
    const u = JSON.parse(JSON.stringify(e)); // a useful error object
    if (u && u.code) {
      switch (e.code) {
        case 'ECONNREFUSED':
          console.log(red(`Couldn't connect. Is your ${yellow('wasmd')} (or preferred daemon) running?\nWe're trying to connect to ${yellow(rpcEndpoint)}\nPlease update environment variables in the ${yellow('.env')} file. (You may need to copy ${yellow('.env.template')} » ${yellow('.env')} if it doesn't exist.)`))
          break;
        case 'ERR_SOCKET_BAD_PORT':
          console.log(red(`Couldn't connect and it seems your port is the problem. The typical RPC port is ${yellow('26657')}\nWe're trying to connect to ${yellow(rpcEndpoint)}\nPlease update environment variables in the ${yellow('.env')} file. (You may need to copy ${yellow('.env.template')} » ${yellow('.env')} if it doesn't exist.)`))
          break;
        case 'EPROTO':
          console.log(red(`Couldn't connect and it seems your protocol is the problem. Check the ${yellow('RPC_PROTOCOL')} environment variable.\nWe're trying to connect to ${yellow(rpcEndpoint)}\nPlease update it in the ${yellow('.env')} file. (You may need to copy ${yellow('.env.template')} » ${yellow('.env')} if it doesn't exist.)`))
          if (process.env.RPC_PROTOCOL === 'https') {
            console.log(yellow(`Consider changing to ${blue('http')}`))
          }
          break;
        default:
          helpFileTicketPlz(u)
          break;
      }
    } else {
      helpFileTicketPlz(u)
    }
    return null
  }
  console.log('aloha0')
  return { 'wss': wss ?? null, 'client': client ?? null}
  // if (wss && client) {
  // } else {
  //   console.log('aloha uh oh')
  //   return { 'wss': null, 'client': null }
  // }
}
