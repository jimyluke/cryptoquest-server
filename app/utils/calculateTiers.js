exports.calculateCosmeticTier = (cosmeticPoints) => {
  if (cosmeticPoints >= 590) {
    return 'Platinum';
  } else if (cosmeticPoints >= 480 && cosmeticPoints <= 580) {
    return 'Gold';
  } else if (cosmeticPoints >= 290 && cosmeticPoints <= 470) {
    return 'Silver';
  } else if (cosmeticPoints >= 20 && cosmeticPoints <= 280) {
    return 'Bronze';
  }
};

exports.calculateStatTier = (statPoints, tome) => {
  if (tome === 'Woodland Respite') {
    if (statPoints >= 121) {
      return 'Platinum';
    } else if (statPoints >= 111 && statPoints < 121) {
      return 'Gold';
    } else if (statPoints >= 95 && statPoints < 111) {
      return 'Silver';
    } else if (statPoints >= 75 && statPoints < 95) {
      return 'Bronze';
    }
  } else if (tome === 'Dawn of Man') {
    if (statPoints >= 124) {
      return 'Platinum';
    } else if (statPoints >= 114 && statPoints < 124) {
      return 'Gold';
    } else if (statPoints >= 98 && statPoints < 114) {
      return 'Silver';
    } else if (statPoints >= 78 && statPoints < 98) {
      return 'Bronze';
    }
  }
};
