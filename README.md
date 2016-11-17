# tfsgit-pr-injector

This is a TFS Build task that will post issues detected by a SonarQube incremental analysis to a Pull Request. It has been tested with Maven and Gradle. 


Dev: 

- install node
- `npm install` to install all the dependencies
- `npm run info` for a description of all the scripts
- building and debugging tests work from inside VSCode - build (ctrl+shift+b) will transpile the ts and you can F5 into a mocha test
- `npm run test` will build and run all the tests
- to try out the VSTS Git API endpoint, have a look at the PrcaService.DriverTest

Packaging: 

- `npm run package` bundles all the files that form this build task
- to test the task on your own account, install it using the tfx-cli utility https://www.npmjs.com/package/tfx-cli



