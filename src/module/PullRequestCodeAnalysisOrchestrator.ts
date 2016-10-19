/// <reference path="../../typings/index.d.ts" />

import { ILogger } from './ILogger';
import { Message } from './Message';
import { ISonarQubeReportProcessor } from './ISonarQubeReportProcessor';
import { SonarQubeReportProcessor } from './SonarQubeReportProcessor';
import { IPRCAService } from './IPRCAService';
import { PRCAService } from './PRCAService';

/**
 * Orchestrates the processing of SonarQube reports and posting issues to pull requests as comments
 *
 * @export
 * @class CodeAnalysisOrchestrator
 */
export class PullRequestCodeAnalysisOrchestrator {

    private logger:ILogger;
    private sqReportProcessor:ISonarQubeReportProcessor;
    private prcaService:IPRCAService;

    constructor(logger:ILogger, sqReportProcessor:ISonarQubeReportProcessor, prcaService:IPRCAService) {
        if (logger == null || logger == undefined) {
            throw new ReferenceError('logger');
        }
        if (sqReportProcessor == null || sqReportProcessor == undefined) {
            throw new ReferenceError('sqReportProcessor');
        }
        if (prcaService == null || prcaService == undefined) {
            throw new ReferenceError('prcaService');
        }

        this.logger = logger;
        this.sqReportProcessor = sqReportProcessor;
        this.prcaService = prcaService;
    }

    /**
     * Fetches messages from the SonarQube report, filters and sorts them, then posts them to the pull request.
     */
    postSonarQubeIssuesToPullRequest():void {
        var sqReportPath = process.env['SQ_REPORT_PATH'];
        this.logger.LogDebug(`SonarQube report path: ${sqReportPath}`);
        if (sqReportPath == undefined || sqReportPath == null) {
            throw new Error("SQ_REPORT_PATH env var was not set.");
        }

        var allMessages:Message[] = this.sqReportProcessor.FetchCommentsFromReport(sqReportPath);
        var messagesToPost:Message[] = null;
        this.prcaService.getModifiedFilesInPr()
            .then((filesChanged: string[]) => {
                this.logger.LogDebug(`${filesChanged.length} changed files in the PR.`);

                messagesToPost = allMessages
                    // Filter by message relating to files that were changed in this PR only
                    .filter(
                    (message:Message) => {
                        // If message.file is contained in filesChanged
                        return (filesChanged.indexOf(message.file) > -1);
                    }
                )
                    // Sort messages (Message.compare implements sorting by descending priority)
                    .sort(Message.compare)
                    // Truncate to the first 100 to reduce perf and experience impact of being flooded with messages
                    .slice(0, 100);
                this.logger.LogDebug(`${allMessages.length} messages were found.`);
                this.logger.LogDebug(`${messagesToPost.length} messages to post.`);
            })
            .then(() => {
                // Delete previous messages
                return this.prcaService.deleteCodeAnalysisComments();
            })
            .then(() => {
                // Create new messages
                return this.prcaService.createCodeAnalysisThreads(messagesToPost);
            })
    }

}