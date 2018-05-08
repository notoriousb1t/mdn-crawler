import * as fs from 'fs';
import * as path from 'path';
import * as jsdom from 'jsdom';

const TurndownService = require('turndown')
const turndownService = new TurndownService()

// change anchors to plain text so we don't end up with a bunch of relative anchors
turndownService.addRule('anchor', {
    filter: 'a',
    replacement: (content) => content
})

const summaries: Record<string, string> = require('./summaries.json');

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
    const segmentSize = 6;
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
    let summary = '';

    try {
        const result = await jsdom.JSDOM.fromURL(url);
        const summaryElement = result.window.document.querySelector('#wikiArticle > p:not(:empty)');
        if (summaryElement) {
            summary = turndownService.turndown(summaryElement.innerHTML);
        }
    } catch (ex) {
        summary = '(no description)';
    }

    return { url, summary };
}

(async () => {
    console.log('starting');

    try {
        const missingSummaries = Object.keys(summaries).filter(s => !summaries[s]);
        const foundSummaries = await getAllSummaries(missingSummaries);

        for (let n of foundSummaries) {
            summaries[n.url] = n.summary;
        }

        const fileContents = JSON.stringify(summaries, undefined, 4);
        fs.writeFileSync('./summaries.json', fileContents, { encoding: 'utf-8' });
    } catch (ex) {
        console.error(ex.toString());
    }

    console.log('ended');
    process.exit();
})();
