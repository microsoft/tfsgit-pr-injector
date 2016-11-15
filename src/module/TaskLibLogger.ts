import tl = require('vsts-task-lib/task');
import { ILogger } from './PRCA/ILogger';

/**
 * The task specific logger
 * 
 * @export
 * @class TaskLibLogger
 * @implements {ILogger}
 */
export class TaskLibLogger implements ILogger {

    public LogWarning(message: string): void {
        tl.warning(message);
    }

    public LogInfo(message: string): void {
        console.log(message);
    }

    public LogDebug(message: string): void {
        tl.debug(message);
    }

}