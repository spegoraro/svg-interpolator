/*
 * SVG Interpolator
 * Takes an SVG as input and generates an array of evently spaced points marking
 * the boundary and fill of the paths.
 * 
 * Copyright (C) 2016 Tutive Ltd.
 */

var webpack		          = require('webpack'),
    path		            = require('path'),
    HTMLWebpackPlugin	  = require('html-webpack-plugin');

module.exports = {
  entry: {
    'svg-interp': './index',
    demo: './demo/demo'
  },
  output: {
    path: path.resolve('./build'),
    filename: '[name].js'
  },
  module: {
    loaders: [
      {test: /\.js$/, loader: 'babel', query: {presets: ['es2015']}},
      {test: /\.svg$/, loader: 'svgcmd-loader'}
    ]
  },
  resolve: {
    root: [
      path.resolve('./'),
      path.resolve('./src')
    ]
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin(),
    new HTMLWebpackPlugin({
      template: './demo/index.html',
      inject: false
    })
  ],
  devtool: 'source-map',
  devServer: {
    contentBase: path.resolve('./build')
  }
};
