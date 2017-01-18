/// <reference path="../../typings/index.d.ts" />

/**
 * Tests for the CommentInjector protocol.
 */

import { SonarQubeReportProcessor } from '../module/prca/SonarQubeReportProcessor';
import { PRInjectorError } from '../module/prca/PRInjectorError';
import { Message } from '../module/prca/Message';
import { TestLogger } from './mocks/TestLogger';

import * as chai from 'chai';
import * as path from 'path';
import * as fs from 'fs';

function VerifyMessage(
    actualMessage: Message,
    expectedContent: string,
    expectedFile: string,
    expectedLine: number,
    expectedPriority: number) {

    chai.expect(actualMessage.content).to.equal(expectedContent, 'Content mismatch');
    chai.expect(actualMessage.file).to.equal(expectedFile, 'File mismatch');
    chai.expect(actualMessage.line).to.equal(expectedLine, 'Line mismatch');
    chai.expect(actualMessage.priority).to.equal(expectedPriority, 'Priority mismatch');
}

describe('The SonarQube Report Processor', () => {
    context('fails when', () => {
        let sqReportProcessor: SonarQubeReportProcessor;
        let testLogger: TestLogger;

        beforeEach(() => {
            testLogger = new TestLogger();
            sqReportProcessor = new SonarQubeReportProcessor(testLogger);
        });

        it('the report path is null', () => {
            chai.expect(() => sqReportProcessor.FetchCommentsFromReport(null)).to.throw(ReferenceError);
        });

        it('the report is not on disk', () => {
            let nonExistentReport: string = '/tmp/bogus.txt';
            chai.expect(() => sqReportProcessor.FetchCommentsFromReport(nonExistentReport)).to.throw(PRInjectorError);
        });

        it('the report is not in json format', () => {
            let invalidJsonReport: string = path.join(__dirname, 'data', 'invalid-sonar-report.json');
            fs.accessSync(invalidJsonReport, fs.F_OK);
            chai.expect(() => sqReportProcessor.FetchCommentsFromReport(invalidJsonReport)).to.throw(PRInjectorError);
        });
    });

    context('succeeds when', () => {
        let sqReportProcessor: SonarQubeReportProcessor;
        let testLogger: TestLogger;

        beforeEach(() => {
            testLogger = new TestLogger();
            sqReportProcessor = new SonarQubeReportProcessor(testLogger);
        });

        it('the report has no components', () => {
            let emptyReport = path.join(__dirname, 'data', 'empty-sonar-report.json');
            var messages = sqReportProcessor.FetchCommentsFromReport(emptyReport);

            chai.expect(messages).to.have.length(0, 'There are no issues');
        });

        it('the report has no new components', () => {
            let report = path.join(__dirname, 'data', 'sonar-no-new-issues.json');
            var messages = sqReportProcessor.FetchCommentsFromReport(report);

            chai.expect(messages).to.have.length(0, 'There are no issues');
        });

        it('the report has no issues', () => {
            let emptyReport = path.join(__dirname, 'data', 'empty-sonar-report.json');
            var messages = sqReportProcessor.FetchCommentsFromReport(emptyReport);

            chai.expect(messages).to.have.length(0, 'There are no issues');
        });

        it('the report is valid', () => {

            // Arrange
            let validReport = path.join(__dirname, 'data', 'sonar-report.json');
            let testLogger = new TestLogger();

            // Act
            let sqReportProcessor: SonarQubeReportProcessor = new SonarQubeReportProcessor(testLogger);
            let messages: Message[] = sqReportProcessor.FetchCommentsFromReport(validReport);

            // Assert
            chai.expect(messages).to.have.length(3, 'There are 3 new issues in the report');

            // valid issue in a module with a path
            VerifyMessage(
                messages[0],
                '**_major_**: Remove this unused "x" local variable. (squid:S1481)',
                '/my-app/src/main/java/com/mycompany/app/App.java',
                12,
                3);

            // another valid issue in a different file, but in a module without a path
            VerifyMessage(
                messages[1],
                '**_minor_**: Replace this usage of System.out or System.err by a logger. (squid:S106)',
                '/src/test/java/com/mycompany/app/AppTest.java',
                11,
                4);

            // issue with no priority
            VerifyMessage(
                messages[2],
                'Bad code right here... (squid:S106)',
                '/my-app/src/main/java/com/mycompany/app/App.java',
                15,
                6);

            chai.expect(testLogger.Warnings).to.have.length(2, 'There should be warnings for the issues with invalid line numbers');
        });
    });
});