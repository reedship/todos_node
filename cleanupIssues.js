const { Octokit, App } = require("octokit");
const GITHUB_URL = process.env.TODOS_GITHUB || undefined;
const GITHUB_ACCESS_TOKEN = process.env.TODOS_TOKEN || undefined;
const octokit = new Octokit({auth: GITHUB_ACCESS_TOKEN});

const [owner, repo] = GITHUB_URL.split('/');
async function main() {
    const issues = await octokit.request(`GET /repos/${GITHUB_URL}/issues`, {
	owner: owner,
	repo: repo,
	headers: {
	    'X-GitHub-Api_Version': '2022-11-28'
	}
    });
    let openIssues = issues.data;
    if (!openIssues) {
	console.log("NO ISSUES OPEN")
	return;
    }
    for (let i=0; i< openIssues.length; i++) {
	let result = await octokit.request(`PATCH /repos/${owner}/${repo}/issues/${openIssues[i].number}`, {
	    state: 'closed',
	    headers: {'X-GitHub-Api-Version': '2022-11-28'}
	});
    }
}

main();
console.log("Marked all issues as closed");
