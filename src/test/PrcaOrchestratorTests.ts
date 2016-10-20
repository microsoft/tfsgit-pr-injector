/// <reference path="../../typings/index.d.ts" />

/**
 * Tests for interactions with the server.
 */

import { GitPullRequestCommentThread, Comment } from 'vso-node-api/interfaces/GitInterfaces';

import { Message } from '../module/Message';
import { SonarQubeReportProcessor } from '../module/SonarQubeReportProcessor';
import { PrcaService } from '../module/PrcaService';
import { PrcaOrchestrator } from '../module/PrcaOrchestrator';

import { TestLogger } from './TestLogger';
import { MockPrcaService } from './MockPrcaService';
import { MockSonarQubeReportProcessor } from './MockSonarQubeReportProcessor';

import * as chai from 'chai';
import { expect } from 'chai';
import * as path from 'path';
import * as Q from 'q';

describe('The PRCA Orchestrator', () => {

    let fakeMessage: Message = new Message('foo bar', './foo/bar.txt', 1, 1);

    before(() => {
        Q.longStackSupport = true;
        chai.should();
    });

    context('fails when it', () => {
        let testLogger: TestLogger;
        let server: MockPrcaService;
        let sqReportProcessor:SonarQubeReportProcessor;
        let orchestrator:PrcaOrchestrator; // object under test

        beforeEach(() => {
            testLogger = new TestLogger();
            server = new MockPrcaService();
            sqReportProcessor = new SonarQubeReportProcessor(testLogger);
            orchestrator = new PrcaOrchestrator(testLogger, sqReportProcessor, server);
        });

        it('is called with invalid arguments', () => {
            // Arrange
            var expectedMessages: Message[] = [fakeMessage, fakeMessage];
            server.createCodeAnalysisThreads(expectedMessages); // post some messages to test that the orchestrator doesn't delete them
            
            // Act & Assert
            expect(() => orchestrator.postSonarQubeIssuesToPullRequest(undefined)).to.throw(Error, /Make sure a SonarQube enabled build task ran before this step./);
            expect(() => orchestrator.postSonarQubeIssuesToPullRequest(null)).to.throw(Error, /Make sure a SonarQube enabled build task ran before this step./);
            expect(server.getSavedMessages()).to.eql(expectedMessages, 'Expected existing PRCA messages to still be on the server');
        });

        it('fails retrieving the list of files in the pull request', () => {
            // Arrange
            var expectedMessages: Message[] = [fakeMessage, fakeMessage];
            server.createCodeAnalysisThreads(expectedMessages); // post some messages to test that the orchestrator doesn't delete them
            server.getModifiedFilesInPr_shouldFail = true;
            var sqReportPath: string = path.join(__dirname, 'data', 'sonar-report.json');

            // Act
            return orchestrator.postSonarQubeIssuesToPullRequest(sqReportPath)
                .then(() => {
                    return Promise.reject('Should not have finished successfully');
                }, (error) => {
                    // We expect to fail
                    expect(server.getSavedMessages()).to.eql(expectedMessages, 'Expected existing PRCA messages to still be on the server');
                    return Promise.resolve(true);
                });
        });

        it('fails deleting old PRCA comments', () => {
            // Arrange
            var expectedMessages: Message[] = [fakeMessage, fakeMessage];
            server.createCodeAnalysisThreads(expectedMessages); // post some messages to test that the orchestrator doesn't delete them
            server.deleteCodeAnalysisComments_shouldFail = true;
            var sqReportPath: string = path.join(__dirname, 'data', 'sonar-report.json');

            // Act
            return orchestrator.postSonarQubeIssuesToPullRequest(sqReportPath)
                .then(() => {
                    return Promise.reject('Should not have finished successfully');
                }, (error) => {
                    // We expect to fail
                    expect(server.getSavedMessages()).to.eql(expectedMessages, 'Expected existing PRCA messages to still be on the server');
                    return Promise.resolve(true);
                });
        });

        it('fails posting new PRCA comments', () => {
            // Arrange
            var oldMessages: Message[] = [fakeMessage, fakeMessage];
            server.createCodeAnalysisThreads(oldMessages); // post some messages to test that the orchestrator deletes them
            server.createCodeAnalysisThreads_shouldFail = true;
            var sqReportPath: string = path.join(__dirname, 'data', 'sonar-report.json');

            // Act
            return orchestrator.postSonarQubeIssuesToPullRequest(sqReportPath)
                .then(() => {
                    return Promise.reject('Should not have finished successfully');
                }, (error) => {
                    // We expect to fail
                    expect(server.getSavedMessages()).to.have.length(0, 'Expected old PRCA comments to have been deleted');
                    return Promise.resolve(true);
                });
        });
    });

    context('succeeds when it', () => {
        let testLogger: TestLogger;
        let server: MockPrcaService;
        let sqReportProcessor: SonarQubeReportProcessor;
        let orchestrator:PrcaOrchestrator; // object under test

        beforeEach(() => {
            testLogger = new TestLogger();
            server = new MockPrcaService();
            sqReportProcessor = new SonarQubeReportProcessor(testLogger);
            orchestrator = new PrcaOrchestrator(testLogger, sqReportProcessor, server);
        });

        it('has no comments to post (no issues reported)', () => {
            // Arrange
            // no changed files => new files to post issues on
            var oldMessages: Message[] = [fakeMessage, fakeMessage];
            server.createCodeAnalysisThreads(oldMessages); // post some messages to test that the orchestrator deletes them
            server.setModifiedFilesInPr([]);
            var sqReportPath: string = path.join(__dirname, 'data', 'sonar-no-issues.json');

            // Act
            return orchestrator.postSonarQubeIssuesToPullRequest(sqReportPath)
                .then(() => {
                    // Assert
                    expect(server.getSavedMessages()).to.have.length(0, 'Correct number of comments');
                });
        });

        it('has no comments to post (no issues in changed files)', () => {
            // Arrange
            var oldMessages: Message[] = [fakeMessage, fakeMessage];
            server.createCodeAnalysisThreads(oldMessages); // post some messages to test that the orchestrator deletes them
            server.setModifiedFilesInPr([]);
            var sqReportPath: string = path.join(__dirname, 'data', 'sonar-no-new-issues.json');

            // Act
            return orchestrator.postSonarQubeIssuesToPullRequest(sqReportPath)
                .then(() => {
                    // Assert
                    expect(server.getSavedMessages()).to.have.length(0, 'Correct number of comments');
                });
        });

        it('has 1 comment to post', () => {
            // Arrange
            var oldMessages: Message[] = [fakeMessage, fakeMessage];
            server.createCodeAnalysisThreads(oldMessages); // post some messages to test that the orchestrator deletes them
            server.setModifiedFilesInPr(['src/test/java/com/mycompany/app/AppTest.java']);
            var sqReportPath: string = path.join(__dirname, 'data', 'sonar-report.json');

            // Act
            return orchestrator.postSonarQubeIssuesToPullRequest(sqReportPath)
                .then(() => {
                    // Assert
                    expect(server.getSavedMessages()).to.have.length(1, 'Correct number of comments');
                });
        });

        it('has multiple comments to post', () => {
            // Arrange
            server.setModifiedFilesInPr(['src/main/java/com/mycompany/app/App.java']);
            var sqReportPath: string = path.join(__dirname, 'data', 'sonar-report.json');

            // Act
            return orchestrator.postSonarQubeIssuesToPullRequest(sqReportPath)
                .then(() => {
                    // Assert
                    expect(server.getSavedMessages()).to.have.length(2, 'Correct number of comments');
                });
        });

        it(`has more comments to post than the limit allows`, () => {
            // Arrange
            server.setModifiedFilesInPr(['src/main/java/com/mycompany/app/App.java']);
            var sqReportPath: string = path.join(__dirname, 'data', 'sonar-no-issues.json');
            let mockSqReportProcessor: MockSonarQubeReportProcessor = new MockSonarQubeReportProcessor();
            let orchestrator: PrcaOrchestrator =
                new PrcaOrchestrator(testLogger, mockSqReportProcessor, server);

            let messages = new Array<Message>(orchestrator.getMessageLimit() + 50);
            // Set (getMessageLimit() + 50) messages to return
            for (var i = 0; i < orchestrator.getMessageLimit() + 50; i++) {
                let message: Message;
                // Some of the messages will have a higher priority, so that we can check that they have all been posted
                if (i < orchestrator.getMessageLimit() + 30) {
                    message = new Message('foo', 'src/main/java/com/mycompany/app/App.java', 1, 2);
                } else {
                    message = new Message('bar', 'src/main/java/com/mycompany/app/App.java', 1, 1);
                }
                messages.push(message);
            }
            mockSqReportProcessor.SetCommentsToReturn(messages);

            // Act
            return orchestrator.postSonarQubeIssuesToPullRequest(sqReportPath)
                .then(() => {
                    // Assert
                    expect(server.getSavedMessages()).to.have.length(orchestrator.getMessageLimit(), 'Correct number of comments');

                    var priorityOneThreads = server.getSavedMessages().filter(
                        (message: Message) => {
                            return message.content == 'bar';
                        }
                    );
                    expect(priorityOneThreads).to.have.length(20, 'High priority comments were all posted');
                });
        });

        it(`has more high-priority comments to post than the limit allows`, () => {
            // Arrange
            server.setModifiedFilesInPr(['src/main/java/com/mycompany/app/App.java']);
            var sqReportPath: string = path.join(__dirname, 'data', 'sonar-no-issues.json');
            let mockSqReportProcessor: MockSonarQubeReportProcessor = new MockSonarQubeReportProcessor();
            let orchestrator: PrcaOrchestrator =
                new PrcaOrchestrator(testLogger, mockSqReportProcessor, server);

            let messages = new Array<Message>(orchestrator.getMessageLimit() + 50);
            // Set (getMessageLimit() + 50) messages to return
            for (var i = 0; i < orchestrator.getMessageLimit() + 50; i++) {
                let message: Message;
                // (getMessageLimit() + 20 of the messages are high priority, so we expect all posted messages to be at the highest priority
                if (i < 30) {
                    message = new Message('foo', 'src/main/java/com/mycompany/app/App.java', 1, 2);
                } else {
                    message = new Message('bar', 'src/main/java/com/mycompany/app/App.java', 1, 1);
                }
                messages.push(message);
            }
            mockSqReportProcessor.SetCommentsToReturn(messages);

            // Act

            return orchestrator.postSonarQubeIssuesToPullRequest(sqReportPath)
                .then(() => {
                    // Assert
                    expect(server.getSavedMessages()).to.have.length(orchestrator.getMessageLimit(), 'Correct number of comments');

                    var priorityOneThreads = server.getSavedMessages().filter(
                        (message: Message) => {
                            return message.content == 'bar';
                        }
                    );
                    expect(priorityOneThreads).to.have.length(orchestrator.getMessageLimit(), 'All posted comments were high priority');
                });
        });

        it(`is given a different comment limit`, () => {
            // Arrange
            server.setModifiedFilesInPr(['src/main/java/com/mycompany/app/App.java']);
            var sqReportPath: string = path.join(__dirname, 'data', 'sonar-no-issues.json');

            let mockSqReportProcessor: MockSonarQubeReportProcessor = new MockSonarQubeReportProcessor();
            let messages = new Array<Message>(10);
            // Set 10 messages to return
            for (var i = 0; i < 10; i++) {
                messages.push(new Message('bar', 'src/main/java/com/mycompany/app/App.java', 1, 1));
            }
            mockSqReportProcessor.SetCommentsToReturn(messages);

            // Act
            let orchestrator: PrcaOrchestrator =
                new PrcaOrchestrator(testLogger, mockSqReportProcessor, server, 5); // set a message limit of 5

            return orchestrator.postSonarQubeIssuesToPullRequest(sqReportPath)
                .then(() => {
                    // Assert
                    expect(server.getSavedMessages()).to.have.length(orchestrator.getMessageLimit(), 'Correct number of comments');

                    var correctThreads = server.getSavedMessages().filter(
                        (message: Message) => {
                            return message.content == 'bar';
                        }
                    );
                    expect(correctThreads).to.have.length(orchestrator.getMessageLimit(), 'All posted comments had correct content');
                });
        });


    });
});