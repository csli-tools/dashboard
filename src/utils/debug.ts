const isJSON= (stuff) => {
  let whoops = false
  try {
    JSON.parse(stuff)
  } catch (_) {
    whoops = true
  }
  return !whoops
}

export const d = (message, stuff, changeStateFn) => {
  if (isJSON(stuff)) {
    return changeStateFn(debugEntries => [`${message} ${JSON.stringify(stuff)}`, ...debugEntries])
  } else {
    return changeStateFn(debugEntries => [`${message} ${stuff}`, ...debugEntries])
  }
}
