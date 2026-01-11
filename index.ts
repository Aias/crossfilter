// Note(cg): exporting current version for umd build.
import crossfilter from './src/index.js';
import pkg from './package.json';

crossfilter.version = pkg.version;

export default crossfilter;
