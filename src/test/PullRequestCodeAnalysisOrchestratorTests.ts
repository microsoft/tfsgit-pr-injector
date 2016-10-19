/**
 * Tests for interactions with the server.
 */

import { GitPullRequestCommentThread, Comment } from 'vso-node-api/interfaces/GitInterfaces';

import { Message } from '../module/Message';
import { ISonarQubeReportProcessor } from '../module/ISonarQubeReportProcessor';
import { SonarQubeReportProcessor } from '../module/SonarQubeReportProcessor';
import { IPRCAService } from '../module/IPRCAService';
import { PRCAService } from '../module/PRCAService';
import { PullRequestCodeAnalysisOrchestrator } from '../module/PullRequestCodeAnalysisOrchestrator';

import { TestLogger } from './TestLogger';
import { MockPrcaService } from './MockPrcaService';
import { MockSonarQubeReportProcessor } from './MockSonarQubeReportProcessor';

import * as chai from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import * as Q from 'q';

describe('The PRCA Orchestrator', () => {

    before(() => {
        Q.longStackSupport = true;
    })

    context('fails when it', () => {
        let testLogger: TestLogger;
        let server: MockPrcaService;
        let sqReportProcessor:SonarQubeReportProcessor;

        beforeEach(() => {
            testLogger = new TestLogger();
            server = new MockPrcaService(testLogger);
            sqReportProcessor = new SonarQubeReportProcessor(testLogger);
        });

        it('does not have the required environment variable', () => {
            // Arrange
            let orchestrator: PullRequestCodeAnalysisOrchestrator = 
                new PullRequestCodeAnalysisOrchestrator(testLogger, sqReportProcessor, server);
            
            // Act
            chai.expect(() => orchestrator.postSonarQubeIssuesToPullRequest()).to.throw(Error, /SQ_REPORT_PATH env var was not set./);
        })
    })

    context('succeeds when it', () => {
        let testLogger: TestLogger;
        let server: MockPrcaService;
        let sqReportProcessor: ISonarQubeReportProcessor;

        beforeEach(() => {
            testLogger = new TestLogger();
            server = new MockPrcaService(testLogger);
            sqReportProcessor = new SonarQubeReportProcessor(testLogger);
        });

        afterEach(() => {
            server.cleanUp();
        });

        it('has no comments to post (no issues reported)', () => {
            // Arrange
            // no changed files => new files to post issues on
            server.setModifiedFilesInPr([]);
            process.env['SQ_REPORT_PATH'] = path.join(__dirname, 'data', 'sonar-no-issues.json');

            // Act
            let orchestrator: PullRequestCodeAnalysisOrchestrator = 
                new PullRequestCodeAnalysisOrchestrator(testLogger, sqReportProcessor, server);
            orchestrator.postSonarQubeIssuesToPullRequest();

            // Assert
            chai.expect(server.getThreads()).to.have.length(0, 'Correct number of comments');
        });

        it('has no comments to post (no issues in changed files)', () => {
            // Arrange
            // no changed files => new files to post issues on
            server.setModifiedFilesInPr([]);
            process.env['SQ_REPORT_PATH'] = path.join(__dirname, 'data', 'sonar-no-new-issues.json');

            // Act
            let orchestrator: PullRequestCodeAnalysisOrchestrator = 
                new PullRequestCodeAnalysisOrchestrator(testLogger, sqReportProcessor, server);
            orchestrator.postSonarQubeIssuesToPullRequest();

            // Assert
            chai.expect(server.getThreads()).to.have.length(0, 'Correct number of comments');
        });

        it('has 1 comment to post', () => {
            // Arrange
            server.setModifiedFilesInPr(['src/test/java/com/mycompany/app/AppTest.java']);
            process.env['SQ_REPORT_PATH'] = path.join(__dirname, 'data', 'sonar-report.json');

            // Act
            let orchestrator: PullRequestCodeAnalysisOrchestrator = 
                new PullRequestCodeAnalysisOrchestrator(testLogger, sqReportProcessor, server);
            orchestrator.postSonarQubeIssuesToPullRequest();

            // Assert
            chai.expect(server.getThreads()).to.have.length(1, 'Correct number of comments');
        });

        it('has multiple comments to post', () => {
            // Arrange
            server.setModifiedFilesInPr(['src/main/java/com/mycompany/app/App.java']);
            process.env['SQ_REPORT_PATH'] = path.join(__dirname, 'data', 'sonar-report.json');

            // Act
            let orchestrator: PullRequestCodeAnalysisOrchestrator = 
                new PullRequestCodeAnalysisOrchestrator(testLogger, sqReportProcessor, server);
            orchestrator.postSonarQubeIssuesToPullRequest();

            // Assert
            chai.expect(server.getThreads()).to.have.length(2, 'Correct number of comments');
        });

        it('has more than 100 mixed-priority comments to post', () => {
            // Arrange
            server.setModifiedFilesInPr(['src/main/java/com/mycompany/app/App.java']);
            process.env['SQ_REPORT_PATH'] = path.join(__dirname, 'data', 'sonar-no-issues.json');

            let mockSqReportProcessor: MockSonarQubeReportProcessor = new MockSonarQubeReportProcessor();
            let messages = new Array<Message>(150);
            // Set 150 messages to return
            for (var i = 0; i < 150; i++) {
                let message: Message;
                // Some of the messages will have a higher priority, so that we can check that they have all been posted
                if (i < 130) {
                    message = new Message('foo', 'src/main/java/com/mycompany/app/App.java', 1, 2);
                } else {
                    message = new Message('bar', 'src/main/java/com/mycompany/app/App.java', 1, 1);
                }
                messages.push(message);
            }
            mockSqReportProcessor.SetCommentsToReturn(messages);

            // Act
            let orchestrator: PullRequestCodeAnalysisOrchestrator = 
                new PullRequestCodeAnalysisOrchestrator(testLogger, mockSqReportProcessor, server);
            orchestrator.postSonarQubeIssuesToPullRequest();

            // Assert
            chai.expect(server.getThreads()).to.have.length(100, 'Correct number of comments');

            var priorityOneThreads = server.getThreads().filter(
                (thread: GitPullRequestCommentThread) => {
                    return thread.comments[0].content == 'bar';
                }
            )
            chai.expect(priorityOneThreads).to.have.length(20, 'High priority comments were all posted');
        });

        it('has more than 100 high-priority comments to post', () => {
            // Arrange
            server.setModifiedFilesInPr(['src/main/java/com/mycompany/app/App.java']);
            process.env['SQ_REPORT_PATH'] = path.join(__dirname, 'data', 'sonar-no-issues.json');

            let mockSqReportProcessor: MockSonarQubeReportProcessor = new MockSonarQubeReportProcessor();
            let messages = new Array<Message>(150);
            // Set 150 messages to return
            for (var i = 0; i < 150; i++) {
                let message: Message;
                // 120 of the messages are high priority, so we expect all 100 posted messages to be at the highest priority
                if (i < 30) {
                    message = new Message('foo', 'src/main/java/com/mycompany/app/App.java', 1, 2);
                } else {
                    message = new Message('bar', 'src/main/java/com/mycompany/app/App.java', 1, 1);
                }
                messages.push(message);
            }
            mockSqReportProcessor.SetCommentsToReturn(messages);

            // Act
            let orchestrator: PullRequestCodeAnalysisOrchestrator = 
                new PullRequestCodeAnalysisOrchestrator(testLogger, mockSqReportProcessor, server);
            orchestrator.postSonarQubeIssuesToPullRequest();

            // Assert
            chai.expect(server.getThreads()).to.have.length(100, 'Correct number of comments');

            var priorityOneThreads = server.getThreads().filter(
                (thread: GitPullRequestCommentThread) => {
                    return thread.comments[0].content == 'bar';
                }
            )
            chai.expect(priorityOneThreads).to.have.length(100, 'All posted comments were high priority');
        });
    });
});