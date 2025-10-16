import chalk from "chalk";
import { WebSocketServer } from 'ws';
import { setNEARConfig, getNetworkStatus, BlockPoller, getNEARConfig } from '../services/near-rpc';
import { cfg } from '../shared/config';

const helpFileTicketPlz = (u: any) => {
  const config = getNEARConfig();
  console.error(chalk.red(`Issue connecting to NEAR RPC at ${chalk.yellow(config.nodeUrl)}\nWanna file a ticket, ol' buddy ol' pal?`))
  console.log('https://github.com/csli-tools/dashboard/issues/new')
}

export const attemptConnect = async () => {
  let wss
  try {
    wss = new WebSocketServer({
      port: cfg().WS_PORT
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

  let nearConnection: { status: any; poller: BlockPoller } | undefined = undefined
  try {
    console.log('aloha2')

    // Configure NEAR network
    const network = cfg().NEAR_NETWORK;
    setNEARConfig(network);
    const config = getNEARConfig();
    console.log(`Connecting to NEAR ${network} at ${config.nodeUrl}`)

    // Test connection by getting network status
    const statusResponse = await getNetworkStatus();
    console.log('aloha3')
    console.log(`Connected to NEAR network: ${statusResponse.result.chain_id}`)

    // Create block poller for real-time updates
    const poller = new BlockPoller();

    nearConnection = { status: statusResponse.result, poller };
  } catch (e: any) {
    const errorMessage = e.message || JSON.stringify(e);

    if (errorMessage.includes('ECONNREFUSED')) {
      console.log(chalk.red(`Couldn't connect to NEAR RPC. Is the network accessible?\nWe're trying to connect to ${chalk.yellow(getNEARConfig().nodeUrl)}\nPlease update the ${chalk.yellow('NEAR_NETWORK')} environment variable in the ${chalk.yellow('.env')} file to 'mainnet', 'testnet', or 'localnet'`))
    } else if (errorMessage.includes('ENOTFOUND')) {
      console.log(chalk.red(`Couldn't resolve NEAR RPC host. Please check your internet connection.\nWe're trying to connect to ${chalk.yellow(getNEARConfig().nodeUrl)}`))
    } else if (errorMessage.includes('ETIMEDOUT')) {
      console.log(chalk.red(`Connection to NEAR RPC timed out. The network may be slow or unavailable.\nWe're trying to connect to ${chalk.yellow(getNEARConfig().nodeUrl)}`))
    } else {
      console.error(chalk.red('Error connecting to NEAR:'), errorMessage)
      helpFileTicketPlz(e)
    }
  }
  console.log('aloha0')
  return {
    wss: wss ?? null,
    nearConnection: nearConnection ?? null,
    // Keep client for backward compatibility, will be removed later
    client: nearConnection ?? null
  }
}
