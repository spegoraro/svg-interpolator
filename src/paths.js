/*
 * SVG Interpolator
 * Takes an SVG as input and generates an array of evently spaced points marking
 * the boundary and fill of the paths.
 * 
 * Copyright (C) 2016 Tutive Ltd.
 *
 * Curve tools
 */



function distance(p0, p1) {
  return Math.sqrt(Math.pow(p1.x - p0.x, 2) + Math.pow(p1.y - p0.y, 2));
}

function mod(x, m) {
  return (x % m + m) % m;
}

function toRadians(angle) {
  return angle * (Math.PI / 180);
}

function angleBetween(v0, v1) {
  var p = v0.x * v1.x + v0.y * v1.y;
  var n = Math.sqrt((Math.pow(v0.x, 2) + Math.pow(v0.y, 2)) * (Math.pow(v1.x, 2) + Math.pow(v1.y, 2)));
  var sign = v0.x * v1.y - v0.y * v1.x < 0 ? -1 : 1;
  var angle = sign * Math.acos(p / n);

  return angle;
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function pointOnLine(p0, p1, t) {
  function calculateLineParameter(x0, x1, t) {
    var result = x0 + (x1 - x0) * t;

    return result;
  }

  return {
    x: calculateLineParameter(p0.x, p1.x, t),
    y: calculateLineParameter(p0.y, p1.y, t)
  };
}

function pointOnQuadraticBezier(p0, p1, p2, t) {
  function calculateQuadraticBezierParameter(x0, x1, x2, t) {
    var result = Math.pow(1 - t, 2) * x0 + 2 * t * (1 - t) * x1 + Math.pow(t, 2) * x2;

    return result;
  }

  return {
    x: calculateQuadraticBezierParameter(p0.x, p1.x, p2.x, t),
    y: calculateQuadraticBezierParameter(p0.y, p1.y, p2.y, t)
  };
}


function pointOnCubicBezierCurve(p0, p1, p2, p3, t) {
  function calculateCubicBezierParameter(x0, x1, x2, x3, t) {
    var result = Math.pow(1 - t, 3) * x0 + 3 * t * Math.pow(1 - t, 2) * x1 + 3 * (1 - t) * Math.pow(t, 2) * x2 + Math.pow(t, 3) * x3;

    return result;
  }

  return {
    x: calculateCubicBezierParameter(p0.x, p1.x, p2.x, p3.x, t),
    y: calculateCubicBezierParameter(p0.y, p1.y, p2.y, p3.y, t)
  };
}

// http://www.w3.org/TR/SVG/implnote.html#ArcSyntax
// To double check our implementation against another source, you can use: 
//      https://java.net/projects/svgsalamander/sources/svn/content/trunk/svg-core/src/main/java/com/kitfox/svg/pathcmd/Arc.java
//      http://fridrich.blogspot.com/2011/06/bounding-box-of-svg-elliptical-arc.html
// t: [0, 1]
function pointOnArc(p0, rx, ry, xAxisRotation, largeArcFlag, sweepFlag, p1, t) {

  // In accordance to: http://www.w3.org/TR/SVG/implnote.html#ArcOutOfRangeParameters
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  xAxisRotation = mod(xAxisRotation, 360);
  var xAxisRotationRadians = toRadians(xAxisRotation);
  // If the endpoints are identical, then this is equivalent to omitting the elliptical arc segment entirely.
  if (p0.x === p1.x && p0.y === p1.y) {
    return p0;
  }

  // If rx = 0 or ry = 0 then this arc is treated as a straight line segment joining the endpoints.    
  if (rx === 0 || ry === 0) {
    return pointOnLine(p0, p1, t);
  }


  // Following "Conversion from endpoint to center parameterization"
  // http://www.w3.org/TR/SVG/implnote.html#ArcConversionEndpointToCenter

  // Step #1: Compute transformedPoint
  var dx = (p0.x - p1.x) / 2;
  var dy = (p0.y - p1.y) / 2;
  var transformedPoint = {
    x: Math.cos(xAxisRotationRadians) * dx + Math.sin(xAxisRotationRadians) * dy,
    y: -Math.sin(xAxisRotationRadians) * dx + Math.cos(xAxisRotationRadians) * dy
  };
  // Ensure radii are large enough
  var radiiCheck = Math.pow(transformedPoint.x, 2) / Math.pow(rx, 2) + Math.pow(transformedPoint.y, 2) / Math.pow(ry, 2);
  if (radiiCheck > 1) {
    rx = Math.sqrt(radiiCheck) * rx;
    ry = Math.sqrt(radiiCheck) * ry;
  }

  // Step #2: Compute transformedCenter
  var cSquareNumerator = Math.pow(rx, 2) * Math.pow(ry, 2) - Math.pow(rx, 2) * Math.pow(transformedPoint.y, 2) - Math.pow(ry, 2) * Math.pow(transformedPoint.x, 2);
  var cSquareRootDenom = Math.pow(rx, 2) * Math.pow(transformedPoint.y, 2) + Math.pow(ry, 2) * Math.pow(transformedPoint.x, 2);
  var cRadicand = cSquareNumerator / cSquareRootDenom;
  // Make sure this never drops below zero because of precision
  cRadicand = cRadicand < 0 ? 0 : cRadicand;
  var cCoef = (largeArcFlag !== sweepFlag ? 1 : -1) * Math.sqrt(cRadicand);
  var transformedCenter = {
    x: cCoef * ((rx * transformedPoint.y) / ry),
    y: cCoef * (-(ry * transformedPoint.x) / rx)
  };

  // Step #3: Compute center
  var center = {
    x: Math.cos(xAxisRotationRadians) * transformedCenter.x - Math.sin(xAxisRotationRadians) * transformedCenter.y + ((p0.x + p1.x) / 2),
    y: Math.sin(xAxisRotationRadians) * transformedCenter.x + Math.cos(xAxisRotationRadians) * transformedCenter.y + ((p0.y + p1.y) / 2)
  };


  // Step #4: Compute start/sweep angles
  // Start angle of the elliptical arc prior to the stretch and rotate operations.
  // Difference between the start and end angles
  var startVector = {
    x: (transformedPoint.x - transformedCenter.x) / rx,
    y: (transformedPoint.y - transformedCenter.y) / ry
  };
  var startAngle = angleBetween({
    x: 1,
    y: 0
  }, startVector);

  var endVector = {
    x: (-transformedPoint.x - transformedCenter.x) / rx,
    y: (-transformedPoint.y - transformedCenter.y) / ry
  };
  var sweepAngle = angleBetween(startVector, endVector);

  if (!sweepFlag && sweepAngle > 0) {
    sweepAngle -= 2 * Math.PI;
  } else if (sweepFlag && sweepAngle < 0) {
    sweepAngle += 2 * Math.PI;
  }
  // We use % instead of `mod(..)` because we want it to be -360deg to 360deg(but actually in radians)
  sweepAngle %= 2 * Math.PI;

  // From http://www.w3.org/TR/SVG/implnote.html#ArcParameterizationAlternatives
  var angle = startAngle + (sweepAngle * t);
  var ellipseComponentX = rx * Math.cos(angle);
  var ellipseComponentY = ry * Math.sin(angle);

  var point = {
    x: Math.cos(xAxisRotationRadians) * ellipseComponentX - Math.sin(xAxisRotationRadians) * ellipseComponentY + center.x,
    y: Math.sin(xAxisRotationRadians) * ellipseComponentX + Math.cos(xAxisRotationRadians) * ellipseComponentY + center.y
  };

  // Attach some extra info to use
  point.ellipticalArcStartAngle = startAngle;
  point.ellipticalArcEndAngle = startAngle + sweepAngle;
  point.ellipticalArcAngle = angle;

  point.ellipticalArcCenter = center;
  point.resultantRx = rx;
  point.resultantRy = ry;



  return point;
}

function approximateArcLengthOfCurve(resolution, pointOnCurveFunc) {
  // Resolution is the number of segments we use
  resolution = resolution ? resolution : 500;

  var resultantArcLength = 0;
  var arcLengthMap = [];
  var approximationLines = [];

  var prevPoint = pointOnCurveFunc(0);
  var nextPoint;
  for (var i = 0; i < resolution; i++) {
    var t = clamp(i * (1 / resolution), 0, 1);
    nextPoint = pointOnCurveFunc(t);
    resultantArcLength += distance(prevPoint, nextPoint);
    approximationLines.push([prevPoint, nextPoint]);

    arcLengthMap.push({
      t: t,
      arcLength: resultantArcLength
    });

    prevPoint = nextPoint;
  }
  // Last stretch to the endpoint
  nextPoint = pointOnCurveFunc(1);
  approximationLines.push([prevPoint, nextPoint]);
  resultantArcLength += distance(prevPoint, nextPoint);
  arcLengthMap.push({
    t: 1,
    arcLength: resultantArcLength
  });

  return {
    arcLength: resultantArcLength,
    arcLengthMap: arcLengthMap,
    approximationLines: approximationLines
  };
}

function generateLinearCurve(resolution, pointOnCurveFunc) {
  // Resolution is the number of segments we use to approximate
  resolution = resolution ? resolution : 500;

  var result = approximateArcLengthOfCurve(resolution, pointOnCurveFunc);
  var arcLength = result.arcLength;
  var arcLengthMap = result.arcLengthMap;

  // Transforms `u`[0-1] into a corresponding point along the curve. `u * arcLength`
  var transformer = function(u) {
    u = clamp(u, 0, 1);
    var targetDistanceFromStartingPoint = u * arcLength;

    var resultantT = 0;

    var prevArcLength = 0;
    var prevT = 0;
    arcLengthMap.every(function(entry) {
      var t = entry.t;
      var arcLength = entry.arcLength;

      // Once we go a past our target
      // Lets interpolate from a previous to current
      if (arcLength >= targetDistanceFromStartingPoint) {
        var endDiff = arcLength - targetDistanceFromStartingPoint;
        var startDiff = targetDistanceFromStartingPoint - prevArcLength;
        var linearFactor = (startDiff / (endDiff + startDiff)) || 0;

        resultantT = prevT + (t - prevT) * linearFactor;

        // Break
        return false;
      }


      prevArcLength = arcLength;
      prevT = t;

      return true;
    });

    return pointOnCurveFunc(resultantT);
  };

  transformer.arcLength = arcLength;

  return transformer;
}


// Returns the number of steps for a given segment length on a curve.
function nsteps(curveFn, res, len) {
  let arcLength = approximateArcLengthOfCurve(res, curveFn).arcLength;
  return Math.floor(arcLength / len);
}


// Returns `steps` points calculated from `pointFn`.
// `pointFn` is expected to take a value `t`.
function getPoints(pointFn, steps) {
  let pts = [];
  for (let i = 0, t = 1 / steps; i <= 1; i += t)
    pts.push(pointFn(i));
  return pts;
}


// Generates a bezier curve from `start` to `end` with the control points `cp1`
// and `cp2` then interpolates that curve with a resolution of `res`. This means
// that the curve will have its value calculated for `res` steps (of t).
// The curve is then interpolated for `len` segments with the point for 
// each segment returned. 
export function pointsForBezier(start, cp1, cp2, end, res, len) {
  let curveFn = pointOnCubicBezierCurve.bind(this, start, cp1, cp2, end),
    stepFn = generateLinearCurve(res, curveFn),
    steps = nsteps(curveFn, res, len);

  return getPoints(stepFn, steps);
}


// Returns an array of points sitting on the arc from `start` to `end` with 
// radii in `rads.x/y`. Specify other SVG arc flags in `rot`, `lrg` and 
// `swp`. Set the computation resolution in `res` and the desired length of
// segments in `len`. The points returned will be no closer than 
// `len` from eachother.
export function pointsForArc(start, rads, rot, lrg, swp, end, res, len) {
  let arcFn = pointOnArc.bind(this, start, rads.x, rads.y, rot, lrg, swp, end),
    stepFn = generateLinearCurve(res, arcFn),
    steps = nsteps(arcFn, res, len);

  return getPoints(stepFn, steps);
}


// Generates a straight line from `start` to `end` and calculates the positions
// of a number of `len` spaced points along the line.
export function pointsForLine(start, end, len) {
  let lineFn = pointOnLine.bind(this, start, end),
    length = distance(start, end),
    steps = Math.floor(length / len);

  return getPoints(lineFn, steps);
}


