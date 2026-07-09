import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Panels are stills — jpeg quality 90 keeps line art crisp without huge files.
Config.setJpegQuality(90);
