/// <reference path="../../typings/index.d.ts" />

import * as fs from 'fs';
import * as path from 'path';

import * as gitInterfaces from 'vso-node-api/interfaces/GitInterfaces';
import { GitPullRequestCommentThread, Comment } from 'vso-node-api/interfaces/GitInterfaces';

import { ILogger } from '../module/ILogger';
import { IVstsServerInteraction } from '../module/VstsServerInteraction';


export class MockVstsServerInteraction implements IVstsServerInteraction {

    public logger: ILogger;

    constructor(logger: ILogger) {
        if (!logger) {
            throw new ReferenceError('logger');
        }

        this.logger = logger;
    }

    /* Helper methods */

    private readData(): Object {
        // file may not exist
        var filePath: string = path.join(__dirname, 'mockServer.json');
        if (!fs.existsSync(filePath)) {
            return null;
        }

        var fileData: Object = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return fileData;
    }

    private writeData(fileData: Object): void {
        var filePath: string = path.join(__dirname, 'mockServer.json');
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
            pullRequestThreadContext: fakePrCommentContext
        };

        return fakeThread;
    }

    /* Interface methods */

    public getThreads():GitPullRequestCommentThread[] {
        var savedData: any = this.readData(); 
        if (savedData == null || savedData == undefined) {
            return new Array<GitPullRequestCommentThread>();
        }

        return savedData.Threads;
    }

    createThread(line:number): GitPullRequestCommentThread {
        // Initialise a faked thread, filling in appropriate fields
        var newThread = this.createFakeCommentThread();
        newThread.threadContext.rightFileStart.line = line;
        newThread.threadContext.rightFileEnd.line = line;

        // Save to file
        var dataToSave: any = this.readData();
        dataToSave.Threads.push(newThread);
        this.writeData(dataToSave);

        return newThread;
    }

    postCommentInThread(threadId:number, commentText:string):GitPullRequestCommentThread {
        var threads:GitPullRequestCommentThread[] = this.getThreads();
        // Filter down to the thread we want
        var matchingThreads = threads.filter(
            (currentCommentThread: GitPullRequestCommentThread) => {
            return currentCommentThread.id == threadId;
        });

        if (matchingThreads.length != 1) {
            throw new Error(`Expected to find 1 thread with ID ${threadId}. Actual: ${matchingThreads.length}`);
        }

        var modifiedThread: GitPullRequestCommentThread = matchingThreads[0];
        var indexOfThread: number = threads.indexOf(modifiedThread);

        var newComment: Comment = <Comment>{
            _links: null,
            author: null,
            commentType: gitInterfaces.CommentType.Text,
            content: commentText, // Comment text goes here
            id: Number.MIN_VALUE,
            isDeleted: false,
            lastUpdatedDate: new Date(),
            publishedDate: new Date(),
            usersLiked: [],
        }
        modifiedThread.comments.push(newComment);

        threads[indexOfThread] = modifiedThread;

        // Save to file
        var dataToSave: any = this.readData();
        dataToSave.Threads = threads;
        this.writeData(dataToSave);

        return modifiedThread;
    }

    deleteComment(threadId:number, commentId:number):void {
        var threads:GitPullRequestCommentThread[] = this.getThreads();
        // Filter the complete list of threads, keeping only those whose id != threadId
        var remainingThreads:GitPullRequestCommentThread[] = threads.filter(
            (currentCommentThread: GitPullRequestCommentThread) => {
            return currentCommentThread.id != threadId;
        });

        // We expected to make a change
        if (threads.length == remainingThreads.length) {
            throw new Error(`Did not find any threads with ID ${threadId}`);
        }

        // Save to file
        var dataToSave: any = this.readData();
        dataToSave.Threads = threads;
        this.writeData(dataToSave);        
    }

}