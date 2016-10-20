/// <reference path="../../typings/index.d.ts" />

import { IGitApi } from 'vso-node-api/GitApi';
import * as gitInterfaces from 'vso-node-api/interfaces/GitInterfaces';

import {Message} from './Message';
import { ILogger } from './ILogger';
import { IPRCAService} from './IPRCAService';

/**
 * PR Code Analysis service 
 * 
 * @export
 * @class PRCAService
 * @implements {IPRCAService}
 */
export class PRCAService implements IPRCAService {

    private latestIterationFetched = false;
    private latestIterationId: number = -1;
    public /* for test purposes */ static PRCACommentDescriptor: string = 'Microsoft.TeamFoundation.CodeAnalysis.PRCA';

    constructor(
        private logger: ILogger,
        private gitApi: IGitApi,
        private repositoryId: string,
        private prId: number) {

        // Uncomment these lines to have Fiddler capture local traffic
        // process.env.https_proxy = 'http://127.0.0.1:8888';
        // process.env.http_proxy = 'http://127.0.0.1:8888';
        // process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

        if (!logger) {
            throw new ReferenceError('logger');
        }

        if (!gitApi) {
            throw new ReferenceError('gitApi');
        }

        if (!repositoryId) {
            throw new ReferenceError('repositoryId');
        }

    }

    public async createCodeAnalysisThreads(messages: Message[]): Promise<void> {

        this.logger.LogDebug(`[PRCA] Creating thread objects from ${messages.length} messages`);

        if (!messages) {
            throw new ReferenceError('messages');
        }

        await this.fetchLatestIterationId();

        let threads: gitInterfaces.GitPullRequestCommentThread[] =
            messages.filter(m => this.validateMessage(m)).map(m => this.createThread(m));

        this.logger.LogDebug(`[PRCA] ${threads.length} threads will be created`);

        var startTime = new Date().getTime();
        let promises: Promise<gitInterfaces.GitPullRequestCommentThread>[] = [];
        threads.forEach(thread => {
            var promise = this.gitApi.createThread(thread, this.repositoryId, this.prId);
            promises.push(promise);
        });

        this.logger.LogDebug(`[PRCA] Waiting for ${promises.length} CreateThread requests to finish`);
        await Promise.all(promises);
        var endTime = new Date().getTime();

        this.logger.LogDebug(`[PRCA] It took ${endTime - startTime} ms to create the threads`);
    }

    public async deleteCodeAnalysisComments(): Promise<void> {

        this.logger.LogDebug('[PRCA] Deleting existing comments');

        await this.fetchLatestIterationId();

        this.logger.LogDebug('[PRCA] Fetching the existing threads');
        let threads = await this.gitApi.getThreads(this.repositoryId, this.prId, null, this.latestIterationId);

        let prcaThreads = threads.filter(th => {
            return !th.isDeleted && // a thread is marked as "deleted" if all its comments are deleted
                th.properties &&
                th.properties[PRCAService.PRCACommentDescriptor] &&
                th.properties[PRCAService.PRCACommentDescriptor].$value === 1;
        });

        this.logger.LogDebug(`[PRCA] Found ${threads.length} threads out of which ${prcaThreads.length} were created by PRCA`);

        var startTime = new Date().getTime();
        let deletePromises: Promise<void>[] = [];
        prcaThreads.forEach(thread => {
            var visibleComments = thread.comments.filter(c => !c.isDeleted);

            if (visibleComments.length > 0) {
                if (visibleComments.length > 1) {
                    this.logger.LogDebug(
                        `[PRCA] PRCA thread ${thread.id} has ${thread.comments.length} comments. User comments will be deleted!`);
                }

                visibleComments.forEach(c => {
                    let deletePromise = this.gitApi.deleteComment(this.repositoryId, this.prId, thread.id, c.id);
                    deletePromises.push(deletePromise);
                });

            } else {
                this.logger.LogDebug(`[PRCA] PRCA thread ${thread.id} has no comments`);
            }
        });

        await Promise.all(deletePromises);

        var endTime = new Date().getTime();
        this.logger.LogDebug(`[PRCA] It took ${endTime - startTime} ms to delete ${deletePromises.length} existing comments`);
    }

    public async getModifiedFilesInPr(): Promise<string[]> {

        this.logger.LogDebug('[PRCA] Getting the modified files for PR');
        await this.fetchLatestIterationId();

        this.logger.LogDebug(`[PRCA] Getting the modified files for PR iteration ${this.latestIterationId}`);

        let iterationChange =
            await this.gitApi.getPullRequestIterationChanges(this.repositoryId, this.prId, this.latestIterationId);

        return iterationChange.changeEntries.map(ce => ce.item.path);
    }


    private async fetchLatestIterationId(): Promise<void> {
        if (!this.latestIterationFetched) {
            this.logger.LogDebug('[PRCA] Querying GitPullRequestIteration');
            let iterations: gitInterfaces.GitPullRequestIteration[]
                = await this.gitApi.getPullRequestIterations(this.repositoryId, this.prId);

            this.latestIterationId = Math.max.apply(Math, iterations.map(i => i.id));
            this.latestIterationFetched = true;
            this.logger.LogDebug(`[PRCA] Latest iteration ID:  ${this.latestIterationId}`);
        }
    }

    private validateMessage(message: Message): boolean {

        if (!message) {
            this.logger.LogDebug('Invalid message ');
            return false;
        }

        if (!message.content) {
            this.logger.LogDebug('Empty message content: ' + message.toString());
            return false;
        }

        if (message.line < 1) {
            this.logger.LogDebug('Invalid message line: ' + message.toString());
            return false;
        }

        return true;
    }

    private createThread(message: Message): gitInterfaces.GitPullRequestCommentThread {

        let thread = {
            comments: this.createComment(message),
            isDeleted: false,
            properties: this.getPRCAProperty(),
            status: gitInterfaces.CommentThreadStatus.Active,
            threadContext: this.createThreadContext(message),
            pullRequestThreadContext: this.createCommentContext(message)
        } as gitInterfaces.GitPullRequestCommentThread;

        return thread;
    }

    private createCommentContext(message: Message): gitInterfaces.GitPullRequestCommentThreadContext {
        return {
            // let the server compute the changeTrackingId, which is used to reposition comments in future iterations
            changeTrackingId: 0,
            // create the comment as if looking at the current iteration compared to the first 
            iterationContext:
            {
                firstComparingIteration: 1,
                secondComparingIteration: this.latestIterationId
            },
            trackingCriteria: null
        };
    }

    private getPRCAProperty() {
        let properties: any = {};
        properties[PRCAService.PRCACommentDescriptor] = {
            type: 'System.Int32',
            value: 1
        };
        return properties;
    }

    private createThreadContext(message: Message): gitInterfaces.CommentThreadContext {

        return {
            filePath: message.file,
            // post comments only to the right pane
            leftFileEnd: null,
            leftFileStart: null,
            rightFileStart: {
                line: message.line,
                offset: 1
            },
            rightFileEnd: {
                line: message.line,
                offset: 1
            },
        };
    }

    private createComment(message: Message): gitInterfaces.Comment[] {
        let comment = {
            // PRCA messages apear as single comments
            parentCommentId: 0,
            content: message.content,
            commentType: gitInterfaces.CommentType.Text
        } as gitInterfaces.Comment;

        return [comment];
    }
}
