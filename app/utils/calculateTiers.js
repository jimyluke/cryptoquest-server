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

exports.calculateStatTier = (statPoints) => {
  if (statPoints >= 118) {
    return 'Platinum';
  } else if (statPoints >= 108 && statPoints < 118) {
    return 'Gold';
  } else if (statPoints >= 92 && statPoints < 108) {
    return 'Silver';
  } else if (statPoints >= 72 && statPoints < 92) {
    return 'Bronze';
  }
};

exports.calculateHeroTier = (statPoints, cosmeticPoints) => {
  const heroTierPointsSP = (statPoints - 72) * 3 * 1.3;
  const heroTierPointsCP = ((cosmeticPoints - 20) / 5) * 0.7;
  const totalPoints = +(heroTierPointsSP + heroTierPointsCP).toFixed(1);

  if (totalPoints >= 236) {
    return 'Mythic';
  } else if (totalPoints >= 205 && totalPoints < 236) {
    return 'Legendary';
  } else if (totalPoints >= 172 && totalPoints < 205) {
    return 'Epic';
  } else if (totalPoints >= 133 && totalPoints < 172) {
    return 'Rare';
  } else if (totalPoints >= 90 && totalPoints < 133) {
    return 'Uncommon';
  } else {
    return 'Common';
  }
};
