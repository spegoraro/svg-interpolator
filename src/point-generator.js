/*
 * SVG Interpolator
 * Takes an SVG as input and generates an array of evently spaced points marking
 * the boundary and fill of the paths.
 *
 * Copyright (C) 2016 Tutive Ltd.
 *
 * Point Generator
 * Takes a set of SVG path commands and turns them into an array of evenly-
 * spaced points.
 */

import {
  pointsForLine,
  pointsForBezier,
  pointsForArc
} from './paths';

import Delaunay from 'delaunay-fast';


class PointGenerator {

  // Create a new PointGenerator with the given resolution and segment length.
  // Generated points will be at a minimum `length` apart. Resolution improves
  // the accuracy at the expense of computation time.
  constructor(resolution, length) {
    this.res = resolution;
    this.len = length;
    this.points = [];
    this.center = {
      x: 0,
      y: 0
    };
  }


  // Scales all points in or out by `amt`.
  scale(amt) {
    this.points.forEach(p => {
      p.x *= amt;
      p.y *= amt;
    });
    return this;
  }


  // Shifts all points by the amounts specified.
  translate(x, y) {
    this.center.x += x;
    this.center.y += y;
    this.points.forEach(p => {
      p.x += x;
      p.y += y;
    });
    return this;
  }


  // Returns all points on the line from `start` to `end` separated by at least
  // the length provided on construction.
  line(start, end) {
    return pointsForLine(start, end, this.len);
  }


  // Returns all of the points on the elliptical arc specified. This uses SVG
  // arc specification and will ensure that the points returned will be at least
  // as far apart as provided on construction.
  arc(start, end, rad, rot, lrg, swp) {
    return pointsForArc(start, rad, rot, lrg, swp, end, this.res, this.len);
  }


  // Returns all of the points on the cubic bezier curve specified. It will
  // ensure that all of the points are at least `this.len` apart.
  curve(start, end, cp1, cp2) {
    return pointsForBezier(start, cp1, cp2, end, this.res, this.len);
  }


  // Returns the current bounding box for the whole object.
  bbox() {
    const first = this.points[0];
    let xmin = first.x,
      xmax = first.x,
      ymin = first.y,
      ymax = first.y;
    this.points.forEach(p => {
      xmin = (p.x < xmin) ? p.x : xmin;
      xmax = (p.x > xmax) ? p.x : xmax;
      ymin = (p.y < ymin) ? p.y : ymin;
      ymax = (p.y > ymax) ? p.y : ymax;
    });
    return {
      x: xmin,
      y: ymin,
      width: xmax - xmin,
      height: ymax - ymin
    };
  }


  // Shift all points so the center of mass is at 0,0
  recenter() {
    const bbox = this.bbox();
    const xshift = bbox.x + (bbox.width / 2);
    const yshift = bbox.y + (bbox.height / 2);
    this.points.forEach(p => {
      p.x -= xshift;
      p.y -= yshift;
    });
    return this;
  }


  // Quick distance calculation ignoring the square root for performance.
  qdist(p1, p2) {
    return Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2);
  }


  // Returns a new array without points that were too close together from
  // `points`. Optionally specify a tolerance to allow more points in.
  clean(points, tolerance = 0) {
    // Compute the square here so we don't have to square root for the distance
    // between points on every pass.
    let minDist = Math.pow(this.len - tolerance, 2);

    // First make an array of all pairs of points that are too close together.
    let pairs = [];
    points.forEach((p1, idx1) => points.forEach((p2, idx2) => {
      if (idx1 !== idx2 && this.qdist(p1, p2) < minDist)
        pairs.push({
          p1: idx1,
          p2: idx2
        });
    }));

    // Remove any duplicates, we only want to remove one point for each pair.
    pairs = pairs.reduce((p, c) => {
      return (p.includes(c.p1) || p.includes(c.p2)) ? p : p.concat(c.p2);
    }, []);

    // Remove those points from the array.
    return points.filter((p, idx) => !pairs.includes(idx));
  }


  // Returns a list of lines corresponding to the edges of triangles that would
  // tile to fill the entire object. `minLength` and `maxLength` restrict the
  // length of the lines so as to not intrude in the empty space for non-convex
  // shapes.
  tessellate(minLength, maxLength) {
    // Square these here to save computation.
    let min = Math.pow(minLength, 2),
      max = Math.pow(maxLength, 2);

    // Convert the point array to an array of arrays first.
    let vertices = Delaunay.triangulate(this.points.map(p => [p.x, p.y]));
    let triangles = [];
    for (let i = 0; i < vertices.length; i += 3) {
      let p1 = this.points[vertices[i]],
        p2 = this.points[vertices[i + 1]],
        p3 = this.points[vertices[i + 2]];
      triangles.push({
        p1: p1,
        p2: p2,
        p3: p3
      });
    }

    // Turn the triangles into a list of lines.
    let lines = triangles
      .map(t => {
        let d1 = this.qdist(t.p1, t.p2),
          d2 = this.qdist(t.p1, t.p3),
          d3 = this.qdist(t.p2, t.p3);
        let res = [];
        if (d1 > min && d1 < max)
          res.push({
            p1: t.p1,
            p2: t.p2
          });
        if (d2 > min && d2 < max)
          res.push({
            p1: t.p1,
            p2: t.p3
          });
        if (d3 > min && d3 < max)
          res.push({
            p1: t.p2,
            p2: t.p3
          });
        return res;
      })
      .reduce((prev, cur) => prev.concat(cur));

    return lines;
  }


  // Fills the internal list of points with more points by tessellating the
  // existing points, finding the halfway mark on each edge then cleaning them
  // up again to prevent overlaps.
  fillWithPoints(minThreshold, maxThreshold) {
    let lines = this.tessellate(minThreshold, maxThreshold)
      .map(l => {
        return {
          x: l.p1.x + (l.p2.x - l.p1.x) / 2,
          y: l.p1.y + (l.p2.y - l.p1.y) / 2
        };
      });

    this.points = this.points.concat(lines);
    this.points = this.clean(this.points);

    return this;
  }


  // Generates an array of points for the provided SVG commands.
  generate(commands) {
    this.points = [];
    let cur = commands[0];
    for (let cmd of commands) {
      let pts = [];

      switch (cmd.code) {

        case 'M': // Do nothing as we update the cur later.
          break;

        case 'L': // Line
          pts = this.line(cur, cmd);
          break;

        case 'V': // Vertical Line
          pts = this.line(cur, {
            x: cur.x,
            y: cmd.y
          });
          break;

        case 'H': // Horizontal Line
          pts = this.line(cur, {
            x: cmd.x,
            y: cur.y
          });
          break;

        case 'A': // Elliptical Arc
          pts = this.arc(cur, cmd, cmd.rads, cmd.rot, cmd.lrg, cmd.swp);
          break;

        case 'C': // Cubic Bezier Curve
          pts = this.curve(cur, cmd, cmd.cp1, cmd.cp2);
          break;

        default:
          console.log(`Unsupported SVG command ${cmd.code}`);
          break;
      }

      this.points = this.points.concat(pts);
      cur = cmd;
    }

    // Clean up overlapping points.
    this.points = this.clean(this.points);

    // Re-center it
    this.recenter();

    return this;
  }
}

export default PointGenerator;
