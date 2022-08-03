// @flow
import { WebSocket } from 'ws';
import WSCSLIPayload from '../../utils/websockets'
import * as util from 'util'

const connectWebsockets = () => {
  const ws = new WebSocket('ws://localhost:63736');

  ws.on('message', function message(data) {
    const jsonData: WSCSLIPayload = JSON.parse(data.toString())
    if (jsonData.type === 'tx') {
      console.clear()
      if (jsonData.identifier !== 'nada') {
        console.log(util.inspect(jsonData.data.body.messages, false, null, true))
      }
    }
  });
}
connectWebsockets()
