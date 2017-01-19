/// <reference path="../../../typings/index.d.ts" />

import * as fs from 'fs';
import * as path from 'path';

import { PRInjectorError } from './PRInjectorError';
import { Message } from './Message';
import { ILogger } from './ILogger';
import { ISonarQubeReportProcessor } from './ISonarQubeReportProcessor';


/**
 * Responsible for parsing the SQ file containg the issues and the paths
 * 
 * @export
 * @class SonarQubeReportProcessor
 * @implements {ISonarQubeReportProcessor}
 */

enum Priority {
    blocker = 1,
    critical,
    major,
    minor,
    info,
    none
}

export class SonarQubeReportProcessor implements ISonarQubeReportProcessor {

    private logger: ILogger;

    constructor(logger: ILogger) {
        if (!logger) {
            throw new ReferenceError('logger');
        }

        this.logger = logger;
    }

    /* Interface methods */

    public FetchCommentsFromReport(reportPath: string): Message[] {

        if (!reportPath) {
            throw new ReferenceError('reportPath');
        }

        try {
            fs.accessSync(reportPath, fs.F_OK);
        } catch (e) {
            throw new PRInjectorError('Could not find ' + reportPath + ' - did the SonarQube analysis complete?');
        }

        let sqReportContent: string = fs.readFileSync(reportPath, 'utf8');
        var sonarQubeReport: any;

        try {
            sonarQubeReport = JSON.parse(sqReportContent);
        } catch (e) {
            throw new PRInjectorError('Could not parse the SonarQube report file. The error is: ' + e.message);
        }

        let componentMap = this.buildComponentMap(sonarQubeReport);
        return this.buildMessages(sonarQubeReport, componentMap);
    }

    /* Helper methods */

    private buildComponentMap(sonarQubeReport: any): Map<string, string> {
        let map: Map<string, string> = new Map();

        if (!sonarQubeReport.components) {
            this.logger.LogInfo('The SonarQube report is empty as it lists no components');
            return map;
        }

        for (var component of sonarQubeReport.components) {
            if (!component.key) {
                throw new PRInjectorError('Invalid SonarQube report - some components do not have keys');
            }

            if (component.path != null) {
                let fullPath: string = component.path;

                if (component.moduleKey != null) { // if the component belongs to a module, we need to prepend the module path
                    // #TODO: Support nested modules once the SonarQube report correctly lists moduleKey in nested modules
                    var buildModule: any = this.getObjectWithKey(sonarQubeReport.components, component.moduleKey);
                    if (buildModule.path != null) { // some modules do not list a path
                        fullPath = path.join(buildModule.path, component.path);
                    }
                }

                map.set(component.key, '/' + fullPath); // the PR file paths have a leading separator
            }
        }

        this.logger.LogDebug(`The SonarQube report contains ${map.size} components with paths`);

        return map;
    }

    private buildMessages(sonarQubeReport: any, componentMap: Map<string, string>): Message[] {

        let messages: Message[] = [];

        // no components, i.e. empty report
        if (componentMap.size === 0) {
            return messages;
        }

        if (!sonarQubeReport.issues) {
            this.logger.LogInfo('The SonarQube report is empty as there are no issues');
            return messages;
        }

        let issueCount: number = sonarQubeReport.issues.length;
        let newIssues = sonarQubeReport.issues.filter((issue: any) => {
            return issue.isNew === true;
        });

        this.logger.LogInfo(`The SonarQube report contains ${issueCount} issues, out of which ${newIssues.length} are new.`);

        for (var issue of newIssues) {
            let issueComponent = issue.component;

            if (!issueComponent) {
                throw new PRInjectorError(`Invalid SonarQube report - an issue does not have the component attribute. Content ${issue.content}`);
            }

            let filePath: string = componentMap.get(issueComponent);
            filePath = this.normalizeIssuePath(filePath);

            if (!filePath) {
                throw new PRInjectorError(`Invalid SonarQube report - an issue belongs to an invalid component. Content ${issue.content}`);
            }

            let message: Message = this.buildMessage(filePath, issue);

            if (message) {
                messages.push(message);
            }

        }

        return messages;
    }

    /**
     * SQ for Maven / Gradle seem to produce inconsistent paths  
     */
    private normalizeIssuePath(filePath: string) {

        if (!filePath) {
            return;
        }

        filePath = filePath.replace(/\\/g, '/');

        if (!filePath.startsWith('/')) {
            filePath = '/' + filePath;
        }

        return filePath;
    }

    // todo: filter out assembly level issues ?
    private buildMessage(path: string, issue: any): Message {
        let priority: number = this.getPriority(issue);
        let content: string = this.buildMessageContent(issue.message, issue.rule, priority);

        if (!issue.line) {
            this.logger.LogWarning(
                    `A SonarQube issue does not have an associated line and will be ignored. File ${path}. Content ${content}`);
            return null;
        }

        let line: number = issue.line;

        if (line < 1) {
            this.logger.LogWarning(
                    `A SonarQube issue was reported on line ${line} and will be ignored. File ${path}. Content ${content}`);
            return null;
        }

        let message: Message = new Message(content, path, line, priority);
        return message;
    }

    private buildMessageContent(message: string, rule: string, priority: number): string {
        let content: string = '';

        if (priority < Priority.none) {
            let severity: string = this.getSeverityDisplayName(priority);
            content = `**_${severity}_**: `;
        }

        content += `${message} (${rule})`;

        return content;
    }

    private getSeverityDisplayName(priority: Number): string {
        switch (priority) {
            case Priority.blocker:
                return Priority[Priority.blocker];
            case Priority.critical:
                return Priority[Priority.critical];
            case Priority.major:
                return Priority[Priority.major];
            case Priority.minor:
                return Priority[Priority.minor];
            case Priority.info:
                return Priority[Priority.info];
            default:
                return Priority[Priority.none];
        }
    }

    private getPriority(issue: any) {

        let severity: string = issue.severity;
        if (!severity) {
            this.logger.LogDebug(`Issue ${issue.content} does not have a priority associated` );
            severity = 'none';
        }

        switch (severity.toLowerCase()) {
            case 'blocker':
                return Priority.blocker;
            case 'critical':
                return Priority.critical;
            case 'major':
                return Priority.major;
            case 'minor':
                return Priority.minor;
            case 'info':
                return Priority.info;
            default:
                return Priority.none;
        }
    }

    /**
     * Finds and returns the first object with the given key from a given section of the SonarQube report.
     * @param sonarQubeReportSection
     * @param searchKey
     * @returns {any} Null if object not found, otherwise the first object with a "key" field matching searchKey.
     */
    private getObjectWithKey(sonarQubeReportSection: any, searchKey: string): any {

        if (!sonarQubeReportSection) {
            return null;
        }

        for (var component of sonarQubeReportSection) {
            if (!component.key) {
                throw new PRInjectorError('Invalid SonarQube report - some components do not have keys');
            }

            if (component.key === searchKey) {
                return component;
            }
        }
    }
}