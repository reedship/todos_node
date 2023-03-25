const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { ExtensionMap } = require('./extensions.js');

const CommentRegex = /^[ |\t]*\/\/.*(?:todo|fixme|note)/i

function printHelp() {
    const help =
	  "Todos \n\t v.0.0.1 \n\t author: Reed Shipley \n" +
	  "Usage:\n\t" +
	  "todos --dir=<directory> --output=<output> \n\t";
    console.log(help);
}

function getArgs() {
    const argsList = process.argv
    const parsedArgs = { dir:
			 process.argv[1].includes('--') ?
			 process.argv[1].split('=')[1]:
			 process.argv[1]
		       };
    if (argsList.length == 2) {
	// assume that the directory requested is the current one
	parsedArgs.dir = __dirname;
	// printHelp();
    }
    // default cli args

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
