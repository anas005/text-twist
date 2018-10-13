/* eslint-disable no-param-reassign */

/**
 * Find all the subsets of a given array
 * Refer: https://stackoverflow.com/a/5752056/5193103
 * @param a The array
 * @param min The minumum length of each subset
 * @returns All the possible subsets
 */
const subsets = (a, min) => {
  const fn = (n, src, got, all) => {
    if (n === 0) {
      if (got.length > 0) {
        all[all.length] = got.join('');
      }
      return;
    }
    for (let j = 0; j < src.length; j += 1) {
      fn(n - 1, src.slice(j + 1), got.concat([src[j]]), all);
    }
  };
  const all = [];
  for (let i = min; i < a.length; i += 1) {
    fn(i, a, [], all);
  }
  all.push(a.join(''));
  return all;
};

module.exports = subsets;
