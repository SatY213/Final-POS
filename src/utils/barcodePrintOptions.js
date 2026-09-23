import { getBarcodeLabelDimensions } from "./barcodeLabelTemplate.js";

export function buildBarcodePrintOptions(profile = {}, silent = false) {
  const dimensions = getBarcodeLabelDimensions(profile);
  return {
    silent,
    deviceName: profile.system_name || undefined,
    copies: Number(profile.copies || 1),
    printBackground: true,
    margins: { marginType: "none" },
    pageSize: {
      width: Math.round(dimensions.width * 1000),
      height: Math.round(dimensions.height * 1000),
    },
    landscape: false,
    scaleFactor: 100,
  };
}

export function comparablePrintLayout(options) {
  const { silent: _silent, ...layout } = options;
  return layout;
}
