exports.sleep = (ms) => {
  console.log(`Waiting ${ms}ms`);

  // eslint-disable-next-line no-undef
  return new Promise((resolve) => setTimeout(resolve, ms));
};
