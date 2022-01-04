import * as core from '@actions/core'
import { Toolkit } from 'actions-toolkit'
import nunjucks from 'nunjucks'
// @ts-ignore
import dateFilter from 'nunjucks-date-filter'
import toposort from 'toposort'

function logError(tools: Toolkit, action: 'creating' | 'updating', err: any) {
    // Log the error message
    const errorMessage = `An error occurred while ${action} the issue. This might be caused by a malformed issue title, or a typo in the labels or assignees!`
    tools.log.error(errorMessage)
    tools.log.error(err)

    // The error might have more details
    if (err.errors) tools.log.error(err.errors)

    // Exit with a failing status
    core.setFailed(errorMessage + '\n\n' + err.message)
    return tools.exit.failure()
}

export async function loopIssues (tools: Toolkit) {
    const file = tools.inputs.json
    if (!file) {
	tools.exit.failure(`No json file of issues provided`)
    }
    const json = await tools.readFile(file) as string
    const parsed = JSON.parse(json)
    const issues = parsed.issues
    const milestones=parsed.milestones
    // create milestones, and index them
    const milestone2i: {[index: string]:number} = {}
    for (const j of milestones) {
        const i = await tools.github.issues.createMilestone({
            ...tools.context.repo,
	    title: j.title,
            description: j.description
        })
	milestone2i[j.title.toString()] = i.data.number
    }

    let ind=0
    const issue2i: {[index: string]:number} = {}
    for (const iss of issues) {
	issue2i[iss.title.toString()] = ind
	ind += 1
    }

    // Topological sort so we don't create any issues before its dependencies
    type X1 = string[][]  
    let depArray:X1=[]
    for (const iss of issues) {
	if (iss.hasOwnProperty("deps")) {
	    for (const dep of iss.deps) {
		depArray.push([iss.title, dep])
	    }
	}
    }
    const topoOrder:string[] = toposort(depArray)
    const issueNumbers: {[index: string]:number} = {}
    
    for (const issueName of topoOrder) {
	let iss=issues[issue2i[issueName.toString()]]
	iss.depi = []
	if (iss.hasOwnProperty("deps")) {
	    for (const dep of iss.deps) {
		iss.depi.push(issueNumbers[dep])
	    }
	}
	if (iss.hasOwnProperty("milestone")) {
	    iss.milestone=milestone2i[iss.milestone.toString()]
	}
	issueNumbers[issueName.toString()] = await createAnIssue(tools, iss)
    }
}


export async function createAnIssue (tools: Toolkit, attributes: any) {

    const env = nunjucks.configure({ autoescape: false })
    env.addFilter('date', dateFilter)

    const templateVariables = {
	...tools.context,
	repo: tools.context.repo,
	env: process.env,
	date: Date.now()
    }
    
    const templated = {
	body: env.renderString(attributes.body, templateVariables),
	title: env.renderString(attributes.title, templateVariables)
    }
    if (attributes.depi.length!=0) {
	templated.body = "Blocked by #" + attributes.depi.join(", #") + "\n\n" + templated.body
    }

    // Create the new issue
    tools.log.info(`Creating new issue ${templated.title}`)
    try {
	const issue = await tools.github.issues.create({
	    ...tools.context.repo,
	    ...templated,
	    assignees: attributes.assignees,
	    labels: attributes.labels,
	    milestone: attributes.milestone || undefined
	})

	tools.log.success(`Created issue ${issue.data.title}#${issue.data.number}: ${issue.data.html_url}`)
	return issue.data.number
    } catch (err: any) {
	return logError(tools,  'creating', err)
    }
}
