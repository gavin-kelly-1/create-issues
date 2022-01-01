import { Toolkit } from 'actions-toolkit'
import { createAnIssue } from './action'

Toolkit.run(loopIssues, {
  secrets: ['GITHUB_TOKEN']
})
