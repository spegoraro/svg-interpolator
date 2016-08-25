/*
 * SVG Interpolator
 * Takes an SVG as input and generates an array of evently spaced points marking
 * the boundary and fill of the paths.
 *
 * Copyright (C) 2016 Tutive Ltd.
 *
 * Demo application
 * Parses the Tutive logo and draws it as a bunch of dots.
 */

import Viewport from 'viewport';
import PointGenerator from 'point-generator';
import logo from './SVG Logo.svg';

document.addEventListener('DOMContentLoaded', () => {
  let canvas = document.getElementById('demo-canvas');
  let viewport = new Viewport(canvas);

  // Parse the logo and scale them down
  let pgen = new PointGenerator(1000, 10),
    pts = pgen
    .generate(logo)
    .fillWithPoints(15, 32)
    .scale(1.0)
    .points;

  // TODO: Remove, for dev only
  viewport.draw = (ctx) => {
    ctx.beginPath();
    for (let pt of pts) {
      ctx.moveTo(pt.x, pt.y);
      ctx.arc(pt.x, pt.y, 2, 0, 2 * Math.PI);
    }
    ctx.fillStyle = '#aaa';
    ctx.fill();
  };
  viewport.start();
});
