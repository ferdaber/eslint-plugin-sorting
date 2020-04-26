# ESLint plugin for sorting

My own ESLint plugin containing custom lint rules for our code.

# Installation

#### NPM

```
npm install -D @ferdaber/eslint-plugin-sorting
```

#### Yarn

```
yarn add -D @ferdaber/eslint-plugin-sorting
```

In your `.eslintrc` file, add the following:

```
{
  "plugins": ["@ferdaber/sorting"],
  "rules": {
    "@ferdaber/sorting/rule-name": "error"
  }
}
```

# Rules

## `sort-imports` 🔧

Enforces all import declarations to be sorted in the following order:

1. Side effect imports
2. External imports
3. Internal imports
4. Static asset imports

Enforces all import specifiers to be sorted alphabetically, as well.

### Options

The rule accepts an object with its properties as:

- `declarationSort` (default: `'import'`): `'import' | 'source'`
- `fix` (default: `false`): `boolean`

Default option settings are:

```json
{
  "@ferdaber/sorting/sort-imports": [
    "error",
    {
      "declarationSort": "import",
      "fix": false
    }
  ]
}
```

### Example

Example of **incorrect** code for this rule:

```js
import MySvg from './svgs/my-svg.svg'
import React from 'react'
```

```js
import { moduleB, moduleC } from 'my-module'
```

Example of **correct** code for this rule:

```js
import 'side-effects-only'

import PropTypes from 'prop-types'
import React from 'react'
import { Router } from 'react-router'

import App from './my-app-wrapper'
import * as routes from 'my-app-routes'

import Icon from 'react-icons/md/icon.svg'
import SomeImage from '../images.png'
```

#### `declarationSort`

Changes the sorting strategy for import declarations based on their source (`'source'`) vs. on their imported names (`'import'`).

Example of **incorrect** code for this rule with the default `{ "declarationSort": "source" }` option:

```js
import module1 from 'module-b'
import module2 from 'module-a'
```

Example of **correct** code for this rule with the default `{ "declarationSort": "source" }` option:

```js
import module2 from 'module-a'
import module1 from 'module-b'
```

Example of **incorrect** code for this rule with the `{ "declarationSort": "import" }` option:

```js
import moduleB from 'module-a'
import * as moduleD from 'module-d'
import moduleA, { moduleC } from 'module-c'
```

Example of **correct** code for this rule with the `{ "declarationSort": "import" }` option:

```js
import moduleA, { moduleC } from 'module-c'
import moduleB from 'module-a'
import * as moduleD from 'module-d'
```

## `sort-object-keys` 🔧

Enforces all object literal keys to be in alphabetical order.

### Options

The rule accepts an object with its properties as:

- `fix` (default: `false`): `boolean`

Default option settings are:

```json
{
  "@ferdaber/sorting/sort-object-keys": [
    "error",
    {
      "fix": false
    }
  ]
}
```

### Example

Example of **incorrect** code for this rule:

```js
const a = 'a'

const foo = {
  b: 'b',
  a,
}
```

```js
const A = 'a'
const B = 'b'

const foo = {
  [`${B}A`]: 'ba',
  [B]: b,
  [A]: a,
}
```

Example of **correct** code for this rule:

```js
const A = 'a'
const B = 'b'

const foo = {
  a: 'a',
  A,
  [B]: b,
  [`${B}A`]: 'ba',
}
```

## `sort-pattern-keys` 🔧

Enforces all object destructuring patterns to have alphabetical keys.

### Options

The rule accepts an object with its properties as:

- `fix` (default: `false`): `boolean`

Default option settings are:

```json
{
  "@ferdaber/sorting/sort-pattern-keys": [
    "error",
    {
      "fix": false
    }
  ]
}
```

### Example

Example of **incorrect** code for this rule:

```js
const Component = ({ hidden, className }) => null
```

```js
const { hidden, className = '' } = this.props
```

Example of **correct** code for this rule:

```js
const Component = ({ className, hidden = false }) => null
```
