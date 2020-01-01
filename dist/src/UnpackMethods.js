"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
function unpackMethods(node, ignoreList) {
    let changes = [];
    for (const statement of node.statements) {
        if (ts.isClassDeclaration(statement)) {
            changes = changes.concat(memberSearch(statement, ignoreList));
        }
    }
    return changes;
}
exports.unpackMethods = unpackMethods;
function memberSearch(node, ignoreList) {
    const changes = [];
    const postChanges = [];
    // Fix methods
    for (const member of node.members) {
        let change;
        if (ts.isMethodDeclaration(member)) {
            change = memberChanges(member, ignoreList, 'function');
        }
        else if (ts.isPropertyDeclaration(member)) {
            change = memberChanges(member, ignoreList, 'let');
        }
        // else if (ts.isGetAccessorDeclaration(member)) {
        //     change = memberChanges(member, ignoreList, '/* >?get */ function');
        // }
        // else if (ts.isSetAccessorDeclaration(member)) {
        //     change = memberChanges(member, ignoreList, '/* >?set */ function');
        // }
        if (change && change.length > 0) {
            changes.push(change[0]);
            postChanges.push(change[1]);
        }
        // changes = changes.concat(getMethodChanges(member, className, implementsNames, config));
    }
    return changes.concat(postChanges);
}
function memberChanges(node, ignoreList, type) {
    // Convert method to function
    if (!~ignoreList.indexOf(node.name.getText())) {
        const methodStart = node.getStart();
        const leadingTriviaStart = methodStart - node.getLeadingTriviaWidth();
        const sourceFileText = node.getSourceFile().getFullText();
        const methodText = node.getText();
        const leadingTrivia = sourceFileText.slice(leadingTriviaStart, methodStart);
        // console.log('lead ', leadingTrivia);
        let newText = methodText;
        let newPreText = '';
        if (node.modifiers) {
            for (const modifier of node.modifiers) {
                if (modifier.kind === ts.SyntaxKind.PublicKeyword) {
                    newPreText += 'export ';
                }
            }
            if (node.modifiers.length > 0)
                newText = methodText.slice(node.modifiers[node.modifiers.length - 1].getEnd() - methodStart);
        }
        newText = leadingTrivia + newPreText + type + newText;
        return [
            // Remove method
            {
                span: {
                    start: node.getFullStart(),
                    length: node.getFullWidth()
                },
                newText: ''
            },
            // Insert function at bottom
            {
                span: {
                    start: node.getSourceFile().getEnd(),
                    length: 0
                },
                newText
            }
        ];
    }
    // No changes
    return [];
}
