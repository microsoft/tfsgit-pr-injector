/// <reference path="../../typings/index.d.ts" />

import * as web from 'vso-node-api/WebApi';
import { WebApi } from 'vso-node-api/WebApi';
import { IGitApi } from 'vso-node-api/GitApi';
import * as gitInterfaces from 'vso-node-api/interfaces/GitInterfaces';
import { GitPullRequestCommentThread, Comment, GitPullRequestCommentThreadContext } from 'vso-node-api/interfaces/GitInterfaces';

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
export class PRCAService /*implements IPRCAService*/ {

    private logger: ILogger;

    constructor(logger: ILogger) {
        if (!logger) {
            throw new ReferenceError('logger');
        }

        this.logger = logger;
    }


    public createCodeAnalysisThreads(messages: Message[]): void {
        if (messages == null || messages == undefined) {
            throw new ReferenceError('messages');
        }

        throw new Error('Not implemented');
    }



    public deleteCodeAnalysisComments(): void {
        throw new Error('Not implemented');
    }



    public getModifiedFilesInPr(): string[] {
        throw new Error('Not implemented');
    }
}