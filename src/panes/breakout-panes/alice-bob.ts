// @flow
import { WebSocket } from 'ws';
import WSCSLIPayload from '../../utils/websockets'
import * as util from 'util'
import * as shell from 'shelljs'


const connectWebsockets = () => {
    const ws = new WebSocket('ws://localhost:63736');

    ws.on('message', function message(data) {
        // const jsonData: WSCSLIPayload = JSON.parse(data.toString())
        process.stdout.write('\u001b[3J\u001b[1J');
        console.clear()
        let agentAddress = shell.exec(`junod keys show alice -a`, {
            silent: true
        })
        console.log(`Alice: ${agentAddress.toString().replace('\n', '')}`)
        let agentInfo = shell.exec(`junod q bank balances $(junod keys show alice -a) --node http://localhost:26657 --output json`, {
            silent: true
        })
        let moarJson = JSON.parse(agentInfo.toString())
        console.log(util.inspect(moarJson, false, null, true))
        agentAddress = shell.exec(`junod keys show bob -a`, {
            silent: true
        })
        console.log(`Bob: ${agentAddress.toString().replace('\n', '')}`)
        agentInfo = shell.exec(`junod q bank balances $(junod keys show bob -a) --node http://localhost:26657 --output json`, {
            silent: true
        })
        moarJson = JSON.parse(agentInfo.toString())
        console.log(util.inspect(moarJson, false, null, true))
    });
}
connectWebsockets()
