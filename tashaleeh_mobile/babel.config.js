module.exports = function (api) {
  api.cache(true);
  const plugins = [];
  // إزالة كل استدعاءات console.* في بناء الإنتاج فقط (تبقى أثناء التطوير)
  const isProd = process.env.NODE_ENV === 'production' || process.env.BABEL_ENV === 'production';
  if (isProd) {
    plugins.push('transform-remove-console');
  }
  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
