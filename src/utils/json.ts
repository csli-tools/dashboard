export const getJSON = (stuff: any): any | undefined => {
  try {
    return JSON.parse(stuff)
  } catch (_) {
    return undefined
  }
}
