/**
 * @fileoverview ESLint plugin with rules for writing complete, maintainable code
 * @author eslint-plugin-code-complete
 */
import * as rules from './rules/index.js';
export default {
    rules: {
        'no-boolean-params': rules.noBooleanParams,
        'enforce-meaningful-names': rules.enforceMeaningfulNames,
        'no-late-argument-usage': rules.noLateArgumentUsage,
        'no-complex-conditionals': rules.noComplexConditionals,
        'max-nesting-depth': rules.maxNestingDepth,
        'high-parameter-coupling': rules.highParameterCoupling,
        'high-import-coupling': rules.highImportCoupling,
        'max-function-length': rules.maxFunctionLength,
        'prefer-early-return': rules.preferEarlyReturn
    }
};
// Export rules for direct import
export { rules };
