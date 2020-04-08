const sortImports = require('./sort-imports')
const sortObjectKeys = require('./sort-object-keys')
const sortPatternKeys = require('./sort-pattern-keys')

/** @type {{ rules: Record<string, import('eslint').Rule.RuleModule> }} */
const plugin = {
  rules: {
    'sort-imports': sortImports,
    'sort-object-keys': sortObjectKeys,
    'sort-pattern-keys': sortPatternKeys
  }
}

module.exports = plugin
