import { Toolkit } from 'actions-toolkit'
import { loopIssues } from './action'

Toolkit.run(loopIssues, {
  secrets: ['GITHUB_TOKEN']
})
