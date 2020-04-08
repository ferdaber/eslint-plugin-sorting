const {
  getSorter,
  getCommentedText,
  getTextBetweenCommentedNodes,
  getSpanningRange,
  getExpressionSortName
} = require('./utils')

function isRestElement(node) {
  return (
    node.type === 'RestProperty' ||
    node.type === 'ExperimentalRestProperty' ||
    node.type === 'RestElement'
  )
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    docs: {
      category: 'ECMAScript 6',
      description: 'Enforce sorted keys in object destructuring patterns',
      recommended: true
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          fix: {
            type: 'boolean'
          }
        }
      }
    ]
  },
  create(context) {
    const options = context.options[0] || {}
    const { fix = false } = options
    return {
      /** @param {import('babel-types').ObjectPattern} node */
      ObjectPattern(node) {
        if (node.properties < 2) return
        let isSorted = true
        node.properties.reduce((prevProp, curProp) => {
          if (isRestElement(curProp)) return curProp
          const curName = getExpressionSortName(curProp.key)
          const prevName = getExpressionSortName(prevProp.key)
          if (isRestElement(prevProp)) {
            isSorted = false
            context.report({
              node: prevProp,
              message: 'Expected rest element to be the last property.'
            })
          } else if (curName.toLowerCase() < prevName.toLowerCase()) {
            isSorted = false
            context.report({
              node: curProp,
              message: "Expected '{{a}}' to be before '{{b}}'",
              data: {
                a: curName,
                b: prevName
              }
            })
          }
          return curProp
        })
        if (!isSorted && fix) {
          context.report({
            node: node,
            message: 'Expected object properties to be sorted.',
            fix(fixer) {
              const source = context.getSourceCode()
              const props = node.properties
              return fixer.replaceTextRange(
                getSpanningRange(props),
                props
                  .slice()
                  .sort(
                    getSorter(
                      prop =>
                        isRestElement(prop)
                          ? Infinity
                          : getExpressionSortName(prop.key).toLowerCase()
                    )
                  )
                  .reduce((textBefore, newProp, idx) => {
                    const text =
                      newProp !== props[0]
                        ? getCommentedText(source, newProp)
                        : source.getText(newProp)
                    const textAfter = getTextBetweenCommentedNodes(
                      source,
                      props[idx],
                      props[idx + 1]
                    )
                    return textBefore + text + textAfter
                  }, '')
              )
            }
          })
        }
      }
    }
  }
}
module.exports = rule
