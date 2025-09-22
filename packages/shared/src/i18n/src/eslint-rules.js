/**
 * ESLint rules to prevent hardcoded strings (avoid RestaurentPOS trap)
 * Add these to your .eslintrc.js to enforce i18n usage
 */

module.exports = {
  rules: {
    // Prevent hardcoded strings in Vue templates
    'vue/no-bare-strings-in-template': [
      'error',
      {
        allowlist: [
          // Allow single characters and numbers
          /^[0-9\s\-\+\*\/\(\)\[\]]+$/,
          // Allow common symbols
          ':', '|', '—', '–', '•', '→', '←', '↑', '↓',
          // Allow debugging/development strings
          'TODO', 'FIXME', 'DEBUG',
          // Allow empty strings
          ''
        ],
        attributes: {
          // Allow certain attributes to have literal strings
          '/.+/': ['title', 'aria-label', 'aria-labelledby', 'aria-describedby'],
          'router-link': ['to'],
          'nuxt-link': ['to']
        },
        directives: ['v-text', 'v-html']
      }
    ],

    // Custom rule: Ensure all text uses $t() function
    'require-i18n-translation': {
      create(context) {
        return {
          // Check for hardcoded strings in JavaScript/TypeScript
          Literal(node) {
            if (
              typeof node.value === 'string' &&
              node.value.trim() &&
              !isAllowedString(node.value) &&
              !isInI18nContext(node)
            ) {
              context.report({
                node,
                message: `Hardcoded string "${node.value}" should use $t() for internationalization`
              })
            }
          },

          // Check for template literals
          TemplateLiteral(node) {
            node.quasis.forEach(quasi => {
              if (
                quasi.value.raw.trim() &&
                !isAllowedString(quasi.value.raw) &&
                !isInI18nContext(node)
              ) {
                context.report({
                  node: quasi,
                  message: `Template literal "${quasi.value.raw}" should use $t() for internationalization`
                })
              }
            })
          }
        }

        function isAllowedString(str) {
          return (
            // Numbers and symbols only
            /^[0-9\s\-\+\*\/\(\)\[\]:.]+$/.test(str) ||
            // Single characters
            str.length === 1 ||
            // URLs
            str.startsWith('http') ||
            // File paths
            str.includes('/') && !str.includes(' ') ||
            // CSS classes
            str.includes('-') && !str.includes(' ') ||
            // Development strings
            ['TODO', 'FIXME', 'DEBUG'].includes(str.toUpperCase())
          )
        }

        function isInI18nContext(node) {
          // Check if we're already in a $t() call or i18n configuration
          let parent = node.parent
          while (parent) {
            if (
              parent.type === 'CallExpression' &&
              parent.callee &&
              (parent.callee.name === '$t' || parent.callee.property?.name === 't')
            ) {
              return true
            }
            parent = parent.parent
          }
          return false
        }
      }
    }
  },

  // Configuration preset for MakanMakan projects
  configs: {
    'makanmakan-i18n': {
      plugins: ['vue'],
      rules: {
        'vue/no-bare-strings-in-template': [
          'error',
          {
            allowlist: [
              /^[0-9\s\-\+\*\/\(\)\[\]]+$/,
              ':', '|', '—', '–', '•', '→', '←', '↑', '↓'
            ]
          }
        ],
        'require-i18n-translation': 'error'
      }
    }
  }
}