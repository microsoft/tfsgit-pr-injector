/// <reference path="../../typings/index.d.ts" />

import * as fs from 'fs';
import * as path from 'path';

import * as gitInterfaces from 'vso-node-api/interfaces/GitInterfaces';
import { GitPullRequestCommentThread, Comment } from 'vso-node-api/interfaces/GitInterfaces';

import { ILogger } from '../module/ILogger';
import { Message } from '../module/Message';
import { IPRCAService } from '../module/IPRCAService';

/**
 * Mock PRCAService for use in testing
 */
export class MockPrcaService implements IPRCAService {

    public logger: ILogger;

    constructor(logger: ILogger) {
        if (!logger) {
            throw new ReferenceError('logger');
        }

        this.logger = logger;
    }

    /* Interface methods */

    public createCodeAnalysisThreads(messages:Message[]):Promise<void> {
        var newThreads: GitPullRequestCommentThread[] = new Array<GitPullRequestCommentThread>();
        for (let message of messages) {
            // Initialise a faked thread, filling in appropriate fields
            var newThread: GitPullRequestCommentThread = this.createFakeCommentThread();
            newThread.threadContext.rightFileStart.line = message.line;
            newThread.threadContext.rightFileEnd.line = message.line;
            newThread.properties["isPRCAComment"] = true;

            // Initialise a faked comment, filling in appropriate fields
            var newComment: Comment = <Comment>{
                _links: null,
                author: null,
                commentType: gitInterfaces.CommentType.Text,
                content: message.content, // Comment text goes here
                id: Number.MIN_VALUE,
                isDeleted: false,
                lastUpdatedDate: new Date(),
                publishedDate: new Date(),
                usersLiked: [],
            }
            newThread.comments.push(newComment);

            newThreads.push(newThread);
        }

        // Save to file
        var dataToSave: any = this.readData();
        dataToSave.Threads = dataToSave.Threads.concat(newThreads);
        this.writeData(dataToSave);
        return Promise.resolve();
    }

    deleteCodeAnalysisComments():Promise<void> {
        var threads:GitPullRequestCommentThread[] = this.getThreads();
        // Filter the complete list of threads, keeping only those which do not have the isPRCAComment property
        var remainingThreads:GitPullRequestCommentThread[] = threads.filter(
            (currentCommentThread: GitPullRequestCommentThread) => {
            return !currentCommentThread.properties["isPRCAComment"];
        });

        this.logger.LogDebug(`Deleted ${threads.length - remainingThreads.length} comments.`)

        // Save to file
        var dataToSave: any = this.readData();
        dataToSave.Threads = remainingThreads;
        this.writeData(dataToSave);
        return Promise.resolve();
    }

    getModifiedFilesInPr():Promise<string[]> {
        var savedData: any = this.readData(); 
        if (savedData == null || savedData == undefined) {
            return Promise.resolve(new Array<string>());
        }

        return Promise.resolve(savedData.Files);
    }

    /* Test methods */

    public cleanUp():void {
        fs.unlinkSync(this.getDataPath());
    }

    public setModifiedFilesInPr(modifiedFiles: string[]): void {
        var dataToSave: any = this.readData();
        dataToSave.Files = modifiedFiles;
        this.writeData(dataToSave);
    }

    public getThreads():GitPullRequestCommentThread[] {
        var savedData: any = this.readData(); 
        if (savedData == null || savedData == undefined) {
            return new Array<GitPullRequestCommentThread>();
        }

        return savedData.Threads;
    }

    /* Helper methods */

    private getDataPath(): string {
        return path.join(__dirname, 'mockServer.json');
    }

    private readData(): Object {
        // file may not exist
        var filePath:string = this.getDataPath();
        if (!fs.existsSync(filePath)) {
            return {
                Threads: [],
                Files: []
            };
        }

        var fileData: Object = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return fileData;
    }

    private writeData(fileData: Object): void {
        var filePath:string = this.getDataPath();
        fs.writeFileSync(filePath, JSON.stringify(fileData));
    }

    private createFakeCommentThread(): GitPullRequestCommentThread {
        var fakeCommentContext = <gitInterfaces.CommentThreadContext>{
            filePath: "/src/test/java/TestProgramTest.java",
            leftFileEnd: null,
            leftFileStart: null,
            rightFileEnd: {
                line: 1,
                offset: 1
            },
            rightFileStart: {
                line: 1,
                offset: 1
            }
        }
        var fakePrCommentContext = <gitInterfaces.GitPullRequestCommentThreadContext>{
            changeTrackingId: 1,
            iterationContext: {
                firstComparingIteration: 1,
                secondComparingIteration: 1
            },
            trackingCriteria: {
                firstComparingIteration: 1,
                secondComparingIteration: 1
            }
        }

        var fakeThread:GitPullRequestCommentThread = <GitPullRequestCommentThread>{
            _links: null,
            comments: new Array<Comment>(),
            id: Number.MIN_VALUE,
            lastUpdatedDate: new Date(),
            properties: {},
            publishedDate: new Date(),
            status: gitInterfaces.CommentThreadStatus.Active,
            threadContext: fakeCommentContext,
            pullRequestThreadContext: fakePrCommentContext
        };

        return fakeThread;
    }

}