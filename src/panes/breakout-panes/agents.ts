// @flow
import { WebSocket } from 'ws';
import WSCSLIPayload from '../../utils/websockets'
import * as util from 'util'
import * as shell from 'shelljs'


const connectWebsockets = () => {
    const ws = new WebSocket('ws://localhost:63736');

    ws.on('message', function message(data) {
        const jsonData: WSCSLIPayload = JSON.parse(data.toString())
        process.stdout.write('\u001b[3J\u001b[1J');
        console.clear()
        console.log(`Agent(s)\n------`)
        const agentInfo = shell.exec(`junod q wasm contract-state smart juno14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9skjuwg8  '{"get_agent_ids":{}}' --node http://localhost:26657 --output json`, {
            silent: true
        })
        const moarJson = JSON.parse(agentInfo.toString()).data
        console.log(util.inspect(moarJson, false, null, true))

        // Show balances for active agent(s)
        for (const agent of moarJson.active) {
            console.log('Agent:', agent)
            const agentBalances = shell.exec(`junod q bank balances ${agent} --node http://localhost:26657 --output json`, {
                silent: true
            })
            console.log(JSON.parse(agentBalances.toString()))
        }
    });
}
connectWebsockets()
