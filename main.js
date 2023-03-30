const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { ExtensionMap } = require('./extensions.js');

const CommentRegex = /^[ |\t]*\/\/.*(?:todo|fixme|note)/i
const ENV_DIRECTORY = process.env.TODOS_DIRECTORY || undefined;
const ENV_OUTPUT = process.env.TODOS_OUTPUT || undefined;

function printHelp() {
    const help =
	  "Todos \n\t v.0.0.1 \n\t author: Reed Shipley \n" +
	  "Usage:\n\t" +
	  "todos --dir=<directory> --output=<output> \n\t";
    console.log(help);
}

function getArgs() {
    const argsList = process.argv
    const parsedArgs = {
	dir: path.resolve(__dirname),
	output: 'STDOUT'
    };

    if (ENV_DIRECTORY != undefined) {
	parsedArgs['dir'] = ENV_DIRECTORY;
    } else if (process.argv[2]) {
	parsedArgs['dir'] = process.argv[2].includes('--directory') ?
	    process.argv[2].split('=')[1] :
	    process.argv[2];
    }

    if (ENV_OUTPUT != undefined) {
	parsedArgs['output'] = ENV_OUTPUT;
    } else if (process.argv[3]) {
	parsedArgs['dir'] = process.argv[3].includes('--output') ?
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
	    const extension = ExtensionMap[fileName.split('.').pop()];
	    lines.push({
		filePath: file,
		fileName,
		extension,
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
	    console.log(`${items[i].name} is a directory. Opening now..`);
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
// TODO: Finish this function
async function main() {
    if (process.argv.length === 3 && process.argv[2].includes('help')){
	printHelp();
	return;
    }
    const args = getArgs();
    console.log(`Now scanning ${args.dir}`);
    const items = fs.readdirSync(args.dir);
    let unreadFiles = await getFiles(args.dir)
    let todos = []
    for (let i=0;i<unreadFiles.length;++i) {
	const result = await searchFile(unreadFiles[i]);
	todos.push(result);
    }
    todos = todos.flat();
    console.log(todos)
}
main()
