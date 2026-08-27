/**
 * @fileoverview Shared utilities for creating rule meta information
 * @author eslint-plugin-code-complete
 */
/**
 * Creates standardized rule meta information
 * @param {string} ruleName - The name of the rule
 * @param {RuleMetaOptions} options - Meta options
 * @returns {Rule.RuleMetaData} - Standardized rule meta data
 */
export function createRuleMeta(ruleName, options) {
    return {
        type: 'suggestion',
        docs: {
            description: options.description,
            category: options.category || 'Best Practices',
            recommended: options.recommended !== false, // Default to true
            url: `https://github.com/aryelukashevski/eslint-plugin-code-complete/blob/main/docs/rules/${ruleName}.md`
        },
        fixable: options.fixable,
        schema: options.schema || [],
        messages: options.messages
    };
}
/**
 * Common rule categories
 */
export const RULE_CATEGORIES = {
    BEST_PRACTICES: 'Best Practices',
    STYLISTIC: 'Stylistic Issues',
    POSSIBLE_ERRORS: 'Possible Errors'
};
