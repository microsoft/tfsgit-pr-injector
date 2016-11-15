# tfsgit-pr-injector

This is a TFS Build task that will post issues detected by a SonarQube incremental analysis to a Pull Request. It has been tested with Maven and Gradle. 


Dev: 

- install node
- "npm install" to install all the dependencies
- "npm run info" for a description of all the scripts
- "npm run package" bundles all the files that form this build task
- building and debugging work from inside VSCode - build (ctrl+shift+b) will transpile the ts and you can F5 into a mocha test
- to try out the VSTS Git API endpoint, have a look at the PrcaService.DriverTest
- to test the task on your own account, install it using the tfx-cli utility https://www.npmjs.com/package/tfx-cli



