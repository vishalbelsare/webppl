'use strict';

var path = require('path');
var fs = require('fs');
var _ = require('underscore');

var isJsModule = function(path) {
  try {
    require.resolve(path);
    return true;
  } catch (e) {
    return false;
  }
};

var globalPkgDir = function() {
  // USERPROFILE is intended to support Windows. This is un-tested.
  var home = process.env.HOME || process.env.USERPROFILE;
  return home ? path.join(home, '.webppl') : '';
};

var isPath = function(s) {
  // This isn't expected to classify any valid NPM package names as paths.
  // https://github.com/npm/validate-npm-package-name
  return s.indexOf(path.sep) >= 0 || s.substr(0, 1) === '.';
};

var read = function(name_or_path, paths, verbose) {
  var paths = paths || [globalPkgDir()];
  var name = path.basename(name_or_path);
  var log = verbose ? function(x) { console.warn(x); return x; } : _.identity;

  var readFirst = function(candidates) {
    if (candidates.length > 0) {
      var candidate = path.resolve(candidates[0]);
      if (fs.existsSync(candidate)) {
        log('Loading module "' + name + '" from "' + candidate + '"');
        var manifest = require(path.join(candidate, 'package.json')).webppl || {};
        var joinPath = function(fn) { return path.join(candidate, fn); };
        return {
          name: name,
          js: isJsModule(candidate) && { identifier: name.replace(/-/g, '_'), path: candidate },
          headers: _.map(manifest.headers, joinPath),
          wppl: _.map(manifest.wppl, joinPath)
        };
      } else {
        return readFirst(candidates.slice(1));
      }
    } else {
      log(allCandidates);
      throw 'Could not find WebPPL package: ' + name;
    }
  };

  var joinName = function(p) { return path.join(p, name_or_path); };
  var allCandidates = isPath(name_or_path) ? [name_or_path] : paths.map(joinName);

  return log(readFirst(allCandidates))
};

var wrapWithQuotes = function(s) { return '"' + s + '"'; };
var wrapWithRequire = function(s) { return 'require("' + s + '")'; };
var wrapWithReadFile = function(s) { return 'fs.readFileSync("' + s + '", "utf8")'; };

var wrappers = {
  identifier: wrapWithQuotes,
  name: wrapWithQuotes,
  headers: wrapWithRequire,
  path: wrapWithRequire,
  wppl: wrapWithReadFile
};

// Recursively transform a package (as returned by read) into an expression
// which can be transformed by the browserify plugin.

var stringify = function(obj, lastSeenKey) {
  if (_.isArray(obj)) {
    return '[' + obj.map(function(x) { return stringify(x, lastSeenKey); }).join(', ') + ']';
  } else if (_.isObject(obj)) {
    var s = _.map(obj, function(value, key) {
      return key + ': ' + stringify(value, key) + '';
    }).join(', ');
    return '{ ' + s + ' }';
  } else if (_.isString(obj)) {
    return wrappers[lastSeenKey](obj);
  }
}

module.exports = {
  read: read,
  stringify: stringify,
  globalPkgDir: globalPkgDir
};
