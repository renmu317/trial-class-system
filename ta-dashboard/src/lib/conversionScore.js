// 计算 Conversion Score (0-1 范围)
export function calculateConversionScore(scores, weights = {
  ownership: 1.0,
  persistence: 1.0,
  curiosity: 1.0,
  expression: 1.0,
  parent_signal: 1.0
}) {
  const dims = ['ownership', 'persistence', 'curiosity', 'expression', 'parent_signal']

  // 统计有效评分数量
  const validDims = dims.filter(d => scores[d] !== null && scores[d] !== undefined)
  if (validDims.length === 0) return null // 全部未评分

  const totalWeight = validDims.reduce((sum, d) => sum + weights[d], 0)
  const weightedSum = validDims.reduce((sum, d) => sum + scores[d] * weights[d], 0)

  return (weightedSum / totalWeight / 10).toFixed(2)
}

// 平均两个 TA 评分（区分未评分和评5分）
export function averageScores(ta1Scores, ta2Scores) {
  const dims = ['ownership', 'persistence', 'curiosity', 'expression', 'parent_signal']
  const result = {}

  dims.forEach(d => {
    const v1 = ta1Scores?.[d]
    const v2 = ta2Scores?.[d]

    const validScores = [v1, v2].filter(v => v !== null && v !== undefined)
    if (validScores.length === 0) {
      result[d] = null // 都未评分
    } else {
      result[d] = Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
    }
  })

  return result
}
