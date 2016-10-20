/**
* Tests for GetChanges
 */

import { PRCAService} from '../module/PRCAService';
import { TestLogger } from './TestLogger';
import {ConfigurableGitApi } from './mocks/ConfigurableGitApi';
import {ErrorTarget} from './mocks/ErrorTarget';

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


describe('PRCA Service ', () => {
    context('getModifiedFilesInPr', () => {
        it('works if the PR has 1 iteration', mochaAsync(async (done: Function) => {

            // Arrange
            let mockGitApi: ConfigurableGitApi = new ConfigurableGitApi();
            let logger: TestLogger = new TestLogger();
            let prcaService: PRCAService = new PRCAService(logger, mockGitApi, 'repoId', 15);

            mockGitApi.configurePRIterations([1]);
            mockGitApi.configurePrIterationChanges(1, ['file1.cs', 'file2.cs']);

            // Act
            let files = await prcaService.getModifiedFilesInPr();

            // Assert
            chai.expect(files.sort()).to.eql(['file1.cs', 'file2.cs']);
        }));

        it('works if the PR has multiple iterations', mochaAsync(async (done: Function) => {

            // Arrange
            let mockGitApi: ConfigurableGitApi = new ConfigurableGitApi();
            let logger: TestLogger = new TestLogger();
            let prcaService: PRCAService = new PRCAService(logger, mockGitApi, 'repoId', 15);

            mockGitApi.configurePRIterations([1, 3, 5, 7]);
            mockGitApi.configurePrIterationChanges(1, ['file1.cs', 'file2.cs']);
            mockGitApi.configurePrIterationChanges(3, ['file1.cs', 'file3.cs']);
            mockGitApi.configurePrIterationChanges(5, ['file1.cs', 'file5.cs']);
            mockGitApi.configurePrIterationChanges(7, ['file1.cs', 'file2.cs', 'file3.cs']);

            // Act
            let files = await prcaService.getModifiedFilesInPr();

            // Assert
            chai.expect(files.sort()).to.eql(['file1.cs', 'file2.cs', 'file3.cs', 'file5.cs']);
        }));

        it('fails if getPullRequestIterations also fails', async (done) => {

            // Arrange
            let mockGitApi: ConfigurableGitApi = new ConfigurableGitApi();
            let logger: TestLogger = new TestLogger();
            let prcaService: PRCAService = new PRCAService(logger, mockGitApi, 'repoId', 15);

            mockGitApi.configurePRIterations([1, 2]);
            mockGitApi.configurePrIterationChanges(1, ['file1.cs', 'file2.cs']);
            mockGitApi.configureException(ErrorTarget.getPullRequestIterations);

            // Act
            try {
                await prcaService.getModifiedFilesInPr();
                done('Expected getModifiedFilesInPr to have failed');
            } catch (e) {
                chai.expect(e.message).to.equal(ConfigurableGitApi.ExpectedExceptionText);
                done();
            }
        });

        it('fails if getPullRequestIterationChanges also fails', async (done) => {

            // Arrange
            let mockGitApi: ConfigurableGitApi = new ConfigurableGitApi();
            let logger: TestLogger = new TestLogger();
            let prcaService: PRCAService = new PRCAService(logger, mockGitApi, 'repoId', 15);

            mockGitApi.configurePRIterations([1, 2]);
            mockGitApi.configurePrIterationChanges(1, ['file1.cs', 'file2.cs']);
            mockGitApi.configureException(ErrorTarget.getPullRequestIterationChanges);

            // Act
            try {
                await prcaService.getModifiedFilesInPr();
                done('Expected getModifiedFilesInPr to have failed');
            } catch (e) {
                chai.expect(e.message).to.equal(ConfigurableGitApi.ExpectedExceptionText);
                done();
            }

        });
    });
});