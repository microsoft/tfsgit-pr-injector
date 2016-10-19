/// <reference path="../../typings/index.d.ts" />

import * as path from 'path';

import { ILogger } from './ILogger';
import { Message } from './Message';
import { ISonarQubeReportProcessor } from './ISonarQubeReportProcessor';
import { IPrcaService } from './IPrcaService';

/**
 * PRCA (Pull Request Code Analysis) Orchestrator
 * Orchestrates the processing of SonarQube reports and posting issues to pull requests as comments
 *
 * @export
 * @class CodeAnalysisOrchestrator
 */
export class PrcaOrchestrator {

    private sqReportProcessor:ISonarQubeReportProcessor;
    private PrcaService:IPrcaService;

    public static MessageLimit = 100;

    constructor(private logger:ILogger, sqReportProcessor:ISonarQubeReportProcessor, PrcaService:IPrcaService) {
        if (sqReportProcessor === null || sqReportProcessor === undefined) {
            throw new ReferenceError('sqReportProcessor');
        }
        if (PrcaService === null || PrcaService === undefined) {
            throw new ReferenceError('PrcaService');
        }

        this.sqReportProcessor = sqReportProcessor;
        this.PrcaService = PrcaService;
    }

    /**
     * Fetches messages from the SonarQube report, filters and sorts them, then posts them to the pull request.
     */
    public postSonarQubeIssuesToPullRequest(sqReportPath: string): Promise<void> {
        this.logger.LogDebug(`SonarQube report path: ${sqReportPath}`);
        if (sqReportPath === undefined || sqReportPath === null) {
            throw new Error("Make sure a SonarQube enabled build task ran before this step.");
        }

        var allMessages:Message[] = this.sqReportProcessor.FetchCommentsFromReport(sqReportPath);
        var messagesToPost:Message[] = null;
        return this.PrcaService.getModifiedFilesInPr()
            .then((filesChanged: string[]) => {
                this.logger.LogDebug(`${filesChanged.length} changed files in the PR.`);

                messagesToPost = this.filterMessages(filesChanged, allMessages);
            })
            .then(() => {
                // Delete previous messages
                return this.PrcaService.deleteCodeAnalysisComments();
            })
            .then(() => {
                // Create new messages
                this.logger.LogDebug(`${messagesToPost.length} messages are to be posted.`);
                return this.PrcaService.createCodeAnalysisThreads(messagesToPost);
            });
    }

    /* Helper methods */
 

    private filterMessages(filesChanged: string[], allMessages: Message[]): Message[] {
        var result: Message[];
        result = allMessages;

        // Filter by message relating to files that were changed in this PR only
        result = result.filter(
            (message:Message) => {
                // If message.file is in filesChanged
                for (let fileChanged of filesChanged) {
                    // case-insensitive normalising file path comparison
                    if (path.relative(fileChanged, message.file) === '') {
                        return true;
                    }
                }
                return false;
            });
        this.logger.LogDebug(`${result.length} messages are for files changed in this PR. ${allMessages.length - result.length} messages are not.`);

        // Sort messages (Message.compare implements sorting by descending priority)
        result = result.sort(Message.compare);

        // Truncate to the first 100 to reduce perf and experience impact of being flooded with messages
        if (result.length > PrcaOrchestrator.MessageLimit) {
            this.logger.LogDebug(`A maximum of 100 messages are posted. ${result.length - PrcaOrchestrator.MessageLimit} messages will not be posted.`);
        }
        result = result.slice(0, PrcaOrchestrator.MessageLimit);

        return result;
    }

}