/// <reference path="../../typings/index.d.ts" />


/**
* Test driver
 */

import { PrcaService} from '../module/PRCAService';
import { Message } from '../module/Message';
import { TestLogger } from './TestLogger';
import {ConfigurableGitApi } from './mocks/ConfigurableGitApi';
import {ErrorTarget} from './mocks/ErrorTarget';

import * as path from 'path';
import * as fs from 'fs';
import * as chai from 'chai';

// boiler plate for async mocha tests
var mochaAsync = (fn: Function) => {
    return async (done: Function) => {
        try {
            await fn();
            done();
        } catch (err) {
            done(err);
        }
    };
};


context('deleteCodeAnalysisComments', () => {
    it('works in conjunction with createCodeAnalysisThreads', async (done: Function) => {

        // Arrange
        let mockGitApi: ConfigurableGitApi = new ConfigurableGitApi();
        let logger: TestLogger = new TestLogger();
        let prcaService: PrcaService = new PrcaService(logger, mockGitApi, 'repoId', 15);

        mockGitApi.configurePRIterations([1]);
        let message1 = new Message('bla bla', 'file1.cs', 14, 2);
        let message2 = new Message('bla bla', 'file1.cs', 14, 2);

        // Act
        await prcaService.createCodeAnalysisThreads([message1, message2]);
        await prcaService.deleteCodeAnalysisComments();

        // Assert
        var threads = mockGitApi.ExistingThreads;
        chai.expect(threads).to.have.length(2);
        ConfigurableGitApi.validateThreadsAreDeleted(threads);
    });

    it('does not fail if getPullRequestIterations fails', mochaAsync(async (done: Function) => {

        // Arrange
        let mockGitApi: ConfigurableGitApi = new ConfigurableGitApi();
        let logger: TestLogger = new TestLogger();
        let prcaService: PrcaService = new PrcaService(logger, mockGitApi, 'repoId', 15);

        mockGitApi.configurePRIterations([1]);
        let message = new Message('bla bla', 'file1.cs', 14, 2);
        await prcaService.createCodeAnalysisThreads([message]);

        mockGitApi.configureException(ErrorTarget.getPullRequestIterations);

        await prcaService.deleteCodeAnalysisComments();

        // Assert
        var threads = mockGitApi.ExistingThreads;
        chai.expect(threads).to.have.length(1);
        ConfigurableGitApi.validateThreadsAreDeleted(threads);
    }));

    it('fails if deleteComment fails ', (async (done: Function) => {

        let mockGitApi: ConfigurableGitApi = new ConfigurableGitApi();
        let logger: TestLogger = new TestLogger();
        let prcaService: PrcaService = new PrcaService(logger, mockGitApi, 'repoId', 15);

        mockGitApi.configurePRIterations([1]);
        let message = new Message('bla bla', 'file1.cs', 14, 2);
        await prcaService.createCodeAnalysisThreads([message]);

        mockGitApi.configureException(ErrorTarget.deleteComment);

        try {
            await prcaService.deleteCodeAnalysisComments();
            done('Expected createCodeAnalysisThreads to have failed');
        } catch (e) {
            chai.expect(e.message).to.equal(ConfigurableGitApi.ExpectedExceptionText)
            done();
        }
    }));

    it('fails if getThreads fails ', (async (done: Function) => {

        let mockGitApi: ConfigurableGitApi = new ConfigurableGitApi();
        let logger: TestLogger = new TestLogger();
        let prcaService: PrcaService = new PrcaService(logger, mockGitApi, 'repoId', 15);

        mockGitApi.configurePRIterations([1]);
        let message = new Message('bla bla', 'file1.cs', 14, 2);
        await prcaService.createCodeAnalysisThreads([message]);

        mockGitApi.configureException(ErrorTarget.getThreads);

        try {
            await prcaService.deleteCodeAnalysisComments();
            done('Expected createCodeAnalysisThreads to have failed');
        } catch (e) {
            chai.expect(e.message).to.equal(ConfigurableGitApi.ExpectedExceptionText)
            done();
        }
    }));

    it('works with a complex thread setup', mochaAsync(async (done: Function) => {

        // This is a complex setup taken from a real network capture. The threads look like this:
        // 
        // 1058 - a system generated thread
        // 1059-1062 - PRCA threads that were already deleted
        // 1062 - a PRCA thread with a single comment "Foo"
        // 1063 - a PRCA thread consisting of 2 comments, "Bar" - posted by PRCA and "User reply" posted by the user
        // 1064 - a non-PRCA thread with a single comment "User comment"
        //
        // Out of these, only 1058 and 1064 should not be deleted because they are not created by PRCA. 1063 will be deleted 
        // even if it has user comments.        

        let mockGitApi: ConfigurableGitApi = new ConfigurableGitApi();
        let logger: TestLogger = new TestLogger();
        let prcaService: PrcaService = new PrcaService(logger, mockGitApi, 'repoId', 15);
        mockGitApi.configurePRIterations([1]);

        let serializedThreadsAndCommentsFile = path.join(__dirname, 'data', 'threadsAndComments.json');
        var data = fs.readFileSync(serializedThreadsAndCommentsFile, 'utf8');
        var threads = JSON.parse(data);
        mockGitApi.ExistingThreads = threads.value;

        await prcaService.deleteCodeAnalysisComments();

        var threadsThatShouldBeDeleted = mockGitApi.ExistingThreads.filter(t => [1059, 1060, 1061, 1062, 1063].indexOf(t.id) > -1);
        chai.expect(threadsThatShouldBeDeleted).to.have.length(5, 'Missing threads');
        ConfigurableGitApi.validateThreadsAreDeleted(threadsThatShouldBeDeleted);

        ConfigurableGitApi.validateThreadIsNotDeleted(mockGitApi.ExistingThreads.find(t => t.id === 1058));
        ConfigurableGitApi.validateThreadIsNotDeleted(mockGitApi.ExistingThreads.find(t => t.id === 1064));
    }));
});