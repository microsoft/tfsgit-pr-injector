/// <reference path="../../typings/index.d.ts" />

import * as web from 'vso-node-api/WebApi';
import { WebApi } from 'vso-node-api/WebApi';

import { IGitApi } from 'vso-node-api/GitApi';
import * as gitInterfaces from 'vso-node-api/interfaces/GitInterfaces';
import { GitPullRequestCommentThread, Comment, GitPullRequestCommentThreadContext } from 'vso-node-api/interfaces/GitInterfaces';

import { ILogger } from './ILogger';

export interface IVstsServerInteraction {
    getThreads(): Promise<GitPullRequestCommentThread[]>;

    createThread(line:number): Promise<GitPullRequestCommentThread>;

    postCommentInThread(threadId: number, commentText: string): Promise<GitPullRequestCommentThread>;

    deleteComment(threadId: number, commentId: number): Promise<GitPullRequestCommentThread>;
}

export class VstsServerInteraction /*implements IVstsServerInteraction*/ {

    private logger: ILogger;

    constructor(logger: ILogger) {
        if (!logger) {
            throw new ReferenceError('logger');
        }

        this.logger = logger;
    }

}