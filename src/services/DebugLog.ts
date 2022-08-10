import EventEmitter from 'events'
import * as fs from 'fs'
import { getJSON } from '../utils/json'

export const d = (message: any, stuff: any | null = null, pleaseWriteToLogs = false) => {
  DebugLog.sharedInstance().log(message, stuff, pleaseWriteToLogs)
}

export default class DebugLog {
  private static instance: DebugLog
  emitter: EventEmitter
  debugEntries: string[]

  private constructor() {
    this.emitter = new EventEmitter()
    this.debugEntries = []
  }

  static sharedInstance() {
    if (!DebugLog.instance) {
      DebugLog.instance = new DebugLog()
    }
    return DebugLog.instance
  }

  log(message: any, stuff: any | null = null, pleaseWriteToLogs = false) {
    let messageContent
    if (stuff && !!getJSON(stuff)) {
      messageContent = JSON.stringify(stuff)
    } else {
      messageContent = stuff
    }
    this.debugEntries = ([...this.debugEntries, `${message} ${messageContent}`])
    this.emitter.emit('log', `${message} ${messageContent}`, this.debugEntries)

    // Write to logs if they want
    if (pleaseWriteToLogs) {
      // Thank you for saying please
      // TODO: put this in a home directory
      fs.appendFile('csli-log.txt', `${messageContent}\n`, 'utf8', () => { });
    }
  }
}
