// suggests what someone may have meant when they typed something that isn't one of the choices: the closest choice, if it's close enough to be a likely typo, or undefined
//
// closeness is the Levenshtein distance (how many single character insertions, deletions, or substitutions it takes to turn one into the other), ignoring case; a choice is close enough if it's at most a third of the typed length away, or 2 for short words
function didYouMean (typed, choices) {
  let closest
  let closestDistance = Math.max(2, Math.floor(typed.length / 3)) + 1
  for (const choice of choices) {
    const distance = levenshtein(typed.toLowerCase(), choice.toLowerCase())
    if (distance < closestDistance) {
      closest = choice
      closestDistance = distance
    }
  }
  return closest
}

// the Levenshtein distance between two strings, worked out a row at a time: row[j] is the distance between the part of `a` done so far and the first j characters of `b`
function levenshtein (a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const nextRow = [i]
    for (let j = 1; j <= b.length; j++) {
      nextRow[j] = Math.min(row[j] + 1, nextRow[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    row = nextRow
  }
  return row[b.length]
}

module.exports = didYouMean
module.exports.levenshtein = levenshtein
