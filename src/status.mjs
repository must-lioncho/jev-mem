// One visible line per turn, like jev-router's "[Jev] routed this turn ..." notice.
export function statusLine(decision) {
  const tag = "[jev-mem]";
  if (decision.error) return `${tag} 관련 기록 검색 실패, 아무것도 불러오지 않음 (${decision.error}).`;
  if (decision.skipped) return `${tag} 검색 건너뜀 (${decision.skipped}).`;
  const found = decision.candidates.length;
  const picked = decision.candidates.filter((c) => decision.injected.includes(c.id));
  if (!found) return `${tag} 관련 기록을 찾았지만 없었습니다 (${decision.ms} ms).`;
  if (!picked.length) return `${tag} 관련 기록 ${found}개 찾음, 따로 불러올 것은 없었습니다 (${decision.ms} ms).`;
  const best = picked.map((c) => `#${c.id} p=${c.p?.toFixed(2)}`).join(", ");
  return `${tag} 관련 기록 ${found}개 중 가장 높은 ${picked.length}개를 불러옵니다 (${best}, ${decision.ms} ms).`;
}
