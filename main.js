const fs = require('fs');
const path = require('path');
const readline = require('readline');

function printHelp() {
    const help =
	  "Todos \n\t v.0.0.1 \n\t author: Reed Shipley \n" +
	  "Usage:\n\t" +
	  "todos --dir=<directory> --format=<format> --output=<output> \n\t";
    console.log(help);
}

function getArgs() {
    const argsList = process.argv
    const parsedArgs = { dir:
			 process.argv[1].includes('--') ?
			 process.argv[1].split('=')[1]:
			 process.argv[1],
			 format: '// TODO:' };
    if (argsList.length == 2) {
	// assume that the directory requested is the current one
	parsedArgs.dir = __dirname;
	// printHelp();
    }
    // trim and edit args here. IE: put into a nice and neat object for parsing below. for now just return
    // default cli args

    return parsedArgs;
}

async function searchFile(file,format) {
    const lines = [];
    const filestream = fs.createReadStream(file);
    const rl = readline.createInterface({
	input: filestream,
	crlfDelay: Infinity
    });
    let lineNumber = 0;
    for await (const line of rl) {
	lineNumber++;
	if (line.includes(format)) {
	    lines.push({file, lineNumber, line: line.trim()});
	}
    }
    // cleanup and return
    console.log(lines);
    return lines;
}
// TODO: Finish this function
async function main() {
    const args = getArgs();
    const items = fs.readdirSync(args.dir);
    let unreadFiles = []
    for (let i=0; i < items.length; ++i){
	if (items[i][0] === '.') {
	    continue;
	} else {
	    // check if directory
	}
	unreadFiles.push(`${args.dir}/${items[i]}`);
    }


    for (let i=0;i<unreadFiles.length;++i) {
	await searchFile(unreadFiles[i], args.format);
    }
}
main()
