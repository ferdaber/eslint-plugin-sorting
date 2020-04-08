const {
  getSorter,
  getCommentedText,
  getTextBetweenCommentedNodes,
  getSpanningRange,
  getExpressionSortName
} = require('./utils')

/**
 * @param {import('babel-types').ObjectExpression} node '
 * @returns {import('babel-types').ObjectExpression['properties'][]}
 */
function getDefinedPropSpansOfObjectExpression(node) {
  let propSpan = []
  return node.properties.reduce((propSpans, prop, idx) => {
    if (prop.type === 'SpreadProperty' || prop.type === 'ExperimentalSpreadProperty') {
      if (propSpan.length) {
        propSpans.push(propSpan)
        propSpan = []
      }
    } else {
      propSpan.push(prop)
    }
    if (propSpan.length && idx === node.properties.length - 1) {
      propSpans.push(propSpan)
    }
    return propSpans
  }, [])
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    docs: {
      category: 'ECMAScript 6',
      description: 'Enforce sorted object keys in object literals',
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
      /** @param {import('babel-types').ObjectExpression} node */
      ObjectExpression(node) {
        if (node.properties.length < 2) return
        // object properties are unsafe to reorganize generally
        // since it can affect runtime, but object spreads are even more so
        // we divide the object properties into contiguous spans of
        // non-spread properties, and just reorder those regions
        getDefinedPropSpansOfObjectExpression(node).forEach(span => {
          if (span.length < 2) return
          let lastUnsortedProperty
          span.reduce((prevProp, curProp) => {
            const curName = getExpressionSortName(curProp.key)
            const prevName = getExpressionSortName(prevProp.key)
            if (curName.toLowerCase() < prevName.toLowerCase()) {
              lastUnsortedProperty = curProp
              context.report({
                node: curProp,
                message: "Expected '{{a}}' to be before '{{b}}'.",
                data: {
                  a: curName,
                  b: prevName
                }
              })
            }
            return curProp
          })
          if (lastUnsortedProperty && fix) {
            context.report({
              node: lastUnsortedProperty,
              message: 'Expected object properties to be sorted.',
              fix(fixer) {
                const source = context.getSourceCode()
                return fixer.replaceTextRange(
                  getSpanningRange(span),
                  span
                    .slice()
                    .sort(getSorter(prop => getExpressionSortName(prop.key).toLowerCase()))
                    .reduce((textBefore, newProp, idx) => {
                      const text =
                        newProp !== node.properties[0]
                          ? getCommentedText(source, newProp)
                          : source.getText(newProp)
                      const textAfter = getTextBetweenCommentedNodes(
                        source,
                        span[idx],
                        span[idx + 1]
                      )
                      return textBefore + text + textAfter
                    }, '')
                )
              }
            })
          }
        })
      }
    }
  }
}
module.exports = rule
