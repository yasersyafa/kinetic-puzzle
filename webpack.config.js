const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const zlib = require('zlib');
const fs = require('fs');
const { execFileSync } = require('child_process');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const analyze = !!env?.analyze;
  const stageSelection = path.resolve('generated/runs/stage-one/latest.json');
  if (!env?.campaign && !env?.legacy) {
    if (!fs.existsSync(stageSelection)) throw new Error('Stage 1 is not ready. Run bun run levels:stage:build first, or select --env legacy explicitly.');
    env = { ...env, campaign: JSON.parse(fs.readFileSync(stageSelection, 'utf8')).campaignPath };
  }
  if (env?.playtest && !env?.campaign) {
    throw new Error('Stage 1 is not ready. Run bun run levels:stage:build first.');
  }
  let campaign = null;
  if (env?.campaign) {
    const campaignPath = path.resolve(env.campaign);
    const generatedRoot = path.resolve('generated');
    const realCampaign = fs.realpathSync(campaignPath);
    if (!realCampaign.startsWith(fs.realpathSync(generatedRoot) + path.sep)) throw new Error('Campaign must be inside generated/');
    // Embed the exact snapshot proven by the verifier, including v2 audit integrity.
    const verified = JSON.parse(execFileSync(process.execPath,
      ['--import', 'tsx', path.resolve('tools/level-generator/verify-export.ts'), campaignPath],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], timeout: 600000, maxBuffer: 32 * 1024 * 1024 }));
    campaign = verified.campaign;
    if (!campaign || verified.verified !== campaign.levels.length) throw new Error('Campaign verification did not return a complete snapshot');
    if (campaign.levels.some(level => level.exits.length !== 1 || level.blocks.some(block => block.color !== ({ simple: 'red', constrained: 'yellow', dependent: 'blue', lock: 'purple', obstacle: 'red' }[block.type || 'simple'])))) throw new Error('Generated campaigns require one shared exit and semantic block colors on every level; regenerate historical multi-exit campaigns.');
  }
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
      __GENERATED_CAMPAIGN__: JSON.stringify(campaign),
      __TEST_HOOKS__: JSON.stringify(!!env?.testhooks),
      __TEST_HEADLESS__: JSON.stringify(!!env?.testhooks && !!env?.headless),
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
      open: env?.playtest ? { target: '/?playtest=1' } : false,
      host: '0.0.0.0',
    },
    devtool: isProduction ? false : 'source-map',
    performance: {
      hints: false,
    },
  };
};
