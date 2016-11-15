/// <reference path="../../typings/index.d.ts" />

/**
* Test that can be used to drive the API using a personal access token (PAT). Make sure not to commit the PAT!!!!
* Use this test to understand / debug the product code. It has no coverage value and will not run with the other tests. 
 */

import { IGitApi } from 'vso-node-api/GitApi';
import { PrcaService} from '../module/prca/PRCAService';
import { Message } from '../module/prca/Message';
import { TestLogger } from './mocks/TestLogger';
import * as web from 'vso-node-api/WebApi';
import { WebApi } from 'vso-node-api/WebApi';

// xit() means the test will not get executed (it will be marked as pending). Use it() to execute.
xit('Real web calls using token, no assertions!', async (done) => {

    // uncomment these lines if you want to use Fiddler to capture the traffic
    // process.env.https_proxy = 'http://127.0.0.1:8888';
    // process.env.http_proxy = 'http://127.0.0.1:8888';
    // process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    var collectionUrl = ''; // DO NOT COMMIT THE COLLECTION 
    let token: string = '';  // DO NOT COMMIT THE PAT

    var repoId = '6db6fc4b-6f3d-418f-b2b5-e4170bef7610'; // replace with your personal repo ID, open a repo and look at the url
    var prId = 113; // replace with your own PR Id, create a PR and look at the url

    let creds = web.getPersonalAccessTokenHandler(token);
    var connection = new WebApi(collectionUrl, creds);
    let vstsGit: IGitApi = connection.getGitApi();

    let logger: TestLogger = new TestLogger();
    let prcaService: PrcaService = new PrcaService(logger, vstsGit, repoId, prId);
    try {

        await prcaService.getModifiedFilesInPr();
        await prcaService.createCodeAnalysisThreads([new Message('Foo', '/Extractor/Program.cs', 1, 5)]);
        await prcaService.deleteCodeAnalysisComments();
        await prcaService.createCodeAnalysisThreads([new Message('Bar', '/ConsoleApplication1/App.config', 3, 1)]);

        done();
    } catch (e) {
        done(e);
    }

});