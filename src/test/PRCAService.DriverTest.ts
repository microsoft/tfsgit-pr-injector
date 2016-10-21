/**
* Test that can be used to drive the API using a PAT. Make sure not to commit the PAT!!!!
 */

import { IGitApi } from 'vso-node-api/GitApi';
import { PrcaService} from '../module/PRCAService';
import { Message } from '../module/Message';
import { TestLogger } from './TestLogger';
import * as web from 'vso-node-api/WebApi';
import { WebApi } from 'vso-node-api/WebApi';

// xit() means the test will not get executed (it will be marked as pending). Use it() instead.
xit('Real web calls using token, no assertions!', async (done) => {

    // for Fiddler to capture the traffic it needs to go through a proxy
    // process.env.https_proxy = 'http://127.0.0.1:8888';
    // process.env.http_proxy = 'http://127.0.0.1:8888';
    // process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    var collectionUrl = ''; // DO NOT COMMIT THE COLLECTION 
    let token: string = '';  // DO NOT COMMIT THE PAT
    let creds = web.getPersonalAccessTokenHandler(token);

    var repoId = '6db6fc4b-6f3d-418f-b2b5-e4170bef7610';
    var prId = 113;

    var connection = new WebApi(collectionUrl, creds);
    let vstsGit: IGitApi = connection.getGitApi();

    let logger: TestLogger = new TestLogger();
    let prcaService: PrcaService = new PrcaService(logger, vstsGit, repoId, prId);
    try {
        await prcaService.createCodeAnalysisThreads([new Message('Foo', '/Extractor/Program.cs', 1, 5)]);
        await prcaService.createCodeAnalysisThreads([new Message('Bar', '/ConsoleApplication1/App.config', 3, 1)]);

        done();
    } catch (e) {
        done(e);
    }

});