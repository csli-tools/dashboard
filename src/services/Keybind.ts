import EventEmitter from 'events'
import blessed from 'blessed'

export default class Keybind {
  private static instance: Keybind
  private constructor() {
    this.emitter = new EventEmitter()
  }
  
  emitter: EventEmitter

  static sharedInstance() {
    if (!Keybind.instance) {
      Keybind.instance = new Keybind()
    }
    return Keybind.instance
  }

  keyPressed(key: blessed.Widgets.Events.IKeyEventArg) {
    this.emitter.emit('key', key)
  }

}
