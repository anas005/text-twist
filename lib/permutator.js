"use strict"
const permutator = (inputArr) => {
    let result = [];
    const permute = (arr, m) => {
        m = m || [];
        if (arr.length === 0) {
            result.push(m)
        } else {
            for (let i = 0; i < arr.length; i++) {
                let curr = arr.slice();
                let next = curr.splice(i, 1);
                permute(curr.slice(), m.concat(next))
            }
        }
    }

    permute(inputArr)

    return result;
}

exports.permutator = permutator;