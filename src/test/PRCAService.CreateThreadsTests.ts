/**
* Tests for creating threads
 */

import { PrcaService} from '../module/PRCAService';
import { Message } from '../module/Message';
import { TestLogger } from './TestLogger';
import {ConfigurableGitApi } from './mocks/ConfigurableGitApi';
import {ErrorTarget} from './mocks/ErrorTarget';

import * as chai from 'chai';

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

context('createCodeAnalysisThreads', () => {
    it('works when posting a single message', mochaAsync(async (done: Function) => {

        // Arrange
        let mockGitApi: ConfigurableGitApi = new ConfigurableGitApi();
        let logger: TestLogger = new TestLogger();
        let prcaService: PrcaService = new PrcaService(logger, mockGitApi, 'repoId', 15);

        mockGitApi.configurePRIterations([1]);
        let message = new Message('bla bla', 'file1.cs', 14, 2);

        // Act
        await prcaService.createCodeAnalysisThreads([message]);

        // Assert
        var threads = mockGitApi.ExistingThreads;
        chai.expect(threads).to.have.length(1);
        ConfigurableGitApi.validateThreadAgainstMessge(message, threads[0], 1);
    }));

    it('works when posting several messages', mochaAsync(async (done: Function) => {

        // Arrange
        let mockGitApi: ConfigurableGitApi = new ConfigurableGitApi();
        let logger: TestLogger = new TestLogger();
        let prcaService: PrcaService = new PrcaService(logger, mockGitApi, 'repoId', 15);

        mockGitApi.configurePRIterations([1, 2, 3]);

        let message1 = new Message('M1', 'file1.cs', 14, 2);
        let message2 = new Message('M2', 'file1.cs', 15, 4);
        let message3 = new Message('M3', 'file3.cs', 22, 1);

        // Act
        await prcaService.createCodeAnalysisThreads([message1, message2, null, message3, null]);

        // Assert
        chai.expect(mockGitApi.ExistingThreads).to.have.length(3);
        ConfigurableGitApi.validateThreadAgainstMessge(message1, mockGitApi.ExistingThreads[0], 3);
        ConfigurableGitApi.validateThreadAgainstMessge(message2, mockGitApi.ExistingThreads[1], 3);
        ConfigurableGitApi.validateThreadAgainstMessge(message3, mockGitApi.ExistingThreads[2], 3);
    }));

    it('fails if getPullRequestIterations fails', async (done) => {

        // Arrange
        let mockGitApi: ConfigurableGitApi = new ConfigurableGitApi();
        let logger: TestLogger = new TestLogger();
        let prcaService: PrcaService = new PrcaService(logger, mockGitApi, 'repoId', 15);
        let message = new Message('bla bla', 'file1.cs', 14, 2);

        mockGitApi.configurePRIterations([1]);
        mockGitApi.configureException(ErrorTarget.getPullRequestIterations);


        // Act
        try {
            await prcaService.createCodeAnalysisThreads([message]);
            done('Expected createCodeAnalysisThreads to have failed');
        } catch (e) {
            chai.expect(e.message).to.equal(ConfigurableGitApi.ExpectedExceptionText);
            done();
        }
    });

    it('fails if createThread fails', async (done) => {

        // Arrange
        let mockGitApi: ConfigurableGitApi = new ConfigurableGitApi();
        let logger: TestLogger = new TestLogger();
        let prcaService: PrcaService = new PrcaService(logger, mockGitApi, 'repoId', 15);
        let message = new Message('bla bla', 'file1.cs', 14, 2);

        mockGitApi.configurePRIterations([1]);
        mockGitApi.configureException(ErrorTarget.createThread);

        // Act
        try {
            await prcaService.createCodeAnalysisThreads([message]);
            done('Expected createCodeAnalysisThreads to have failed');
        } catch (e) {
            chai.expect(e.message).to.equal(ConfigurableGitApi.ExpectedExceptionText);
            done();
        }
    });
});