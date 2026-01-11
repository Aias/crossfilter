// Note(cg): exporting current version for umd build.
import crossfilter from "./src/index";
import pkg from "./package.json";

export const version = pkg.version;
crossfilter.version = version;

export default crossfilter;
