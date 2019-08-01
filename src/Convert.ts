import { lex } from "./Lexer/Lexer";
import { TokenType } from "./Lexer/Token";

type ReplaceFunc = (match: string, ...args: string[]) => string;

function check(searchValue: string | RegExp, strOrFunc: string | ReplaceFunc) {
    return (match: string, ...args: string[]) => {
        if (match.split('\n').length > 1)
            console.error('Warning: Large match\nSearch Value: ' + searchValue + '\n' + match);

        if (typeof strOrFunc === 'string')
            return strOrFunc;
        else if (typeof strOrFunc === 'function')
            return strOrFunc(match, ...args);
        return '';
    };
}

function replace(text: string, searchValue: string | RegExp, replaceValue: string | ReplaceFunc): string {
    return text.replace(searchValue, check(searchValue, replaceValue));
}

const forEachRegex = /^\s*for each\s*\(\s*(var )?([\w\d]+)\s*(?::\s*[\w\d*]+)? in/;
const declareRegex = /^\s*(?:override\s+)?(public|protected|private|internal)\s+(static\s+)?(?:override\s+)?(function|var|class|const)/;

const replacePairs: [RegExp, string][] = [
    [/:\s*Function/g, ': () => void'],
    [/:\s*Boolean/g, ': boolean'],
    [/:\s*Number/g, ': number'],
    [/:\s*int/g, ': number'],
    [/:\s*String/g, ': string'],
    [/:\s*void/g, ': void'],
    [/:\s*Array/g, ': any[]'],
    [/Vector.</g, 'Vector<'],
    [/ is /g, ' instanceof '],
    [/:\*/g, ': any'],  // This one is dangerous
];

/**
 * Converts the text from AS3 to TS.
 * Removes 'package' and 'import'.
 * Converts types.
 * If file is loaded by "includes", convert all methods to functions.
 * @param text
 * @param isIncluded Was this file loaded by "includes"
 */
export function convert(text: string, isIncluded: boolean) {
    const lines = text.split('\n');

    let removeCurlyBraceOpen = 0;
    let removeCurlyBraceClose = 0;
    let index = 0;
    while (index < lines.length) {
        // Remove - package ...
        if (lines[index].trimLeft().startsWith('package')) {
            if (!lines[index].includes('{'))
                removeCurlyBraceOpen++;
            removeCurlyBraceClose++;
            lines.splice(index, 1);
            continue;
        }

        // Remove - if package ... then {
        if (removeCurlyBraceOpen > 0 && lines[index].trimLeft().startsWith('{')) {
            lines.splice(index, 1);
            removeCurlyBraceOpen--;
            continue;
        }

        // Remove - import ...
        if (lines[index].trimLeft().startsWith('import')) {
            lines.splice(index, 1);
            continue;
        }

        // Fix "for each"
        let match = lines[index].match(forEachRegex);
        if (match) {
            lines[index] =
                'for(' +
                (match[1] ? 'const ' : '') +
                match[2] +
                ' of' +
                lines[index].slice((match.index || 0) + match[0].length);
        }

        match = lines[index].match(declareRegex);
        if (match) {
            // if (match.length !== 3)
            //     console.log('Incorrect function declaraction match. Line: ' + index);

            // 1. public|protected|private|internal
            const accessModifier = match[1];
            // 2. static?
            const staticModifier = match[2] || '';
            // 3. function|var|class|const
            const type = match[3];

            const restOfLine = lines[index].slice((match.index || 0) + match[0].length);

            if (type === 'class') {
                if (accessModifier === 'public' || accessModifier === 'internal')
                    lines[index] = 'export ' + staticModifier + type + restOfLine;
                else
                    lines[index] = staticModifier + type + restOfLine;
            }
            else if (isIncluded) {
                if (type === 'function' || type === 'var' || type === 'const') {
                    if (accessModifier === 'internal' || accessModifier === 'public')
                        lines[index] = 'export ' + type + restOfLine;
                    else
                        lines[index] = type + restOfLine;
                }
            }
            else {
                if (type === 'function' || type === 'var' || type === 'const') {
                    if (accessModifier === 'internal')
                        lines[index] = 'public ' + staticModifier + restOfLine;
                    else
                        lines[index] = accessModifier + ' ' + staticModifier + restOfLine;
                }
            }
        }

        index++;
    }

    text = lines.join('\n');

    index = text.length - 1;
    while (removeCurlyBraceClose > 0) {
        if (text[index] === '}') {
            text = text.slice(0, index) + text.substr(index + 1);
            removeCurlyBraceClose--;
        }
        index--;
    }

    // Using this to filter out non code
    const tokens = lex(text);
    for (const token of tokens) {
        if (token.type === TokenType.Code) {
            for (const pair of replacePairs)
                token.text = replace(token.text, pair[0], pair[1]);
        }
    }

    // ts-morph has some weird error with removing nodes that have comments on the same line as a closing brace
    return tokens.reduce((str, token) => str + token.text, '');
    // return tokens.reduce((str, token) => str + token.text, '')
    //     .replace(/}[ \t]*\/\*/g, '}\n/*')
    //     .replace(/}[ \t]*\/\//g, '}\n//');
}