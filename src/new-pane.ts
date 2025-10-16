require('@babel/register')({
  presets: [['@babel/preset-env'], ['@babel/preset-react']]
});
// args: means when you run "npm run pane aloha honua"
// "aloha" is the zeroth index, "honua" is the first index
const supportedPanes: {[key: string]: string} = {
   'msg': 'Shows the Messages for the selected transaction',
   'agents': 'Shows agent information',
   'tasks': 'Shows tasks',
   'alice-bob': 'Shows details on Alice and Bob',
};
const supportedPanesList = Object.keys(supportedPanes).map(paneName => `⚛️  ${paneName} — ${supportedPanes[paneName]}`).join('\n')
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Listing valid panes…\nPlease add one of these after your command:\n', supportedPanesList)
  process.exit(0);
}

// They provided at least one argument
const paneName = args[0];
if (Object.keys(supportedPanes).indexOf(paneName) === -1) {
  console.warn(
    'Try harder. You can use:',
    supportedPanesList
  );
  process.exit(0);
}

// The files in that directory will be the [command name].ts, basically
require('./panes/breakout-panes/' + paneName);
