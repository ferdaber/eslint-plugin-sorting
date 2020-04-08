/**
 * Gets the maximum range of text locations in an array of nodes
 * @param {import('babel-types').Node[]} nodes
 * @returns {[number, number]}
 */
function getSpanningRange(nodes) {
  return [nodes[0].range[0], nodes[nodes.length - 1].range[1]]
}

/**
 * @param {import('eslint').SourceCode} source
 * @param {import('babel-types').Node} node
 */
function getCommentedText(source, node) {
  const comments = source.getCommentsBefore(node)
  const range = comments.length
    ? getSpanningRange([comments[0], node])
    : getSpanningRange([node, node])
  return source.getText().slice(range[0], range[1])
}

/**
 * @param {import('eslint').SourceCode} source
 * @param {import('babel-types').Node} nodeA
 * @param {import('babel-types').Node | undefined} nodeB
 */
function getTextBetweenCommentedNodes(source, nodeA, nodeB) {
  if (!nodeB) {
    return ''
  }
  const commentsBeforeNodeB = source.getCommentsBefore(nodeB)
  const nextNode = commentsBeforeNodeB.length ? commentsBeforeNodeB[0] : nodeB
  return source.getText().slice(nodeA.range[1], nextNode.range[0])
}

/**
 * Create a comparison function for use in Array.prototype.sort
 * @param {(item: any) => string | number} sortFunction
 */
function getSorter(sortFunction) {
  return (a, b) => {
    const aName = sortFunction(a)
    const bName = sortFunction(b)
    if (aName === Infinity || bName === -Infinity) {
      return 1
    } else if (bName === Infinity || aName === -Infinity) {
      return -1
    }
    return aName === bName ? 0 : aName < bName ? -1 : 1
  }
}

/**
 * @param {import('babel-types').Expression} node
 * @returns {string}
 */
function getExpressionSortName(node) {
  if (!node) {
    return ''
  }
  switch (node.type) {
    case 'Identifier':
      return node.name
    case 'Literal':
    case 'BooleanLiteral':
    case 'StringLiteral':
    case 'NumericLiteral':
      return String(node.value)
    case 'TemplateLiteral':
      return node.quasis.reduce(
        (text, quasi, idx) => text + quasi.value.raw + getExpressionSortName(node.expressions[idx]),
        ''
      )
    default:
      return ''
  }
}

module.exports = {
  getSpanningRange,
  getCommentedText,
  getTextBetweenCommentedNodes,
  getSorter,
  getExpressionSortName
}
