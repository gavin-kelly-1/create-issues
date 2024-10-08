const core = require('@actions/core');
const nunjucks = require('nunjucks');
const dateFilter = require('nunjucks-date-filter');
const toposort = require('toposort');


function logError(tools, action, err) {
    // Log the error message
    const errorMessage = `An error occurred while ${action} the issue. This might be caused by a malformed issue title, or a typo in the labels or assignees!`;
    tools.log.error(errorMessage);
    tools.log.error(err);
    
    // The error might have more details
    if (err.errors) tools.log.error(err.errors);
    
    // Exit with a failing status
    core.setFailed(errorMessage + '\n\n' + err.message);
    return tools.exit.failure();
}

async function loopIssues (tools) {
    const file = tools.inputs.json;
    if (!file) {
	tools.exit.failure(`No json file of issues provided`);
    }
    await tools.github.issues.createLabel({
        ...tools.context.repo,
	name: "Blocked",
	color: "000000",
	description: "This topic has unresolved dependencies."
    }).catch(_ => true);
    await tools.github.issues.createLabel({
        ...tools.context.repo,
	name: "BABS Work Package",
	color: "94CEF2",
	description: "An agreed package of work."
    }).catch(_ => true);
    await tools.github.issues.createLabel({
        ...tools.context.repo,
	name: "BABS Task",
	color: "76b82a",
	description: "Task that lives outside a work package."
    }).catch(_ => true);

    const json = await tools.readFile(file);
    const parsed = JSON.parse(json);
    const issues = parsed.issues;
    const milestones=parsed.milestones;
    // create milestones, and index them
    const milestone2i = {};
    tools.github.paginate(tools.github.issues.listMilestones,
			  {...tools.context.repo})
	.then(async function(pre_m) {
	    for (const j of milestones) {
		let already_milestone=pre_m.filter(m => m.title == j.title);
		var i;
		if (already_milestone.length != 0) {
		    i=already_milestone[0];
		} else {
		    i = await tools.github.issues.createMilestone({
			...tools.context.repo,
			title: j.title,
			description: j.description
		    });
		}
		milestone2i[j.title.toString()] = i.number;
	    }
	});
    let ind=0;
    const issue2i = {};
    for (const iss of issues) {
	issue2i[iss.title.toString()] = ind;
	ind += 1;
    }

    // Topological sort so we don't create any issues before its dependencies
    let depArray=[];
    for (const iss of issues) {
	if (iss.hasOwnProperty("deps")) {
	    for (const dep of iss.deps) {
		depArray.push([dep, iss.title]);
	    }
	}
    }
    const topoOrder = toposort(depArray);
    const issueNumbers = {};
    
    for (const issueName of topoOrder) {
	let iss=issues[issue2i[issueName.toString()]];
	iss.depi = [];
	if (iss.hasOwnProperty("deps")) {
	    for (const dep of iss.deps) {
		//preqrequisites will have already been created, so should be safe
		iss.depi.push(issueNumbers[dep]);
	    }
	}
	if (iss.hasOwnProperty("milestone")) {
	    iss.milestone=milestone2i[iss.milestone.toString()];
	}
	issueNumbers[issueName.toString()] = await createAnIssue(tools, iss);
    }
}


async function createAnIssue (tools, attributes) {

    const env = nunjucks.configure({ autoescape: false });
    env.addFilter('date', dateFilter);

    const templateVariables = {
	...tools.context,
	repo: tools.context.repo,
	env: process.env,
	date: Date.now()
    };
    if (typeof attributes.body == "object") {
	var body=await Promise.all(
	    attributes.body.map(async function(bod) {
		if (Object.hasOwn(bod, "markdown")) {
		    return tools.readFile(bod.markdown).catch(_ => "");
		} else if (Object.hasOwn(bod, "template")) {
		    return tools.readFile(bod.template).catch(_ => "");
		} else {
		    return bod;
		}
	    }));
    } else {
	var body=[attributes.body];
    }
    const templated = {
	body: body.map(b => env.renderString(b, templateVariables)).join('\n\n'),
	title: env.renderString(attributes.title, templateVariables)
    };
    if (attributes.depi.length!=0) {
	templated.body = "Prerequisites: #" + attributes.depi.join(", #") + "\n\n" + templated.body;
	attributes.labels.push("blocked");
    }

    // Create the new issue
    tools.log.info(`Creating new issue ${templated.title}`);
    try {
	const issue = await tools.github.issues.create({
	    ...tools.context.repo,
	    ...templated,
	    assignees: attributes.assignees,
	    labels: attributes.labels,
	    milestone: attributes.milestone || undefined
	});

	tools.log.success(`Created issue ${issue.data.title}#${issue.data.number}: ${issue.data.html_url}`);
	return issue.data.number;
    } catch (err) {
	return logError(tools,  'creating', err);
    }
}

module.exports = {
    loopIssues
}
