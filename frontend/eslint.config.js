import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    // 仅启用 react-hooks 经典规则：7.x 的 recommended 预设还包含面向 React Compiler 的规则，
    // 会标记现有代码的 useEffect 数据加载模式，修复需重构业务逻辑，超出本任务范围
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
)