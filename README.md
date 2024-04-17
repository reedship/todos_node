# Todos

## Summary

This CLI collects all `TODO` statements inside a given project directory, and presents them as a list of outstanding issues to be completed. This tool can be used for reporting, documentation, and issue generation on github.

## Usage

Todos will default to using environment variables instead of CLI arguments if they are present. If neither ENV variables nor cli arguments are present, the defaults assume you are searching the current directory (IE: the todos project directory) and using a STDOUT output. This is obviously not helpful for users, so the only TODO found will be an error stating that you should really be passing in a directory.

Here is an example of the command used to run the tool, with environment variables declared manually.
``` shell
TODOS_GITHUB=<github_owner>/<repo_name> TODOS_TOKEN=<github_access_token> node main.js --dir=<directory> --output=<output>
```


### Environment variables

- TODOS_GITHUB

  This should be the github repo for the project you are using this tool on. For example, if you were attaching this to a repo with a url of `https://www.github.com/johnsmith/test_repo`, this variable should be set to `johnsmith/test_repo`.

- TODOS_TOKEN

  This should be the github personal access token for your github user. Creating a special token specifically for this project with limited permissions is advised. See [the documentation for creating github PATs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) for more information
  .
### NPM Package

``` json-with-comments
// Package.json
{
	// truncated...
	"dependencies": {
		// your dependencies here
		"todos": 1.0.0
	},
	"scripts": {
		"start": "react-scripts start",
		"build": "react-scripts build",
		"test": "react scripts test && npm run todos", // add todos on to existing test script
		"todos": "todos --dir=<your src dir> --output=csv"
	}
	// truncated...
}
```
