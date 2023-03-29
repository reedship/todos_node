# Todos

## Summary
This CLI collects all `TODO` statements inside a given project directory, and presents them as a list of outstanding issues to be completed. This tool can be used for reporting, documentation, and issue generation on github.

## Usage
Todos will default to using environment variables instead of CLI arguments if they are present. If neither ENV variables nor cli arguments are present, the defaults assume you are searching the current directory (IE: the todos project directory) and using a STDOUT output. This is obviously not helpful for users, so the only TODO found will be an error stating that you should really be passing in a directory.

``` shell
todos --dir=<directory> --output=<output>
```

## Steps to be completed
- [x] traverses individual files
- [x] traverses directory trees
- [ ] full flag and help documentation
- [ ] released on NPM
