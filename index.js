const { Toolkit } = require('actions-toolkit');
const { loopIssues } = require('./action');

Toolkit.run(loopIssues, {
  secrets: ['GITHUB_TOKEN']
});
