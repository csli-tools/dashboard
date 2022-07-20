import * as dotenv from 'dotenv'
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { blue, yellow, red } from "chalk";
// Load the environment variables in .env
dotenv.config()
const rpcEndpoint = `${process.env.RPC_PROTOCOL ?? 'http'}://${process.env.RPC_URL ?? '127.0.0.1'}:${process.env.RPC_PORT ?? 26657}`

const helpFileTicketPlz = (u) => {
  console.error(red(`Issue connecting to RPC at ${yellow(rpcEndpoint)}\nWanna file a ticket, ol' buddy ol' pal?`))
  console.log('https://github.com/csli-tools/dashboard/issues/new')
}

export const attemptConnect = async () => {
  try {
    return await CosmWasmClient.connect(rpcEndpoint)
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
}
