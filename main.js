const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { ExtensionMap } = require('./extensions.js');
const { Octokit, App } = require("octokit");
const CommentRegex = /[ |\t]*\/\/.*[todo|fixme|note|fix me]\:.*/gi
const ENV_DIRECTORY = process.env.TODOS_DIRECTORY || undefined;
const ENV_OUTPUT = process.env.TODOS_OUTPUT || undefined;
const GITHUB_URL = process.env.TODOS_GITHUB || undefined; // should have format of 'OWNER/REPO'
const GITHUB_ACCESS_TOKEN = process.env.TODOS_TOKEN || undefined;
const [owner, repo] = GITHUB_URL.split('/');

const octokit = new Octokit({auth: GITHUB_ACCESS_TOKEN});


function printHelp() {
    const help = [
	"Todos \nv.0.0.1",
	"",
	"This cli scans a directory of your choosing and lets you print an output",
	"",
	"There are two environment variables you must set up in order to connect this cli to your github repo.",
	"",
	"Environment Variables:",
	"GITHUB_URL: the location of your github repo,with 'https://github.com/' removed",
	"    example: johnsmith/test_repo",
	"GITHUB_ACCESS_TOKEN: the access token you have created for your github account",
	"    get value from https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens",
	"",
	"Command Line Variables:",
	"dir: the directory you'd like to scan. Defaults to the current directory.",
	"output: output format. Defaults to STDOUT. Options are CSV or STDOUT. If CSV is selected, the output will be written to `output.csv` in the current working directory",
	"",
	"Usage:",
	"$ TODOS_GITHUB=johnsmith/test_repo TODOS_TOKEN=abcdefghijklmnopqrstuvwxyz node main.js --dir=<directory> --output=<output>"
    ].join("\n");
    console.log(help);
n    return 1;
}

function getArgs() {
    const argsList = process.argv
    if (argsList.includes("help")) printHelp();
    const parsedArgs = {
	dir: path.resolve(__dirname),
	output: 'STDOUT'
    };

    if (ENV_DIRECTORY != undefined) {
	parsedArgs['dir'] = ENV_DIRECTORY;
    } else if (process.argv[2]) {
	parsedArgs['dir'] = process.argv[2].includes('--dir') ?
	    process.argv[2].split('=')[1] :
	    process.argv[2];
    }

    if (ENV_OUTPUT != undefined) {
	parsedArgs['output'] = ENV_OUTPUT;
    } else if (process.argv[3]) {
	parsedArgs['output'] = process.argv[3].includes('--output') ?
	    process.argv[3].split('=')[1] :
	    process.argv[3];
    }
    return parsedArgs;
}

async function searchFile(file) {
    const lines = [];
    const filestream = fs.createReadStream(file);
    const rl = readline.createInterface({
	input: filestream,
	crlfDelay: Infinity
    });
    let lineNumber = 0;
    for await (const line of rl) {
	lineNumber++;
	if (line.match(CommentRegex)) {
	    const fileName = file.split('/').pop();
	    const fileType = ExtensionMap[fileName.split('.').pop()];
	    const title = `TODO:${fileName}:${line.slice(0,20)}`;
	    console.log(`Found todo with title: ${title}`);
	    lines.push({
		title,
		filePath: file,
		fileName,
		fileType,
		lineNumber,
		line: line.trim()
	    });
	}
    }
    return lines;
}

async function getFiles(directory) {
    if (directory.includes("node_modules")) return [];
    let unreadFiles = [];
    const items = fs.readdirSync(directory, { withFileTypes: true });
    for (let i=0; i < items.length; ++i){
	const filename = items[i].name;
	if (filename[0] === '.') continue;
	const itemPath = path.join(directory, filename)
	if (items[i].isDirectory()){
	    console.log(`Now scanning directory: ${directory}/${items[i].name}`);
	    const newFiles = await getFiles(itemPath)
	    if (newFiles.length != 0) {
		unreadFiles = unreadFiles.concat(newFiles);
	    }
	} else {
	    unreadFiles.push(`${directory}/${filename}`);
	}
    }
    return unreadFiles;
}

function writeOutput(args, todos) {
    // we should sort these todos alphabetically by filename first and then by linenumber
    todos = todos.sort((a,b) => a.fileName < b.fileName || a.lineNumber < b.lineNumber)
    if (args.output.toLowerCase().includes('csv')) {
	// write to generated output.csv file
	console.log(`Writing ${todos.length} todos to csv...`);
	const csvString = [
	    [
		'Title',
		'File Path',
		'File Name',
		'File Type',
		'Line Number',
		'Content'
	    ],
	    ...todos.map(todo=>[
		todo.title,
		todo.filePath,
		todo.fileName,
		todo.fileType,
		todo.lineNumber,
		todo.content
	    ].map(str => `"${str.toString().replace(/"/g, '\"')}"`))
	]
	      .map(e=>e.join(','))
	      .join('\n');
	fs.writeFile('todos.csv',csvString, 'utf8', function (err) {
	    if (err) {
		console.log(`Error when writing csv. File may not have been saved
${err}`);
	    } else {
		console.log('Output has been saved to todos.csv');
	    }
	});
    } else {
	// assume STDOUT
    }
}

async function getIssues() {
    const issues = await octokit.request(`GET /repos/${owner}/${repo}/issues`, {
	owner: owner,
	repo: repo,
	headers: {
	    'X-GitHub-Api_Version': '2022-11-28'
	}
    });

    let openIssues = issues.data.filter(x => x.state == 'open' && x.title.match(/(?:todo|fixme|note|fix me)\:.*\:.*/gi));
    return openIssues;
}

function removeDuplicates(arr) {
    let unique = [];
    arr.forEach(element => {
        if (!unique.includes(element)) {
            unique.push(element);
        }
    });
    return unique;
}

function filterIssues(todos, issues) {
    if (issues.length == 0) {
	console.log("No issues matching title pattern on github");
	return [todos, []];
    }
    console.log(`Checking the status for ${todos.length} todos in the directory`);
    const todoTitles = todos.map((x)=>x.title);
    const issueTitles = issues.map((x)=>x.title);
    const newTodos = todos.filter((todo) => !issueTitles.includes(todo.title));
    const issuesToBeRemoved = issues.filter((issue) => !todoTitles.includes(issue.title));
    console.log(`Found ${issuesToBeRemoved.length} issues that can be closed on github`);
    return [newTodos, issuesToBeRemoved];
}

async function deleteGithubIssues(issuesToBeRemoved) {
    if (!issuesToBeRemoved) {
	console.log("No issues to be closed");
	return;
    }
    for (let i=0; i< issuesToBeRemoved.length; i++) {
	let result = await octokit.request(`PATCH /repos/${owner}/${repo}/issues/${issuesToBeRemoved[i]}`, {
	    state: 'closed',
	    headers: {'X-GitHub-Api-Version': '2022-11-28'}
	});
    }
}

async function handleIssues(todos) {
    // check if we have the envr variables set
    if (GITHUB_URL == undefined || GITHUB_ACCESS_TOKEN == undefined) {
	console.log("Github action not configured. Exiting");
	return;
    }
    const issues = await getIssues();
    const result = filterIssues(todos, issues);
    if (result[1].length != 0) {
	await deleteGithubIssues(result[1]);
    } else {
	console.log("No issues to delete on github");
    }
    if (result[0].length != 0) {
	_ = await uploadNewGithubIssues(result[0]);
    } else {
	console.log("No new TODO comments in project");
    }
}

async function uploadNewGithubIssues(todos) {
    if (!todos || !GITHUB_URL) return;
    for (let i=0;i<todos.length;i++){
	console.log("attempting to upload issue to github");
	let result = await octokit.request(`POST /repos/${owner}/${repo}/issues`, {
	    owner: owner,
	    repo: repo,
	    title: todos[i].title,
	    body: todos[i].content,
	    headers: {'X-GitHub-Api-Version': '2022-11-28'}
	});
	if (result) {
	    console.log(`Uploaded issue in ${todos[i].fileName} to github`);
	}
    }
}

// the below comment is for testing purposes.
// TODO: Finish this function
async function main() {
    if (process.argv.length === 3 && process.argv[2].includes('help')){
	printHelp();
	return;
    }
    const args = getArgs();
    console.log(`Now scanning directory: ${args.dir}`);
    const items = fs.readdirSync(args.dir);
    let unreadFiles = await getFiles(args.dir)
    let todos = []
    for (let i=0;i<unreadFiles.length;++i) {
	const result = await searchFile(unreadFiles[i]);
	todos.push(result);
    }
    todos = todos.flat();
    writeOutput(args,todos);
    handleIssues(todos);
}

console.log("Scraping todos..");
main();
console.log("Finished scraping todos");
