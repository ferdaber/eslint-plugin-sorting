/**
 * See https://eslint.org/docs/developer-guide/working-with-rules on how to work with custom rules
 * Sorts imports of a module into something like the following example:
 *  import 'side-effects-only'
 *
 *  import PropTypes from 'prop-types'
 *  import React from 'react'
 *  import { Router } from 'react-router'
 *
 *  import App from './my-app-wrapper'
 *  import * as routes from 'my-app-routes'
 *
 *  import Icon from 'react-icons/md/icon.svg'
 *  import SomeImage from '../images.png'
 */

const {
  getSorter,
  getCommentedText,
  getTextBetweenCommentedNodes,
  getSpanningRange,
} = require('./utils')

const DECL_PRIORITIES = {
  SideEffect: 0,
  External: 1,
  Internal: 3,
  StaticAsset: 4,
}

const DECL_TYPE_NAMES = ['side effect', 'external package', 'internal', 'static asset']

/**
 * Gets the sortable name of an import declaration by using its specifiers
 * @param {import('babel-types').ImportDeclaration} node
 */
function getImportDeclarationSortName(node) {
  // side-effectful imports have no bindings, so just use their source
  if (isImportSideEffect(node)) {
    return node.source.value
  }
  // default and namespace specifiers always come before destructured specifiers
  if (
    node.specifiers[0].type === 'ImportDefaultSpecifier' ||
    node.specifiers[0].type === 'ImportNamespaceSpecifier'
  ) {
    return getImportSpecifierSortName(node.specifiers[0])
  }
  // import { Button, AnchorButton } from 'buttons' -> 'AnchorButton'
  return node.specifiers.reduce(
    (sortName, spec) =>
      spec.type === 'ImportSpecifier'
        ? sortName == null ||
          getImportSpecifierSortName(spec).toLowerCase() < sortName.toLowerCase()
          ? getImportSpecifierSortName(spec)
          : sortName
        : sortName,
    null
  )
}

/**
 * Gets the sortable name of an import specifier based on its type
 * @param {import('babel-types').ImportDeclaration['specifiers'][number]} node
 */
function getImportSpecifierSortName(node) {
  switch (node.type) {
    // import React from 'react' -> 'React'
    case 'ImportDefaultSpecifier':
    // import * as React from 'react' -> 'React'
    case 'ImportNamespaceSpecifier':
      return node.local.name
    // import { Button } from 'buttons' -> 'Button'
    case 'ImportSpecifier':
      return node.imported.name
  }
}

/**
 * Gets the sort index of an import declaration
 * Order is based on {@link DECL_PRIORITIES}: side effects -> external -> internal -> static
 * @param {import('babel-types').ImportDeclaration} node
 */
function getImportDeclarationSortIdx(node) {
  const importSource = node.source.value.toLowerCase()
  if (isImportSideEffect(node)) {
    return DECL_PRIORITIES.SideEffect
  }
  if (/\.(svg|woff|woff2|tts|eot|bmp|jpe?g|gif|png|json|txt)$/.test(importSource)) {
    return DECL_PRIORITIES.StaticAsset
  }
  if (isImportExternal(node)) {
    return DECL_PRIORITIES.External
  } else {
    return DECL_PRIORITIES.Internal
  }
}

/**
 * Determines if an import is of form:
 * import 'side-effect-only'
 * @param {import('babel-types').ImportDeclaration} node
 */
function isImportSideEffect(node) {
  return !(node.specifiers && node.specifiers.length)
}

/**
 * Determines if an import points to a package in node_modules
 * @param {import('babel-types').ImportDeclaration} node
 */
function isImportExternal(node) {
  if (node.source.value.startsWith('.')) {
    return false
  }
  try {
    // attempting to resolve the module from this file location
    // leads to Node going into node_modules, if it finds a package
    // it means that the resolved module is in node_modules
    require.resolve(node.source.value)
    return true
  } catch (_) {
    return false
  }
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    docs: {
      category: 'ECMAScript 6',
      description: 'Enforce sorted import declarations within app modules',
      recommended: true,
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          declarationSort: {
            type: 'string',
            enum: ['source', 'import'],
          },
          fix: {
            type: 'boolean',
          },
        },
      },
    ],
  },
  create(context) {
    const options = context.options[0] || {}
    const { declarationSort = 'source', fix = false } = options
    return {
      /** @param {import('babel-types').Program} program */
      Program(program) {
        // return early if there's nothing to compare
        if (program.body.length < 2) {
          return
        }

        /** @type {import('babel-types').ImportDeclaration[]} */
        const declarationsWithUnsortedSpecifiers = []
        let fixable = true
        let lastUnsortedDeclaration

        /** @type {import('babel-types').ImportDeclaration[]} */
        const imports = program.body.reduce((imports, statement) => {
          // if we find non-import statements between import statements
          // don't try to autofix but still report errors
          if (statement.type === 'ImportDeclaration') {
            if (imports.length && imports.nonImportFound) {
              fixable = false
            }
            imports.push(statement)
          } else if (imports.length) {
            imports.nonImportFound = true
          }
          return imports
        }, [])

        // return early if there's nothing to compare
        if (imports.length < 2) return

        // for each import declaration, compare the current one with the previous
        // to determine if something is out of order
        imports.reduce((prevImport, curImport) => {
          const curDeclarationSortIdx = getImportDeclarationSortIdx(curImport)
          const prevDeclarationSortIdx = getImportDeclarationSortIdx(prevImport)
          // check if an import's "group" is out of order
          if (curDeclarationSortIdx < prevDeclarationSortIdx) {
            lastUnsortedDeclaration = curImport
            context.report({
              node: curImport,
              message: 'Expected {{a}} imports to be before {{b}} imports.',
              data: {
                a: DECL_TYPE_NAMES[curDeclarationSortIdx],
                b: DECL_TYPE_NAMES[prevDeclarationSortIdx],
              },
            })
          }
          // within the same group, check that their sortable names are in alphabetical order
          else if (curDeclarationSortIdx === prevDeclarationSortIdx) {
            if (declarationSort === 'import') {
              const curSortName = getImportDeclarationSortName(curImport)
              const prevSortName = getImportDeclarationSortName(prevImport)
              if (curSortName.toLowerCase() < prevSortName.toLowerCase()) {
                lastUnsortedDeclaration = curImport
                context.report({
                  node: curImport,
                  message:
                    "Expected '{{impA}}' from '{{decA}}' to be before '{{impB}}' from '{{decB}}'.",
                  data: {
                    impA: curSortName,
                    impB: prevSortName,
                    decA: curImport.source.value,
                    decB: prevImport.source.value,
                  },
                })
              }
            } else if (declarationSort === 'source') {
              const curSource = curImport.source.value
              const prevSource = prevImport.source.value
              if (curSource.toLowerCase() < prevSource.toLowerCase()) {
                lastUnsortedDeclaration = curImport
                context.report({
                  node: curImport,
                  message: "Expected imports from '{{a}}' to be before imports from '{{b}}'",
                  data: {
                    a: curSource,
                    b: prevSource,
                  },
                })
              }
            } else {
              throw new Error('Unexpected sort strategy')
            }
          }
          // check the declaration's own import specifiers to see if they are in alphabetical order
          if (!isImportSideEffect(curImport)) {
            // only destructured import specifiers are sortable
            // since you can only have 1 default import or 1 namespace import
            const sortableSpecifiers = curImport.specifiers.filter(
              (s) => s.type === 'ImportSpecifier'
            )
            if (sortableSpecifiers.length >= 2) {
              let isSorted = true
              sortableSpecifiers.reduce((prevSpec, curSpec) => {
                if (isSorted) {
                  const curSortName = getImportSpecifierSortName(curSpec)
                  const prevSortName = getImportSpecifierSortName(prevSpec)
                  if (curSortName.toLowerCase() < prevSortName.toLowerCase()) {
                    isSorted = false
                    lastUnsortedDeclaration = curImport
                    // track declarations with unsorted specifiers to autofix later
                    fixable && declarationsWithUnsortedSpecifiers.push(curImport)
                    context.report({
                      node: curSpec,
                      message: "Expected '{{a}}' to be before '{{b}}'",
                      data: {
                        a: curSortName,
                        b: prevSortName,
                      },
                    })
                  }
                }
                return curSpec
              })
            }
          }
          return curImport
        })
        // fix everything all at once to prevent inefficient sorting
        // otherwise autofix will have to be potentially run many times
        // so report one error message along with a single fix
        if (lastUnsortedDeclaration && fix && fixable) {
          context.report({
            node: lastUnsortedDeclaration,
            message: 'Expected imports to be sorted.',
            fix(fixer) {
              const source = context.getSourceCode()
              if (declarationsWithUnsortedSpecifiers.length) {
                // if we have declarations whose specifiers are out of order
                // only attempt to autofix just those before reordering the declarations
                return declarationsWithUnsortedSpecifiers.map((imp) => {
                  const specifiers = imp.specifiers.filter(
                    (spec) => spec.type === 'ImportSpecifier'
                  )
                  // replace the span of text between all import specifiers with the reordered specifiers
                  return fixer.replaceTextRange(
                    getSpanningRange(specifiers),
                    specifiers
                      .slice()
                      .sort(getSorter((node) => getImportSpecifierSortName(node).toLowerCase()))
                      .reduce((textBefore, newSpec, idx) => {
                        // group specifiers along with the comments that come before them
                        // we cannot determine if the comment before the first specifier is actually associated
                        // with that node (there may be whitespace in between), so ignore that one
                        const text =
                          newSpec !== specifiers[0]
                            ? getCommentedText(source, newSpec)
                            : source.getText(newSpec)

                        // preserve and re-add in all text between the original import specifiers (prior to sorting)
                        const textAfter = getTextBetweenCommentedNodes(
                          source,
                          specifiers[idx],
                          specifiers[idx + 1]
                        )

                        return textBefore + text + textAfter
                      }, '')
                  )
                })
              }
              let prevGroup
              // reorder all import declarations (one line per declaration, with space in between each group)
              return fixer.replaceTextRange(
                getSpanningRange(imports),
                imports
                  .slice()
                  .sort(
                    getSorter(
                      declarationSort === 'import'
                        ? (node) =>
                            getImportDeclarationSortIdx(node) +
                            getImportDeclarationSortName(node).toLowerCase()
                        : declarationSort === 'source'
                        ? (node) =>
                            getImportDeclarationSortIdx(node) + node.source.value.toLowerCase()
                        : () => {
                            throw new Error('Unexpected sort strategy')
                          }
                    )
                  )
                  .reduce((textBefore, newImport, idx) => {
                    // if the group changes, it means that there needs to be a blank line before this next declaration
                    const currentGroup = getImportDeclarationSortIdx(newImport)
                    const groupSeparator =
                      prevGroup != null && prevGroup !== currentGroup ? '\n' : ''
                    prevGroup = currentGroup
                    // like import specifiers, import declarations are grouped with their comments
                    // and ignore comments before the first import declaration since it is impossible
                    // to determine if it's actually associated with that node
                    const text =
                      newImport !== imports[0]
                        ? getCommentedText(source, newImport)
                        : source.getText(newImport)

                    // each declaration goes in its own line so add a new line before adding a new declaration
                    const textAfter = idx < imports.length - 1 ? '\n' : ''

                    return textBefore + groupSeparator + text + textAfter
                  }, '')
              )
            },
          })
        }
      },
    }
  },
}
module.exports = rule
