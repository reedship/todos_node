const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { ExtensionMap } = require('./extensions.js');
const { Octokit, App } = require("octokit");
const CommentRegex = /^[ |\t]*\/\/.*(?:todo|fixme|note|fix me)/i
const ENV_DIRECTORY = process.env.TODOS_DIRECTORY || undefined;
const ENV_OUTPUT = process.env.TODOS_OUTPUT || undefined;
const GITHUB_URL = process.env.TODOS_GITHUB || undefined; // should have format of 'OWNER/REPO'
const GITHUB_ACCESS_TOKEN = process.env.TODOS_TOKEN || undefined;

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
	"$ GITHUB_URL=todos --dir=<directory> --output=<output>"
    ].join("\n");
    console.log(help);
    return 1;
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
	    const title = `TODO:${fileName}:${lineNumber}`;
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
		console.log('Error when writing csv. File may not have been saved');
		console.log(err);
	    } else {
		console.log('Output has been saved to todos.csv');
	    }
	});
    } else {
	// assume STDOUT
    }
}

async function getIssues() {
    const {owner, repo} = GITHUB_URL.split('/');
    const issues = await octokit.request(`GET /repos/${GITHUB_URL}/issues`, {
	owner: owner,
	repo: repo,
	headers: {
	    'X-GitHub-Api_Version': '2022-11-28'
	}
    });
    let openIssues = issues.data.map(x => x.state === 'open');
    return openIssues;
}

function filterIssues(todos, issues) {
    if (!issues.data) return {todos, issuesToBeRemoved: []};
    const patt = new RegExp("/(?:todo|fixme|note|fix me)\:.*\:\d*/gi");
    const todosIssues = issues.data.select((issue) => patt.test(issue.title));
    const issuesToBeRemoved = [];
    todosIssues.forEach((issue,index)=> {
	if (!todos.values().contains(issue.title)) {
	    todos.splice(index,1); //remove this item from our todos
	    issuesToBeRemoved.push(issue); // add to list of items to be
	}
    });
    console.log(`Found ${issuesToBeremoved.length} issues that can be closed on github`);
    return [todos, issuesToBeRemoved];
}

async function deleteGithubIssues(issuesToBeRemoved) {
    if (!issuesToBeRemoved) return;
    // IMPLEMENT THIS
    issuesToBeRemoved.forEach((issue) => {
	console.log(`Deleting ${issue.title}`);
    });
}

async function handleIssues(todos) {
    // check if we have the envr variables set
    if (GITHUB_URL == undefined || GITHUB_ACCESS_TOKEN == undefined) {
	console.log("Github action not configured. Exiting");
	return;
    }
    const issues = await getIssues();
    const result = filterIssues(todos, issues);
    await deleteGithubIssues(result.issuesToBeRemoved);
    await uploadNewGithubIssues(result.todos);
}

async function uploadNewGithubIssues(todos) {
    if (!todos || !GITHUB_URL) return;
    console.log({GITHUB_URL});
    const [owner, repo] = GITHUB_URL.split('/');
    console.log(owner,repo);
    for (let i=0;i<todos.length;i++){
	let result = await octokit.request(`POST /repos/${owner}/${repo}/issues`, {
	    owner: owner,
	    repo: repo,
	    title: todos[i].title,
	    body: todos[i].content,
	    headers: {'X-GitHub-Api-Version': '2022-11-28'}
	});
	if (result) {
	    console.log({result});
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
