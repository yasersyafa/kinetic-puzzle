const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const zlib = require('zlib');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const analyze = !!env?.analyze;
  const VALID_TARGETS = ['itch', 'poki', 'crazygames', 'gamedistribution', 'playgama', 'discord'];
  const requested = env?.target;
  // Dev mode: default to 'itch' (no SDK script loaded, no Poki/CG init) for clean localhost.
  // Production: default to 'platform' (runtime hostname detection between Poki/CG).
  const defaultTarget = isProduction ? 'platform' : 'itch';
  const buildTarget = VALID_TARGETS.includes(requested) ? requested : defaultTarget;

  const plugins = [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      inject: 'body',
      templateParameters: {
        BUILD_TARGET: buildTarget,
      },
      minify: isProduction
        ? {
            collapseWhitespace: true,
            removeComments: true,
            minifyCSS: true,
            minifyJS: true,
          }
        : false,
    }),
    new webpack.DefinePlugin({
      __BUILD_TARGET__: JSON.stringify(buildTarget),
      __DEV__: JSON.stringify(!isProduction),
      'process.env.VITE_DISCORD_CLIENT_ID': JSON.stringify(
        process.env.VITE_DISCORD_CLIENT_ID || ''
      ),
    }),
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'marketing/TemplateData/logo.png'),
          to: path.resolve(__dirname, 'dist/logo.png'),
        },
        {
          from: path.resolve(__dirname, 'src/assets/fonts'),
          to: path.resolve(__dirname, 'dist/fonts'),
        },
        ...(buildTarget === 'playgama'
          ? [
              {
                from: path.resolve(__dirname, 'playgama-bridge-config.json'),
                to: path.resolve(__dirname, 'dist/playgama-bridge-config.json'),
              },
            ]
          : []),
      ],
    }),
  ];

  // Non-discord builds: ignore the Discord SDK module so resolution doesn't fail
  // when the package isn't installed and to keep it out of other bundles.
  if (buildTarget !== 'discord') {
    plugins.push(
      new webpack.IgnorePlugin({ resourceRegExp: /^@discord\/embedded-app-sdk$/ })
    );
  }

  if (isProduction) {
    plugins.push(
      new CompressionPlugin({
        filename: '[path][base].br',
        algorithm: 'brotliCompress',
        test: /\.(js|css|html|svg|json)$/,
        compressionOptions: {
          params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
        },
        threshold: 1024,
        minRatio: 0.9,
      }),
      new CompressionPlugin({
        filename: '[path][base].gz',
        algorithm: 'gzip',
        test: /\.(js|css|html|svg|json)$/,
        threshold: 1024,
        minRatio: 0.9,
      })
    );
  }

  if (analyze) {
    plugins.push(new BundleAnalyzerPlugin({ openAnalyzer: false, analyzerMode: 'static' }));
  }

  return {
    entry: './src/main.ts',
    output: {
      filename: isProduction ? 'game.[contenthash:8].js' : 'game.js',
      path: path.resolve(__dirname, 'dist'),
      publicPath: '',
      clean: true,
    },
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    plugins,
    optimization: isProduction
      ? {
          minimize: true,
          minimizer: [
            new TerserPlugin({
              extractComments: false,
              terserOptions: {
                compress: {
                  drop_console: false,
                  passes: 2,
                },
                format: { comments: false },
              },
            }),
          ],
          splitChunks: {
            chunks: 'all',
            cacheGroups: {
              phaser: {
                test: /[\\/]node_modules[\\/]phaser[\\/]/,
                name: 'phaser',
                chunks: 'all',
                priority: 10,
              },
              vendor: {
                test: /[\\/]node_modules[\\/]/,
                name: 'vendor',
                chunks: 'all',
                priority: 5,
              },
            },
          },
        }
      : { minimize: false },
    devServer: {
      static: path.resolve(__dirname, 'dist'),
      port: 3000,
      hot: true,
      compress: true,
      open: false,
      host: '0.0.0.0',
    },
    devtool: isProduction ? false : 'source-map',
    performance: {
      hints: false,
    },
  };
};
