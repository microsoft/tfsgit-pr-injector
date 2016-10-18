import {Message} from './Message';


/**
 * High level interaction with the VSTS server that allows the PRCA (pull request code analysis)
 * 
 * @export
 * @interface IVstsServerInteraction
 */
export interface IPRCAService {

    /**
     * Creates a comment and attaches it to a new thread for each input message. 
     * The comments are marked so that they can be later retrieved.
     * The threads are always created on the *latest* iteration of the PR.
     * 
     * @param {Message[]} messages
     * 
     * @memberOf IPRCAService
     */
    createCodeAnalysisThreads(messages: Message[]): void;

    /**
     * Deletes comments that were created by this service.
     * Remark: users can add other comments to a PRCA thread, this method only deletes the original comments
     * 
     * @memberOf IPRCAService
     */
    deleteCodeAnalysisComments(): void;


    /**
     * Gets a list of files that were modified in the PR.
     * 
     * @returns {string[]}
     * 
     * @memberOf IPRCAService
     */
    getModifiedFilesInPr(): string[];
}
