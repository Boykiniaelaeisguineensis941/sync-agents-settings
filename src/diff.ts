export interface NameSetDiff {
  shared: string[];
  onlyInSource: string[];
  onlyInTarget: string[];
}

export function compareNameSets(source: Set<string>, target: Set<string>): NameSetDiff {
  const shared = [...source].filter((name) => target.has(name)).sort();
  const onlyInSource = [...source].filter((name) => !target.has(name)).sort();
  const onlyInTarget = [...target].filter((name) => !source.has(name)).sort();
  return { shared, onlyInSource, onlyInTarget };
}
