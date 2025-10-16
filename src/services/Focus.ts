import cuid from 'cuid'

interface Focusable {
  focus(): void
}

interface FocusableElement {
  id: string
  element: Focusable
  tabIndex: number
}
export default class Focus {
  private static instance: Focus
  private constructor() {
    this.list = []
    this.focusedId = undefined
  }
  
  list: FocusableElement[]
  focusedId?: string

  static sharedInstance() {
    if (!Focus.instance) {
      Focus.instance = new Focus()
    }
    return Focus.instance
  }

  register(element: Focusable, tabIndex: number): string {
    const id = cuid()
    this.list.push({element, tabIndex, id})
    this.list.sort((a, b) => a.tabIndex > b.tabIndex ? 1 : -1)
    return id
  }
  
  unregister(id: string) {
    this.list = this.list.filter(item => item.id !== id)
  }

  focusNext() {
    if (this.list.length === 0) {
      return
    }
    if (this.focusedId === undefined) {
      this.focusedId = this.list[0].id
      this.list[0].element.focus()
    } else {
      let index = this.list.findIndex((item) => item.id === this.focusedId)
      if (index + 1 >= this.list.length) {
        this.focusedId = this.list[0].id
        this.list[0].element.focus()
      } else {
        this.focusedId = this.list[index + 1].id
        this.list[index + 1].element.focus()
      }
    } 
  }
  
  focusPrevious() {
    if (this.list.length === 0) {
      return
    }
    if (this.focusedId === undefined) {
      this.focusedId = this.list[this.list.length - 1].id
      this.list[this.list.length - 1].element.focus()
    } else {
      let index = this.list.findIndex((item) => item.id === this.focusedId)
      if (index - 1 < 0) {
        this.focusedId = this.list[this.list.length - 1].id
        this.list[this.list.length - 1].element.focus()
      } else {
        this.focusedId = this.list[index - 1].id
        this.list[index - 1].element.focus()
      }
    } 
  }
}
