/// <reference path="../../../typings/index.d.ts" />

import { Message } from '../../module/prca/Message';
import { IPrcaService } from '../../module/prca/IPrcaService';

/**
 * Mock PrcaService for use in testing
 */
export class MockPrcaService implements IPrcaService {

    public prSavedMessages: Message[] = [];
    public prModifiedFiles: string[] = [];

    public createCodeAnalysisThreads_shouldFail = false;
    public deleteCodeAnalysisComments_shouldFail = false;
    public getModifiedFilesInPr_shouldFail = false;

    /* Interface methods */

    public createCodeAnalysisThreads(messages: Message[]): Promise<void> {
        if (this.createCodeAnalysisThreads_shouldFail) {
            return Promise.reject(new Error('mock failure when creating code analysis threads'));
        }

        this.prSavedMessages = this.prSavedMessages.concat(messages);
        return Promise.resolve();
    }

    public deleteCodeAnalysisComments(): Promise<void> {
        if (this.deleteCodeAnalysisComments_shouldFail) {
            return Promise.reject(new Error('mock failure when deleting code analysis threads'));
        }

        this.prSavedMessages = [];
        return Promise.resolve();
    }

    public getModifiedFilesInPr(): Promise<string[]> {
        let shouldFail = this.getModifiedFilesInPr_shouldFail;
        let modifiedFiles = this.prModifiedFiles;
        return new Promise((resolve, reject) => {
            if (shouldFail) {
                reject(new Error('mock failure when getting modified files in the PR'));
            } else {
                resolve(modifiedFiles);
            }
        });
    }

    /* Test methods */

    public setModifiedFilesInPr(modifiedFiles: string[]): void {
        this.prModifiedFiles = modifiedFiles;
    }

    public getSavedMessages(): Message[] {
        return this.prSavedMessages;
    }

}