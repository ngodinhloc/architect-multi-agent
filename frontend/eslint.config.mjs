import nextConfig from 'eslint-config-next';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

const eslintConfig = [...nextConfig, eslintPluginPrettierRecommended];

export default eslintConfig;
