const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { ExtensionMap } = require('./extensions.js');

const CommentRegex = /^[ |\t]*\/\/.*(?:todo|fixme|note|fix me)/i
const ENV_DIRECTORY = process.env.TODOS_DIRECTORY || undefined;
const ENV_OUTPUT = process.env.TODOS_OUTPUT || undefined;
const GITHUB_URL = process.env.TODOS_GITHUB || undefined; // should have format of 'OWNER/REPO'
const GITHUB_ACCESS_TOKEN = process.env.TODOS_TOKEN || undefined;

function printHelp() {
    const help = [
	"Todos \nv.0.0.1",
	"This cli scans a directory of your choosing and lets you print an output",
	"Variables:",
	"dir: the directory you'd like to scan. Defaults to the current directory.",
	"output: output format. Defaults to STDOUT. Options are CSV or STDOUT. If CSV is selected, the output will be written to `output.csv` in the current working directory",
	"Usage:",
	"$ todos --dir=<directory> --output=<output>"
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
	    lines.push({
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
    if (args.output.toLowerCase() === 'csv') {
	// write to generated output.csv file
	console.log(`Writing ${todos.length} todos to csv...`);
	// include "completed" checkbox column
	todos.map(todo => todo.completed = false);
	const csvString = [
	    [
		'File Path',
		'File Name',
		'File Type',
		'Line Number',
		'Line',
		'Completed'
	    ],
	    ...todos.map(todo=>[
		todo.filePath,
		todo.fileName,
		todo.fileType,
		todo.lineNumber,
		todo.line,
		todo.completed
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
	console.log(todos);
    }
}

async function getIssues() {
    const octokit = new OctoKit({auth: GITHUB_ACCESS_TOKEN});
    const issues = await octokit.request(`GET /repos/${GITHUB_URL}/issues`, {
	owner: GITHUB_URL.split('/')[0],
	repo: GITHUB_URL.split('/')[1],
	headers: {
	    'X-GitHub-Api_Version': '2022-11-28'
	}
    });
    console.log({issues});
    return issues;
}

function filterIssues(todos, issues) {
    // we need to create a specific format for the naming convention so that we can check for issues that match that pattern.
    // TODO:{FileName}:{LineNumber} does the below regex match?
    const patt = new RegExp("/TODO:([a-z][A-Z])*:([0-9])*/");
    const todosIssues = issues.select((issue) => patt.test(issue.title));
    const issuesToBeRemoved = [];
    todosIssues.forEach((issue)=> {
	if (!todos.values().contains(issue.title)) {
	    issuesToBeRemoved.push(issue);
	}
    });
    console.log(`Found ${issuesToBeremoved.length} issues that can be removed from github`);
    return issuesToBeRemoved;
}

async function deleteGithubIssues(issuesToBeRemoved) {
    // IMPLEMENT THIS
    issuesToBeRemoved.forEach((issue) => {
	console.log(`Deleting ${issue.title}`);
    });
}

//TODO: TEST THIS FUNCTION
async function handleIssues(todos) {
    // check if we have the envr variables set
    if (GITHUB_URL == undefined || GITHUB_ACCESS_TOKEN == undefined) {
	console.log("Github action not configured. Exiting");
	return;
    }
    const issues = await getIssues();
    issuesToBeRemoved = filterIssues(todos, issues);
    await deleteGithubIssues(issuesToBeRemoved);
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


main()
