/** @type {import('next').NextConfig} */
module.exports = {
  webpack: (config, { webpack }) => {
    // pptxgenjs imports Node-only modules via "node:" URLs. Strip the prefix...
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
        resource.request = resource.request.replace(/^node:/, "");
      })
    );
    // ...and tell the browser bundle those modules are not needed.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      https: false,
      path: false,
      os: false,
    };
    return config;
  },
};