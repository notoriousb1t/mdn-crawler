import * as fs from 'fs';
import * as path from 'path';
import * as jsdom from 'jsdom';

import { urls } from './urls';

type UrlSummary = {
    url: string;
    summary: string;
};

/**
 * thread sleep more or less
 */
function sleep<T>(time: number, onComplete?: () => T): Promise<T> {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                if (typeof onComplete === 'function') {
                    onComplete && resolve(onComplete());
                } else {
                    resolve();
                }
            } catch (ex) {
                reject(ex);
            }
        }, time);
    });
}

async function getAllSummaries(urls: string[]) {
    const segmentSize = 5;
    const interval = 100;

    const tasks: Promise<UrlSummary>[] = [];
    for (let i = 0; i < urls.length; i += segmentSize) {
        console.log(`fetching records: ${i} - ${Math.min(i + segmentSize, urls.length - 1)}`);

        for (let j = i; j < i + segmentSize && j < urls.length; j++) {
            const url = urls[j];
            console.log(`fetching ${url}`);
            tasks.push(fetchSummary(url));
        }
        await sleep(interval);
    }
    return await Promise.all(tasks);
}

async function fetchSummary(url: string): Promise<UrlSummary> {
    let summary: string;

    try { 
        const result = await jsdom.JSDOM.fromURL(url);
        const summaryElement = result.window.document.querySelector('#wikiArticle p:first-of-type');

        if (summaryElement) {
            summary = summaryElement.textContent;
        } else {
            summary = ''
        }
    }
    catch (ex) {
        summary = '(no descriptions)'
    }

    return { url, summary };
}

(async () => {
    console.log('starting');

    try {
        const summaries = await getAllSummaries(urls); 
        const summaryObject = summaries.reduce((c, n) => { 
            c[n.url] = n.summary;
            return c;
        }, {})

        const fileContents = JSON.stringify(summaryObject, undefined, 4);
        fs.writeFileSync('./summaries.json', fileContents, { encoding: 'utf-8' });
    } catch (ex) {
        console.error(ex.toString()); 
    }
    
    console.log('ended');
    process.exit();
})();

