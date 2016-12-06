
import tl = require('vsts-task-lib/task');
import * as web from 'vso-node-api/WebApi';
import { WebApi } from 'vso-node-api/WebApi';

import { ILogger } from './ILogger';
import { Message } from './Message';
import { ISonarQubeReportProcessor } from './ISonarQubeReportProcessor';
import { SonarQubeReportProcessor } from './SonarQubeReportProcessor';
import { IPrcaService } from './IPrcaService';
import { PrcaService } from './PrcaService';

/**
 * PRCA (Pull Request Code Analysis) Orchestrator
 * Orchestrates the processing of SonarQube reports and posting issues to pull requests as comments
 *
 * @export
 * @class CodeAnalysisOrchestrator
 */
export class PrcaOrchestrator {

    private sqReportProcessor: ISonarQubeReportProcessor;
    private prcaService: IPrcaService;
    private logger: ILogger;
    private messageLimit: number = 100;

    /**
     * This constructor gives full control of the ISonarQubeReportProcessor and IPrcaService.
     * If such control isn't required, see the static method PrcaOrchestrator.CreateOrchestrator() below.
     * 
     * @param logger Platform-independent logging
     * @param sqReportProcessor Parses report files into Message objects
     * @param prcaService Handles interaction with the serverside
     * @param messageLimit (Optional) A limit to the number of messages posted for performance and experience reasons.
     */
    constructor(logger: ILogger, sqReportProcessor: ISonarQubeReportProcessor, prcaService: IPrcaService, messageLimit?: number) {
        if (!logger) {
            throw new ReferenceError('logger');
        }
        if (!sqReportProcessor) {
            throw new ReferenceError('sqReportProcessor');
        }
        if (!prcaService) {
            throw new ReferenceError('PrcaService');
        }

        this.logger = logger;
        this.sqReportProcessor = sqReportProcessor;
        this.prcaService = prcaService;

        if (messageLimit != null && messageLimit !== undefined) {
            this.messageLimit = messageLimit;
        }
    }

    /**
     * This static constructor is intended for general-use creation of PrcaOrchestrator instances.
     * @param logger Platform-independent logging
     * @param collectionUrl The URL of the server
     * @param token Authentication token
     * @param repositoryId Internal ID of the repository
     * @param pullRequestId Internal ID of the pull request
     * @returns {PrcaOrchestrator}
     */
    public static Create(
        logger: ILogger,
        collectionUrl: string,
        bearerToken: string,
        repositoryId: string,
        pullRequestId: number,
        messageLimit: number): PrcaOrchestrator {

        if (collectionUrl == null) {
            throw new ReferenceError('collectionUrl');
        }
        if (bearerToken == null) {
            throw new ReferenceError('token');
        }

        let creds = web.getBearerHandler(bearerToken);
        var connection = new WebApi(collectionUrl, creds);

        let prcaService: IPrcaService = new PrcaService(logger, connection.getGitApi(), repositoryId, pullRequestId);
        let reportProcessor: ISonarQubeReportProcessor = new SonarQubeReportProcessor(logger);
        return new PrcaOrchestrator(logger, reportProcessor, prcaService, messageLimit);
    }

    /**
     * An upper limit on the number of messages that will be posted to the pull request.
     * The first n messages by priority will be posted.
     *
     * @returns {number}
     */
    public getMessageLimit(): number {
        return this.messageLimit;
    }

    /**
     * Fetches messages from the SonarQube report, filters and sorts them, then posts them to the pull request.
     *
     * @param sqReportPath
     * @returns {Promise<void>}
     */
    public postSonarQubeIssuesToPullRequest(sqReportPath: string): Promise<void> {
        this.logger.LogDebug(`[PRCA] SonarQube report path: ${sqReportPath}`);
        if (sqReportPath === undefined || sqReportPath === null) {
            // Looks like: "Make sure a Maven or Gradle ran before this step and SonarQube was enabled."
            return Promise.reject(tl.loc('Error_NoReportPathFound'));
        }

        var allMessages: Message[] = this.sqReportProcessor.FetchCommentsFromReport(sqReportPath);
        var messagesToPost: Message[] = null;
        return Promise.resolve()
            .then(() => {
                // Delete previous messages
                return this.prcaService.deleteCodeAnalysisComments()
                    .catch((error) => {
                        this.logger.LogDebug(`[PRCA] Failed to delete previous PRCA comments. Reason: ${error}`);
                        // Looks like: "Failed to delete previous PRCA comments."
                        return Promise.reject(tl.loc('Info_ResultFail_FailedToDeleteOldComments'));
                    });
            })
            .then(() => {
                return this.prcaService.getModifiedFilesInPr()
                    .catch((error) => {
                        this.logger.LogDebug(`[PRCA] Failed to get the files modified by the pull request. Reason: ${error}`);
                        // Looks like: "Failed to get the files modified by the pull request."
                        return Promise.reject(tl.loc('Info_ResultFail_FailedToGetModifiedFiles'));
                    });
            })
            .then((filesChanged: string[]) => {
                this.logger.LogDebug(`[PRCA] ${filesChanged.length} changed files in the PR: ${filesChanged}`);
                this.logger.LogDebug(`[PRCA] ${allMessages.length} messages exist before filtering: ${allMessages}`);

                messagesToPost = this.filterMessages(filesChanged, allMessages);
            })
            .then(() => {
                // Create new messages
                this.logger.LogDebug(`[PRCA] ${messagesToPost.length} messages are to be posted.`);
                return this.prcaService.createCodeAnalysisThreads(messagesToPost)
                    .catch((error) => {
                        this.logger.LogDebug(`[PRCA] Failed to post new PRCA comments. Reason: ${error}`);
                        // Looks like: "Failed to post new PRCA comments."
                        return Promise.reject(tl.loc('Info_ResultFail_FailedToPostNewComments'));
                    });
            });
    }

    /* Helper methods */

    private filterMessages(filesChangedInPr: string[], allMessages: Message[]): Message[] {
        let result: Message[];

        // Filter by message relating to files that were changed in this PR only
        result = allMessages.filter(
            (message: Message) => {
                // If message.file is in filesChanged
                for (let fileChangedInPr of filesChangedInPr) {

                    // case-insensitive normalising file path comparison
                    if (fileChangedInPr.toLowerCase().endsWith(message.file.toLowerCase())) {
                        return true;
                    }
                    // if (path.relative(fileChanged, message.file) === '') {
                    //     return true;
                    // }
                }
                return false;
            });
        this.logger.LogDebug(`[PRCA] ${result.length} messages are for files changed in this PR. ${allMessages.length - result.length} messages are not.`);

        // Sort messages (Message.compare implements sorting by descending priority)
        result = result.sort(Message.compare);

        // Truncate to the first 100 to reduce perf and experience impact of being flooded with messages
        if (result.length > this.messageLimit) {
            this.logger.LogDebug(`[PRCA] The number of messages posted is limited to ${this.messageLimit}. ${result.length - this.messageLimit} messages will not be posted.`);
        }
        result = result.slice(0, this.messageLimit);

        return result;
    }

}